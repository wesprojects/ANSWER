"""One-page 'AI Questions' sheet in Conklin's house multilingual style (see wesprojects/conklin-signage):
English first and large, then the same words in Spanish, French and Swahili beneath a thin amber rule,
each with an ES / FR / SW tag. Translations come from the same Google endpoint the signage server uses
and are cached in translations.json (edit that file to correct a line). Run: python3 build_house_pdf.py"""
import os, json, ssl, time, urllib.parse, urllib.request
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, "assets", "conklin-logo-white.png")
CACHE = os.path.join(HERE, "translations.json")
OUT = os.path.join(HERE, "AI-Questions.pdf")
EMAIL = "wes@conklinoffice.com"
LANGS = ["es", "fr", "sw"]            # house order, same as TILE_LANGS in conklin-signage

# ---- English master text (edit here) ----
TITLE = "AI Questions"
BLOCKS = [
 ("New to AI?", [[("AI tools like ChatGPT, Claude and Copilot are chat assistants. You type a request in everyday language and they write back. Think of one as a fast, eager helper, not an expert who is always right.", 0)]]),
 ("Questions about AI", [[("Is it always right?", 1), ("No. Double-check facts, numbers and names.", 0)],
                         [("Will it take my job?", 1), ("It speeds up tasks. People who learn to use it well get the most out of it.", 0)]]),
 ("How to use AI", [[("Say what you want. Add context: who it's for, the tone and the length. If it's not right, ask again. Check it before you use or send it.", 0)]]),
 ("Use with care", [[("Don't paste confidential, customer or personal details into a tool unless it's approved. Never send AI-written text without reading it first.", 0)]]),
]
FOOT = "Questions? Just ask."

# ---- translation (same endpoint and method as conklin-signage's translate_text) ----
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
def tr(text, lang):
    key = lang + "|" + text
    if key not in cache:
        url = ("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + lang
               + "&dt=t&q=" + urllib.parse.quote(text))
        req = urllib.request.Request(url, headers={"User-Agent": "conklin-signage"})
        for wait in (0, 4, 8, 16, 32):          # the endpoint is unofficial and rate-limited: pace and retry
            time.sleep(wait or 1.2)
            try:
                with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
                    cache[key] = "".join(s[0] for s in json.loads(r.read().decode("utf-8"))[0]).strip()
                break
            except urllib.error.HTTPError as e:
                if e.code != 429 or wait == 32: raise
        json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=1)
    return cache[key]
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def version(item, lang):
    parts = []
    for text, bold in item:
        t = text if lang == "en" else tr(text, lang)
        parts.append("<b>%s</b>" % esc(t) if bold else esc(t))
    return " ".join(parts)

W, H = letter; M = 42
DARK, AMBER = HexColor("#0f1216"), HexColor("#e8a33d")
INK, GREY, LINE, HAIR = HexColor("#1f2a33"), HexColor("#4b5662"), HexColor("#f7dfbb"), HexColor("#e1e5ea")
HH, FH = 100, 62
TW = W - 2*M; GUT = 26

def layout(k):
    en = ParagraphStyle("en", fontName="Helvetica", fontSize=12.5*k, leading=15.6*k, textColor=INK)
    sm = ParagraphStyle("sm", fontName="Helvetica", fontSize=9.6*k, leading=12.4*k, textColor=GREY)
    blocks = []
    for head, items in BLOCKS:
        hl = " · ".join(esc(tr(head, l)).upper() for l in LANGS)
        its = []
        for item in items:
            e = Paragraph(version(item, "en"), en); e.wrap(TW, 500)
            ts = []
            for l in LANGS:
                p = Paragraph(version(item, l), sm); p.wrap(TW-GUT, 500); ts.append((l, p))
            its.append((e, ts))
        blocks.append((head, hl, its))
    return blocks

def block_h(b, k):
    h = 14*k + 12 + 10          # heading + translated heading + rule gaps
    for e, ts in b[2]:
        h += e.height + 9 + sum(p.height + 3 for _, p in ts) + 12
    return h

avail = H - HH - 4 - FH - 3 - 30
k = 1.0
while True:
    blocks = layout(k)
    need = sum(block_h(b, k) for b in blocks)
    if need <= avail or k < 0.8: break
    k -= 0.02
print("scale %.2f  need %.0f of %.0f  (EN %.1fpt, translations %.1fpt)" % (k, need, avail, 12.5*k, 9.6*k))
gap = max(0, (avail - need) / (len(blocks)))

c = canvas.Canvas(OUT, pagesize=letter)
c.setTitle("AI Questions - Conklin Office Furniture"); c.setAuthor("Conklin Office Furniture")
c.setSubject("English, Spanish, French, Swahili")
# header
c.setFillColor(DARK); c.rect(0, H-HH, W, HH, stroke=0, fill=1)
c.setFillColor(AMBER); c.rect(0, H-HH-4, W, 4, stroke=0, fill=1)
lw = 128; c.drawImage(LOGO, M, H-16-lw*117/520, width=lw, height=lw*117/520, mask="auto")
def spaced(x, y, s, font, size, color, cs, align="l"):
    t = c.beginText(); t.setFont(font, size); t.setFillColor(color); t.setCharSpace(cs)
    w = c.stringWidth(s, font, size) + cs*len(s)
    t.setTextOrigin(x - (w if align == "r" else 0), y); t.textOut(s); c.drawText(t)
spaced(M, H-72, TITLE.upper(), "Helvetica-Bold", 24, AMBER, 4)
sub = "  ·  ".join(tr(TITLE, l).upper() for l in LANGS)
spaced(M, H-90, sub, "Helvetica", 8, HexColor("#e9c88f"), 1.6)

y = H - HH - 4 - 22
for head, hl, its in blocks:
    spaced(M, y-10, head.upper(), "Helvetica-Bold", 11.5*k, INK, 2.4)
    spaced(M, y-22*k-1, hl, "Helvetica", 7*k, GREY, 1.2)
    y -= 14*k + 12 + 4
    c.setStrokeColor(AMBER); c.setLineWidth(0.9); c.line(M, y, W-M, y); y -= 10
    for ii, (e, ts) in enumerate(its):
        e.drawOn(c, M, y - e.height); y -= e.height + 7
        c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(M, y, W-M, y); y -= 9
        for l, p in ts:
            ty = y - p.height
            c.setFillColor(AMBER); c.roundRect(M, y-10.2, 17, 10.2, 2, stroke=0, fill=1)
            c.setFillColor(DARK); c.setFont("Helvetica-Bold", 6.6); c.drawCentredString(M+8.5, y-7.4, l.upper())
            p.drawOn(c, M+GUT, ty); y = ty - 3
        y -= 9
        if ii < len(its)-1:
            c.setStrokeColor(HAIR); c.setLineWidth(0.5); c.line(M, y+4, W-M, y+4)
    y -= gap
# footer
c.setFillColor(DARK); c.rect(0, 0, W, FH, stroke=0, fill=1)
c.setFillColor(AMBER); c.rect(0, FH, W, 3, stroke=0, fill=1)
spaced(M, 38, FOOT.upper(), "Helvetica-Bold", 10.5, white, 2)
spaced(M, 22, "  ·  ".join(tr(FOOT, l).upper() for l in LANGS), "Helvetica", 7.2, HexColor("#e9c88f"), 1.2)
c.setFillColor(AMBER); c.setFont("Helvetica-Bold", 16); c.drawRightString(W-M, 32, EMAIL)
ew = c.stringWidth(EMAIL, "Helvetica-Bold", 16); c.linkURL("mailto:"+EMAIL, (W-M-ew, 26, W-M, 50), relative=0)
c.setFillColor(HexColor("#aab3be")); c.setFont("Helvetica", 8); c.drawRightString(W-M, 15, "Conklin Office Furniture")
c.save()
json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=1)
