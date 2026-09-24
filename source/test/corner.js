// Corner junction geometry through the interface (p15 block-and-post, p24 46 1/2" frame, p209 butted worksurfaces, p521 corner sizes):
// draw a run, drag a corner out of its end handle, add a corner worksurface and straights from the right-click menu; no errors, the seams butt,
// and the plan and elevation measure each leg as 48" + the 1 1/2" corner allowance.
// Run from the repo root: NODE_PATH=$(npm root -g) node test/corner.js
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info !== undefined ? ' — ' + info : '')); if (!ok) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= (t === undefined ? 0.01 : t);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('answer.rc', '0'); }); await pg.reload(); await pg.waitForTimeout(300);
  const box = await pg.locator('#plan').boundingBox();
  const scr = (x, y) => pg.evaluate(([x, y]) => { window.scrollTo(0, 0); const v = window.answerDebug.view; return [v.ox + x * v.s, v.oy - y * v.s]; }, [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await pg.mouse.move(...a); await pg.mouse.down(); await pg.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await pg.mouse.move(...c, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(150); };
  const toast = () => pg.evaluate(() => getComputedStyle(document.querySelector('#toast')).display === 'block' ? document.querySelector('#toast').textContent : '');
  const menu = async (pt, labels) => { await pg.mouse.click(pt[0], pt[1], { button: 'right' }); await pg.waitForTimeout(200); let sel = '.ctxmenu'; for (let i = 0; i < labels.length; i++) { const s = `${sel} ${i ? '> .sub ' : ''}> .it:has-text(${JSON.stringify(labels[i])})`; if (!(await pg.locator(s).count())) { await pg.keyboard.press('Escape'); return false; } if (i === labels.length - 1) await pg.click(s); else { await pg.hover(s); await pg.waitForTimeout(100); } sel = s; } await pg.waitForTimeout(250); return true; };
  const state = () => pg.evaluate(() => { const P = window.answerDebug.P(), E = window.ANSWER, R = E.generate(P); return { nodes: P.nodes, panels: Object.values(P.panels).map(p => ({ id: p.id, a: p.a, b: p.b, w: p.width })), types: Object.fromEntries(Object.values(R.nodes).map(j => [j.node.id, j.type])), ws: Object.values(P.worksurfaces).map(w => ({ id: w.id, kind: w.kind, panel: w.panel, width: w.width, C: w.C, D: w.D, seams: w._seams, sup: w._supportAt })), err: R.errors.map(e => e.msg) }; });
  const dist = (n, a, c) => Math.hypot(n[c].x - n[a].x, n[c].y - n[a].y);

  // a run of two 48s, then a corner dragged out of the end handle: two more 48s down the other leg
  await pg.selectOption('#optWidth', '48'); await pg.keyboard.press('d'); await drag(0, 48, 96, 48); await pg.keyboard.press('v'); await pg.click('#zFit'); await pg.waitForTimeout(150);
  const hx = await pg.evaluate(() => { const v = window.answerDebug.view; const on = []; for (let x = 96; x < 140; x += .5) { const h = window.answerDebug.hit(v.ox + x * v.s, v.oy - 48 * v.s); if (h && h.kind === 'handle') on.push(x); } return on.length ? (on[0] + on[on.length - 1]) / 2 : null; });
  ck('end handle found', hx !== null);
  await drag(hx, 48, 96, -48); await pg.click('#zFit'); await pg.waitForTimeout(150); let s = await state();
  const corner = Object.keys(s.types).find(id => s.types[id] === 'L');
  ck('the drag from the end handle turned an L corner with two 48" panels', s.panels.length === 4 && !!corner, JSON.stringify(s.types));
  const legs = s.panels.filter(p => p.a === corner || p.b === corner), far = (p) => p.a === corner ? p.b : p.a;
  ck('plan: each leg is 48" + 1 1/2" corner allowance = 49 1/2" from the corner node to the next junction (p15, p24)', legs.length === 2 && legs.every(p => near(dist(s.nodes, corner, far(p)), 49.5)), JSON.stringify(legs.map(p => dist(s.nodes, corner, far(p)))));
  ck('plan: the panels beyond the in-line junctions stay 48" node to node', s.panels.filter(p => !legs.includes(p)).every(p => near(dist(s.nodes, p.a, p.b), 48)), JSON.stringify(s.nodes));
  // right-click inside the L: add the corner worksurface; then a 24"D straight on the inside of each far panel
  const C = s.nodes[corner], dirs = legs.map(p => { const o = s.nodes[far(p)]; const L = dist(s.nodes, corner, far(p)); return [(o.x - C.x) / L, (o.y - C.y) / L]; });
  const inside = [C.x + (dirs[0][0] + dirs[1][0]) * 12, C.y + (dirs[0][1] + dirs[1][1]) * 12];
  await menu(await scr(C.x + (dirs[0][0] + dirs[1][0]) * 0.5, C.y + (dirs[0][1] + dirs[1][1]) * 0.5), ['Add corner worksurface here']);
  const t1 = await toast(); s = await state();
  ck('menu: a 48×48 corner worksurface is added at the L (its arms end on the 48" seams)', /48×48 corner worksurface added/.test(t1) && s.ws.length === 1 && s.ws[0].C === 48 && s.ws[0].D === 48, JSON.stringify([t1, s.ws]));
  for (const [i, p] of legs.entries()) {
    const out = s.panels.find(q => q.id !== p.id && (q.a === far(p) || q.b === far(p)));
    const pt = await pg.evaluate(([pid, v]) => { const P = window.answerDebug.P(); const q = P.panels[pid]; const a = P.nodes[q.a], c = P.nodes[q.b]; return [(a.x + c.x) / 2 + v[0], (a.y + c.y) / 2 + v[1]]; }, [out.id, dirs[1 - i]]);
    await menu(await scr(...pt), ['Add worksurface on this side', '24"D', 'Fit the panel']);
  }
  s = await state(); const straights = s.ws.filter(w => w.kind === 'straight'), cw = s.ws.find(w => w.kind === 'corner');
  ck('menu: a 48"W straight on each far panel', straights.length === 2 && straights.every(w => w.width === 48), JSON.stringify(s.ws));
  ck('no rule errors', !s.err.length, JSON.stringify(s.err));
  ck('seams butt: the corner arms and the straights meet on the in-line junctions with no gap', cw && cw.seams.length === 2 && straights.every(w => w.seams.length === 1 && w.seams[0].with === cw.id && w.seams[0].gap < 0.01) && cw.seams.every(x => x.gap < 0.01), JSON.stringify(s.ws.map(w => w.seams)));
  ck('supports sit on junctions', s.ws.every(w => Object.values(w.sup).every(x => !x.junction || x.d < 0.01)), JSON.stringify(s.ws.map(w => w.sup)));
  const geo = await pg.evaluate(() => { const P = window.answerDebug.P(), E = window.ANSWER; const cwz = Object.values(P.worksurfaces).find(w => w.kind === 'corner'); const g = E.wsGeometry(P, cwz); return g.arms.map(a => ({ reach: a.reach, back: Math.hypot(a.end[0] - g.o[0], a.end[1] - g.o[1]) })); });
  ck('the 48 corner arms run 47 1/2" (cord drop, p521) from the rear corner and end 49 1/2" out, on the junction', geo.every(a => near(a.back, 47.5) && near(a.reach, 49.5)), JSON.stringify(geo));

  // the plan drawing: along one leg the corner junction (block and post) reaches 2 1/4" from the node, the skin runs from there to the in-line junction
  await pg.mouse.click(box.x + 20, box.y + box.height - 30); await pg.waitForTimeout(100); // clear the selection
  const leg = legs.find(p => Math.abs(dirs[legs.indexOf(p)][1]) < 1e-9) || legs[0], u = dirs[legs.indexOf(leg)];
  await pg.evaluate(([x, y]) => { const v = window.answerDebug.view; v.s = 8; v.ox = 420 - x * 8; v.oy = 260 + y * 8; return true; }, [C.x + u[0] * 25, C.y + u[1] * 25]); await pg.click('#zIn'); await pg.waitForTimeout(200); // the leg's middle near the plan's center
  const cols = await pg.evaluate(([cx, cy, ux, uy, L]) => { const v = window.answerDebug.view, c = document.getElementById('plan'), k = c.width / c.clientWidth, g = c.getContext('2d'); const at = (t) => Array.from(g.getImageData(Math.round((v.ox + (cx + ux * t - uy * 0.9) * v.s) * k), Math.round((v.oy - (cy + uy * t + ux * 0.9) * v.s) * k), 1, 1).data).slice(0, 3).join(','); return { post: at(1.9), skin0: at(2.7), mid: at(L / 2), skin1: at(L - 1.2) }; }, [C.x, C.y, u[0], u[1], dist(s.nodes, corner, far(leg))]);
  // sampled 0.9" off the centreline (the glass line runs down it); posts are in the job's trim finish (7207 = #232323)
  ck('plan: the corner post fills 1 1/2"–2 1/4" from the node, the skin starts at the corner face and runs to the in-line junction', cols.post === '35,35,35' && cols.skin0 === cols.mid && cols.skin1 === cols.mid && cols.mid !== cols.post, JSON.stringify(cols));

  // the elevation of that leg's run: corner node to in-line node 49 1/2", then 48"
  const mid = await pg.evaluate(([pid]) => { const P = window.answerDebug.P(); const q = P.panels[pid]; const a = P.nodes[q.a], c = P.nodes[q.b]; return [(a.x + c.x) / 2, (a.y + c.y) / 2]; }, [leg.id]);
  await pg.click('#zFit'); await pg.waitForTimeout(100); await pg.mouse.click(...(await scr(...mid))); await pg.waitForTimeout(250);
  const info = await pg.evaluate(() => window.answerDebug.elevInfo());
  const gaps = info.nodeX.slice(1).map((x, i) => (x - info.nodeX[i]) / info.s).sort((a, c) => a - c);
  ck('elevation: the leg measures 49 1/2" corner to in-line junction and 48" beyond; 8\'-0" nominal', gaps.length === 2 && near(gaps[0], 48, 1e-6) && near(gaps[1], 49.5, 1e-6) && /^8'-0" nominal/.test(info.label), JSON.stringify([gaps, info.label]));

  // take the new leg off from the menu (its worksurfaces go with it): the corner becomes an end of run again and the run closes up to 96"
  await pg.click('#zFit'); await pg.waitForTimeout(100); s = await state();
  const midOf = (pid) => pg.evaluate(([pid]) => { const P = window.answerDebug.P(); const q = P.panels[pid]; const a = P.nodes[q.a], c = P.nodes[q.b]; return [(a.x + c.x) / 2, (a.y + c.y) / 2]; }, [pid]);
  const vert = s.panels.filter(p => Math.abs(s.nodes[p.a].x - s.nodes[p.b].x) < 0.01).sort((p, q) => Math.min(s.nodes[p.a].y, s.nodes[p.b].y) - Math.min(s.nodes[q.a].y, s.nodes[q.b].y)); // the far one first
  for (const p of vert) await menu(await scr(...(await midOf(p.id))), ['Delete panel']);
  s = await state(); const xs = Object.values(s.nodes).map(n => n.x);
  ck('deleting the new leg from the menu: back to an end of run, 96" end to end', vert.length === 2 && s.panels.length === 2 && !Object.values(s.types).includes('L') && near(Math.max(...xs) - Math.min(...xs), 96), JSON.stringify([s.nodes, s.types]));

  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
})();
