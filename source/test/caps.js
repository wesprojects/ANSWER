// Plan close-ups of every junction type with its cap, and a check that no background shows between a panel and its junction cap.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 2 }); pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const cases = { L: [0, 90], T: [0, 90, 180], X: [0, 90, 180, 270], V: [90, 210], Y: [90, 210, 330] }; let bad = 0;
  for (const [nm, angs] of Object.entries(cases)) {
    const gap = await pg.evaluate(([angs]) => { const E = window.ANSWER, P = window.answerDebug.P(); for (const k of Object.keys(P.panels)) delete P.panels[k]; for (const k of Object.keys(P.nodes)) delete P.nodes[k]; P.worksurfaces = {};
      const c = E.addNode(P, 0, 0); for (const a of angs) { const q = E.addPanel(P, c, a, 48, 54); q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; }
      const v = window.answerDebug.view, cv = document.getElementById('plan'); v.s = 16; v.ox = cv.clientWidth / 2; v.oy = cv.clientHeight / 2; window.answerDebug.refresh();
      // sample pixels just outside the cap along each leg, inside the panel: none may be the plan background
      const ctx = cv.getContext('2d'), d = window.devicePixelRatio || 1; const out = [];
      for (const a of angs) { const t = a * Math.PI / 180; for (const r of [0.95, 1.2, 1.6, 2.2]) for (const off of [-1.2, 0, 1.2]) { const wx = Math.cos(t) * r - Math.sin(t) * off, wy = Math.sin(t) * r + Math.cos(t) * off; const px = Math.round((v.ox + wx * v.s) * d), py = Math.round((v.oy - wy * v.s) * d); const [R, G, B] = ctx.getImageData(px, py, 1, 1).data; if (R > 245 && G > 245 && B > 245) out.push(`leg ${a}° r=${r} off=${off}`); } }
      return out; }, [angs]);
    // re-sample after the refresh has painted
    const gap2 = await pg.evaluate(([angs]) => { const v = window.answerDebug.view, cv = document.getElementById('plan'), ctx = cv.getContext('2d'), d = window.devicePixelRatio || 1; const out = []; for (const a of angs) { const t = a * Math.PI / 180; for (const r of [0.95, 1.2, 1.6, 2.2]) for (const off of [-1.2, 0, 1.2]) { const wx = Math.cos(t) * r - Math.sin(t) * off, wy = Math.sin(t) * r + Math.cos(t) * off; const px = Math.round((v.ox + wx * v.s) * d), py = Math.round((v.oy - wy * v.s) * d); const [R, G, B] = ctx.getImageData(px, py, 1, 1).data; if (R > 245 && G > 245 && B > 245) out.push(`leg ${a}° r=${r} off=${off}`); } } return out; }, [angs]); gap.push(...gap2);
    await pg.waitForTimeout(100); const box = await pg.locator('#plan').boundingBox(); await pg.screenshot({ path: `test/overlap/cap_${nm}.png`, clip: { x: box.x + box.width / 2 - 90, y: box.y + box.height / 2 - 90, width: 180, height: 180 } });
    if (gap.length) bad++; console.log(nm, gap.length ? 'GAP ' + gap.join('; ') : 'no gaps');
  }
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? bad + ' JUNCTIONS WITH GAPS' : 'ALL CLEAN'); await b.close();
})();
