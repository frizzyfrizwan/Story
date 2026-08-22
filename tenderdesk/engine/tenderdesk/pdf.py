"""Render a tender review as a branded PDF a client can be sent directly.

Markdown is the working format; this is the deliverable. Everything here is
laid out for one purpose: a contractor opens it on a phone, reads the verdict
in five seconds, and can tell it was prepared for them specifically.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .profile import CompanyProfile
from .qualify import BidDecision
from .tenders import Tender

MAPLE = colors.HexColor("#B3261E")
INK = colors.HexColor("#1A2332")
SOFT = colors.HexColor("#59636E")
LINE = colors.HexColor("#DEE2DA")
WASH = colors.HexColor("#F4F1EC")

_VERDICT = {
    "bid": ("WORTH BIDDING", colors.HexColor("#29584A")),
    "bid_with_partner": ("WORTH BIDDING - WITH A PARTNER", colors.HexColor("#8A6116")),
    "no_bid": ("DO NOT BID", MAPLE),
}


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle(
            "brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=13, textColor=MAPLE, spaceAfter=2,
        ),
        "kicker": ParagraphStyle(
            "kicker", parent=base["Normal"], fontName="Helvetica",
            fontSize=7.5, textColor=SOFT, spaceAfter=14, leading=10,
        ),
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=17, textColor=INK, alignment=0, leading=21, spaceAfter=4,
        ),
        "meta": ParagraphStyle(
            "meta", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=SOFT, spaceAfter=14,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=11, textColor=INK, spaceBefore=16, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=INK, leading=14, alignment=TA_JUSTIFY,
            spaceAfter=8,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=INK, leading=13, spaceAfter=4,
        ),
        "note": ParagraphStyle(
            "note", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=7.5, textColor=SOFT, leading=10.5, spaceBefore=6,
        ),
        "cell": ParagraphStyle(
            "cell", parent=base["Normal"], fontName="Helvetica",
            fontSize=8.5, textColor=INK, leading=11.5,
        ),
        "celllabel": ParagraphStyle(
            "celllabel", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8.5, textColor=SOFT, leading=11.5,
        ),
    }


def _escape(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _bullets(items: list[str], style: ParagraphStyle, numbered: bool = False):
    return ListFlowable(
        [ListItem(Paragraph(_escape(i), style), leftIndent=14) for i in items],
        bulletType="1" if numbered else "bullet",
        bulletFontSize=7,
        bulletColor=MAPLE,
        leftIndent=14,
        spaceAfter=6,
    )


def render_review_pdf(
    decision: BidDecision,
    tender: Tender,
    profile: CompanyProfile,
    dest: str | Path,
    prepared_by: str = "TenderDesk",
    today: date | None = None,
) -> Path:
    """Write a client-ready PDF review and return its path."""
    path = Path(dest)
    path.parent.mkdir(parents=True, exist_ok=True)
    s = _styles()
    stamp = (today or date.today()).strftime("%B %-d, %Y")
    closes = tender.closes[:16].replace("T", " ") if tender.closes else "See notice"
    label, accent = _VERDICT.get(decision.recommendation, (decision.recommendation.upper(), INK))

    doc = SimpleDocTemplate(
        str(path), pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title=f"Tender Review - {tender.title}",
        author=prepared_by,
        subject=f"Bid/no-bid review prepared for {profile.name}",
    )

    story = [
        Paragraph(_escape(prepared_by), s["brand"]),
        Paragraph("GOVERNMENT TENDER REVIEW", s["kicker"]),
        Paragraph(_escape(tender.title), s["title"]),
        Paragraph(
            f"Prepared for <b>{_escape(profile.name)}</b> &nbsp;&middot;&nbsp; {stamp}",
            s["meta"],
        ),
    ]

    facts = [
        ("Solicitation", tender.solicitation or tender.reference),
        ("Buyer", tender.entity),
        ("Closes", closes),
        ("Selection", tender.selection_criteria or "See notice"),
    ]
    table = Table(
        [[Paragraph(k, s["celllabel"]), Paragraph(_escape(v), s["cell"])] for k, v in facts],
        colWidths=[1.15 * inch, 5.5 * inch],
    )
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    story += [table, Spacer(1, 18)]

    # Verdict block — the only thing many readers will look at.
    verdict_rows = [
        [Paragraph(f'<font color="{accent.hexval()}" size="14"><b>{label}</b></font>', s["cell"])],
        [Paragraph(
            f'<font color="{SOFT.hexval()}">Fit <b><font color="{INK.hexval()}">'
            f"{decision.fit_score}/100</font></b> &nbsp;&middot;&nbsp; roughly "
            f'<b><font color="{INK.hexval()}">{decision.estimated_effort_hours} hours</font></b> '
            "of your team's time to prepare a compliant response</font>",
            s["cell"],
        )],
    ]
    verdict = Table(verdict_rows, colWidths=[6.65 * inch])
    verdict.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WASH),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (0, 0), 12),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 12),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
    ]))
    story += [verdict, Spacer(1, 14), Paragraph(_escape(decision.rationale), s["body"])]

    if decision.red_flags:
        story += [
            Paragraph("What stands in the way", s["h2"]),
            _bullets(decision.red_flags, s["bullet"]),
        ]

    if decision.mandatory_requirements:
        story += [
            Paragraph("What the tender requires", s["h2"]),
            Paragraph(
                "Each of these must be satisfied, or the bid is set aside before price "
                "is even looked at.",
                s["body"],
            ),
            _bullets(decision.mandatory_requirements, s["bullet"]),
        ]

    if decision.questions_for_buyer:
        story += [
            Paragraph("Questions worth putting to the buyer", s["h2"]),
            Paragraph(
                "Submit these in writing before the enquiry deadline. Answers are "
                "published to every bidder, and they often change the economics.",
                s["body"],
            ),
            _bullets(decision.questions_for_buyer, s["bullet"], numbered=True),
        ]

    if decision.recommendation == "no_bid":
        next_step = (
            "We are not recommending this one. If it would help, we will keep watching "
            "for tenders that fit your crew, equipment and service area, and flag the "
            "ones worth your time."
        )
    else:
        next_step = (
            "If you would like us to prepare the response, we deliver a complete "
            "submission package - compliance matrix, technical response, cover letter, "
            "past performance and submission checklist - in five business days. You "
            "review, sign, and remain the bidder of record."
        )
    story += [
        KeepTogether([
            Paragraph("What happens next", s["h2"]),
            Paragraph(next_step, s["body"]),
        ]),
        Spacer(1, 10),
        HRFlowable(width="100%", thickness=0.4, color=LINE, spaceAfter=4),
        Paragraph(
            f"Prepared by {_escape(prepared_by)} from the public tender notice and "
            f"{_escape(profile.name)}'s federal contract record. This is advice on "
            "whether to bid, not legal advice; the full solicitation documents should "
            "be read before any bid decision is final.",
            s["note"],
        ),
    ]

    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(SOFT)
        canvas.drawString(0.9 * inch, 0.5 * inch, f"{prepared_by}  |  {stamp}")
        canvas.drawRightString(letter[0] - 0.9 * inch, 0.5 * inch, f"Page {doc_.page}")
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(0.9 * inch, 0.62 * inch, letter[0] - 0.9 * inch, 0.62 * inch)
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return path
