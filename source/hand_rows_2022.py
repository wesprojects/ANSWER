#!/usr/bin/env python3
"""Rows of the June 2022 guide that the pattern matcher of add_rows_2022.py could not place, entered from the pages named on each row.
Runs after update_catalog_2022.py and add_rows_2022.py; idempotent (rows already present are replaced)."""
import json, os, importlib.util
ROOT = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(ROOT, 'src', 'catalog.json')
spec = importlib.util.spec_from_file_location('a', os.path.join(ROOT, 'add_rows_2022.py')); A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
u = A.u
cat = json.load(open(OUT, encoding='utf-8')); P = {p['id']: p for p in cat['products']}

def upsert(pid, row):
    p = P[pid]; p['rows'] = [r for r in p['rows'] if r['style'] != row['style']]; row['added2022'] = True; p['rows'].append(row)
    if row.get('page') and row['page'] not in p['pages']: p['pages'] = sorted(p['pages'] + [row['page']])

# 24"H recessed frameless glass screens (guide2022 p398): base price, wood top cap, omit glass, frosted glass, as the 6"/12"/18" rows
T = u.load('guide2022'); toks = u.make_tokenizer(set()); R = u.runs(T[398], toks)
sib = next(r for r in P['thin-frameless-glass-screen-recessed']['rows'] if r['style'] == 'TS71824TFGR')
for w in (24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96):
    s = f'TS724{w}TFGR'; run = R[s][0]; assert len(run) == 4, (s, run)
    upsert('thin-frameless-glass-screen-recessed', {'group': '24"H Recessed Frameless Glass', 'attrs': {'height': 24, 'width': w}, 'style': s, 'price': run[0],
           'adders': {'woodTopCap': run[1], 'omitGlass': run[2], 'frostedGlass': run[3]}, 'page': 398})

# Junction grommets for frameless glass (guide2022 p399): two standard junction grommets, $5; required where recessed glass meets a
# change of height, a utility pole, or a boundary screen (p399)
upsert('thin-recessed-frameless-glass-top-cap-connector', {'attrs': {'description': 'Junction grommets for frameless glass (two standard junction grommets)'}, 'style': 'TS7FGJG', 'price': 5, 'page': 399})
P['thin-recessed-frameless-glass-top-cap-connector']['name'] = 'Recessed Frameless Glass Top Cap Connector and Junction Grommets for Frameless Glass—Thin Trim'

# Pedestal cushion tops for field installation on RPM2421C__ only (guide2022 p656)
for s, price, handle, d, note in (('RPXTC24F', 443, False, 22.625, 'For use with RPM2421CF only'), ('RPXTC24P', 443, False, 23.5, 'For use with RPM2421CP, RPM2421CL, and RPM2421CW only'),
                                   ('RPXTCH24F', 595, True, 22.625, 'For use with RPM2421CF only'), ('RPXTCH24P', 595, True, 23.5, 'For use with RPM2421CP, RPM2421CL, and RPM2421CW only')):
    upsert('us-mobile-pedestals', {'group': 'Pedestal Cushion Top for Field Installation on RPM2421C__ only', 'style': s, 'desc': f'Cushion top {"with black handle" if handle else "without handle"}, {d}"D x 15"W x 2 1/4"H ({note})',
           'attrs': {'kind': 'cushion top', 'handle': handle, 'actualDepth': d, 'width': 15, 'height': 2.25, 'forPedestal': 'RPM2421C'}, 'price': price, 'page': 656})

# Parametric markerboard surface for steel skins (guide2022 p481): one style, priced by width band x height band
bands_w = [(12, 17.9375), (18, 23.9375), (24, 29.9375), (30, 35.9375), (36, 41.9375), (42, 47.9375), (48, 53.9375), (54, 59.9375), (60, 65.9375), (66, 71.9375), (72, 77.9375), (78, 83.9375), (84, 89.9375), (90, 95.9375), (96, 96)]
bands_h = [(12, 16.1875), (16.25, 23.9375), (24, 35.9375), (36, 36)]
run = R481 = u.runs(T[481], toks)['TS7MBSP'][0]
assert len(run) >= 4 * len(bands_w), len(run)
matrix = [run[i * 4:(i + 1) * 4] for i in range(len(bands_w))]
upsert('sh-markerboard-surfaces', {'group': 'Parametric Markerboard Surface for Steel Skins', 'style': 'TS7MBSP', 'attrs': {'skinType': 'markerboard surface', 'parametric': True, 'heightRange': [12, 36], 'widthRange': [12, 96]},
       'price': matrix[0][0], 'priceMatrix': {'widthBands': bands_w, 'heightBands': bands_h, 'prices': matrix}, 'desc': 'Flexible magnetic markerboard surface for steel skins, 12"H-36"H x 12"W-96"W, priced by width and height band (p481)', 'page': 481})

json.dump(cat, open(OUT, 'w', encoding='utf-8'), separators=(',', ':')); print('hand rows entered')

# ---- option adders the text matcher could not place, read from the rendered or quoted 2022 pages ----
cat = json.load(open(OUT, encoding='utf-8')); P = {p['id']: p for p in cat['products']}
def setopt(pid, name_start, price, page, note=None):
    hits = [o for o in P[pid]['options'] if o['name'].startswith(name_start)]
    assert hits, (pid, name_start)
    for o in hits:
        o.setdefault('price2015', o['price']); o['price'] = price; o.pop('unpriced2022', None); o['page2022'] = page
        if note: o['priceNote'] = note
# p590 (guide2022/_p590.png): center support panels +$17 / +$30, end panels +$41 / +$68
setopt('uw-center-support-panels', 'Paint price group 2', 17, 590); setopt('uw-center-support-panels', 'Paint price group 3', 30, 590)
setopt('uw-end-panels', 'Paint price group 2', 41, 590); setopt('uw-end-panels', 'Paint price group 3', 68, 590)
# p651 / p656: basic drawers (no rails, pencil trays or box drawer dividers) -$73 on box/file and box/box/file pedestals
setopt('us-fixed-pedestals', 'Basic drawers', -73, 651); setopt('us-mobile-pedestals', 'Basic drawers', -73, 656)
# p654-p655: mobile pedestal tops are priced by laminate or wood price group in 2022; the option carries the group 1 price and the others in the note
setopt('us-mobile-pedestals', '1 3/16"H square edge laminate top', 404, 654, 'Laminate price group 1 +$404, group 2 +$410, group 3 +$420 (p654-655)')
setopt('us-mobile-pedestals', '1 7/16"H bullnose laminate top', 459, 654, 'Laminate price group 1 +$459, group 2 +$465, group 3 +$475 (p654-655)')
setopt('us-mobile-pedestals', '1 3/16"H wood veneer top', 546, 655, 'Wood price group 1 +$546; groups 2 and 3 see information at left (p655)')
setopt('us-mobile-pedestals', "Customer's Own Material", 21, 655)
# p449, p451: oval utility packages, change-of-height cable routing at one end / both ends of the top cap +$6 (unchanged)
for pid in ('oval-ceiling-access-lay-in-utility-package', 'oval-floor-access-lay-in-utility-package'):
    setopt(pid, 'Change-of-height cable routing', 6, 449 if 'ceiling' in pid else 451)
json.dump(cat, open(OUT, 'w', encoding='utf-8'), separators=(',', ':')); print('hand options entered')
