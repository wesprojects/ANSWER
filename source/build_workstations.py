#!/usr/bin/env python3
"""Convert the Universal worksurface, support and pedestal families (data/*.json) into catalog products
for the ANSWER configurator. Imported by build_catalog.py."""
import json, os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')

def load(f): return json.load(open(os.path.join(DATA, f), encoding='utf-8'))
def fam(d, fid): return next(f for f in d['families'] if f['id'] == fid)
def pages(f):
    p = f['page']; return list(p) if isinstance(p, list) else [p]
def code_of(name):
    n = name.lower()
    m = re.match(r'paint price group (\d)', n)
    if m: return 'paintGroup' + m.group(1)
    m = re.match(r'fabric price group (\d+)', n)
    if m: return 'fabricGroup' + m.group(1)
    if n.startswith('open line laminate'): return 'openLine'
    if n.startswith('premium wood 2'): return 'premiumWood2'
    if n.startswith('premium wood 3'): return 'premiumWood3'
    if n.startswith('customiz stain'): return 'customizStain' + ('Pull' if 'pull' in n else ('Top' if 'top' in n else ''))
    if n.startswith('full-fill'): return 'fullFill'
    if n.startswith('omit scallop'): return 'omitScallop'
    if n.startswith('cutout'): return 'cutout'
    if n.startswith('full-width wood veneer pull'): return 'woodPull'
    if n in ('contemporary', 'handle', 'jazz', 'bar', 'c:scape'): return 'pull' + n.replace(':', '').title()
    if n.startswith('rails'): return 'rails'
    if n.startswith('basic drawers'): return 'basicDrawers'
    if n.startswith('ember chrome'): return 'emberLock'
    if n.startswith('no lock'): return 'noLock'
    if n.startswith('individual locking'): return 'individualLocks'
    if n.startswith('factory- and field'): return 'keying'
    if 'steel top' in n and '1"h' in n: return 'topSteel1'
    if 'square edge laminate top' in n: return 'topLaminate'
    if 'bullnose laminate top' in n: return 'topLaminateBullnose'
    if 'open line laminate on laminate top' in n: return 'topOpenLine'
    if 'wood veneer top' in n and 'premium' not in n and 'customiz' not in n: return 'topWood'
    if 'cushion top without' in n: return 'cushionTop'
    if 'cushion top with black' in n: return 'cushionTopHandle'
    if 'leather price group' in n and 'elmo' not in n: return 'leather'
    if 'elmosoft' in n: return 'elmosoft'
    if n.startswith("customer's own"): return 'com'
    return re.sub(r'[^a-z0-9]+', '_', n).strip('_')[:40]

def options(f):
    out, seen = [], {}
    for o in f.get('options', []):
        c = code_of(o['name'])
        if c in seen: c = c + str(seen[c] + 1)
        seen[c.rstrip('0123456789')] = seen.get(c.rstrip('0123456789'), 0) + 1
        out.append({'group': o.get('group', ''), 'name': o['name'], 'code': c, 'price': o.get('price'), 'priceText': o.get('priceText', ''), 'spec': o.get('spec', ''), 'appliesTo': o.get('appliesTo', '')})
    return out

def product(f, pid, category, name=None, trim=None):
    p = {'id': pid, 'trim': trim, 'category': category, 'name': name or f['title'], 'pages': pages(f), 'sections': ['Universal Systems Worksurfaces' if category.startswith('Worksurface') or category in ('Support', 'Leg') else 'Universal Storage'],
         'detailsPages': [f['understandingPage']] if f.get('understandingPage') else [],
         'standardIncludes': f.get('standardIncludes', []), 'requiredToSpecify': f.get('requiredToSpecify', []), 'options': options(f),
         'tips': f.get('tips', []), 'notes': f.get('notes', []), 'columns': f.get('columns', []), 'rows': []}
    return p

EDGE_COLS = {'P': 'Plastic P-Edge (Suffix P)', 'SW': 'Wood Square Edge (Suffix SW)', 'K': 'Plastic Knife Edge (Suffix K)'}
def ws_rows(f, kind):
    rows = []
    for it in f['items']:
        a = dict(it['attrs']); op = it.get('optionPrices') or {}
        price_by = {'3mm': it['price']}
        for suf, col in EDGE_COLS.items():
            if op.get(col) is not None: price_by[suf] = op[col]
        adders = {}
        ff = op.get('Full-Fill Finish (Option, add $ to base price; wood)')
        if ff is not None: adders['fullFill'] = ff
        a['kind'] = kind
        if kind != 'straight':
            a['depth'] = a.get('depthA'); a['width'] = a.get('widthC')
        rows.append({'style': it['style'], 'desc': it['desc'], 'attrs': a, 'price': it['price'], 'priceByEdge': price_by, 'adders': adders, 'page': it.get('page')})
    return rows

def plain_rows(f):
    return [{'style': it['style'], 'desc': it['desc'], 'attrs': it.get('attrs', {}), 'price': it.get('price'), 'page': it.get('page')} for it in f['items']]

def ped_rows(f):
    rows = []
    for it in f['items']:
        rows.append({'style': it['style'], 'baseStyle': it.get('baseStyle', it['style'].rstrip('_')), 'desc': it['desc'], 'attrs': it['attrs'], 'price': None, 'priceBySuffix': it['priceBySuffix'], 'page': it.get('page')})
    return rows

def build():
    A = load('univ-ws-a.json'); B = load('univ-ws-b.json'); S = load('univ-storage.json')
    out = []
    for fid, pid, kind, nm in [('straight', 'uw-straight', 'straight', 'Straight Worksurfaces'), ('corner-curved-front', 'uw-corner-curved', 'corner', 'Corner, Curved-Front Worksurfaces'),
                               ('extended-corner-curved-front', 'uw-extended-corner-curved', 'extcorner', 'Extended Corner, Curved-Front Worksurfaces'), ('corner-120', 'uw-corner-120', 'corner120', 'Corner, 120° Worksurfaces')]:
        f = fam(A, fid); p = product(f, pid, 'Worksurface', nm); p['rows'] = ws_rows(f, kind); out.append(p)
    for fid, pid, cat in [('univ-cantilever', 'uw-cantilever', 'Support'), ('univ-side-support-brackets', 'uw-side-support-brackets', 'Support'), ('univ-support-plate', 'uw-support-plate', 'Support'),
                          ('univ-tie-plates', 'uw-tie-plates', 'Support'), ('univ-reinforcing-channels', 'uw-reinforcing-channels', 'Support'), ('univ-center-support-panels', 'uw-center-support-panels', 'Support'),
                          ('univ-end-panels', 'uw-end-panels', 'Support'), ('univ-off-module-ws-to-panel-connector', 'uw-off-module-connector', 'Support'), ('univ-post-legs-double-post-legs', 'uw-post-legs', 'Leg')]:
        f = fam(B, fid); p = product(f, pid, cat); p['rows'] = plain_rows(f); out.append(p)
    for fid, pid in [('univ-fixed-pedestals', 'us-fixed-pedestals'), ('univ-mobile-pedestals', 'us-mobile-pedestals')]:
        f = fam(S, fid); p = product(f, pid, 'Pedestal'); p['rows'] = ped_rows(f); out.append(p)
    for fid, pid in [('univ-pedestal-fillers', 'us-pedestal-fillers'), ('univ-ped-conversion-kits', 'us-ped-conversion-kits')]:
        f = fam(S, fid); p = product(f, pid, 'Pedestal'); p['rows'] = plain_rows(f); out.append(p)
    # rules worth carrying into the app (page-referenced)
    rules = [r for r in B['rules'] if r.get('page') in (207, 208, 216, 217, 218) and r.get('topic') in ('support', 'panel-supports', 'span', 'knife-edge', 'reinforcement', 'off-module-connector')]
    rules += [r for r in S['rules'] if r.get('page') in (272, 273) and r.get('topic') == 'pedestals']
    return out, rules

if __name__ == '__main__':
    prods, rules = build()
    for p in prods: print(p['id'], len(p['rows']), 'rows', len(p['options']), 'options', p['pages'])
    print(len(rules), 'rules')
