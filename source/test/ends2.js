// Elevation close-ups: plain run (in-line + two ends), a change of height in line, and an L corner.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 }); pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const box = await pg.locator('#plan').boundingBox();
  await pg.click('[data-tool="draw"]'); await pg.mouse.move(box.x + 150, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 520, box.y + 250, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  // make the second panel taller: change of height at the in-line junction
  await pg.evaluate(() => { const P = window.answerDebug.P(); const ps = Object.values(P.panels); window.ANSWER.setHeight(P, ps[1], 66); for (const q of ps) q.glassScreen = null; });
  await pg.click('#zFit'); await pg.waitForTimeout(100);
  const pp = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const p = Object.values(P.panels)[0]; const a = P.nodes[p.a], c = P.nodes[p.b]; return [v.ox + (a.x + c.x) / 2 * v.s, v.oy - (a.y + c.y) / 2 * v.s]; });
  await pg.mouse.click(box.x + pp[0], box.y + pp[1]); await pg.waitForTimeout(250);
  await pg.locator('#elevwrap').screenshot({ path: 'test/overlap/elev_run.png' });
  const eb = await pg.locator('#elev').boundingBox(); const J = await pg.evaluate(() => 0);
  for (const [n, fx] of [['left', 0.02], ['mid', 0.5], ['right', 0.95]]) await pg.screenshot({ path: `test/overlap/elev_${n}.png`, clip: { x: eb.x + eb.width * fx - 70, y: eb.y + 10, width: 140, height: 120 } });
  await pg.locator('#planwrap').screenshot({ path: 'test/overlap/plan_run.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); await b.close();
})();
