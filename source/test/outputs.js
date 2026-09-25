// Outputs after the plan: spec filter/CSV/SIF, sourcing keys across finish changes, shop labels, pick list by source,
// live bins in the pick print, job-wide staging, plan print, edge and oval cap finishes. Prints PASS/FAIL per check.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const errs = []; let step = 'load'; pg.on('pageerror', e => errs.push(`PAGEERROR [${step}] ` + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errs.push(`CONSOLE [${step}] ` + m.text()); });
  pg.on('dialog', d => d.accept());
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(400);
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  await pg.evaluate(() => { window.__prints = []; window.print = () => window.__prints.push(document.getElementById('printArea').innerHTML); });
  let fails = 0; const ok = (name, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' — ' + info : '')); if (!c) fails++; };
  const box = await pg.locator('#plan').boundingBox();
  const place = async (name, x, y) => { await pg.click('#bTypicals'); await pg.waitForTimeout(150); await pg.click(`.typ:has(.nm:text-is("${name}"))`); await pg.mouse.move(box.x + x, box.y + y); await pg.mouse.click(box.x + x, box.y + y); await pg.waitForTimeout(300); };
  const dl = async (sel) => { const [d] = await Promise.all([pg.waitForEvent('download'), pg.click(sel)]); return { name: d.suggestedFilename(), buf: fs.readFileSync(await d.path()) }; };
  const csv = (t) => { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\r') { } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else f += c; } row.push(f); rows.push(row); return rows; };
  const printed = async (sel, wait) => { await pg.evaluate(() => window.__prints = []); await pg.click(sel); await pg.waitForTimeout(wait || 500); return pg.evaluate(() => window.__prints[0] || ''); };
  step = 'build';
  await pg.fill('#jobName', 'Out "test" × 1'); await pg.press('#jobName', 'Tab');
  await place('L workstation 6×6, furnished', 150, 120); await place('U workstation 8×8, furnished', 520, 120);
  await pg.click('#zFit'); await pg.waitForTimeout(200);
  const pieces = () => pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).lines.reduce((a, l) => a + l.qty, 0));
  // 7: worksurface edge is its own setting (2015 p711), default 6009 for 2730 (p734); receptacle plastic stays separate
  step = 'finishes';
  const wsSpec = () => pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).lines.find(l => l.cat === 'Worksurface').spec);
  ok('edge default 6009 Arctic White', /edge plastic 6009 Arctic White/.test(await wsSpec()), await wsSpec());
  await pg.click('#bFinishes'); await pg.waitForTimeout(200);
  await pg.selectOption('#fPlastic', '6B03'); await pg.waitForTimeout(150);
  ok('receptacle color does not change the edge', /edge plastic 6009/.test(await wsSpec()), await wsSpec());
  const nEdges = await pg.$$eval('#fEdge option', o => o.length); await pg.selectOption('#fEdge', '6655'); await pg.waitForTimeout(150);
  ok('edge list from surface.edges', nEdges > 20 && /edge plastic 6655 Warm White/.test(await wsSpec()), `${nEdges} edges · ${await wsSpec()}`);
  // 16: every priced fabric is listed
  const nFab = await pg.$$eval('#finishBody [data-fab]', d => d.length); const nAll = await pg.evaluate(() => window.ANSWER.fabrics().filter(f => f.code && f.group && f.group !== 'n/a').length);
  ok('fabric list complete', nFab === nAll, `${nFab}/${nAll}`);
  await pg.click('#bCloseFinishes');
  // 2: sourcing survives a finish change
  step = 'spec';
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(400);
  await pg.selectOption('#specBody select.src >> nth=0', 'refurbish'); await pg.waitForTimeout(250);
  await pg.selectOption('#specBody select.src >> nth=1', 'stock'); await pg.waitForTimeout(250);
  const srcCount = () => pg.evaluate(() => { const P = window.answerDebug.P(), E = window.ANSWER; const c = { buy: 0, refurbish: 0, stock: 0 }; E.generate(P).lines.forEach(l => c[E.sourcingOf(P, l)]++); return c; });
  await pg.click('#bFinishes'); await pg.waitForTimeout(200); await pg.click('[data-paint]:not(.on) >> nth=2'); await pg.waitForTimeout(200); await pg.click('#fWoodTrim'); await pg.waitForTimeout(200); await pg.click('#bCloseFinishes'); await pg.waitForTimeout(200);
  let c = await srcCount(); ok('line sourcing kept after paint and wood trim changes', c.refurbish === 1 && c.stock === 1, JSON.stringify(c));
  // 2: an old job with text keys migrates
  const mig = await pg.evaluate(() => { const P = window.answerDebug.P(), E = window.ANSWER, R = E.generate(P); const l = R.lines[3]; const o = JSON.parse(JSON.stringify(P)); o.sourcing.byKey = { [E.lineKeyV1(l)]: 'stock', 'gone|X|y|z': 'refurbish' }; o.pick = { done: { [l.style + '|' + l.spec]: true }, bins: {} }; localStorage.setItem('answer.planner', JSON.stringify(o)); return E.lineKey(l); });
  await pg.reload(); await pg.waitForTimeout(600); await pg.evaluate(() => { window.__prints = []; window.print = () => window.__prints.push(document.getElementById('printArea').innerHTML); });
  const m2 = await pg.evaluate((k) => { const P = window.answerDebug.P(); return { src: P.sourcing.byKey, pick: P.pick.done, k }; }, mig);
  ok('old text keys migrate to stable keys, orphans dropped', JSON.stringify(m2.src) === JSON.stringify({ [mig]: 'stock' }) && m2.pick['pick|' + mig] === true, JSON.stringify(m2));
  // 4 + 15: CSV honors the Show filter, carries CAD, has a BOM
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(400);
  await pg.selectOption('#specSource', 'stock'); await pg.waitForTimeout(250);
  let f = await dl('#bSpecCsv'); let t = f.buf.toString('utf8'); let rows = csv(t.replace(/^﻿/, ''));
  ok('CSV UTF-8 BOM', f.buf[0] === 0xef && f.buf[1] === 0xbb && f.buf[2] === 0xbf);
  ok('spec CSV honors Show filter', rows.length - 1 === 1 && rows[1][0] === 'Stock' && /_stock\.csv$/.test(f.name), `${rows.length - 1} rows, ${f.name}`);
  const ca = rows[0].indexOf('Ext CA List'); ok('spec CSV Ext CA List column', ca > 0 && +rows[1][ca] >= +rows[1][rows[0].indexOf('Ext US List')]);
  const cadTot = await pg.evaluate(() => [...document.querySelectorAll('#specBody tr.tot')].map(r => r.innerText).join(' | '));
  ok('Canadian total for the filtered view', /Canadian list ×1\.09 \(Stock\)/.test(cadTot), cadTot.replace(/\s+/g, ' '));
  await pg.selectOption('#specSource', 'all'); await pg.waitForTimeout(250);
  f = await dl('#bSpecCsv'); rows = csv(f.buf.toString('utf8').replace(/^﻿/, '')); const nLines = await pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).lines.length);
  const usSum = rows.slice(1).reduce((a, r) => a + +r[6], 0), caSum = rows.slice(1).reduce((a, r) => a + +r[ca], 0); const tot = await pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).totals);
  ok('spec CSV all lines, US and CAD sums match totals', rows.length - 1 === nLines && usSum === tot.all && caSum === tot.canadian, `${rows.length - 1}/${nLines} · ${usSum}/${tot.all} · ${caSum}/${tot.canadian}`);
  // 14: no empty "': " prefix in the warnings banner
  ok('warning banner has no empty prefix', !/(^|· ): /.test(await pg.evaluate(() => (document.querySelector('#specBody .msg') || { innerText: '' }).innerText)));
  // 1: SIF carries code-less options (AN/AD) next to ON/OD pairs, still ASCII + CRLF
  step = 'sif';
  f = await dl('#bSpecSif'); t = f.buf.toString('utf8');
  const recs = t.split('\r\nPN=').slice(1);
  const specAll = await pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).lines.map(l => l.spec));
  const want = new Set(specAll.flatMap(s => window_specNotes(s)));
  function window_specNotes(s) { return String(s || '').split(/;\s*/).map(x => x.trim()).filter(x => x && !/\b((?:\d[A-Z0-9]{3})|(?:[A-Z]\d[A-Z0-9]{2}))\b/.test(x)); }
  const got = new Set((t.match(/^AD=.*$/gm) || []).map(x => x.slice(3).toLowerCase()));
  const miss = [...want].filter(x => !got.has(x.toLowerCase().replace(/–/g, '-').replace(/×/g, 'x')));
  ok('SIF: every code-less option written as AN/AD', miss.length === 0 && /\r\nAN=OPTION\r\nAD=/.test(t), miss.slice(0, 4).join(' · ') || `${(t.match(/^AN=OPTION$/gm) || []).length} AN/AD pairs`);
  ok('SIF: ASCII, CRLF, ON/OD paired', !/[^\x00-\x7f]/.test(t) && !/[^\r]\n/.test(t) && recs.every(r => { const k = r.split('\r\n').map(x => x.slice(0, 2)).filter(x => x === 'ON' || x === 'OD').join(''); return /^(ONOD)*$/.test(k); }));
  // 3, 5, 6, 12, 13: pick list by source, job-wide staging, live bins, CSV Source column
  step = 'install';
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(300);
  const twin = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#specBody tbody tr')].filter(r => r.querySelector('select.src')); const m = {}; for (const r of rows) { const k = r.children[2].innerText + '|' + r.children[4].innerText; (m[k] = m[k] || []).push(r.querySelector('select').dataset.k); } return Object.entries(m).find(([k, v]) => v.length >= 2 && !/^TS7\w*TEPJ/.test('')); });
  await pg.selectOption(`#specBody select.src[data-k="${twin[1][1]}"]`, 'stock'); await pg.waitForTimeout(300);
  await pg.click('[data-stage="install"]'); await pg.waitForTimeout(800);
  const style = twin[0].split('|')[0];
  const pr = await pg.evaluate((s) => [...document.querySelector('#installBody .sheet').querySelectorAll('tbody tr')].filter(r => r.children[2] && r.children[2].innerText === s).map(r => r.children[1].innerText + ' ' + r.children[5].innerText), style);
  ok('pick list splits a style by source', pr.some(x => /Stock/.test(x)) && pr.some(x => /Buy new/.test(x)), `${style}: ${pr.join(' / ')}`);
  const pickPcs = await pg.evaluate(() => [...document.querySelector('#installBody .sheet').querySelectorAll('tbody tr:not(.grp)')].reduce((a, r) => a + +r.children[1].innerText, 0));
  const stageTxt = await pg.evaluate(() => document.querySelectorAll('#installBody .sheet')[1].innerText); const stPcs = [...stageTxt.matchAll(/· (\d+) pieces/g)].reduce((a, m) => a + +m[1], 0);
  ok('staging (incl. job-wide) adds up to the pick list', stPcs === pickPcs && pickPcs === await pieces() && /Job-wide/.test(stageTxt), `staging ${stPcs}, pick ${pickPcs}`);
  ok('installer sheet for job-wide parts', await pg.$('#inst-job') !== null && /USSBR|TIEPLATE|USS/.test(await pg.innerText('#inst-job')));
  await pg.fill('#installBody input.bin >> nth=0', 'A-1'); await pg.press('#installBody input.bin >> nth=0', 'Tab'); await pg.check('#installBody input.chk >> nth=1'); await pg.waitForTimeout(300);
  await pg.fill('#installBody input.bin >> nth=2', 'B-7 "top"'); await pg.press('#installBody input.bin >> nth=2', 'Tab'); await pg.waitForTimeout(100);
  const ticked = await pg.$$eval('#installBody .sheet:first-child input.chk', x => x.filter(y => y.checked).length); const pp = await printed('#bPickPrint');
  ok('pick print uses live bins and ticks', pp.includes('A-1') && pp.includes('B-7 "top"') && ticked >= 1 && (pp.match(/class="box">✓/g) || []).length === ticked && !/<input/.test(pp), `${ticked} ticked`);
  f = await dl('#bPickCsv'); rows = csv(f.buf.toString('utf8').replace(/^﻿/, ''));
  const si = rows[0].indexOf('Source'), ui = rows[0].indexOf('Used At'), bi = rows[0].indexOf('Bin');
  ok('pick CSV: Source column, comma-separated Used At, bins per style+finish', si > 0 && rows.slice(1).some(r => r[si] === 'Stock') && rows.slice(1).some(r => /, /.test(r[ui])) && new Set(rows.slice(1).filter(r => r[bi] === 'A-1').map(r => r[1] + '|' + r[3])).size === 1 && rows.slice(1).reduce((a, r) => a + +r[0], 0) === pickPcs, rows[0].join(','));
  // 11: shop paint labels
  step = 'shop';
  await pg.click('[data-stage="plan"]'); await pg.waitForTimeout(200); await pg.click('#zOut'); await pg.click('#zOut'); await pg.waitForTimeout(100);
  await place('Spine with fins', 700, 420);
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(400); await pg.selectOption('#sourcing select[data-cat="Skins"]', 'refurbish'); await pg.waitForTimeout(300);
  await pg.click('[data-stage="shop"]'); await pg.waitForTimeout(400);
  const shop = await pg.innerText('#shopBody');
  ok('shop: window frame labelled, steel skins by side', /window frame/.test(shop) && /steel skin face[^\n]*side A/.test(shop) && /steel skin face[^\n]*side B/.test(shop));
  // 9: plan print is a fitted plain figure plus a job summary, no live editor
  step = 'plan print';
  await pg.click('[data-stage="plan"]'); await pg.waitForTimeout(300);
  const pl = await printed('#bPrint', 900);
  ok('plan print: figure + summary, no form controls', /<img src="data:image\/png/.test(pl) && /Summary/.test(pl) && /Workstations<b>3</.test(pl) && /Issues ·/.test(pl) && !/<select|<input|<button/.test(pl), pl.length + ' bytes');
  // 8: oval junction specs carry the cap color, Y junctions get a spec
  step = 'oval';
  await pg.click('#trimSwitch [data-trim="oval"]'); await pg.waitForTimeout(300); await place('120° pod', 300, 420);
  const ov = await pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).lines.filter(l => l.cat === 'Junction' && !/In-line/.test(l.desc) && !/Stacking/.test(l.desc)).map(l => l.style + ' ' + l.spec));
  ok('oval junction specs name the cap color', ov.length > 0 && ov.every(x => /junction cap (\w{4}) /.test(x)), ov.filter(x => !/junction cap/.test(x)).slice(0, 3).join(' · ') || ov.length + ' junctions');
  ok('oval wood caps specify the wood (woodTrim on)', ov.filter(x => /YPJW|EPJW|LPJW/.test(x)).every(x => /wood junction cap \d{4}/.test(x)));
  // round trip keeps finishes
  const fin = await pg.evaluate(() => JSON.stringify(window.answerDebug.P().finishes)); await pg.reload(); await pg.waitForTimeout(500);
  ok('finishes survive reload', fin === await pg.evaluate(() => JSON.stringify(window.answerDebug.P().finishes)));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  console.log(fails || errs.length ? `\n${fails} FAILURES` : '\nALL PASS');
  await b.close(); process.exit(fails || errs.length ? 1 : 0);
})();
