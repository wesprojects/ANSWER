#!/usr/bin/env python3
"""Re-price and re-page the catalog from the June 2022 Answer Solutions Specification Guide.

The 2015 catalog (data/catalog_2015.json, the build of 2026-09-22) anchors every priced row on a style number. For each row this script
finds the style on its 2015 page, reads the run of price cells after it ("$156 -$ 73" = base price, then the adders in the page's column
order; "N.A." is an empty cell), learns from the 2015 values which cell is which field, finds the same style on the 2022 page for that
product (the 2022 pages where the product's styles carry prices) and assigns the 2022 cells to the same fields. Tables whose columns
changed in 2022 are mapped explicitly in COLMAP, read from the rendered page. Rows that cannot be matched are listed in
guide2022/_reprice_report.txt and left at their 2015 values with `unpriced2022: true`, never guessed.

Usage: python update_catalog_2022.py            writes src/catalog.json and the report
       python update_catalog_2022.py --check    report only
"""
import json, os, re, sys, glob, collections
ROOT = os.path.dirname(os.path.abspath(__file__))
OLD = os.path.join(ROOT, 'data', 'catalog_2015.json')
OUT = os.path.join(ROOT, 'src', 'catalog.json')
REPORT = os.path.join(ROOT, 'guide2022', '_reprice_report.txt')

# 2022 tables whose columns differ from 2015, as the rendered pages print them (guide2022/_p539.png: straight worksurfaces with 1/2" cord drop
# gained a plastic knife edge column, suffix K, between P-edge and wood square edge; full-depth worksurfaces keep 3 mm and K). Each entry:
# product id -> { row family (by attrs.construction) : 2022 column list }, columns named as the row's priceByEdge keys, 'fullFill' = the adder.
# Column names: edge:<suffix> -> priceByEdge, suffix:<letter> -> priceBySuffix, adder:<name> -> adders. Corner, extended-corner and 120-degree
# worksurfaces keep their 2015 columns (3 mm, P, SW, full-fill) and need no map. Pedestals (guide2022/_p651_cols.png) gained a proud laminate
# front, suffix L, between the proud steel front (P) and the proud wood front (W).
WS_CORD = ['edge:3mm', 'edge:P', 'edge:K', 'edge:SW', 'adder:fullFill']; WS_FULL = ['edge:3mm', 'edge:K']; PED = ['suffix:F', 'suffix:P', 'suffix:L', 'suffix:W']
COLMAP = {'uw-straight': {'cord-drop': WS_CORD, 'full-depth': WS_FULL}, 'us-fixed-pedestals': {None: PED}, 'us-mobile-pedestals': {None: PED}}
CULLED = re.compile(r'(?<![A-Z0-9])G(\d\d)/(\d\d)(?![A-Z0-9])')   # "G10/22" after a style: scheduled to be culled, last order entry in that month (page 1)

def clean(t):  # the 2022 PDF's fonts: "fi" prints as "À " or a stray "w", the en dash as "ï", thin spaces as "ɚ"
    return (t.replace('À ', 'fi').replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace('ï', '-').replace('ɚ', ' ')
            .replace('–', '-').replace('—', '-').replace(' ', ' '))

def load(folder):
    return {int(re.search(r'p(\d+)\.txt$', f).group(1)): clean(open(f, encoding='utf-8').read()) for f in glob.glob(os.path.join(ROOT, folder, 'p*.txt'))}

CELL = re.compile(r'([+-]?)\s*\$\s*([+-]?)\s*(\d[\d,]*)|(N\.A\.)')   # "$156", "-$ 73", "+$ 30", "N.A."

def make_tokenizer(known):
    """style tokens: any known catalog style (digit-only ones included), or a letter-led capitals-and-digits token containing a digit."""
    rx = re.compile(r'(?<![A-Z0-9])([A-Z0-9]{3,16})(?![A-Z0-9])')
    def toks(text): return [m for m in rx.finditer(text) if m.group(1) in known or (m.group(1)[0].isalpha() and re.search(r'\d', m.group(1)))]
    return toks

def runs(text, toks):
    """style -> list of cell runs following it (one per occurrence): values, None for N.A., until the next style token."""
    out = collections.defaultdict(list); culled = {}
    for cm in CULLED.finditer(text):   # the culled mark sits between a style and its price: note it, then blank it so it does not split the run
        before = text[max(0, cm.start() - 20): cm.start()].split(); 
        if before: culled[before[-1]] = cm.group(0)
    text = CULLED.sub(lambda m: ' ' * len(m.group(0)), text)
    T = toks(text)
    for i, m in enumerate(T):
        seg = text[m.end(): T[i + 1].start() if i + 1 < len(T) else m.end() + 400]
        vals = []
        first = CELL.search(seg)
        if not first or first.start() > 60: continue   # a table cell follows its style within a few characters; a mention in a tip does not
        for mm in CELL.finditer(seg):
            if mm.group(4): vals.append(None); continue
            v = int(mm.group(3).replace(',', '')); neg = '-' in (mm.group(1) + mm.group(2)); vals.append(-v if neg else v)
        if any(v is not None for v in vals): out[m.group(1)].append(vals)
    out['__culled__'] = culled
    return out

def fields_of(row):
    """the priced fields of a row: price, then adders / priceByEdge / priceBySuffix entries (None-valued ones left out)."""
    f = [('price', None)] if row.get('price') is not None else []
    for k in ('adders', 'priceByEdge', 'priceBySuffix'):
        for kk, v in (row.get(k) or {}).items():
            if v is not None: f.append((k, kk))
    return f

def get(row, f): return row['price'] if f[0] == 'price' else row[f[0]][f[1]]
def put(row, f, v):
    if f[0] == 'price': row['price'] = v
    else: row.setdefault(f[0], {})[f[1]] = v

def learn(row, run):
    """cell index -> fields it feeds (equal-valued fields share a cell); None unless every field is found."""
    fields = fields_of(row); vals = [get(row, f) for f in fields]; pos = {}; done = set()
    for i, v in enumerate(run):
        if v is None: continue
        hit = [k for k, x in enumerate(vals) if x == v and k not in done]
        if hit: pos[i] = hit; done.update(hit)
        if len(done) == len(fields): break
    return pos if len(done) == len(fields) and fields else None

def apply_colmap(row, cols, run):
    """assign a 2022 run by an explicit column list; returns False when the run is shorter than the columns."""
    if len(run) < len(cols): return False
    for col, v in zip(cols, run):
        kind, name = col.split(':')
        key = {'edge': 'priceByEdge', 'suffix': 'priceBySuffix', 'adder': 'adders'}[kind]
        if v is not None: row.setdefault(key, {})[name] = v
        elif key in row: row[key].pop(name, None)
        if kind == 'edge':
            av = row['attrs'].setdefault('edgeSuffixesAvailable', [])
            if v is not None and name not in av: av.append(name)
            if v is None and name in av: av.remove(name)
    if 'priceByEdge' in row: row['price'] = row['priceByEdge'].get('3mm', row.get('price'))
    return True

def main(check=False):
    cat = json.load(open(OLD, encoding='utf-8'))
    known = {r['style'].rstrip('_') for p in cat['products'] for r in p['rows']}; toks = make_tokenizer(known)
    T15, T22 = load('guide'), load('guide2022')
    R15 = {pg: runs(t, toks) for pg, t in T15.items()}; R22 = {pg: runs(t, toks) for pg, t in T22.items()}
    priced22 = collections.defaultdict(set)
    for pg, r in R22.items():
        for s in r: priced22[s].add(pg)
    report = []; n_ok = n_fail = 0; pagemap = {}
    for p in cat['products']:
        styles = [r['style'].rstrip('_') for r in p['rows']]
        votes = collections.Counter(pg for s in set(styles) for pg in priced22.get(s, ()))
        pages22 = sorted(pg for pg, n in votes.items() if n >= max(1, len(set(styles)) / 5))
        pagemap[p['id']] = {'pages2015': p['pages'], 'pages2022': pages22}
        p['pages2015'] = p['pages']; p['pages'] = pages22
        cm = COLMAP.get(p['id'])
        for row in p['rows']:
            s = row['style'].rstrip('_'); fields = fields_of(row)
            old_pages = [row['page']] if row.get('page') else p['pages2015']
            old_runs = [run for pg in old_pages for run in R15.get(pg, {}).get(s, [])]
            new_runs = [(pg, run) for pg in (pages22 or sorted(priced22.get(s, ()))) for run in R22.get(pg, {}).get(s, [])]
            ok = False; note = ''
            if cm:
                cols = cm.get(row['attrs'].get('construction'))
                cols = cols or cm.get(None)
                if cols and new_runs:
                    pg, run = new_runs[0]; row['price2015'] = row.get('price'); row['priceByEdge2015'] = dict(row.get('priceByEdge') or {})
                    ok = apply_colmap(row, cols, run)
            elif old_runs:
                pos = next((q for run in old_runs if (q := learn(row, run))), None); L = len(next((r for r in old_runs if learn(row, r) == pos), []))
                if pos:
                    same = [(pg, run) for pg, run in new_runs if len(run) == L]; longer = [(pg, run) for pg, run in new_runs if len(run) > L]
                    shorter = [(pg, run) for pg, run in new_runs if len(run) < L and all(i < len(run) for i in pos)]
                    pick = same[0] if same else (longer[0] if longer else (shorter[0] if shorter else None))
                    if pick and not same: note = f'NOTE 2022 run {"longer" if longer else "shorter"} than 2015 ({pick[1]}), cells taken by the 2015 positions'
                    if pick and all(pick[1][i] is not None for i in pos):
                        pg, run = pick; row['price2015'] = row.get('price')
                        for i, ks in pos.items():
                            for k in ks: put(row, fields[k], run[i])
                        ok = True
            elif new_runs and len([v for v in new_runs[0][1] if v is not None]) == len(fields):  # a style corrected in 2015, printed in 2022
                pg, run = new_runs[0]; vals = [v for v in run if v is not None]
                for k, f in enumerate(fields): put(row, f, vals[k])
                row['price2015'] = row.get('price'); ok = True; note = 'NOTE style absent from the 2015 text (corrected style); 2022 cells taken in field order'
            if ok:
                mark = R22.get(pg, {}).get('__culled__', {}).get(s)
                if mark: row['culled2022'] = mark   # "G10/22": scheduled to be culled, last order entry October 16, 2022 (page 1, page 462)
                if 'page' in row: row['page2015'] = row['page']; row['page'] = pg
                row.pop('unpriced2022', None); n_ok += 1
                if note: report.append(f"{p['id']:45s} {row['style']:14s} {note}")
            else:
                n_fail += 1; row['unpriced2022'] = True
                report.append(f"{p['id']:45s} {row['style']:14s} FAIL fields {[(f[1] or f[0], get(row, f)) for f in fields]} 2015 runs {old_runs[:2]} 2022 runs {new_runs[:2]}")
    cat['source'] = 'Steelcase Answer Solutions Specification Guide, June 2022 (U.S. price list 198.B, June 20, 2022; the 9% adjustment of July 18, 2022 is not applied)'
    cat['source2015'] = 'Steelcase Answer Solutions Specification Guide, February 2015 (U.S. price list 180.F)'
    cat['pageMap'] = pagemap
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    open(REPORT, 'w', encoding='utf-8').write(f'repriced {n_ok} rows, unmatched {n_fail}\n\n' + '\n'.join(report) + '\n')
    print(f'repriced {n_ok} rows, unmatched {n_fail}; report {REPORT}')
    if not check:
        json.dump(cat, open(OUT, 'w', encoding='utf-8'), separators=(',', ':')); print('wrote', OUT)

if __name__ == '__main__':
    main('--check' in sys.argv)
