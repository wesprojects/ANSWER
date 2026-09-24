// ⊕ handle: generous hit area, click extends straight on, right-click lists the compliant directions; Add worksurface tool; supports drawn = spec.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } }); pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); if (!ok) fails++; };
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const box = await pg.locator('#plan').boundingBox();
  await pg.click('[data-tool="draw"]'); await pg.mouse.move(box.x + 300, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 500, box.y + 250, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200); await pg.click('[data-tool="select"]');
  const handles = () => pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P), v = window.answerDebug.view; return Object.values(P.nodes).filter(n => R.nodes[n.id] && R.nodes[n.id].type === 'EOR').map(n => { const l = R.nodes[n.id].legs[0], a = (l.angle + 180) * Math.PI / 180; return { id: n.id, x: v.ox + (n.x + Math.cos(a) * (1.5 + 28 / v.s)) * v.s, y: v.oy - (n.y + Math.sin(a) * (1.5 + 28 / v.s)) * v.s }; }); });
  const count = () => pg.evaluate(() => Object.keys(window.answerDebug.P().panels).length);
  let hs = await handles(); const n0 = await count();
  // click 14px off the handle centre: still hits
  await pg.mouse.click(box.x + hs[0].x + 10, box.y + hs[0].y + 10); await pg.waitForTimeout(250);
  ck('click near the ⊕ (14px off centre) adds a panel straight on', await count() === n0 + 1, `${n0} -> ${await count()}`);
  const straight = await pg.evaluate(() => { const P = window.answerDebug.P(); const ps = Object.values(P.panels); const q = ps[ps.length - 1]; const a = P.nodes[q.a], c = P.nodes[q.b]; return Math.abs(a.y - c.y) < 0.01; }); ck('new panel continues in the same direction', straight);
  hs = await handles(); await pg.mouse.click(box.x + hs[0].x, box.y + hs[0].y, { button: 'right' }); await pg.waitForTimeout(150);
  const items = await pg.$$eval('.ctxmenu > .it', els => els.map(e => e.textContent.trim())); ck('right-click ⊕ lists directions with straight on first', /straight on/.test(items[0] || '') && items.length >= 3, items.join(' | '));
  await pg.click('.ctxmenu > .it:nth-child(3)'); await pg.waitForTimeout(250); ck('picking a direction adds a panel', await count() === n0 + 2);
  // Add worksurface tool: click beside the first panel
  await pg.click('[data-tool="ws"]'); const pp = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const p = Object.values(P.panels)[0]; const a = P.nodes[p.a], c = P.nodes[p.b]; return [v.ox + (a.x + c.x) / 2 * v.s, v.oy - ((a.y + c.y) / 2 - 1) * v.s]; });
  await pg.mouse.click(box.x + pp[0], box.y + pp[1]); await pg.waitForTimeout(300);
  const ws = await pg.evaluate(() => Object.values(window.answerDebug.P().worksurfaces || {}).length); ck('Add worksurface tool places a worksurface on a panel side', ws === 1, 'worksurfaces: ' + ws);
  // supports drawn = supports specified
  const r = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); const drawn = Object.values(P.worksurfaces).flatMap(w => w._supports || []).filter(s => s.kind === 'cantilever').length; const spec = R.lines.filter(l => l.pid === 'uw-cantilever').reduce((a, l) => a + l.qty, 0); return { drawn, spec, err: R.errors.map(e => e.msg) }; });
  ck('cantilevers drawn = cantilevers specified', r.drawn === r.spec && r.spec > 0, JSON.stringify(r));
  await pg.locator('#planwrap').screenshot({ path: 'test/overlap/handle.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); await b.close();
})();
