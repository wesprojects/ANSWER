#!/usr/bin/env python3
"""Add the June 2022 guide's new rows to the catalog's existing products.

`guide2022/_newrows.py` lists every priced style on an existing product's 2022 pages that the product does not have (guide2022/_newrows.json).
Each new style is matched to a sibling row of the same product with the same letter skeleton (the style with its digits and the height code
Q removed); the sibling's attributes are copied and the numeric part re-read from the new style: base junctions, trims, posts and stackers
carry the height as a number (TS736TIPJ = 36"H), change-of-height junctions carry one code per leg (3 = 30", Q = 36", 4 = 42", 8 = 48",
5 = 54", 6 = 66", 7 = 78"; guide2022 p357-p371), tiles carry height then width (TS72424TFGR = 24"H x 24"W). Prices come from the 2022 run in
the sibling's cell layout. Styles this cannot place are reported in guide2022/_addrows_report.txt for hand entry, never guessed.
"""
import json, os, re, sys, collections, importlib.util
ROOT = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('u', os.path.join(ROOT, 'update_catalog_2022.py')); u = importlib.util.module_from_spec(spec); spec.loader.exec_module(u)
CODES = {'3': 30, 'Q': 36, '4': 42, '8': 48, '5': 54, '6': 66, '7': 78}
HEIGHT_ATTRS = ('heightA', 'heightB', 'heightC', 'heightD')
NUM_ATTRS = ('height', 'stackHeight', 'width', 'depth')

def skeleton(s): return re.sub(r'[0-9Q]', '', s)
def split(s):
    m = re.match(r'^(TS7|TS6|TS5)([0-9Q]+)([A-Z0-9]*)$', s)
    return (m.group(1), m.group(2), m.group(3)) if m else None

def new_attrs(sib, s):
    """the sibling's attrs with the numbers re-read from the new style; None when the style's numeric part cannot be explained."""
    a = dict(sib['attrs']); ps, pn = split(sib['style'].rstrip('_')), split(s)
    if not ps or not pn or ps[0] != pn[0] or skeleton(ps[2]) != skeleton(pn[2]): return None
    codes_s, codes_n = ps[1], pn[1]
    legs = [k for k in HEIGHT_ATTRS if k in a]
    if legs:   # one code per leg
        if len(codes_s) != len(legs) or len(codes_n) != len(legs) or any(ch not in CODES for ch in codes_n): return None
        for k, ch in zip(legs, codes_n): a[k] = CODES[ch]
        tall = max(a[k] for k in legs); names = [k[-1] for k in legs]
        a['configuration'] = ' and '.join(n for n, k in zip(names, legs) if a[k] == tall) + ' tall; ' + ' and '.join(n for n, k in zip(names, legs) if a[k] != tall) + ' low'
        return a
    nums = [k for k in NUM_ATTRS if k in a and isinstance(a[k], (int, float)) and float(a[k]).is_integer()]
    # the sibling's numeric part is the concatenation of its numeric attrs in some order
    for order in ([nums[i] for i in idx] for idx in __import__('itertools').permutations(range(len(nums)))):
        if ''.join(str(int(a[k])) for k in order) == codes_s:
            widths = [len(str(int(a[k]))) for k in order]
            if len(order) == 1: a[order[0]] = int(codes_n) if codes_n.isdigit() else CODES.get(codes_n); return a if a[order[0]] else None
            if sum(widths) != len(codes_n) or not codes_n.isdigit(): return None
            i = 0
            for k, w in zip(order, widths): a[k] = int(codes_n[i: i + w]); i += w
            return a
    return None

def main(check=False):
    cat = json.load(open(os.path.join(ROOT, 'src', 'catalog.json'), encoding='utf-8')); P = {p['id']: p for p in cat['products']}
    new = json.load(open(os.path.join(ROOT, 'guide2022', '_newrows.json'), encoding='utf-8'))['existing']
    T22 = u.load('guide2022'); known = {r['style'].rstrip('_') for p in cat['products'] for r in p['rows']}; toks = u.make_tokenizer(known | {e['style'] for e in new})
    R22 = {pg: u.runs(T22[pg], toks) for pg in {e['page'] for e in new}}
    report = []; added = collections.Counter()
    for e in new:
        p = P[e['pid']]; s = e['style']
        sibs = [r for r in p['rows'] if skeleton(r['style'].rstrip('_')) == skeleton(s) and split(r['style'].rstrip('_')) and split(s)]
        cands = [(r, new_attrs(r, s)) for r in sibs]; cands = [(r, a) for r, a in cands if a]
        if not cands: report.append(f"{e['pid']:44s} {s:14s} run {e['run']} NO SIBLING PATTERN (sibling by distance {e['sibling']})"); continue
        sib, attrs = cands[0]
        # the sibling's 2022 cell layout on this page (or its own page) gives the field positions
        sruns = R22.get(e['page'], {}).get(sib['style'].rstrip('_')) or [run for pg in p['pages'] for run in u.runs(T22[pg], toks).get(sib['style'].rstrip('_'), [])]
        pos = next((q for run in sruns if (q := u.learn(sib, run))), None)
        run = e['run']
        if not pos or any(i >= len(run) or run[i] is None for i in pos):
            report.append(f"{e['pid']:44s} {s:14s} run {run} sibling {sib['style']} CELLS DO NOT MATCH the sibling layout {sruns[:1]}"); continue
        row = {k: v for k, v in sib.items() if k not in ('price2015', 'page2015', 'printedStyle', 'correction', 'note', 'unpriced2022', 'culled2022')}
        row = json.loads(json.dumps(row)); row['attrs'] = attrs; row['style'] = s; row['page'] = e['page']; row['added2022'] = True
        if 'desc' in row: row['desc'] = re.sub(r'\d+"', lambda m: m.group(0), row['desc'])
        fields = u.fields_of(sib)
        for i, ks in pos.items():
            for k in ks: u.put(row, fields[k], run[i])
        if e.get('culled'): row['culled2022'] = e['culled']
        # the W suffix is the wood trim group in every junction and trim family (2015 rows carry it already)
        if s.endswith('W') and not sib['style'].endswith('W'): report.append(f"{e['pid']:44s} {s:14s} NOTE wood-trim style matched to a painted sibling"); continue
        p['rows'].append(row); added[e['pid']] += 1
    open(os.path.join(ROOT, 'guide2022', '_addrows_report.txt'), 'w', encoding='utf-8').write(f'added {sum(added.values())} rows: {dict(added)}\n\n' + '\n'.join(report) + '\n')
    print('added', sum(added.values()), dict(added)); print('unresolved', len([r for r in report if 'NOTE' not in r]))
    if not check: json.dump(cat, open(os.path.join(ROOT, 'src', 'catalog.json'), 'w', encoding='utf-8'), separators=(',', ':')); print('wrote catalog')

if __name__ == '__main__':
    main('--check' in sys.argv)
