"""
Trains a lightweight fruit-ripeness CNN from scratch and exports
FruitRipenessModel.mlpackage for the iOS app.

No internet required — builds the model entirely from our 40k training images.

Architecture: MobileNet-style depthwise separable CNN
  Input  : 128×128 (fast on CPU; AdaptiveAvgPool makes inference work at 224×224)
  Output : 31 fruit-ripeness classes

Expected runtime: ~25–40 min on CPU.
"""

import os, sys, json, time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
import coremltools as ct

# ── Config ────────────────────────────────────────────────────────────────────

DATA_DIR   = "/home/user/Story/TrainingData"
OUTPUT_DIR = "/home/user/Story/FruitRipeness/FruitRipeness"
MODEL_PATH = os.path.join(OUTPUT_DIR, "FruitRipenessModel.mlpackage")
IMG_SIZE   = 128          # train at 128; CoreML export uses 224
BATCH         = 64
VAL_SPLIT     = 0.15
EPOCHS        = 20
LR            = 3e-3
MAX_PER_CLASS = 250   # cap each class so total ~7k imgs → ~1 min/epoch
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"

print(f"\n🍎 FruitRipeness Trainer (from scratch, no internet needed)")
print(f"   Device : {DEVICE}  |  img {IMG_SIZE}×{IMG_SIZE}  |  {EPOCHS} epochs\n")

# ── Data ──────────────────────────────────────────────────────────────────────

train_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE + 20, IMG_SIZE + 20)),
    transforms.RandomCrop(IMG_SIZE),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(p=0.1),
    transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.4, hue=0.06),
    transforms.RandomRotation(20),
    transforms.RandomGrayscale(p=0.05),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.1),
])

val_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

full_ds     = datasets.ImageFolder(DATA_DIR, transform=train_tf)
class_names = full_ds.classes
num_classes = len(class_names)

# Balance: cap each class at MAX_PER_CLASS so large classes don't dominate
# and total dataset stays small enough for fast CPU training.
import random
random.seed(42)
by_class = {}
for idx, (_, label) in enumerate(full_ds.samples):
    by_class.setdefault(label, []).append(idx)
balanced_indices = []
for label, idxs in by_class.items():
    balanced_indices.extend(random.sample(idxs, min(len(idxs), MAX_PER_CLASS)))
random.shuffle(balanced_indices)

from torch.utils.data import Subset
balanced_ds = Subset(full_ds, balanced_indices)

val_n   = int(len(balanced_ds) * VAL_SPLIT)
train_n = len(balanced_ds) - val_n
train_ds, val_ds = random_split(balanced_ds, [train_n, val_n],
                                 generator=torch.Generator().manual_seed(42))

# Swap val set to non-augmented transform
val_clean = datasets.ImageFolder(DATA_DIR, transform=val_tf)
val_ds.dataset = Subset(val_clean, balanced_indices)

train_loader = DataLoader(train_ds, batch_size=BATCH, shuffle=True,
                          num_workers=4, pin_memory=True)
val_loader   = DataLoader(val_ds,   batch_size=BATCH, shuffle=False,
                          num_workers=4, pin_memory=True)

print(f"   Classes : {num_classes}  |  Train : {train_n}  |  Val : {val_n}")
for c in class_names:
    n = sum(1 for _, l in full_ds.samples if l == full_ds.class_to_idx[c])
    print(f"             {n:>5}  {c}")

# ── Model ─────────────────────────────────────────────────────────────────────

def dw_sep(in_ch, out_ch, stride=1):
    """Depthwise separable conv block — same spatial resolution unless stride=2."""
    return nn.Sequential(
        # Depthwise
        nn.Conv2d(in_ch, in_ch, 3, stride=stride, padding=1, groups=in_ch, bias=False),
        nn.BatchNorm2d(in_ch),
        nn.ReLU6(inplace=True),
        # Pointwise
        nn.Conv2d(in_ch, out_ch, 1, bias=False),
        nn.BatchNorm2d(out_ch),
        nn.ReLU6(inplace=True),
    )

class FruitNet(nn.Module):
    def __init__(self, num_classes):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(3, 32, 3, stride=2, padding=1, bias=False),  # 128→64
            nn.BatchNorm2d(32),
            nn.ReLU6(inplace=True),
        )
        self.blocks = nn.Sequential(
            dw_sep(32,  64,  stride=1),   # 64×64
            dw_sep(64,  128, stride=2),   # 64→32
            dw_sep(128, 128, stride=1),
            dw_sep(128, 256, stride=2),   # 32→16
            dw_sep(256, 256, stride=1),
            dw_sep(256, 512, stride=2),   # 16→8
            dw_sep(512, 512, stride=1),
            dw_sep(512, 512, stride=1),
            dw_sep(512, 512, stride=1),
            dw_sep(512, 512, stride=1),
            dw_sep(512, 512, stride=1),
            dw_sep(512, 1024, stride=2),  # 8→4
            dw_sep(1024, 1024, stride=1),
        )
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.head = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(1024, num_classes),
        )

    def forward(self, x):
        x = self.stem(x)
        x = self.blocks(x)
        x = self.pool(x).flatten(1)
        return self.head(x)

model     = FruitNet(num_classes).to(DEVICE)
params    = sum(p.numel() for p in model.parameters()) / 1e6
print(f"\n   Model params : {params:.1f}M\n")

# ── Training ──────────────────────────────────────────────────────────────────

criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
scheduler = optim.lr_scheduler.OneCycleLR(
    optimizer, max_lr=LR,
    steps_per_epoch=len(train_loader), epochs=EPOCHS,
    pct_start=0.2, anneal_strategy='cos',
)

best_acc   = 0.0
best_state = None

def run_epoch(loader, train):
    model.train(train)
    total_loss = correct = total = 0
    with torch.set_grad_enabled(train):
        for imgs, labels in loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            if train:
                optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(out, labels)
            if train:
                loss.backward()
                optimizer.step()
                scheduler.step()
            total_loss += loss.item() * imgs.size(0)
            correct    += (out.argmax(1) == labels).sum().item()
            total      += imgs.size(0)
    return total_loss / total, correct / total

print("=" * 52)
print(f"Training {EPOCHS} epochs")
print("=" * 52)

for epoch in range(1, EPOCHS + 1):
    t = time.time()
    tr_loss, tr_acc = run_epoch(train_loader, train=True)
    va_loss, va_acc = run_epoch(val_loader,   train=False)

    star = " ★" if va_acc > best_acc else ""
    if va_acc > best_acc:
        best_acc   = va_acc
        best_state = {k: v.clone() for k, v in model.state_dict().items()}

    print(f"  Epoch {epoch:>2}/{EPOCHS}  "
          f"train {tr_acc*100:5.1f}%  val {va_acc*100:5.1f}%  "
          f"({time.time()-t:.0f}s){star}")

# ── Export to CoreML ──────────────────────────────────────────────────────────

print(f"\nBest val accuracy : {best_acc*100:.1f}%")
print("Exporting to CoreML…")

model.load_state_dict(best_state)
model.eval().cpu()

# Trace at 224×224 — AdaptiveAvgPool makes this work regardless of train size
example = torch.zeros(1, 3, 224, 224)
traced  = torch.jit.trace(model, example)

coreml = ct.convert(
    traced,
    inputs=[ct.ImageType(
        name="image",
        shape=example.shape,
        scale=1.0 / (0.226 * 255.0),
        bias=[-0.485 / 0.229, -0.456 / 0.224, -0.406 / 0.225],
        color_layout=ct.colorlayout.RGB,
    )],
    outputs=[ct.ClassifierConfig(class_labels=class_names)],
    minimum_deployment_target=ct.target.iOS16,
)

coreml.short_description = "Fruit ripeness classifier — 31 classes"
coreml.author            = "FruitRipeness App"
coreml.version           = "1.0"
coreml.save(MODEL_PATH)

labels_path = os.path.join(OUTPUT_DIR, "FruitRipenessLabels.json")
with open(labels_path, "w") as f:
    json.dump(class_names, f, indent=2)

mb = os.path.getsize(MODEL_PATH) / 1e6 if os.path.isfile(MODEL_PATH) else \
     sum(os.path.getsize(os.path.join(dp,f))
         for dp,_,fs in os.walk(MODEL_PATH) for f in fs) / 1e6

print(f"\n✅  {MODEL_PATH}  ({mb:.1f} MB)")
print(f"    {labels_path}")
print(f"\nDrag FruitRipenessModel.mlpackage into Xcode → FruitRipeness target → build & run.")
