#!/usr/bin/env python3
"""Catalog products new in the June 2022 Answer guide, built from the guide's text (guide2022/pNNN.txt) with every row's price read from its
pricing page by style number (the same cell parser as update_catalog_2022.py). Runs after update_catalog_2022.py, add_rows_2022.py and
hand_rows_2022.py; idempotent (a product already present is replaced).

Products (pricing page, understanding pages):
  thin-top-cap-screens           Universal and Sarto screens with Answer thin trim top cap (p402-403; p70-73)
  sh-fabric-skins-big-open-base  Fabric-covered panel skins, big open base 19 3/16"H (p474; p125)
  sh-steel-skins-big-open-base   Steel panel skins, big open base 19 3/16"H (p480; p127)
  thin-big-open-base-trim        Big open base trim package TSBBOBTRM (p393; p58)
  sh-back-painted-glass-skins    Back painted glass skins 12/18/24/30/36"H (p500-501; p137) and to the floor 24/30/36"H (p502)
"""
import json, os, re, importlib.util
ROOT = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(ROOT, 'src', 'catalog.json')
spec = importlib.util.spec_from_file_location('u', os.path.join(ROOT, 'update_catalog_2022.py')); u = importlib.util.module_from_spec(spec); spec.loader.exec_module(u)
T = u.load('guide2022'); toks = u.make_tokenizer({'TSBBOBTRM'})   # the trim package's style has no digit
def runs(pg): return u.runs(T[pg], toks)
def price(pg, style, n=1):
    r = runs(pg).get(style)
    assert r and len(r[0]) >= n, (pg, style, r); return r[0]
cat = json.load(open(OUT, encoding='utf-8')); P = {p['id']: p for p in cat['products']}
def put(prod):
    cat['products'] = [p for p in cat['products'] if p['id'] != prod['id']]; prod['added2022'] = True; cat['products'].append(prod); P[prod['id']] = prod
def opt(group, name, price, spec, code=None, **kw):
    o = {'group': group, 'name': name, 'code': code or re.sub(r'[^a-z0-9]+', ' ', name.lower()).strip().replace(' ', '_'), 'price': price, 'spec': spec}; o.update(kw); return o
PAINT = lambda pg: [opt('Surface Materials', 'Paint price group 1', 0, 'Specify paint color number.', 'paintGroup1'), opt('Surface Materials', 'Paint price group 2', 15, 'Specify paint color number.', 'paintGroup2'), opt('Surface Materials', 'Paint price group 3', 31, 'Specify paint color number.', 'paintGroup3')]

# ---- Universal and Sarto screens with Answer thin trim top cap (p402-403; p70-73) ----
rows = []
for pg in (402, 403):
    for m in re.finditer(r'TS71([39])(\d\d)T([US])SC', T[pg]):
        s = m.group(0); h = 13.5 if m.group(1) == '3' else 19.5; w = int(m.group(2)); kind = 'universal' if m.group(3) == 'U' else 'sarto'
        rows.append({'group': ('Universal' if kind == 'universal' else 'Sarto') + ' Screens with Answer Thin Trim Top Cap', 'attrs': {'kind': kind, 'height': h, 'width': w, 'screenHeight': h if kind == 'universal' else h - 1},
                     'style': s, 'price': price(pg, s)[0], 'page': pg})
rows.sort(key=lambda r: (r['attrs']['kind'], r['attrs']['height'], r['attrs']['width']))
assert len(rows) == 52, len(rows)
fab = [('A', 0)] + [(str(i), v) for i, v in zip(range(1, 11), (0, 45, 121, 151, 185, 217, 251, 282, 315, 347))]
put({'id': 'thin-top-cap-screens', 'trim': 'thin', 'category': 'Screens', 'name': 'Universal and Sarto Screens with Answer Thin Trim Top Cap', 'pages': [402, 403], 'detailsPages': [70, 71, 72, 73],
     'standardIncludes': ['Top cap: paint price group 1', 'Screen: fabric price group 1', 'Edge on Universal screen: PET', 'Two brackets (three on Sarto screens 60"W and wider), hard stops on Sarto screens'],
     'requiredToSpecify': ['Style number', 'Paint color number for top cap', 'Fabric color number for screen', 'Edge color (Universal): P630 Medium Heather Grey PET or P631 Dark Heather Grey PET', 'Options, if selected'],
     'options': PAINT(402) + [opt('Screen', f'Fabric price group {g}', v, 'Specify fabric color number.', f'fabricGroup{g}') for g, v in fab[1:]] + [opt('Screen', "Customer's Own Material (COM)", 21, 'See Surface Materials Reference Manual.', 'com')],
     'tips': ['Thin profile trim only (p70, p72).', 'Placed on the top of a base or stacking panel only; the top bar must be in the top position of the frame (p71, p73).',
              'Cannot be added to a panel segment with a 6" stacker, nor where a window is in the top position of the panel, nor to the lower segment of an in-line change of height (p71, p73).',
              'One screen can span two or more in-line panels up to 96"; specify one in-line spanning top cap lightseal (p404) per in-line junction spanned; screens cannot span a corner junction (p71, p73).',
              'A Sarto screen 60"W or wider cannot span two panel sections of equal width: its middle bracket meets the in-line junction (p73).',
              '13 1/2"H screen aligns with a 42" overall height and 19 1/2"H with 48" when installed on a 30"H panel (p70, p72). Actual Sarto screen heights are 12 1/2" and 18 1/2" (p72).'],
     'columns': ['Width', 'Height', 'Style Number (Universal)', 'U.S. Base Price', 'Style Number (Sarto)', 'U.S. Base Price'], 'rows': rows})

# ---- Big open base skins (p474 fabric, p480 steel; p125, p127) and the big open base trim package (p393; p58) ----
def bob(pg, suffix, group, skinType, pid, name, details, options, tips):
    rr = []
    for m in re.finditer(r'TS7(\d\d)' + suffix + r'BOB\b', T[pg]):
        s = m.group(0); rr.append({'group': group, 'attrs': {'width': int(m.group(1)), 'height': 19.1875, 'skinType': skinType, 'bigOpenBase': True}, 'style': s, 'price': price(pg, s)[0], 'page': pg})
    assert len(rr) == 8, (pid, len(rr))
    put({'id': pid, 'trim': 'shared', 'category': 'Skins', 'name': name, 'pages': [pg], 'detailsPages': details, 'standardIncludes': [f'19 3/16"H {skinType} panel skin'], 'requiredToSpecify': ['Style number', 'Color number for skin surface', 'Options, if selected'],
         'options': options, 'tips': tips, 'columns': ['Width', 'Style Number', 'U.S. Base Price'], 'rows': rr})
bobtips = ['Big open base skins are 19 3/16"H and sit on the junctions just above the big open base vertical trim (p125, p127).', '30"H big open base skins finish a 30"H panel; on panels taller than 30" the big open base skin is the bottom segment (p125, p127).',
           'Order the big open base trim package TSBBOBTRM with the base horizontal frame package (p393).']
bob(474, 'TK', 'Tackable Acoustical Big Open Base Skins', 'tackable acoustical', 'sh-fabric-skins-big-open-base', 'Fabric-Covered Panel Skins Big Open Base', [125],
    [opt('Surface Materials', 'Fabric price group A', -3, 'Specify fabric color number.', 'fabricGroupA')] + [opt('Surface Materials', f'Fabric price group {g}', v, 'Specify fabric color number.', f'fabricGroup{g}') for g, v in ((1, 0), (2, 19), (3, 36), (4, 52), (5, 80), (6, 110), (7, 142))], bobtips + ['72"W fabric-covered skins take fabric in the horizontal direction only (p474).'])
bob(480, 'HS', 'Steel Big Open Base Skins', 'steel', 'sh-steel-skins-big-open-base', 'Steel Panel Skins Big Open Base', [127],
    [opt('Surface Materials', 'Paint price group 1', 0, 'Specify paint color number.', 'paintGroup1'), opt('Surface Materials', 'Paint price group 2', 32, 'Specify paint color number.', 'paintGroup2'), opt('Surface Materials', 'Paint price group 3', 54, 'Specify paint color number.', 'paintGroup3')],
    bobtips + ['Data cutouts on 42"W to 72"W steel skins +$11, left or right, not both; no data or modular receptacle cutouts on 18"W (p480).'])
put({'id': 'thin-big-open-base-trim', 'trim': 'thin', 'category': 'Base Trims', 'name': 'Big Open Base Trim Package—Thin Trim', 'pages': [393], 'detailsPages': [58], 'standardIncludes': ['Two inside vertical trim: paint price group 1'], 'requiredToSpecify': ['Style number', 'Paint color number for trim', 'Options, if selected'],
     'options': PAINT(393), 'tips': ['One big open base trim package per panel with big open base skins (p393).'], 'columns': ['Style Number', 'U.S. Base Price'], 'rows': [{'attrs': {'description': 'Big open base trim package, two inside vertical trims'}, 'style': 'TSBBOBTRM', 'price': price(393, 'TSBBOBTRM')[0], 'page': 393}]})

# ---- Back painted glass skins (p500-501; p137) and to the floor (p502) ----
def glass_rows(pages, floor):
    rr = []
    for pg in pages:
        for m in re.finditer(r'TS7(\d\d)(\d\d)GS' + ('F' if floor else '') + r'\b', T[pg]):
            s = m.group(0); h, w = int(m.group(1)), int(m.group(2)); run = price(pg, s, 2)
            rr.append({'group': f'{h}"H Back Painted Glass Skins' + (' to the Floor' if floor else ''), 'attrs': {'width': w, 'height': h, 'skinType': 'back painted glass', 'toFloor': floor}, 'style': s, 'price': run[0], 'adders': {'magneticBacker': run[1]}, 'page': pg})
    return sorted(rr, key=lambda r: (r['attrs']['height'], r['attrs']['width']))
gr = glass_rows((500, 501), False); gf = glass_rows((502,), True)
assert len(gr) == 40 and len(gf) == 24, (len(gr), len(gf))
put({'id': 'sh-back-painted-glass-skins', 'trim': 'shared', 'category': 'Skins', 'name': 'Back Painted Glass Skins', 'pages': [500, 501], 'detailsPages': [137], 'standardIncludes': ['Skin: back painted glass', 'Trim: paint', 'Attachment hardware'],
     'requiredToSpecify': ['Style number', 'Back painted glass color for skin surface', 'Paint color number for trim', 'Options, if selected'], 'options': [opt('Magnetic Backer', 'Magnetic backer', None, 'Specify with backer.', 'magneticBacker', priceBy='row adder magneticBacker')],
     'tips': ['Back painted glass skins only work on junctions manufactured on or after October 10, 2011 and do not attach to wall-start junctions (p500).', 'Rare earth magnets should be used with the magnetic backer (p500).'],
     'columns': ['Width', 'Style Number', 'U.S. Base Price', 'Option (Add $ to Base Price): Magnetic Backer'], 'rows': gr})
put({'id': 'sh-back-painted-glass-skins-to-floor', 'trim': 'shared', 'category': 'Skins', 'name': 'Back Painted Glass To The Floor Skins', 'pages': [502], 'detailsPages': [137], 'standardIncludes': ['Skin: back painted glass', 'Trim: paint', 'Attachment hardware'],
     'requiredToSpecify': ['Style number', 'Back painted glass color for skin surface', 'Paint color number for trim', 'Options, if selected'], 'options': [opt('Magnetic Backer', 'Magnetic backer', None, 'Specify with backer.', 'magneticBacker', priceBy='row adder magneticBacker')],
     'tips': ['Omit the base trims on the horizontal frame package when using a skin to the floor (p502).', 'Skins to the floor are planned 6" shorter than the panel height but are taller in actual height to cover the base trim area (p502).'],
     'columns': ['Width', 'Style Number', 'U.S. Base Price', 'Option (Add $ to Base Price): Magnetic Backer'], 'rows': gf})
json.dump(cat, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print('new products:', [p['id'] for p in cat['products'] if p.get('added2022')], 'products', len(cat['products']), 'rows', sum(len(p['rows']) for p in cat['products']))

# ---- Answer boundary screens (p408-426; p80-84): one style per configuration and connection, priced by height x width band, laminate or wood ----
def clean2(t): return re.sub(r'\s*\|\s*(\|\s*)*', ' | ', re.sub(r'\n+', ' | ', t.replace('¼', '/').replace('”', '"').replace('“', '"')))   # one ' | ' between cells; the PDF font prints the fraction slash as ¼ and p426 a curly inch mark
CFG = {'TS7SCSSD': ('single-connect', 'single-sided'), 'TS7SCSPN': ('single-connect', 'spanning'), 'TS7SCSPT': ('single-connect', 'split'),
       'TS7DCSSD': ('dual-connect', 'single-sided'), 'TS7DCSPN': ('dual-connect', 'spanning'), 'TS7DCSPT': ('dual-connect', 'split'),
       'TS7SCLSSD': ('single-connect', 'L return single-sided'), 'TS7SCLSPT': ('single-connect', 'L return split'), 'TS7DCLSSD': ('dual-connect', 'L return single-sided'), 'TS7DCLSPT': ('dual-connect', 'L return split')}
HEIGHTS = [30, 36, 42, 48, 54]
def frac(s): m = re.match(r'(\d+)(?:(\d)/(\d+))?$', s.replace(' ', '')); return int(m.group(1)) + (int(m.group(2)) / int(m.group(3)) if m.group(2) else 0)
bs = {}
for pg in range(409, 427):
    t = clean2(T[pg])
    # each block: "<Material> — <Segment>" or "<Material>" then the style then 5 rows "NN"H v v v ..."
    for m in re.finditer(r'(High-Pressure Laminate|Wood Veneer)(?: [—–-] (Primary Screen|Return Screen))? \| (TS7[SD]C[A-Z]+) \| (30"H .*?)(?= \| d |\| DStyle| \| Tip| \| High-Pressure| \| Wood Veneer|$)', t):   # the shared cleaner turns the em dash into a hyphen
        mat, seg, style, body = m.group(1), m.group(2) or 'screen', m.group(3), m.group(4)
        # the width columns for this table: the last "dModular" header before the block
        hdr = t[:m.start()].rfind('dModular'); cols = [frac(w) for w in re.findall(r'd(\d+(?:\d/\d+)?)"\s?W', t[hdr: m.start()])]
        cols = cols[:3] if seg == 'Return Screen' else cols[:9]   # the modular widths; the parametric bands that follow repeat them as ranges
        rows = {}
        for hm in re.finditer(r'(\d\d)"H((?: \| (?:\+?\$\s*[\d,]+|N\.A\.))+)', body):
            vals = [None if 'N.A.' in v else int(re.sub(r'[^\d]', '', v)) for v in re.findall(r'\+?\$\s*[\d,]+|N\.A\.', hm.group(2))]
            rows[int(hm.group(1))] = vals
        assert sorted(rows) == HEIGHTS and all(len(v) == len(cols) for v in rows.values()), (pg, style, mat, seg, cols, {k: len(v) for k, v in rows.items()})
        key = (style, 'laminate' if mat.startswith('High') else 'wood veneer', 'primary' if seg == 'Primary Screen' else 'return' if seg == 'Return Screen' else 'screen')
        bs[key] = {'page': pg, 'widths': cols, 'prices': [rows[h] for h in HEIGHTS]}
assert len(bs) == 6 * 2 + 4 * 2 * 2, len(bs)
brow = []
for (style, mat, seg), d in sorted(bs.items()):
    conn, cfg = CFG[style]
    brow.append({'group': f'{cfg.capitalize()} boundary screen, {conn}' + (f' — {seg} screen' if seg != 'screen' else ''), 'style': style, 'attrs': {'connection': conn, 'configuration': cfg, 'material': mat, 'segment': seg, 'heights': HEIGHTS, 'widths': d['widths'], 'parametric': True},
                 'price': next(v for v in d['prices'][0] if v), 'priceMatrix': {'heightBands': [[h, h] for h in HEIGHTS], 'widthBands': [[w, w] for w in d['widths']], 'prices': d['prices'], 'adder': seg == 'return'}, 'page': d['page']})
put({'id': 'thin-boundary-screens', 'trim': 'thin', 'category': 'Screens', 'name': 'Answer Boundary Screens', 'pages': list(range(408, 427)), 'detailsPages': [80, 81, 82, 83, 84],
     'standardIncludes': ['Screen: High-Pressure Laminate price group 1 or wood group 1 veneer', 'Edge on laminate screen: plastic', 'Connecting panel cover: paint price group 1', '1 1/2" adjustable glides', 'Attachment hardware'],
     'requiredToSpecify': ['Style number', 'Screen size type: modular or parametric', 'Height of connecting panel: 30"H to 90"H', 'Handedness (single-sided screens): right or left', 'Widths: primary and return (L returns), left and right (split)', 'Laminate or wood color number', 'Paint color number for connecting panel cover', 'Options, if selected'],
     'options': [opt('Additional Hardware', 'Single-connect straight split', 27, 'Applied when the single-connect straight split style number is specified.', 'splitHardware'), opt('Surface Materials', 'Open Line laminate', 184, 'See Surface Materials Reference Manual; plus cost of laminate.', 'openLine'),
                 opt('Surface Materials', 'Wood group 2', 184, 'Specify wood color number.', 'woodGroup2'), opt('Surface Materials', 'Wood group 3', 654, 'Specify wood color number.', 'woodGroup3'), opt('Connecting panel cover', 'Paint price group 2', 15, 'Specify paint color number.', 'coverPaintGroup2'), opt('Connecting panel cover', 'Paint price group 3', 31, 'Specify paint color number.', 'coverPaintGroup3')],
     'tips': ['Boundary screens attach to the Answer panel at an end-of-run junction as an alternative to a panel, when power and hang-on components are not required (p80).',
              'Single-connect screens attach at the end-of-run junction only; dual-connect screens also attach to an adjacent worksurface or a 1.5-H or higher storage unit and can replace a leg (p80).',
              'Heights 30", 36", 42", 48", 54"; single-sided widths 27"-75" (24"-72" inside plus the 3" panel), spanning 51"-75", split 25 1/2"-73 1/2" per side, returns 18"/24"/30", 13/16" thick; parametric widths in 1/16" steps (p80-82).',
              'Boundary screens on a stacked panel must be at least 6" lower than the start of the stacking segment; order the change-of-height end-of-run trim separately (p83).',
              'Open Line laminates with grain go vertical only and not on screens or segments 60"W and wider; vertical wood grain laminates to 59"W (p83).',
              'A panel with a panel-connected worksurface on one side and a freestanding table on the other takes single-connect screens (p84).'],
     'columns': ['Style Number', 'Height', 'Modular Width', 'U.S. Base Prices by width'], 'rows': brow})
json.dump(cat, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print('boundary screens:', len(brow), 'matrix rows; products', len(cat['products']), 'rows', sum(len(p['rows']) for p in cat['products']))
