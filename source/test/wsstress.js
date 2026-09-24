// Fill every plain typical through the right-click menu (corners at every 90°/120° corner, then a 24"D worksurface on every panel side)
// and check that nothing the planner places overlaps or breaks a rule: every seam's ends butt (<=0.6") and every junction-mounted support is within 1.6" of a junction center.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const names = await pg.evaluate(() => { document.querySelector('#bTypicals').click(); const o = [...document.querySelectorAll('.typ .nm')].map(e => e.textContent).filter(t => !/furnished/.test(t)); document.querySelector('#bCloseTypicals').click(); return o; });
  const box = await pg.locator('#plan').boundingBox(); let bad = 0;
  const scr = (x, y) => pg.evaluate(([x, y]) => { const v = window.answerDebug.view; return [v.ox + x * v.s, v.oy - y * v.s]; }, [x, y]);
  const menuPick = async (path) => { for (let i = 0; i < path.length; i++) { const sel = (i ? '.ctxmenu .sub ' : '.ctxmenu > ') + `.it:has-text("${path[i]}")`; const el = pg.locator(sel).first(); if (!(await el.count())) { await pg.keyboard.press('Escape'); return false; } if (await el.evaluate(e => e.classList.contains('dis'))) { await pg.keyboard.press('Escape'); return false; } if (i < path.length - 1) await el.hover(); else await el.click(); await pg.waitForTimeout(60); } return true; };
  for (const nm of names) {
    await pg.click('#bNew'); await pg.waitForTimeout(100); await pg.click('#bTypicals'); await pg.click(`.typ:has-text("${nm}")`); await pg.mouse.click(box.x + 500, box.y + 280); await pg.waitForTimeout(200); await pg.click('#zFit'); await pg.waitForTimeout(100);
    // corners
    const corners = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); const out = []; for (const n of Object.values(P.nodes)) { const J = R.nodes[n.id]; if (!J || !J.legs || J.legs.length < 2) continue; const L = J.legs.slice().sort((a, b) => a.angle - b.angle); for (let i = 0; i < L.length; i++) { const a = L[i], c = L[(i + 1) % L.length]; const span = ((c.angle - a.angle) + 360) % 360 || 360; if (Math.abs(span - 90) < 1 || Math.abs(span - 120) < 1) { const m = (a.angle + span / 2) * Math.PI / 180; out.push({ x: n.x + Math.cos(m) * 1.2, y: n.y + Math.sin(m) * 1.2, k120: Math.abs(span - 120) < 1 }); } } } return out; });
    for (const c of corners) { const [sx, sy] = await scr(c.x, c.y); await pg.mouse.click(box.x + sx, box.y + sy, { button: 'right' }); await pg.waitForTimeout(80); await menuPick([c.k120 ? 'Add 120° corner worksurface' : 'Add corner worksurface here']); }
    // straights on every panel side
    const sides = await pg.evaluate(() => { const P = window.answerDebug.P(); const out = []; for (const p of Object.values(P.panels)) { const a = P.nodes[p.a], c = P.nodes[p.b]; const L = Math.hypot(c.x - a.x, c.y - a.y); const ux = (c.x - a.x) / L, uy = (c.y - a.y) / L; for (const s of [1, -1]) out.push({ x: (a.x + c.x) / 2 - uy * 1 * s, y: (a.y + c.y) / 2 + ux * 1 * s }); } return out; });
    for (const s of sides) { const [sx, sy] = await scr(s.x, s.y); await pg.mouse.click(box.x + sx, box.y + sy, { button: 'right' }); await pg.waitForTimeout(80); await menuPick(['Add worksurface on this side', '24\\"D worksurface']); }
    const r = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); return { ws: Object.values(P.worksurfaces).map(w => w.kind === 'straight' ? w.width : w.C + 'x' + w.D).join(' '), err: R.errors.map(e => e.msg).concat(Object.values(P.worksurfaces).flatMap(w => [...(w._seams || []).filter(x => x.gap > 0.6).map(x => `CHECK seam ${w.id}/${x.with} ends ${x.gap}" apart (must butt, <=0.6")`), ...Object.entries(w._supportAt || {}).filter(([, x]) => x.junction && x.d > 1.6).map(([k, x]) => `CHECK ${w.id} ${x.s} at ${k} is ${x.d}" from a junction (must be <=1.6")`)])) }; });
    await pg.click('#zFit'); await pg.locator('#planwrap').screenshot({ path: `test/overlap/stress_${nm.replace(/\W+/g, '_')}.png` });
    if (r.err.length) bad++; console.log(`${nm}: ws [${r.ws}]` + (r.err.length ? '\n  ERR ' + r.err.join('\n  ERR ') : ' — no errors'));
  }
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? `${bad} typicals with errors` : 'ALL CLEAN'); await b.close();
})();
