"""Builds the one-page 'AI Questions' PDF in each standard language (EN, ES, FR, SW).
Run from this folder:  python3 build_pdf.py   (needs reportlab)
Text lives in content.py. Brand: logo + amber/near-black tokens from wesprojects/VTRANSLATE."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from content import LANGS

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, "assets", "conklin-logo-white.png")
EMAIL = "wes@conklinoffice.com"
W, H = letter
M = 40
DARK, AMBER, AMBER_TXT = HexColor("#0d0f13"), HexColor("#f5a524"), HexColor("#9A6F1F")
INK, CARD, RULE, RED = HexColor("#1f2a33"), HexColor("#f3f5f8"), HexColor("#d6dce3"), HexColor("#d94a4a")
SOFT = HexColor("#c9d1dc")

def build(code, scale=1.0):
    L = LANGS[code]
    fs = lambda n: n * scale
    def S(name, **kw):
        base = dict(fontName="Helvetica", fontSize=fs(10), leading=fs(13.6), textColor=INK)
        base.update(kw); return ParagraphStyle(name, **base)
    body = S("body"); small = S("small", fontSize=fs(9.4), leading=fs(12.6))
    bullet = S("bullet", leftIndent=10, bulletIndent=0, spaceAfter=fs(5))
    q = S("q", fontName="Helvetica-Bold", textColor=INK, spaceAfter=1)
    a = S("a", spaceAfter=fs(8)); para = S("para", spaceAfter=fs(7))
    stitle = S("st", fontName="Helvetica-Bold", fontSize=fs(10), leading=fs(12))

    def total(flow, w):
        t = 0
        for p in flow:
            t += p.wrap(w, 1000)[1] + p.getSpaceAfter()
        return t
    cw = (W-2*M-14)/2; fw = W-2*M
    new = [Paragraph(t, para) for t in L["new"][:-1]] + [Paragraph(L["new"][-1], body)]
    faq = []
    for i, (qq, aa) in enumerate(L["faq"]):
        faq += [Paragraph(qq, q), Paragraph(aa, a if i < len(L["faq"])-1 else body)]
    great = [Paragraph(t, bullet, bulletText="•") for t in L["great"]]
    care = [Paragraph(t, bullet, bulletText="•") for t in L["care"]]
    CH = 38  # card title area + bottom padding
    h1 = CH + max(total(new, cw-32), total(faq, cw-32))
    h4 = CH + max(total(great, cw-32), total(care, cw-32))
    # steps block
    sw = (fw-32-3*10)/4
    st_paras = [Paragraph(t, stitle) for t, _ in L["steps"]]
    sd_paras = [Paragraph(d, small) for _, d in L["steps"]]
    st_h = max(p.wrap(sw-26, 100)[1] for p in st_paras)
    sd_h = max(p.wrap(sw-4, 100)[1] for p in sd_paras)
    prm = Paragraph('<b><font color="#9A6F1F">%s</font></b><br/>%s' % (L["try_label"], L["prompt"]),
                    S("ex", fontSize=fs(10), leading=fs(13.6)))
    pbh = prm.wrap(fw-32-20, 200)[1] + 18
    h3 = 40 + max(st_h, 18) + 8 + sd_h + 14 + pbh + 14

    hh = 118; fh = 60
    top = H-hh-4-18
    avail = top - (fh+3+14)
    need = h1 + h3 + h4
    gap = (avail-need)/2
    if gap < 12: return None
    gap = min(gap, 24)

    out = os.path.join(HERE, L["file"])
    c = canvas.Canvas(out, pagesize=letter)
    c.setTitle(L["title"]+" - Conklin Office Furniture"); c.setAuthor("Conklin Office Furniture")
    c.setSubject(L["label"])
    # header
    c.setFillColor(DARK); c.rect(0, H-hh, W, hh, stroke=0, fill=1)
    c.setFillColor(AMBER); c.rect(0, H-hh-4, W, 4, stroke=0, fill=1)
    lw = 132; c.drawImage(LOGO, M, H-18-lw*117/520, width=lw, height=lw*117/520, mask="auto")
    c.setFillColor(AMBER); c.setFont("Helvetica-Bold", 10.5); c.drawRightString(W-M, H-30, L["label"].upper())
    tsize = 34
    while c.stringWidth(L["title"], "Helvetica-Bold", tsize) > W-2*M and tsize > 22: tsize -= 1
    c.setFillColor(white); c.setFont("Helvetica-Bold", tsize); c.drawString(M, H-90, L["title"])
    ss = 12
    while c.stringWidth(L["subtitle"], "Helvetica", ss) > W-2*M and ss > 9: ss -= 0.5
    c.setFillColor(SOFT); c.setFont("Helvetica", ss); c.drawString(M, H-107, L["subtitle"])

    def card(x, ytop, w, h, title, flow, accent=AMBER):
        c.setFillColor(CARD); c.setStrokeColor(RULE); c.roundRect(x, ytop-h, w, h, 6, stroke=1, fill=1)
        c.setFillColor(accent); c.rect(x, ytop-h+8, 3.5, h-16, stroke=0, fill=1)
        c.setFillColor(DARK); c.setFont("Helvetica-Bold", 13); c.drawString(x+16, ytop-22, title)
        y = ytop-32
        for p in flow:
            ph = p.wrap(w-32, 1000)[1]; y -= ph; p.drawOn(c, x+16, y); y -= p.getSpaceAfter()
    card(M, top, cw, h1, L["new_title"], new)
    card(M+cw+14, top, cw, h1, L["faq_title"], faq)
    y3 = top-h1-gap
    c.setFillColor(CARD); c.setStrokeColor(RULE); c.roundRect(M, y3-h3, fw, h3, 6, stroke=1, fill=1)
    c.setFillColor(AMBER); c.rect(M, y3-h3+8, 3.5, h3-16, stroke=0, fill=1)
    c.setFillColor(DARK); c.setFont("Helvetica-Bold", 13); c.drawString(M+16, y3-22, L["how_title"])
    for i in range(4):
        sx = M+16+i*(sw+10); cy = y3-46
        c.setFillColor(DARK); c.circle(sx+9, cy, 9, stroke=0, fill=1)
        c.setFillColor(AMBER); c.setFont("Helvetica-Bold", 10); c.drawCentredString(sx+9, cy-3.5, str(i+1))
        ph = st_paras[i].wrap(sw-26, 100)[1]; st_paras[i].drawOn(c, sx+23, cy-ph/2)
        sd_paras[i].wrap(sw-4, 100); sd_paras[i].drawOn(c, sx, y3-40-max(st_h, 18)-8-sd_paras[i].height)
    bx, bw = M+16, fw-32; by = y3-h3+14
    c.setFillColor(white); c.setStrokeColor(AMBER); c.setLineWidth(1); c.roundRect(bx, by, bw, pbh, 4, stroke=1, fill=1)
    prm.wrap(bw-20, 200); prm.drawOn(c, bx+10, by+9)
    y4 = y3-h3-gap
    card(M, y4, cw, h4, L["great_title"], great)
    card(M+cw+14, y4, cw, h4, L["care_title"], care, accent=RED)
    # footer
    c.setFillColor(DARK); c.rect(0, 0, W, fh, stroke=0, fill=1)
    c.setFillColor(AMBER); c.rect(0, fh, W, 3, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 13); c.drawString(M, 33, L["foot"])
    c.setFillColor(SOFT); c.setFont("Helvetica", 9); c.drawString(M, 17, "Conklin Office Furniture")
    c.setFillColor(AMBER); c.setFont("Helvetica-Bold", 13); c.drawRightString(W-M, 27, EMAIL)
    ew = c.stringWidth(EMAIL, "Helvetica-Bold", 13)
    c.linkURL("mailto:"+EMAIL, (W-M-ew, 22, W-M, 42), relative=0)
    c.save()
    return out, scale, gap

for code in LANGS:
    s = 1.0
    while True:
        r = build(code, s)
        if r: print(code, "scale %.2f" % s, "gap %.1f" % r[2]); break
        s -= 0.03
