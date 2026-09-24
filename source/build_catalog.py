#!/usr/bin/env python3
"""Merge the extracted spec-guide JSON into one catalog for the ANSWER configurator."""
import json, os, re, collections
SRC = '/tmp/claude-0/-home-claude/4752eaf4-377e-53a8-9808-b195f2680e30/scratchpad/spec/out'
OUT = os.path.join(os.path.dirname(__file__), 'src', 'catalog.json')

products = collections.OrderedDict()
for f in ['thin_a', 'thin_b', 'oval', 'shared_a', 'shared_b', 'wiring']:
    for p in json.load(open(os.path.join(SRC, f + '.json'))):
        p.pop('_src', None)
        if p['id'] in products:
            # same shared product listed in two sections: union sections/pages
            q = products[p['id']]
            q['sections'] = sorted(set(q.get('sections', []) + p.get('sections', [])))
            q['pages'] = sorted(set(q['pages'] + p['pages']))
            q['detailsPages'] = sorted(set(q.get('detailsPages', []) + p.get('detailsPages', [])))
            continue
        products[p['id']] = p

# ---- corrections approved by Wes 2026-09-22 (guide typos) ----
def fix(pid, height, jt, printed, corrected):
    p = products[pid]
    n = 0
    for r in p['rows']:
        if r['attrs'].get('height') == height and r['attrs'].get('junctionType') == jt and r['style'] == printed:
            r['style'] = corrected
            r['printedStyle'] = printed
            r['correction'] = f'Guide prints {printed} in the {height}" row (duplicate of the 42" row). Corrected to {corrected} to follow the height pattern. Verify with Steelcase before ordering.'
            r.pop('uncertain', None); r.pop('note', None)
            n += 1
    assert n == 1, (pid, n)
fix('square-v-y-base-junction', 48, 'V', 'TS742SVPJW', 'TS748SVPJW')
fix('oval-v-y-base-junction', 48, 'V', 'TS742VPJ', 'TS748VPJ')

# color 6612 on Series 9000 grommets: offer, mark verify
for o in products['wc-series-9000-duplex-cable-grommets']['options']:
    if o['code'] == 'color6612':
        o['verify'] = 'Guide shows a small symbol after 6612 Grey V2 (possibly transitional). Verify availability.'

# style index (for the catalog browser and duplicates check)
index = {}
dups = []
for p in products.values():
    for r in p['rows']:
        key = r['style']
        if key in index and index[key] != p['id']:
            dups.append((key, index[key], p['id']))
        index.setdefault(key, p['id'])
print('duplicate styles across products:', dups)

surface = json.load(open(os.path.join(SRC, 'surface.json')))

# Universal worksurfaces, supports and pedestals (data/univ-*.json) for workstations
import build_workstations
ws_products, ws_rules = build_workstations.build()
for p in ws_products:
    assert p['id'] not in products, p['id']
    products[p['id']] = p
    for r in p['rows']:
        if r['style'] in index and index[r['style']] != p['id']: dups.append((r['style'], index[r['style']], p['id']))
        index.setdefault(r['style'], p['id'])
print('workstation products:', len(ws_products), 'duplicates now:', dups)

catalog = {
    'source': 'Steelcase Answer Solutions Specification Guide, February 2015 (U.S. price list 180.F)',
    'products': list(products.values()),
    'surface': surface,
    'workstationRules': ws_rules,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(catalog, open(OUT, 'w'), separators=(',', ':'))
print(len(products), 'products', sum(len(p['rows']) for p in products.values()), 'rows ->', OUT, os.path.getsize(OUT), 'bytes')
