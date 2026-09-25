import json, re, glob, collections, importlib.util, sys
spec = importlib.util.spec_from_file_location('u', 'update_catalog_2022.py'); u = importlib.util.module_from_spec(spec); spec.loader.exec_module(u)
c = json.load(open('src/catalog.json', encoding='utf-8'))
known = {r['style'].rstrip('_') for p in c['products'] for r in p['rows']}
STY = re.compile(r'^(TS|US|WS|UC|WC|UE|WE|UB|RP|UP|UD|UH|UT|UW|UF|UL|UM|UO|UA|UK|BB|BX|BY|CB|CF|CQ|SB|SP)[A-Z0-9]{2,14}$')
toks = u.make_tokenizer(known)
T = {int(re.search(r'p(\d+)', f).group(1)): u.clean(open(f, encoding='utf-8').read()) for f in glob.glob('guide2022/p*.txt')}
R = {pg: u.runs(t, toks) for pg, t in T.items()}
claimed = {}; out = {'existing': [], 'newpages': {}}
for p in c['products']:
    mine = {r['style'].rstrip('_') for r in p['rows']}
    for pg in p['pages']:
        for s, rs in R[pg].items():
            if s == '__culled__' or s in known or not STY.match(s) or s in claimed: continue
            claimed[s] = p['id']
            sib = min(mine, key=lambda m: sum(a != b for a, b in zip(m, s)) + abs(len(m) - len(s)))
            out['existing'].append({'pid': p['id'], 'page': pg, 'style': s, 'run': rs[0], 'sibling': sib, 'culled': R[pg]['__culled__'].get(s)})
prodpages = {pg for p in c['products'] for pg in p['pages']}
for pg, r in R.items():
    if pg > 740: continue
    for s, rs in r.items():
        if s != '__culled__' and s not in known and s not in claimed and STY.match(s) and pg not in prodpages:
            out['newpages'].setdefault(pg, []).append({'style': s, 'run': rs[0], 'culled': r['__culled__'].get(s)})
json.dump(out, open('guide2022/_newrows.json', 'w'), indent=0)
print('new rows on existing products:', len(out['existing']), collections.Counter(e['pid'] for e in out['existing']))
for pg in sorted(out['newpages']):
    head = ' / '.join(l.strip() for l in T[pg].split('\n') if l.strip() and 'Speci' not in l)[:80]
    print(f"p{pg} ({len(out['newpages'][pg])}): {head}  e.g. {[x['style'] for x in out['newpages'][pg][:5]]}")
