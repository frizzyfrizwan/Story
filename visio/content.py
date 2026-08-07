"""Content model for the "Maintenance, end to end" process map.

Everything the diagram says lives here. The layout engine and the two writers
(VSDX and VBA) read from this module, so editing text or reassigning a process
to a different stage is a one-line change here and never touches drawing code.

Stage indexes are 0-based (0 = "Plan & Program" ... 5 = "Report, Pay & Close").
Rows that need two stacked strips of boxes declare ``bands = 2``; a cell is then
addressed as ``(stage, band)``.
"""

TITLE_EYEBROW = "THE PROCESS MAP"
TITLE = "Maintenance, end to end"
SUBTITLE = (
    "Each row is a team. Each column is a lifecycle stage. "
    "Follow any arrow to see where work goes next."
)
FOOTER = (
    "Every box is a process from the Critical Task List; every arrow is a handoff "
    "named in that submission. The two dashed loops are the FARC repair priority "
    "returning to field delivery, and year-end data returning to planning. "
    "Stage detail follows on the next six pages."
)
LOOP_LABEL = (
    "Actuals, performance and condition data feed next year's Bridge Work Plan, "
    "Tour Book and budgets — the cycle repeats"
)

LEGEND = [
    ("arrow", "work moves forward"),
    ("dashed", "work loops back"),
    ("trigger", "trigger from outside the stage"),
    ("process", "process owned by that team"),
]

# --------------------------------------------------------------------------
# Stages (columns)
# --------------------------------------------------------------------------

STAGES = [
    "1  PLAN & PROGRAM",
    "2  FUND & CONTRACT",
    "3  REVIEW & AUTHORIZE",
    "4  DELIVER IN THE FIELD",
    "5  INSPECT, RATE & QA",
    "6  REPORT, PAY & CLOSE",
]

# --------------------------------------------------------------------------
# Trigger strip (what starts the work in each stage)
# --------------------------------------------------------------------------

TRIGGER_ROW_LABEL = "Triggers"
TRIGGER_ROW_SUBLABEL = "What starts the work"

TRIGGERS = [
    "Condition data + annual work program and Tour Book cycle",
    "Contract expiry, renewal or new procurement need",
    "Permit application in OSP · ERC assignment · PTI site request",
    "Storm activation · work order raised · impact or public inquiry",
    "Inspection due · consultant report batch · repair completed",
    "Invoice received · monthly and compliance reporting cycle",
]

# --------------------------------------------------------------------------
# Team rows
#
# cells: {(stage, band): (process text, owner credit)}
# --------------------------------------------------------------------------

ROWS = [
    {
        "key": "program_admin",
        "label": "Program Administration",
        "people": "Catia Guerra Silva",
        "bands": 1,
        "cells": {
            (0, 0): (
                "Build budgets, encumbrance plan, FCO and Tour Book submissions",
                "Catia Guerra Silva",
            ),
            (1, 0): (
                "Scope and manage contract work authorizations",
                "Program Administrator",
            ),
            (3, 0): (
                "EOC coordination and emergency expenditure tracking",
                "Catia Guerra Silva",
            ),
            (5, 0): (
                "Invoices, travel and purchasing · financial and performance reporting",
                "Catia Guerra Silva · Eric Stinson",
            ),
        },
    },
    {
        "key": "contract_dev",
        "label": "Contract Dev & Admin",
        "people": "Trisa Thomas · Alan Chua · Angel Cano · Gina Wilkinson",
        "bands": 1,
        "cells": {
            (1, 0): (
                "Scope and drawings → Specs on the Web → ITB / PO exhibits → "
                "AASHTOWare advertisement → OMS setup",
                "Trisa Thomas · Alan Chua · Gina Wilkinson",
            ),
            (5, 0): (
                "Pay invoices and estimates in AASHTOWare · upload contracts to EDMS",
                "Blanca Soto · Gina Wilkinson",
            ),
        },
    },
    {
        "key": "plans_review",
        "label": "Plans Review",
        "people": "Robert May",
        "bands": 1,
        "cells": {
            (0, 0): (
                "Represent Maintenance in project development · MOAs and MOUs",
                "Robert May · Alex Navarro",
            ),
            (2, 0): (
                "Assign ERC reviews, resolve conflicting comments, issue PTI work "
                "authorizations",
                "Robert May · Alex Navarro · Hans Alce",
            ),
            (3, 0): (
                "Coordinate tower site issues with Zone Managers",
                "Robert May · Hans Alce",
            ),
            (5, 0): (
                "Semi-annual reviewer performance reports · PTI rent update with Finance",
                "Robert May",
            ),
        },
    },
    {
        "key": "permits",
        "label": "Permits",
        "people": "Dan Ekback",
        "bands": 1,
        "cells": {
            (2, 0): (
                "Intake and file → completeness check → discipline and MOT review "
                "→ approve in OSP",
                "Stephanie Shinsbery · Victor Galindez · Dan Ekback",
            ),
            (3, 0): (
                "Pre-work meeting · lane closures in ProjectSolve · active permit "
                "coordination",
                "Victor Galindez · Stephanie Shinsbery",
            ),
            (4, 0): (
                "Field inspection of permit work and MOT field review",
                "Victor Galindez",
            ),
            (5, 0): (
                "Collect COC / UCOC and as-builts → close permit in OSP · zone reports",
                "Stephanie Shinsbery · Dan Ekback",
            ),
        },
    },
    {
        "key": "structures",
        "label": "Structures Maintenance",
        "people": "Aran Lessard",
        "bands": 2,
        "cells": {
            (0, 0): (
                "Bridge Work Plan and Tour Book project requests",
                "Aran Lessard",
            ),
            (0, 1): (
                "QC procedures and structure performance measures",
                "Aran Lessard",
            ),
            (1, 0): (
                "Establish inspection contracts with Finance and PSU",
                "Aran Lessard",
            ),
            (2, 0): (
                "Technical review of design submittals and shop drawings",
                "Aran Lessard (PE)",
            ),
            (2, 1): (
                "Assign structure IDs · OD permit clearance check",
                "Wassim Ashy",
            ),
            (3, 0): (
                "Issue NTP and open items · repair project management",
                "Anne Schmiemann · Omar Porras",
            ),
            (3, 1): (
                "Construction coordination · storm response teams",
                "Giuliana Cox · Structures team",
            ),
            (4, 0): (
                "Inspection schedule → consultant reports reviewed → final approval",
                "Giuliana Cox · Saiada Fancy · Wassim Ashy · Aran Lessard",
            ),
            (4, 1): (
                "Inspection QA, work order QA, warranty → FARC repair priorities",
                "Omar Porras · Aran Lessard (PE)",
            ),
            (5, 0): (
                "Update BWOS · invoice review chain · budget tracker",
                "Stephanie Shinsbery · Dan Ekback",
            ),
            (5, 1): (
                "Monthly, scour and FHWA compliance reports · Power BI dashboard",
                "Wassim Ashy · Saiada Fancy",
            ),
        },
    },
    {
        "key": "environmental",
        "label": "Environmental & Landscape",
        "people": "Guy Murtonen · Briston De Armas",
        "bands": 1,
        "cells": {
            (0, 0): (
                "NPDES program · wildflower plan · roadside vegetation management plan",
                "Guy Murtonen · Briston De Armas",
            ),
            (2, 0): (
                "ERC plan reviews — NPDES and landscape, all zones",
                "Briston De Armas · Victor Borges · Guy Murtonen",
            ),
            (3, 0): (
                "Routine, periodic and performance-based landscape contracts · CEI services",
                "Victor Borges · Guy Murtonen",
            ),
            (4, 0): (
                "Herbicide log QA and chemical application tracking, all zones",
                "Victor Borges",
            ),
            (5, 0): (
                "Update Roadway Maintenance environmental SharePoint section",
                "Briston De Armas",
            ),
        },
    },
    {
        "key": "mrp_rci",
        "label": "MRP/RCI · Traffic Ops · Telecom",
        "people": "Bryan Herrera · Jim Hilbert · Eric Stinson · Ken LeBlanc",
        "bands": 1,
        "cells": {
            (0, 0): (
                "ITS work program and PTI ten-year budget planning",
                "Eric Stinson",
            ),
            (1, 0): (
                "IM contracts (Road Ranger, RISC, STARR) · MFMP procurement · "
                "staff augmentation",
                "Jim Hilbert · Eric Stinson",
            ),
            (3, 0): (
                "Telecom servers and network, moves/adds/changes, on-call rotation",
                "Ken LeBlanc · Mark Cassie",
            ),
            (4, 0): (
                "MRP inspections and RCI collection · tower checklists · "
                "vendor evaluations",
                "Bryan Herrera · Jim Hilbert · Telecom team",
            ),
            (5, 0): (
                "Vendor payments · IM annual reports · ITS inventory and audit",
                "Jim Hilbert · Eric Stinson",
            ),
        },
    },
]

ENABLING_LABEL = "Enabling services"
ENABLING_LEAD = "Runs underneath every stage:"
ENABLING_ITEMS = [
    "GIS applications, field data collection and emergency mapping (Matthew Kurry)",
    "Work order desk intake, contractor onboarding and access (Nancy Booth)",
    "OMS entry, program coordination, SharePoint and training logistics (Marina Soeiro)",
]

# --------------------------------------------------------------------------
# Handoffs
#
# Each entry is a chain of cells the work flows through, left to right, within
# one row. The layout engine turns consecutive pairs into forward arrows.
# --------------------------------------------------------------------------

FLOWS = [
    ("program_admin", 0, [0, 1, 3, 5]),
    ("contract_dev", 0, [1, 5]),
    ("plans_review", 0, [0, 2, 3, 5]),
    ("permits", 0, [2, 3, 4, 5]),
    ("structures", 0, [0, 1, 2, 3, 4, 5]),
    ("structures", 1, [0, 2, 3, 4, 5]),
    ("environmental", 0, [0, 2, 3, 4, 5]),
    ("mrp_rci", 0, [0, 1, 3, 4, 5]),
]

# Handoffs that cross from one team's row to another's.
# (from_row, from_stage, from_band, to_row, to_stage, to_band)
CROSS_FLOWS = [
    ("program_admin", 0, 0, "contract_dev", 1, 0),
]

# The FARC loop: QA in stage 5 sends repair priorities back to stage 4 delivery.
FARC_LOOP = ("structures", 4, 1, "structures", 3, 0)
