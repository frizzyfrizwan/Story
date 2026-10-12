import type { Nutrient } from '@/types'

export const NUTRIENT_INFO: Record<Nutrient, { label: string; why: string; sources: string }> = {
  folate: { label: 'Folate', why: 'Supports the neural tube as it closes in the first weeks.', sources: 'Leafy greens, lentils, citrus, fortified grains' },
  iron: {
    label: 'Iron',
    why: 'Blood volume rises by up to 50%; iron keeps energy up and prevents anaemia.',
    sources: 'Lean red meat, beans, tofu, spinach, pumpkin seeds',
  },
  calcium: { label: 'Calcium', why: "Builds baby's bones and teeth while protecting yours.", sources: 'Yogurt, cheese, fortified plant milk, almonds, tofu' },
  protein: { label: 'Protein', why: 'The building block for every new cell in baby and placenta.', sources: 'Eggs, fish, poultry, beans, Greek yogurt, nuts' },
  omega3: {
    label: 'Omega-3 (DHA)',
    why: "Fuels baby's brain and eye development, especially in the third trimester.",
    sources: 'Salmon, sardines, chia, walnuts, flax',
  },
  fiber: { label: 'Fibre', why: 'Keeps digestion moving when progesterone slows it down.', sources: 'Oats, berries, beans, whole grains, vegetables' },
  vitaminD: { label: 'Vitamin D', why: 'Helps absorb calcium and supports immune health.', sources: 'Fortified milk, eggs, salmon, sunlight' },
  choline: { label: 'Choline', why: "Works alongside folate for baby's brain and spinal cord.", sources: 'Eggs, chicken, soybeans, broccoli' },
  vitaminC: {
    label: 'Vitamin C',
    why: 'Boosts iron absorption and builds collagen for skin and tissues.',
    sources: 'Citrus, bell peppers, strawberries, kiwi',
  },
  iodine: { label: 'Iodine', why: "Essential for baby's thyroid and brain development.", sources: 'Dairy, eggs, seaweed, iodised salt' },
  magnesium: {
    label: 'Magnesium',
    why: 'May ease leg cramps and supports muscle and nerve function.',
    sources: 'Pumpkin seeds, spinach, black beans, dark chocolate',
  },
  potassium: { label: 'Potassium', why: 'Balances fluids and can reduce swelling and cramps.', sources: 'Bananas, sweet potato, avocado, beans' },
}
