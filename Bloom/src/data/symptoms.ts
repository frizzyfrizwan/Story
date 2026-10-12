import type { SymptomDef, SymptomId } from '@/types'

export const SYMPTOMS: SymptomDef[] = [
  { id: 'nausea', label: 'Nausea', emoji: '🤢', relief: 'Small frequent meals, ginger, and plain crackers before getting up can help.' },
  { id: 'fatigue', label: 'Fatigue', emoji: '😴', relief: 'Rest when you can, keep iron-rich foods up, and go gentle on yourself.' },
  { id: 'breast-tenderness', label: 'Breast tenderness', emoji: '💗', relief: 'A soft, supportive bra (even at night) and warm showers ease soreness.' },
  { id: 'frequent-urination', label: 'Frequent urination', emoji: '🚻', relief: 'Keep drinking water, but lean forward when you pee to empty fully.' },
  { id: 'food-aversions', label: 'Food aversions', emoji: '🙅', relief: 'Eat what you can tolerate; nutrition evens out over weeks, not days.' },
  { id: 'cravings', label: 'Cravings', emoji: '🍓', relief: 'Honour cravings in moderation and pair sweets with protein.' },
  { id: 'mood-swings', label: 'Mood swings', emoji: '🎭', relief: 'Hormones are real. Sleep, movement and talking it out all help.' },
  { id: 'bloating', label: 'Bloating', emoji: '🎈', relief: 'Smaller meals, slow eating and a walk after dinner reduce gas.' },
  { id: 'constipation', label: 'Constipation', emoji: '🪨', relief: 'Fibre, fluids and daily movement; ask about your iron supplement type.' },
  { id: 'headache', label: 'Headache', emoji: '🤕', relief: 'Hydrate, rest, and check posture. Call your provider if severe or with vision changes.' },
  { id: 'heartburn', label: 'Heartburn', emoji: '🔥', relief: 'Avoid lying down after meals, skip spicy or fatty foods, and prop up your pillows.' },
  { id: 'dizziness', label: 'Dizziness', emoji: '💫', relief: 'Stand up slowly, eat regularly and keep hydrated.' },
  { id: 'back-pain', label: 'Back pain', emoji: '🦴', relief: 'Supportive shoes, a pregnancy pillow and gentle stretches help.' },
  { id: 'round-ligament-pain', label: 'Round ligament pain', emoji: '⚡', relief: 'Change positions slowly; a warm bath can relax the stretching ligaments.' },
  { id: 'leg-cramps', label: 'Leg cramps', emoji: '🦵', relief: 'Stretch calves before bed, stay hydrated and consider magnesium-rich foods.' },
  { id: 'swelling', label: 'Swelling', emoji: '🧦', relief: 'Elevate your feet, avoid standing for long and drink water. Sudden swelling needs a call.' },
  { id: 'insomnia', label: 'Insomnia', emoji: '🌙', relief: 'A consistent wind-down, side sleeping with pillows and limiting late fluids can help.' },
  {
    id: 'shortness-of-breath',
    label: 'Shortness of breath',
    emoji: '🌬️',
    relief: 'Slow down, sit upright and sleep propped up. Sudden breathlessness needs a call.',
  },
  { id: 'braxton-hicks', label: 'Braxton Hicks', emoji: '🌊', relief: 'Change position, hydrate and rest. Regular, strengthening contractions are different.' },
  { id: 'pelvic-pressure', label: 'Pelvic pressure', emoji: '⬇️', relief: 'A support belt, rest and pelvic floor exercises can ease the heaviness.' },
  { id: 'nasal-congestion', label: 'Nasal congestion', emoji: '🤧', relief: 'Saline spray, a humidifier and extra pillows help pregnancy rhinitis.' },
  { id: 'skin-changes', label: 'Skin changes', emoji: '✨', relief: 'Moisturise, use sunscreen and be patient; most changes fade after birth.' },
  { id: 'vivid-dreams', label: 'Vivid dreams', emoji: '💭', relief: 'Totally normal. Journaling before bed can quiet a busy mind.' },
  { id: 'increased-appetite', label: 'Increased appetite', emoji: '🍽️', relief: 'Reach for protein and fibre to stay full longer.' },
  { id: 'carpal-tunnel', label: 'Carpal tunnel', emoji: '✋', relief: 'Wrist splints at night and shaking out your hands can relieve tingling.' },
  { id: 'hip-pain', label: 'Hip pain', emoji: '🧘', relief: 'Sleep with a pillow between your knees and try gentle hip stretches.' },
]

export const SYMPTOM_BY_ID: Record<SymptomId, SymptomDef> = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s])) as Record<SymptomId, SymptomDef>
