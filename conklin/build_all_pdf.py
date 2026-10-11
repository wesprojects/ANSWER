"""Builds ONE simple page with all four languages (EN, ES, FR, SW) -> AI-Questions-ALL.pdf
Big type, three short lines per language. Run from this folder: python3 build_all_pdf.py (needs reportlab).
Text lives in content.py (LANGS for names, SIMPLE for the lines)."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from content import LANGS, SIMPLE

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, "assets", "conklin-logo-white.png")
OUT = os.path.join(HERE, "AI-Questions-ALL.pdf")
EMAIL = "wes@conklinoffice.com"
W, H = letter; M = 36; GAP = 10
DARK, AMBER = HexColor("#0d0f13"), HexColor("#f5a524")
INK, CARD, RULE, SOFT = HexColor("#1f2a33"), HexColor("#f3f5f8"), HexColor("#d6dce3"), HexColor("#c9d1dc")
ORDER = ["EN", "ES", "FR", "SW"]
HH, FH = 96, 64
TOP = H - HH - 4 - 14
BOTTOM = FH + 3 + 14
BH = (TOP - BOTTOM - 3*GAP) / 4          # band height
TABW = 104                                # language tab width
TX = M + TABW + 18; TW = W - M - 14 - TX  # text column

def rows_for(code, k):
    top = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=14*k, leading=16.5*k, textColor=INK)
    txt = ParagraphStyle("x", fontName="Helvetica", fontSize=12.5*k, leading=15.5*k, textColor=INK)
    return [(Paragraph(a, top), Paragraph(b, txt)) for a, b in SIMPLE[code]["rows"]]

def band_need(rows, rowgap):
    return sum(t.wrap(TW, 500)[1] + x.wrap(TW, 500)[1] + 1 for t, x in rows) + rowgap*(len(rows)-1) + 28

k = 1.15
while True:
    allrows = {c: rows_for(c, k) for c in ORDER}
    if max(band_need(r, 8) for r in allrows.values()) <= BH: break
    k -= 0.02
print("scale %.2f -> body %.1fpt, headings %.1fpt" % (k, 12.5*k, 14*k))

c = canvas.Canvas(OUT, pagesize=letter)
c.setTitle("AI Questions - Conklin Office Furniture (EN / ES / FR / SW)"); c.setAuthor("Conklin Office Furniture")
c.setFillColor(DARK); c.rect(0, H-HH, W, HH, stroke=0, fill=1)
c.setFillColor(AMBER); c.rect(0, H-HH-4, W, 4, stroke=0, fill=1)
lw = 128; c.drawImage(LOGO, M, H-14-lw*117/520, width=lw, height=lw*117/520, mask="auto")
c.setFillColor(white); c.setFont("Helvetica-Bold", 36); c.drawString(M, H-84, "AI Questions")

for i, code in enumerate(ORDER):
    y0 = TOP - i*(BH+GAP)
    c.setFillColor(CARD); c.setStrokeColor(RULE); c.roundRect(M, y0-BH, W-2*M, BH, 8, stroke=1, fill=1)
    c.setFillColor(DARK); c.roundRect(M, y0-BH, TABW, BH, 8, stroke=0, fill=1); c.rect(M+TABW-10, y0-BH, 10, BH, stroke=0, fill=1)
    c.setFillColor(AMBER); c.rect(M+TABW, y0-BH, 3, BH, stroke=0, fill=1)
    lab = LANGS[code]["label"]; fs = 17
    while c.stringWidth(lab, "Helvetica-Bold", fs) > TABW-16: fs -= 0.5
    c.setFillColor(white); c.setFont("Helvetica-Bold", fs); c.drawCentredString(M+TABW/2, y0-BH/2-fs*0.35, lab)
    rows = allrows[code]
    heights = [t.wrap(TW, 500)[1] + x.wrap(TW, 500)[1] + 1 for t, x in rows]
    gap = (BH - sum(heights)) / (len(rows)+1)
    y = y0 - gap
    for (t, x), h in zip(rows, heights):
        th = t.height; t.drawOn(c, TX, y-th); x.drawOn(c, TX, y-th-1-x.height); y -= h + gap

c.setFillColor(DARK); c.rect(0, 0, W, FH, stroke=0, fill=1)
c.setFillColor(AMBER); c.rect(0, FH, W, 3, stroke=0, fill=1)
c.setFillColor(white); c.setFont("Helvetica-Bold", 12); c.drawString(M, 36, "Questions?  \u00b7  \u00bfPreguntas?  \u00b7  Des questions\u00a0?  \u00b7  Maswali?")
c.setFillColor(SOFT); c.setFont("Helvetica", 9.5); c.drawString(M, 18, "Conklin Office Furniture")
c.setFillColor(AMBER); c.setFont("Helvetica-Bold", 16); c.drawRightString(W-M, 26, EMAIL)
ew = c.stringWidth(EMAIL, "Helvetica-Bold", 16); c.linkURL("mailto:"+EMAIL, (W-M-ew, 20, W-M, 44), relative=0)
c.save()
