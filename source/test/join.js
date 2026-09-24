// Moving a run snaps it onto another run's junction where the joined junction is an Answer one (T here); right-click on ⊕ never adds a panel;
// a chosen worksurface width spans panels junction to junction.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } }); pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); if (!ok) fails++; };
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const box = await pg.locator('#plan').boundingBox();
  const setup = () => pg.evaluate(() => { const E = window.ANSWER, D = window.answerDebug, P = D.P(); for (const k of Object.keys(P.panels)) delete P.panels[k]; for (const k of Object.keys(P.nodes)) delete P.nodes[k]; for (const k of Object.keys(P.worksurfaces || {})) delete P.worksurfaces[k];
    let n = E.addNode(P, 0, 0); for (let i = 0; i < 2; i++) { const q = E.addPanel(P, n, 270, 30, 66); n = P.nodes[q.b]; } // left run, down: in-line junction at (0,-30)
    n = E.addNode(P, 10, -28); const top = []; for (let i = 0; i < 3; i++) { const q = E.addPanel(P, n, 0, 30, 66); top.push(q.id); n = P.nodes[q.b]; }
    const v = D.view; v.s = 5; v.ox = 120; v.oy = 150; D.refresh(); return top; });
  const toS = (x, y) => pg.evaluate(([x, y]) => { const v = window.answerDebug.view; return [v.ox + x * v.s, v.oy - y * v.s]; }, [x, y]);
  const top = await setup();
  const [gx, gy] = await toS(55, -28); // middle of the top run's middle panel
  await pg.mouse.move(box.x + gx, box.y + gy); await pg.mouse.down(); await pg.mouse.move(box.x + gx - 40, box.y + gy + 8, { steps: 6 }); await pg.mouse.move(box.x + gx - 48, box.y + gy + 9, { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(250);
  let st = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); return { types: Object.values(R.nodes).map(j => j.type).sort().join(','), err: R.errors.length, toast: (document.querySelector('#toast') || {}).textContent }; });
  ck('dragging a run near another run\'s in-line junction snaps it into a T', /\bT\b/.test(st.types) && st.err === 0, JSON.stringify(st));
  // a join Answer does not make (end of run onto the middle of a straight in-line junction at 180° overlap) does not snap
  await setup(); await pg.evaluate(() => { const P = window.answerDebug.P(); const n = Object.values(P.nodes).find(n => Math.abs(n.x - 10) < 0.01); n.x = 0; n.y = -20; for (const m of Object.values(P.nodes)) if (m !== n && Math.abs(m.y + 28) < 0.01) { m.x -= 10; m.y = -20; } window.answerDebug.refresh(); }); // top run now starts at (0,-20), crossing the left run
  const nodes0 = await pg.evaluate(() => Object.keys(window.answerDebug.P().nodes).length);
  const [hx, hy] = await toS(45, -20); await pg.mouse.move(box.x + hx, box.y + hy); await pg.mouse.down(); await pg.mouse.move(box.x + hx - 15, box.y + hy + 0, { steps: 5 }); await pg.mouse.move(box.x + hx - 25, box.y + hy + 1, { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(250);
  st = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); return { nodes: Object.keys(P.nodes).length, bad: Object.values(R.nodes).filter(j => j.type === 'unsupported').length }; });
  ck('no snap onto a junction Answer does not make', st.bad === 0 && st.nodes === nodes0, JSON.stringify(st));
  // right-click on ⊕: menu only
  const top3 = await setup(); const n0 = await pg.evaluate(() => Object.keys(window.answerDebug.P().panels).length);
  const hs = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P), v = window.answerDebug.view; const n = Object.values(P.nodes).find(n => Math.abs(n.x - 100) < 0.01); const l = R.nodes[n.id].legs[0], a = (l.angle + 180) * Math.PI / 180; return [v.ox + (n.x + Math.cos(a) * (1.5 + 28 / v.s)) * v.s, v.oy - (n.y + Math.sin(a) * (1.5 + 28 / v.s)) * v.s]; });
  await pg.mouse.click(box.x + hs[0], box.y + hs[1], { button: 'right' }); await pg.waitForTimeout(200);
  const items = await pg.$$eval('.ctxmenu > .it', els => els.map(e => e.textContent.trim()));
  ck('right-click on ⊕ opens the direction menu and adds nothing', await pg.evaluate(() => Object.keys(window.answerDebug.P().panels).length) === n0 && /straight on/.test(items[0] || ''), `${items.length} items`);
  await pg.keyboard.press('Escape');
  // Windows order: mousedown, mouseup, then contextmenu
  await pg.evaluate(([x, y]) => { const pl = document.querySelector('#plan'), r = pl.getBoundingClientRect(); const o = { clientX: r.left + x, clientY: r.top + y, button: 2, buttons: 2, bubbles: true, cancelable: true }; pl.dispatchEvent(new MouseEvent('mousedown', o)); window.dispatchEvent(new MouseEvent('mouseup', o)); pl.dispatchEvent(new MouseEvent('contextmenu', o)); }, hs); await pg.waitForTimeout(200);
  ck('right-click on ⊕ in Windows event order adds nothing', await pg.evaluate(() => Object.keys(window.answerDebug.P().panels).length) === n0 && await pg.$$eval('.ctxmenu > .it', e => e.length) > 2);
  await pg.keyboard.press('Escape'); await pg.mouse.click(box.x + hs[0], box.y + hs[1]); await pg.waitForTimeout(200);
  ck('left-click on ⊕ still adds one panel', await pg.evaluate(() => Object.keys(window.answerDebug.P().panels).length) === n0 + 1);
  // chosen width spans two 30" panels
  const top4 = await setup(); const w = await pg.evaluate((top) => { const D = window.answerDebug, P = D.P(); D.addStraightWs(top[1], 0, 55, -40, 30, 60); return Object.values(P.worksurfaces).map(x => x.width + 'x' + x.depth); }, top4);
  ck('60"W × 30"D goes on a 30" panel, spanning to the next junction', w.join() === '60x30', w.join());
  // toolbar width select
  const opts = await pg.$$eval('#optWsWidth option', o => o.map(x => x.value)); ck('Add worksurface has a width choice', opts.includes('auto') && opts.includes('60'), opts.join(','));
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); await b.close();
})();
