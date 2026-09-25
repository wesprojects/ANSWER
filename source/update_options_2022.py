#!/usr/bin/env python3
"""Re-price the products' option adders (paint and fabric price groups, wood top caps, trims, pulls...) from the June 2022 guide.

Each product option is a dict {name, price, spec...} read from the 2015 page's option table ("• Paint price group 2   +$11   Specify paint
color number."). The same table is on the product's 2022 pages (catalog pageMap); the option is found by its name and the price cell after it
("+$15", "-$4", "No cost") re-read. Options whose line cannot be found are listed in guide2022/_options_report.txt and keep their 2015 value
with `unpriced2022: true`. Runs after update_catalog_2022.py (idempotent)."""
import json, os, re, sys, importlib.util
ROOT = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(ROOT, 'src', 'catalog.json')
spec = importlib.util.spec_from_file_location('u', os.path.join(ROOT, 'update_catalog_2022.py')); u = importlib.util.module_from_spec(spec); spec.loader.exec_module(u)
PRICE = r'(\+\s*\$\s*(\d[\d,]*)|[-–]\s*\$\s*(\d[\d,]*)|No cost|\$\s*(\d[\d,]*))'

def norm(t): return re.sub(r'\s+', ' ', t.replace('•', ' ')).strip()

def find_price(text, name, words=None):
    """the price cell right after the option name (or its first `words` words: the page breaks long names across lines with the price cell
    between them); None when no price follows within 40 characters."""
    n = norm(name); n = re.sub(r'\s*\(.*?\)\s*$', '', n)   # a trailing parenthesis in the catalog name is the page's own note
    if words: n = ' '.join(n.split()[:words])
    pat = re.escape(n).replace(r'\ ', r'\s+').replace(r'\-', r'-\s*') + r'[^$+\-–]{0,40}?' + PRICE   # the page may break a name after a hyphen
    m = re.search(pat, text, re.I)
    if not m: return None
    if m.group(1).startswith('No'): return 0
    v = m.group(2) or m.group(3) or m.group(4); v = int(v.replace(',', ''))
    return -v if m.group(3) else v

def read_pair(texts15, texts22, o):
    """(2015 read, 2022 read): the product's own pages first, the neighbouring pages only when the name is not on them; the longest name
    prefix whose 2015 read equals the catalog value decides the prefix used on the 2022 side."""
    for t15 in texts15:
        for w in (None, 7, 5, 4, 3):
            old = find_price(t15, o['name'], w)
            if old is not None and old == o['price']:
                for t22 in texts22:
                    new = find_price(t22, o['name'], w)
                    if new is not None: return old, new
                return old, None
    return find_price(texts15[-1], o['name']), None

def main(check=False):
    cat = json.load(open(OUT, encoding='utf-8')); T22 = u.load('guide2022'); T15 = u.load('guide')
    report = []; n_ok = n_fail = n_skip = 0
    for p in cat['products']:
        pages = p['pages'] or []; wide = lambda pgs: sorted(set(pg + d for pg in pgs for d in (-2, -1, 0, 1, 2)))   # a product's option table sits up to two pages before its price table
        texts22 = [norm(' '.join(T22.get(pg, '') for pg in pages)), norm(' '.join(T22.get(pg, '') for pg in wide(pages)))]
        texts15 = [norm(' '.join(T15.get(pg, '') for pg in p.get('pages2015', []))), norm(' '.join(T15.get(pg, '') for pg in wide(p.get('pages2015', []))))]
        for o in p['options']:
            if not isinstance(o.get('price'), (int, float)): n_skip += 1; continue
            base = o['price2015'] if 'price2015' in o else o['price']   # the 2015 value, whether or not a previous run already re-priced the option
            old, new = read_pair(texts15, texts22, {'name': o['name'], 'price': base})
            if old is None or old != base:   # the 2015 name does not read back to the catalog's value: do not trust the same read in 2022
                n_fail += 1; o['unpriced2022'] = True; report.append(f"{p['id']:45s} {o['name'][:50]:50s} 2015 value {base} reads {old} on the 2015 page; 2022 read {new}: not applied"); continue
            if new is None: n_fail += 1; o['unpriced2022'] = True; report.append(f"{p['id']:45s} {o['name'][:50]:50s} 2015 {base} -> not found on 2022 pages {pages}"); continue
            o['price2015'] = base; o['price'] = new; o.pop('unpriced2022', None); n_ok += 1
    open(os.path.join(ROOT, 'guide2022', '_options_report.txt'), 'w', encoding='utf-8').write(f'options repriced {n_ok}, unmatched {n_fail}, without a numeric price {n_skip}\n\n' + '\n'.join(report) + '\n')
    print(f'options repriced {n_ok}, unmatched {n_fail}, without a numeric price {n_skip}')
    if not check: json.dump(cat, open(OUT, 'w', encoding='utf-8'), separators=(',', ':')); print('wrote catalog')

if __name__ == '__main__':
    main('--check' in sys.argv)
