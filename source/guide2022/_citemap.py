"""Map every 2015 page the code, tests and docs cite to its June 2022 page: pricing pages through the catalog's page map (style-anchored),
understanding pages through the 2015 page's running head matched to the 2022 table of contents plus the page's offset in its subsection;
a page without a running head (a figure page) inherits the subsection of the page before it or of the facing page. Writes _citemap.json
(every 2015 page) and _citemap.txt (the cited pages, both headings side by side for review)."""
import re, glob, json, collections, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def clean(t): return re.sub(r'[·\.]{5,}', '', t.replace('À ', 'fi').replace('ﬁ', 'fi').replace('\U00100077', 'fi').replace('􀁷', 'fi').replace('ï', '-').replace('ɚ', ' ').replace('⁄', '/').replace('¼', '/'))
T15 = {int(re.search(r'p(\d+)', f).group(1)): clean(open(f, encoding='utf-8').read()) for f in glob.glob(os.path.join(ROOT, 'guide', 'p*.txt'))}
T22 = {int(re.search(r'p(\d+)', f).group(1)): clean(open(f, encoding='utf-8').read()) for f in glob.glob(os.path.join(ROOT, 'guide2022', 'p*.txt'))}
lines = open(os.path.join(ROOT, 'guide2022', '_toc.txt'), encoding='utf-8').read().split('\n')
toc22 = []
for l in lines[1:]:
    if l.startswith('=='): break
    m = re.match(r'^(\s*)(.*?)\s+-> p(\d+)$', l)
    if m: toc22.append((clean(m.group(2)).strip(), int(m.group(3))))
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', t.lower().replace('—', ' ').replace('–', ' ').replace(', continued', '')).strip()
sec22 = collections.defaultdict(list)
for t, pg in toc22: sec22[norm(t)].append(pg)
starts22 = sorted(pg for _, pg in toc22)
def sec_len22(pg): nxt = [q for q in starts22 if q > pg]; return (nxt[0] - pg) if nxt else 4
GENERIC = re.compile(r'(Panels|Shared Components|Wiring and Cabling|Universal Storage)')
def sub15(pg):
    ls = [re.sub(r'\s{3,}.*$', '', l).strip() for l in T15[pg].split('\n') if l.strip()][:6]
    cands = [l for l in ls if norm(l) in sec22 and not GENERIC.fullmatch(l)]
    if cands:
        specific = [c for c in cands if norm(c) != 'universal systems worksurfaces']
        return specific[0] if specific else cands[0]
    raw = [l.strip() for l in T15[pg].split('\n') if l.strip()][:10]
    for n in (2, 3):   # titles wrapped over two or three lines
        for i in range(len(raw) - n + 1):
            j = ' '.join(raw[i: i + n])
            if norm(j) in sec22: return j
    return None
subs = {pg: sub15(pg) for pg in sorted(T15)}
for pg in sorted(T15):   # a figure page inherits the subsection of the page before it, or of the facing page after it
    if not subs[pg] and pg <= 300:
        if subs.get(pg - 1): subs[pg] = subs[pg - 1]
        elif subs.get(pg + 1): subs[pg] = subs[pg + 1]
cat = json.load(open(os.path.join(ROOT, 'src', 'catalog.json'), encoding='utf-8'))
prodmap = collections.defaultdict(set)
for p in cat['products']:
    for a in p['pages2015']: prodmap[a].update(p['pages'])
    for r in p['rows']:
        if r.get('page2015') and r.get('page'): prodmap[r['page2015']].add(r['page'])
res = {}; last = 1
for pg in sorted(T15):
    if prodmap.get(pg): q = sorted(prodmap[pg])[0]; how = 'product'
    else:
        s = subs.get(pg); q = None; how = 'section'
        if s:
            key = norm(s); cands = sec22[key]
            off = 0; r = pg - 1
            while r in subs and subs[r] and norm(subs[r]) == key: off += 1; r -= 1
            st = min(cands, key=lambda c: abs(c - last)); q = st + min(off, max(sec_len22(st) - 1, 0))
    if q: last = q
    res[pg] = {'p2022': q, 'how': how, 'sub2015': subs.get(pg)}
json.dump(res, open(os.path.join(ROOT, 'guide2022', '_citemap.json'), 'w'), indent=0)
cited = set()
for f in ['src/engine.js', 'src/capdxf.js', 'src/planner.js', 'src/planner.html', 'README.md', 'CLAUDE.md'] + glob.glob(os.path.join(ROOT, 'test', '*.js')):
    txt = open(os.path.join(ROOT, f), encoding='utf-8').read()
    for m in re.finditer(r'\bp(\d{1,3})(?:[–-](\d{1,3}))?\b', txt):
        a = int(m.group(1)); b = int(m.group(2)) if m.group(2) else a
        if 1 <= a <= 766 and a <= b <= 766 and b - a < 12: cited.update(range(a, b + 1))
def heading22(t):
    ls = [l.strip() for l in t.split('\n') if l.strip()]
    ls = [l for l in ls if not re.fullmatch(r'\d+', l) and 'Specification Guide' not in l and 'Canadian' not in l and 'Steelcase' not in l and 'June 2022' not in l and 'See page 1' not in l and 'Multiply' not in l and len(l) > 3]
    return ' / '.join(ls[:3])[:70]
with open(os.path.join(ROOT, 'guide2022', '_citemap.txt'), 'w', encoding='utf-8') as out:
    for pg in sorted(cited):
        r = res[pg]; q = r['p2022']
        out.write(f"{pg:4d} -> {str(q):5s} [{r['how']:7s}] 2015: {(r['sub2015'] or heading22(T15[pg]))[:60]:60s} | 2022: {heading22(T22[q]) if q else '-'}\n")
print('cited', len(cited), 'unmapped', sum(1 for pg in cited if not res[pg]['p2022']))
