#!/usr/bin/env python3
"""Assemble the single-file ANSWER app: dist/index.html. Build number = today's date (America/New_York) + counter."""
import os, json, datetime, re, sys
from zoneinfo import ZoneInfo
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src'); DIST = os.path.join(ROOT, 'dist'); os.makedirs(DIST, exist_ok=True)

today = datetime.datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d')
counter_file = os.path.join(ROOT, '.build')
last = open(counter_file).read().strip() if os.path.exists(counter_file) else ''
n = int(last.split('.')[1]) + 1 if last.startswith(today) else 1
if len(sys.argv) > 1 and sys.argv[1] == '--same' and last: build = last
else:
    build = f'{today}.{n}'; open(counter_file, 'w').write(build)

rd = lambda f: open(os.path.join(SRC, f), encoding='utf-8').read()
tpl = rd('planner.html')
catalog = rd('catalog.json').replace('</script', '<\\/script')
logo = ''
out = (tpl.replace('/*__CSS__*/', rd('planner.css')).replace('/*__ENGINE__*/', rd('engine.js') + '\n' + rd('capdxf.js')).replace('/*__APP__*/', rd('planner.js'))
       .replace('__CATALOG__', catalog).replace('__LOGO__', logo).replace('__BUILD__', build))
open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8', newline='\n').write(out)  # LF on every platform; the repo file is LF
print('BUILD', build, '->', os.path.join(DIST, 'index.html'), f'{os.path.getsize(os.path.join(DIST, "index.html"))/1e6:.2f} MB')
