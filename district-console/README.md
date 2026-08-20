# Turnpike District Console

A single-file web application for running the weekly rhythm of Maintenance District
Delivery: the GEC Workload & Commitments Tracker cycle, the contract clock, program
freshness, and the open-actions register.

Built to the district's own standing rules: one self-contained HTML file, no external
dependencies, no IT involvement, FTE navy `#003087` and orange `#F47920` for internal
tools, and the FTE green Transportation Operations palette on the printed document.

## Why this exists — the gap it fills

The weekly cycle already had reminders (scheduled routines) and formats (skills and
operating docs), but no tool. Every Friday the collection status lived in chat; every
weekend the consolidation was rebuilt from scratch; the quality filter (real date,
named requester, director-level content) was applied by hand; the 90-day contract
clock was recomputed in conversation; freshness flags depended on remembering when a
program was last confirmed. This app makes all of that stateful, checked, and one tap
away.

## What it does

- **Weekly Tracker** — collection board for all nine submitting leads with one-tap
  chase notes; entries in the fixed format (name / task one-liner / requested by /
  commitments / due), each linted live: no real date or named blocker, no named
  requester, task-log phrasing, and unlabeled figures are flagged before anything
  travels. Exports: consolidated tracker as text, a printed FTE-green document
  (print → Save as PDF), and the Monday cover note.
- **Contract Clock** — days to end of term per contract, out-of-term first,
  90-day amber / 30-day red. References carried exactly. Dollars never travel
  without a basis (programmed / committed / available / encumbered).
- **Programs** — the eight programs with the four fixed questions and a first-class
  freshness flag: Current (≤5 working days), STALE, or NEVER CONFIRMED. One button
  drafts the district one-pager.
- **Open Actions** — owed by me / owed to me / gone quiet, heat-ordered, with the
  political-read column.

## Rules the app enforces

- A blank prints as "—" (not recorded), never as zero.
- Seeded data starts unconfirmed and says so; nothing unverified reads as current.
- Contract references are never paraphrased.
- Figures carry their basis or get flagged.

## Data

State lives in the page: saved to the browser automatically (localStorage), with
JSON backup/restore buttons. When the page runs as a published Claude artifact, a
"Save to all devices" button publishes the state into the document itself so phone
and laptop see the same data.

## Use

Open `index.html` in any modern browser — double-click works. Or use the published
artifact link for a cross-device copy.
