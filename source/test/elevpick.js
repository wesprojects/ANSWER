// Clicking a part in the elevation: the page does not scroll, the plan glides to centre the part, and it is highlighted.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 800 } }); pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); if (!ok) fails++; };
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.click(box.x + 300, box.y + 300, { button: 'right' }); await pg.click('.ctxmenu .it:has-text("Add workstation here")'); await pg.click('.typ:has-text("U workstation 8×8, furnished")'); await pg.waitForTimeout(300);
  await pg.click('#zFit'); for (let i = 0; i < 3; i++) await pg.click('#zIn'); await pg.waitForTimeout(200);
  // select a panel on the plan so the elevation shows its run
  const pp = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const p = Object.values(P.panels)[0]; const a = P.nodes[p.a], c = P.nodes[p.b]; v.ox += 0; return [v.ox + (a.x + c.x) / 2 * v.s, v.oy - (a.y + c.y) / 2 * v.s]; });
  await pg.evaluate(() => { const P = window.answerDebug.P(); window.__first = Object.keys(P.panels)[0]; });
  await pg.click('#zFit'); await pg.waitForTimeout(150);
  const pp2 = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const p = P.panels[window.__first]; const a = P.nodes[p.a], c = P.nodes[p.b]; return [v.ox + (a.x + c.x) / 2 * v.s, v.oy - (a.y + c.y) / 2 * v.s]; });
  await pg.mouse.click(box.x + pp2[0], box.y + pp2[1]); await pg.waitForTimeout(200);
  for (let i = 0; i < 3; i++) await pg.click('#zIn'); await pg.waitForTimeout(150);
  // scroll the page so the elevation is in view, then click hits in the elevation
  await pg.locator('#elevwrap').scrollIntoViewIfNeeded(); await pg.waitForTimeout(150);
  const y0 = await pg.evaluate(() => window.scrollY);
  const hits = await pg.evaluate(() => window.answerDebug.elevHits().filter(o => ['tile', 'post', 'ws', 'ped', 'topcap'].includes(o.kind)).map(o => ({ kind: o.kind, x: o.x + o.w / 2, y: o.y + o.h / 2, pid: o.pid, nid: o.nid, id: o.id })));
  const seen = new Set(); const eb = await pg.locator('#elev').boundingBox();
  for (const h of hits) { if (seen.has(h.kind)) continue; seen.add(h.kind);
    await pg.mouse.click(eb.x + h.x, eb.y + h.y); await pg.waitForTimeout(600);
    const r = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view, cv = document.getElementById('plan'); return { y: window.scrollY, cx: (cv.clientWidth / 2 - v.ox) / v.s, cy: (v.oy - cv.clientHeight / 2) / v.s }; });
    const tgt = await pg.evaluate((h) => { const P = window.answerDebug.P(); if (h.kind === 'post') { const n = P.nodes[h.nid]; return [n.x, n.y]; } if (h.kind === 'ws' || h.kind === 'ped') return null; const p = P.panels[h.pid]; const a = P.nodes[p.a], c = P.nodes[p.b]; return [(a.x + c.x) / 2, (a.y + c.y) / 2]; }, h);
    const shown = await pg.evaluate(() => window.answerDebug.elevHits().length); ck(`${h.kind}: elevation still shows the run`, shown > 0);
    ck(`${h.kind}: page did not scroll`, Math.abs(r.y - y0) < 2, `${y0} -> ${r.y}`);
    if (tgt) ck(`${h.kind}: plan centred on the part`, Math.hypot(r.cx - tgt[0], r.cy - tgt[1]) < 1, `centre (${r.cx.toFixed(1)}, ${r.cy.toFixed(1)}) part (${tgt[0].toFixed(1)}, ${tgt[1].toFixed(1)})`);
  }
  const hits2 = await pg.evaluate(() => window.answerDebug.elevHits().filter(o => o.kind === 'tile').map(o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 }))); const tile = hits2[0]; await pg.mouse.click(eb.x + tile.x, eb.y + tile.y); await pg.waitForTimeout(1500);
  await pg.locator('#planwrap').screenshot({ path: 'test/overlap/elevpick_plan.png' }); await pg.locator('#elevwrap').screenshot({ path: 'test/overlap/elevpick_elev.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); await b.close();
})();
