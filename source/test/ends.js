// Close-up of run ends (thin and oval) on the plan and in the elevation.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 2 }); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  for (const trim of ['thin', 'oval']) {
    await pg.click(`[data-trim="${trim}"]`); await pg.waitForTimeout(200);
    await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox();
    await pg.mouse.move(box.x + 200, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 500, box.y + 250, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200);
    await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const R = window.ANSWER.generate(P); const n = Object.values(P.nodes).find(n => R.nodes[n.id] && R.nodes[n.id].type === 'EOR'); v.s = 14; const c = document.getElementById('plan'); v.ox = c.clientWidth / 2 - n.x * v.s; v.oy = c.clientHeight / 2 + n.y * v.s; window.dispatchEvent(new Event('resize')); }); await pg.mouse.move(box.x + 5, box.y + 5); await pg.waitForTimeout(150);
    const p = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const q = Object.values(P.panels)[0]; const a = P.nodes[q.a]; return [v.ox + a.x * v.s, v.oy - a.y * v.s, v.s]; });
    await pg.mouse.move(box.x + 5, box.y + 5);
    await pg.screenshot({ path: `test/overlap/end_${trim}.png`, clip: { x: box.x + box.width / 2 - 200, y: box.y + box.height / 2 - 110, width: 400, height: 220 } });
    console.log(trim, 'scale px/in', p[2].toFixed(2));
    await pg.click('#bNew'); await pg.waitForTimeout(150);
  }
  await b.close();
})();
