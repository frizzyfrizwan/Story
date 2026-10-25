import type { AppointmentSuggestion } from '@/types'

/** Typical prenatal care timeline. Providers vary; use as a planning aid. */
export const APPOINTMENT_SUGGESTIONS: AppointmentSuggestion[] = [
  {
    id: 'first-visit',
    title: 'First prenatal visit',
    fromWeek: 6,
    toWeek: 10,
    description: 'Medical history, blood work, urine test, and often a dating ultrasound.',
  },
  {
    id: 'nipt',
    title: 'NIPT / first-trimester screening',
    fromWeek: 10,
    toWeek: 13,
    description: 'Optional blood screening for chromosomal conditions; discuss with your provider.',
  },
  {
    id: 'nt-scan',
    title: 'Nuchal translucency scan',
    fromWeek: 11,
    toWeek: 13,
    description: 'Ultrasound measuring fluid at the back of the baby’s neck, usually paired with blood tests.',
  },
  { id: 'visit-16', title: 'Routine check-up', fromWeek: 15, toWeek: 17, description: 'Blood pressure, weight, urine and listening to the heartbeat.' },
  {
    id: 'anatomy-scan',
    title: 'Anatomy scan',
    fromWeek: 18,
    toWeek: 22,
    description: 'Detailed ultrasound of organs, limbs, placenta and fluid. You can usually learn the sex if you wish.',
  },
  { id: 'visit-24', title: 'Routine check-up', fromWeek: 23, toWeek: 25, description: 'Fundal height, heartbeat and symptom review.' },
  {
    id: 'glucose',
    title: 'Glucose screening',
    fromWeek: 24,
    toWeek: 28,
    description: 'Screens for gestational diabetes; you may be asked to fast or drink a glucose solution.',
  },
  {
    id: 'tdap',
    title: 'Tdap vaccine & Rh screen',
    fromWeek: 27,
    toWeek: 36,
    description: 'Whooping-cough protection for baby; Rh-negative parents are offered anti-D.',
  },
  { id: 'visit-30', title: 'Check-up (every 2 weeks begins)', fromWeek: 29, toWeek: 31, description: 'Visits usually move to every two weeks from 28 weeks.' },
  { id: 'visit-32', title: 'Growth check', fromWeek: 32, toWeek: 34, description: 'Some providers scan growth and position here.' },
  { id: 'gbs', title: 'Group B strep swab', fromWeek: 36, toWeek: 37, description: 'Simple swab; a positive result means antibiotics during labour.' },
  {
    id: 'position',
    title: 'Position check & birth plan review',
    fromWeek: 36,
    toWeek: 38,
    description: 'Confirm baby is head-down and talk through your preferences for labour.',
  },
  { id: 'weekly', title: 'Weekly visits', fromWeek: 37, toWeek: 41, description: 'From 36–37 weeks visits become weekly until birth.' },
  {
    id: 'post-dates',
    title: 'Post-dates monitoring',
    fromWeek: 40,
    toWeek: 42,
    description: 'Non-stress test or fluid check may be offered; induction is discussed around 41 weeks.',
  },
]
