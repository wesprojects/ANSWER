"""Rewrite the 2015 page citations in the source, tests and docs to June 2022 pages.

A citation `pNN` or `pNN-MM` becomes the 2022 page(s) when every page in it maps with confidence: pricing pages through the catalog's
style-anchored page map, understanding pages when the mapped 2022 page's own heading carries the 2015 subsection title (or the mapping was
pinned by hand from the rendered headings, OVERRIDES). Any other citation is kept as printed but marked `2015 pNN`, so nothing is ever
cited against the wrong page. Writes _recite_report.txt with every rewrite and every citation left as 2015.
"""
import re, json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = {int(k): v for k, v in json.load(open(os.path.join(ROOT, 'guide2022', '_citemap.json'), encoding='utf-8')).items()}
# pinned from the rendered/quoted 2022 headings (2026-09-25): figure pages of spreads and same-titled sections the mapper mixed up
OVERRIDES = {27: 33, 50: 58, 51: 59, 54: 62, 55: 63, 56: 64, 57: 65, 58: 66, 60: 68, 66: 78, 107: 124, 108: 126, 116: 138, 118: 140, 146: 172,
             158: 184, 162: 188, 163: 189, 164: 190, 206: 222, 207: 223, 208: 224, 209: 225, 274: 316, 709: 724, 714: 732,
             88: 104, 124: 148, 125: 149, 126: 150, 127: 151, 137: 161, 523: 565}
def clean(t): return t.replace('À ', 'fi').replace('ï', '-').replace('ɚ', ' ')
T22 = {int(re.search(r'p(\d+)', f).group(1)): clean(open(f, encoding='utf-8').read()) for f in glob.glob(os.path.join(ROOT, 'guide2022', 'p*.txt'))}
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', t.lower().replace('—', ' ').replace('–', ' ').replace(', continued', '')).strip()
def confident(pg):
    if pg in OVERRIDES: return OVERRIDES[pg]
    r = M.get(pg)
    if not r or not r['p2022']: return None
    if r['how'] == 'product': return r['p2022']
    sub = r.get('sub2015')
    if not sub: return None
    key = ' '.join(norm(sub).split()[:3]); head = norm(' '.join(T22[r['p2022']].split('\n')[:12]))
    return r['p2022'] if key and key in head else None
import sys
FILES = sys.argv[1:] or ['src/engine.js', 'src/capdxf.js', 'src/planner.js', 'src/planner.html', 'README.md', 'CLAUDE.md'] + sorted(glob.glob(os.path.join(ROOT, 'test', '*.js')))
CITE = re.compile(r'(?<![A-Za-z0-9_])(2015 |2022 )?p(\d{1,3})(?:([–-])(\d{1,3}))?(?![A-Za-z0-9_"])')
report = []; kept = set(); done = set()
for f in FILES:
    path = f if os.path.isabs(f) else os.path.join(ROOT, f)
    s = open(path, encoding='utf-8', newline='').read(); orig = s
    def sub(m):
        if m.group(1): return m.group(0)                      # already marked as a 2015 or a 2022 page
        a = int(m.group(2)); b = int(m.group(4)) if m.group(4) else a
        if not (1 <= a <= 766 and a <= b <= 766 and b - a < 12): return m.group(0)   # not a page citation (a size, a count)
        # a citation inside a style number or a word like 'p24' in code identifiers is excluded by the lookbehind; still skip 'top', 'wsp' etc.
        pages = list(range(a, b + 1)); targets = [confident(p) for p in pages]
        if all(targets) and (len(pages) == 1 or targets == list(range(targets[0], targets[0] + len(pages)))):
            done.update(pages); return f'p{targets[0]}' if len(pages) == 1 else f'p{targets[0]}{m.group(3)}{targets[-1]}'
        if all(targets):   # every page maps but not contiguously: list them
            done.update(pages); return 'p' + '/'.join(str(t) for t in sorted(set(targets)))
        kept.update(pages); return '2015 ' + m.group(0)
    if path.endswith('.js'):   # code: rewrite only inside comments and string literals, never an identifier such as p1
        # template literals may nest one level inside ${...}: `a ${x ? `b` : ''} c`
        REGION = re.compile(r"//[^\n]*|/\*.*?\*/|'(?:\\.|[^'\\\n])*'|\"(?:\\.|[^\"\\\n])*\"|`(?:\\.|\$\{(?:[^{}`]|`(?:\\.|[^`\\])*`)*\}|[^`\\])*`", re.S)
        s = REGION.sub(lambda r: CITE.sub(sub, r.group(0)), s)
    else: s = CITE.sub(sub, s)
    if s != orig:
        open(path, 'w', encoding='utf-8', newline='').write(s); report.append(f'{f}: rewritten')
open(os.path.join(ROOT, 'guide2022', '_recite_report.txt'), 'w', encoding='utf-8').write('\n'.join(report) + '\n\nrewritten pages: ' + ' '.join(f'{p}->{confident(p)}' for p in sorted(done)) + '\n\nleft as 2015 pages: ' + ' '.join(str(p) for p in sorted(kept)) + '\n')
print('rewritten', len(done), 'pages; left as 2015:', sorted(kept))
