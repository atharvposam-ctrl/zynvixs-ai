"""Readable PDF layout presets. Never pad pages, drop facts or invent content."""

import io
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader


def render(content, preference="1-2"):
    limit = {"1-2": 2, "4-5": 5, "12": 12}.get(preference, 2)
    base = {"1-2": 10.5, "4-5": 11, "12": 11.5}.get(preference, 10.5)
    font = next(
        (
            p
            for p in [
                Path("C:/Windows/Fonts/arial.ttf"),
                Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            ]
            if p.exists()
        ),
        None,
    )
    if font and "ResumeFont" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("ResumeFont", str(font)))
    output = b""
    for size in [base, base - 0.5, 9.5]:
        styles = getSampleStyleSheet()
        for style in styles.byName.values():
            if font:
                style.fontName = "ResumeFont"
        styles["BodyText"].fontSize = size
        styles["BodyText"].leading = size * 1.28
        styles["BodyText"].spaceAfter = 2
        for level in range(1, 4):
            styles["Heading" + str(level)].fontSize = (
                20 if level == 1 else 13 if level == 2 else 11
            )
            styles["Heading" + str(level)].leading = 24 if level == 1 else 16
            styles["Heading" + str(level)].spaceBefore = 8
            styles["Heading" + str(level)].spaceAfter = 5
        story = []
        for line in content.splitlines():
            text = line.strip()
            style = "BodyText"
            if not text:
                story.append(Spacer(1, 4))
                continue
            if text.startswith("#"):
                level = min(len(text) - len(text.lstrip("#")), 3)
                style = "Heading" + str(level)
                text = text.lstrip("#").strip()
            elif text.startswith(("- ", "* ")):
                text = "• " + text[2:]
            story.append(Paragraph(escape(text), styles[style]))
        if not story:
            story = [Spacer(1, 1)]
        buffer = io.BytesIO()
        margin = 40 if preference == "1-2" else 46
        SimpleDocTemplate(
            buffer,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        ).build(story)
        output = buffer.getvalue()
        if len(PdfReader(io.BytesIO(output)).pages) <= limit:
            break
    return output
