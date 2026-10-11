from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

OUT = "AI-Questions.pdf"
W, H = letter
NAVY, GOLD, INK, MUTED = HexColor("#13294B"), HexColor("#C8963E"), HexColor("#1F2A33"), HexColor("#5B6770")
CARD, RULE = HexColor("#F3F5F8"), HexColor("#D6DCE3")
M = 40

def S(name, **kw):
    base = dict(fontName="Helvetica", fontSize=10, leading=13.6, textColor=INK)
    base.update(kw); return ParagraphStyle(name, **base)
body = S("body"); small = S("small", fontSize=9.4, leading=12.6)
bullet = S("bullet", leftIndent=10, bulletIndent=0, spaceAfter=5)
qa_q = S("q", fontName="Helvetica-Bold", textColor=NAVY, spaceAfter=1)
qa_a = S("a", spaceAfter=8)

c = canvas.Canvas(OUT, pagesize=letter)
c.setTitle("AI Questions - Conklin Office"); c.setAuthor("Conklin Office"); c.setSubject("A plain-English guide to AI")

# Header band
hh = 118
c.setFillColor(NAVY); c.rect(0, H-hh, W, hh, stroke=0, fill=1)
c.setFillColor(GOLD); c.rect(0, H-hh-4, W, 4, stroke=0, fill=1)
c.setFillColor(GOLD); c.setFont("Helvetica-Bold", 11); c.drawString(M, H-36, "CONKLIN OFFICE")
c.setFillColor(white); c.setFont("Helvetica-Bold", 34); c.drawString(M, H-76, "AI Questions")
c.setFont("Helvetica", 12); c.setFillColor(HexColor("#D9E1EC"))
c.drawString(M, H-98, "Plain-English answers for anyone curious about AI.")

def card(x, ytop, w, h, title, flow, accent=GOLD):
    c.setFillColor(CARD); c.setStrokeColor(RULE); c.roundRect(x, ytop-h, w, h, 6, stroke=1, fill=1)
    c.setFillColor(accent); c.rect(x, ytop-h+8, 3.5, h-16, stroke=0, fill=1)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 13); c.drawString(x+16, ytop-22, title)
    y = ytop-32
    for p in flow:
        pw, ph = p.wrap(w-32, 1000); y -= ph; p.drawOn(c, x+16, y)
        y -= p.getSpaceAfter()
    return y

gap = 20; cw = (W-2*M-14)/2
top = H-hh-4-18
h1 = 196
# Card 1: New to AI?
card(M, top, cw, h1, "New to AI? Start here", [
    Paragraph("AI tools like ChatGPT, Claude and Copilot are chat assistants. You type a request in plain English and they write back.", S("b1", spaceAfter=7)),
    Paragraph("They can draft, summarize, explain and brainstorm. Think of one as a fast, eager helper, <b>not</b> an expert who is always right.", S("b2", spaceAfter=7)),
    Paragraph("<b>Tip:</b> pick one small, everyday task, like tidying an email, and try it this week.", body),
])
# Card 2: Questions about AI
card(M+cw+14, top, cw, h1, "Questions about AI", [
    Paragraph("Is it always right?", qa_q),
    Paragraph("No. It can sound confident and still be wrong. Double-check facts, numbers and names.", qa_a),
    Paragraph("Is it free?", qa_q),
    Paragraph("Many tools have a free tier. Paid plans add features and higher limits.", qa_a),
    Paragraph("Will it take my job?", qa_q),
    Paragraph("It speeds up tasks. People who learn to use it well get the most out of it.", body),
])

# Card 3: How to use AI (full width)
y3 = top-h1-gap; h3 = 166; fw = W-2*M
c.setFillColor(CARD); c.setStrokeColor(RULE); c.roundRect(M, y3-h3, fw, h3, 6, stroke=1, fill=1)
c.setFillColor(GOLD); c.rect(M, y3-h3+8, 3.5, h3-16, stroke=0, fill=1)
c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 13); c.drawString(M+16, y3-22, "How to use AI: 4 simple steps")
steps = [("1", "Say what you want", "Describe the task and why you need it."),
         ("2", "Add context", "Who it's for, the tone, the length."),
         ("3", "Follow up", "Ask it to shorten, simplify or try again."),
         ("4", "Check it", "Read and edit before you use or send it.")]
sw = (fw-32-3*10)/4
for i, (n, t, d) in enumerate(steps):
    sx = M+16+i*(sw+10)
    c.setFillColor(NAVY); c.circle(sx+9, y3-46, 9, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 10); c.drawCentredString(sx+9, y3-49.5, n)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 10); c.drawString(sx+23, y3-49.5, t)
    p = Paragraph(d, small); pw, ph = p.wrap(sw-4, 100); p.drawOn(c, sx, y3-62-ph)
# example prompt
bx, by, bw, bh = M+16, y3-h3+14, fw-32, 50
c.setFillColor(white); c.setStrokeColor(GOLD); c.setLineWidth(1); c.roundRect(bx, by, bw, bh, 4, stroke=1, fill=1)
p = Paragraph('<b><font color="#9A6F1F">TRY THIS PROMPT</font></b><br/>"Write a friendly, professional 3-sentence email telling a customer their desk delivery is scheduled for Thursday morning."',
              S("ex", fontSize=10, leading=13.6))
pw, ph = p.wrap(bw-20, 100); p.drawOn(c, bx+10, by+(bh-ph)/2)

# Card 4 & 5: good for / be careful
y4 = y3-h3-gap; h4 = 156
card(M, y4, cw, h4, "AI is great for", [
    Paragraph("Drafting and polishing emails", bullet, bulletText="•"),
    Paragraph("Summarizing long documents", bullet, bulletText="•"),
    Paragraph("Brainstorming ideas and names", bullet, bulletText="•"),
    Paragraph("Explaining unfamiliar topics simply", bullet, bulletText="•"),
    Paragraph("Turning rough notes into clear text", bullet, bulletText="•"),
])
card(M+cw+14, y4, cw, h4, "Use with care", [
    Paragraph("Don't paste confidential, customer or personal details into a tool unless it's approved for that.", bullet, bulletText="•"),
    Paragraph("Verify anything important: prices, dates, legal, medical or financial points.", bullet, bulletText="•"),
    Paragraph("Never send AI-written text without reading it first.", bullet, bulletText="•"),
], accent=HexColor("#B5483A"))

# Footer
fh = 60
c.setFillColor(NAVY); c.rect(0, 0, W, fh, stroke=0, fill=1)
c.setFillColor(GOLD); c.rect(0, fh, W, 3, stroke=0, fill=1)
c.setFillColor(white); c.setFont("Helvetica-Bold", 13); c.drawString(M, 33, "Still have questions? Just ask.")
c.setFillColor(HexColor("#D9E1EC")); c.setFont("Helvetica", 9); c.drawString(M, 17, "Conklin Office")
c.setFillColor(GOLD); c.setFont("Helvetica-Bold", 13)
email = "wes@conklinoffice.com"; c.drawRightString(W-M, 27, email)
ew = c.stringWidth(email, "Helvetica-Bold", 13)
c.linkURL("mailto:"+email, (W-M-ew, 22, W-M, 42), relative=0)
c.save()
print("ok")
