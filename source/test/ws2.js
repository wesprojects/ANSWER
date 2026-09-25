// Workstation QA round 2 through the interface: fit-checked menus and inspector, pedestals, pulls, 36"D, straight-to-straight L, corner kind changes.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const box = await pg.locator('#plan').boundingBox(); let fails = 0;
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info ? ' — ' + info : '')); if (!ok) fails++; };
  const toast = () => pg.textContent('#toast');
  const fresh = async () => { await pg.click('#bNew'); await pg.waitForTimeout(150); };
  const typical = async (name, furnished) => { await pg.mouse.click(box.x + 400, box.y + 300, { button: 'right' }); await pg.waitForTimeout(120); await pg.click(`.ctxmenu .it:has-text("${furnished ? 'Add workstation here' : 'Add typical here'}")`); await pg.waitForTimeout(150); await pg.click(`.typ:has-text(${JSON.stringify(name)})`); await pg.waitForTimeout(300); await pg.click('#zFit'); await pg.waitForTimeout(150); };
  const scr = (x, y) => pg.evaluate(([x, y]) => { window.scrollTo(0, 0); const v = window.answerDebug.view; return [v.ox + x * v.s, v.oy - y * v.s]; }, [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const panelPt = (pid, side) => pg.evaluate(([pid, side]) => { const P = window.answerDebug.P(); const p = P.panels[pid]; const a = P.nodes[p.a], c = P.nodes[p.b]; const n = window.ANSWER.sideNormal(P, p, side); return [(a.x + c.x) / 2 + n[0], (a.y + c.y) / 2 + n[1]]; }, [pid, side]).then(([x, y]) => scr(x, y));
  const wsPt = (wid, u = 0.5) => pg.evaluate(([wid, u]) => { const P = window.answerDebug.P(); const w = P.worksurfaces[wid]; const g = window.ANSWER.wsGeometry(P, w); if (g.kind === 'straight') return [g.lo[0] + g.dir[0] * w.width * u + g.n[0] * g.depth * 0.8, g.lo[1] + g.dir[1] * w.width * u + g.n[1] * g.depth * 0.8]; const a = g.arms[0]; return [a.end[0] - a.dir[0] * 20 + a.n[0] * 8, a.end[1] - a.dir[1] * 20 + a.n[1] * 8]; }, [wid, u]).then(([x, y]) => scr(x, y));
  const pedPt = (wid, at) => pg.evaluate(([wid, at]) => { const P = window.answerDebug.P(); const w = P.worksurfaces[wid]; const g = window.ANSWER.wsGeometry(P, w); const r = window.ANSWER.pedRect(P, w, g, w.peds.find(d => d.at === at)); return [(r[0][0] + r[2][0]) / 2, (r[0][1] + r[2][1]) / 2]; }, [wid, at]).then(([x, y]) => scr(x, y));
  const menu = async (pt, labels) => { await pg.mouse.click(pt[0], pt[1], { button: 'right' }); await pg.waitForTimeout(200); let sel = '.ctxmenu'; for (let i = 0; i < labels.length; i++) { const s = `${sel} ${i ? '> .sub ' : ''}> .it:has-text(${JSON.stringify(labels[i])})`; if (!(await pg.locator(s).count())) { await pg.keyboard.press('Escape'); await pg.mouse.click(box.x + 5, box.y + 5); return false; } if (i === labels.length - 1) await pg.click(s); else { await pg.hover(s); await pg.waitForTimeout(100); } sel = s; } await pg.waitForTimeout(250); return true; };
  const menuItems = async (pt, labels) => { await pg.mouse.click(pt[0], pt[1], { button: 'right' }); await pg.waitForTimeout(200); let sel = '.ctxmenu'; for (let i = 0; i < labels.length; i++) { sel = `${sel} ${i ? '> .sub ' : ''}> .it:has-text(${JSON.stringify(labels[i])})`; await pg.hover(sel); await pg.waitForTimeout(100); } const out = await pg.$$eval(`${sel} > .sub > .it`, els => els.map(e => e.firstChild.textContent.trim())); await pg.keyboard.press('Escape'); await pg.mouse.click(box.x + 5, box.y + 5); return out; };
  const state = () => pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); return { ws: Object.values(P.worksurfaces).map(w => ({ id: w.id, kind: w.kind, panel: w.panel, off: w.off, width: w.width, depth: w.depth, C: w.C, D: w.D, construction: w.construction, peds: w.peds.map(d => d.at + ':' + d.type + d.config), res: w._resolved, seams: w._seams, sup: w._supportAt, tie: w._tie })), err: R.errors.map(e => e.msg), warn: R.warnings.map(e => e.msg) }; });
  const panels = () => pg.evaluate(() => Object.values(window.answerDebug.P().panels).map(p => p.id));

  // #1 U 6×8 back wall: the second 24"D worksurface cannot butt the first and still land on a junction, so the menu refuses it (no fake seam)
  await fresh(); await typical('U workstation 6×8'); { const ps = await panels(); const inside = await pg.evaluate(([a]) => { const P = window.answerDebug.P(); return window.ANSWER.sideNormal(P, P.panels[a], 0)[1] < 0 ? 0 : 1; }, [ps[0]]);
    await menu(await panelPt(ps[0], inside), ['Add worksurface', '24"D']); await menu(await panelPt(ps[1], inside), ['Add worksurface', '24"D']); const t = await toast(); const s = await state();
    // corner geometry (p21, p30, p225): each back-wall panel's module starts 1 1/2" out from its L corner, at the side panel's face, so a 48"W worksurface
    // fits on each back-wall panel wrapped by the side, and the two butt at the center junction (before, modules started on the corner node and the
    // second one could not both butt the first and land on a junction, so the menu refused it). Still: no errors, no fake seams, supports on junctions.
    ck('#1 U back wall: both 48"W worksurfaces fit and butt at the center junction, no errors, no fake seams', /worksurface added/.test(t) && s.ws.length === 2 && s.ws.every(w => w.width === 48) && !s.err.length && s.ws.every(w => w.seams.length === 1 && w.seams.every(x => x.gap <= 0.01) && Object.values(w.sup).every(x => !x.junction || x.d <= 1.6)), JSON.stringify([t, s]));
    ck('#4 the wrapped end on a 36"W return takes a cantilever, not a side support bracket', s.ws[0] && Object.values(s.ws[0].res).every(x => x === 'cantilever'), JSON.stringify(s.ws[0] && s.ws[0].res)); }
  // #2 / #5 corners: extended <-> standard, swap, sizes and construction only where they fit
  await fresh(); await typical('L workstation 6×6'); { const ns = await pg.evaluate(() => Object.values(window.answerDebug.P().nodes).map(n => [n.id, n.x, n.y])); const [, x, y] = ns[0];
    await menu(await scr(x + 1, y - 1), ['Add corner worksurface here']); let s = await state(); const cid = s.ws[0].id;
    await menu(await wsPt(cid), ['Make it an extended corner']); s = await state(); ck('#5 extended corner that cannot land on seams is refused, corner unchanged', /No extended corner worksurface fits/.test(await toast()) && s.ws[0].kind === 'corner' && !s.err.length, JSON.stringify([await toast(), s.ws[0], s.err]));
    const sizes = await menuItems(await wsPt(cid), ['Size']); ck('#5 Size lists only sizes that fit (36×36 on 36" panels)', sizes.length > 0 && sizes.every(z => /^36×36/.test(z)), sizes.join(' | ')); }
  await fresh(); await typical('L workstation 6×6, furnished', true); { let s = await state(); const cid = s.ws.find(w => w.kind === 'corner').id;
    const sizes = await menuItems(await wsPt(cid), ['Size']); ck('#5 furnished L: Size lists no size that overlaps the straights', sizes.every(z => /^42×42/.test(z)), sizes.join(' | '));
    await pg.mouse.click(...(await wsPt(cid))); await pg.waitForTimeout(300); await pg.selectOption('#wCon', 'full-depth'); await pg.waitForTimeout(300); s = await state(); const c = s.ws.find(w => w.id === cid);
    ck('#5 construction change keeps the size (42×42 24/24 full depth)', c.construction === 'full-depth' && c.C === 42 && c.D === 42 && !s.err.length, JSON.stringify([c, s.err]));
    // delete the straights so the extended corner fits, then swap and go back to standard (was a JS error, #2)
    await pg.evaluate(() => { const P = window.answerDebug.P(); for (const w of Object.values(P.worksurfaces)) if (w.kind === 'straight') delete P.worksurfaces[w.id]; }); await pg.click('#zFit'); await pg.waitForTimeout(150);
    await pg.selectOption('#wCon', 'cord-drop').catch(() => {}); await pg.waitForTimeout(200);
    await menu(await wsPt(cid), ['Make it an extended corner']); s = await state(); const ext = s.ws.find(w => w.id === cid); ck('#5 extended corner placed on seams (72×42)', ext.kind === 'extcorner' && !s.err.length, JSON.stringify([await toast(), ext, s.err]));
    await menu(await wsPt(cid), ['Swap the long arm']); s = await state(); const sw = s.ws.find(w => w.id === cid); ck('#5 swap the long arm: refused or valid, never an error', !s.err.length, JSON.stringify([await toast(), sw, s.err]));
    await menu(await wsPt(cid), ['Make it a standard corner']); s = await state(); const st = s.ws.find(w => w.id === cid); ck('#2 back to a standard corner: no JS error, a guide size', st.kind === 'corner' && st.C === st.D && !s.err.length && !errs.length, JSON.stringify([await toast(), st, s.err, errs])); }
  // #3 / #8 pedestals: a second one that would overlap is refused; move swaps; + Mobile never replaces
  await fresh(); await typical('Private office front'); { const ps = await panels(); await menu(await panelPt(ps[0], 0), ['Add worksurface', '24"D']); let s = await state(); const wid = s.ws[0].id;
    await menu(await wsPt(wid), ['Add pedestal', 'Fixed pedestal, box/box/file', 'Right end']); await menu(await wsPt(wid), ['Add pedestal', 'Mobile pedestal, box/file 21"H', 'Left end']); s = await state();
    ck('#8 two pedestals on a 48"W worksurface', s.ws[0].peds.length === 2, JSON.stringify(s.ws[0].peds));
    await menu(await pedPt(wid, 'hi'), ['Swap with the']); s = await state(); ck('#8 "move" to an occupied end swaps the pedestals', s.ws[0].peds.sort().join() === ['hi:mobileC', 'lo:fixedA'].sort().join(), JSON.stringify(s.ws[0].peds));
    await pg.mouse.click(...(await wsPt(wid))); await pg.waitForTimeout(300); await pg.click('#wPedM'); await pg.waitForTimeout(200); s = await state(); ck('#8 + Mobile with both ends taken: refused, nothing replaced', /Both ends already have a pedestal/.test(await toast()) && s.ws[0].peds.length === 2, JSON.stringify(s.ws[0].peds));
    const lbl = await menuItems(await wsPt(wid), ['Add pedestal', 'Fixed pedestal, file/file']); ck('#8 add-pedestal menu says what it replaces', lbl.some(t => /replaces the/.test(t)), lbl.join(' | '));
    // #7 c:scape pull colors
    await pg.mouse.click(...(await pedPt(wid, 'lo')), { button: 'right' }); await pg.waitForTimeout(150); await pg.keyboard.press('Escape'); await pg.mouse.click(box.x + 5, box.y + 5);
    await menu(await pedPt(wid, 'lo'), ['Front', 'Proud steel']); await pg.mouse.click(...(await wsPt(wid))); await pg.waitForTimeout(300);
    await pg.selectOption('[data-pedpull]', 'c:scape'); await pg.waitForTimeout(300); const cols = await pg.$$eval('[data-pedcolor] option', o => o.map(x => x.value)); const spec = await pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).lines.find(l => /^RPF/.test(l.style)).spec);
    ck('#7 c:scape pull colors are the paints 4140/4144/4799 (p316)', cols.join() === '4140,4144,4799' && /pull paint 4140/.test(spec), cols.join() + ' | ' + spec);
    // #3: a 24"W worksurface cannot take two pedestals
    await menu(await wsPt(wid), ['Delete worksurface']); await menu(await panelPt(ps[2], 0), ['Width', '24"']); const ps2 = await panels(); await menu(await panelPt(ps2[2], 0), ['Add worksurface', '24"D']); s = await state(); const w24 = s.ws.find(w => w.width === 24);
    await menu(await wsPt(w24.id), ['Add pedestal', 'Fixed pedestal, box/box/file', 'Left end']); const sideR = await pg.evaluate((id) => { const w = window.answerDebug.P().worksurfaces[id]; return w.side === 0 ? 0.9 : 0.1; }, w24.id); await menu(await wsPt(w24.id, sideR), ['Add pedestal', 'Fixed pedestal, box/box/file', 'Right end']); s = await state();
    ck('#3 second pedestal under a 24"W worksurface refused', s.ws.find(w => w.id === w24.id).peds.length === 1 && /Not changed: .*pedestals .* overlap/.test(await toast()) && !s.err.length, JSON.stringify([await toast(), s.err])); }
  // #9 36"D (35 1/2") straights are freestanding only (p539 tip): the panel menu does not offer them
  await fresh(); await typical('Benching divider'); { const ps = await panels(); await menu(await panelPt(ps[0], 0), ['Width', '72"']); const ps2 = await panels(); const items = await menuItems(await panelPt(ps2[0], 0), ['Add worksurface']); await pg.keyboard.press('Escape');
    ck('#9 no 36"D worksurface on the panel menu (freestanding only, p539)', items.length >= 3 && !items.some(t => /36"D/.test(t)) && items.some(t => /30"D/.test(t)), JSON.stringify(items)); }
  // #12 straight-to-straight L: 24"W first return panel, full-depth back worksurface, the return placed against its front edge
  await fresh(); await typical('L workstation 6×6'); { let ps = await panels(); await menu(await panelPt(ps[2], 0), ['Width', '24"']); ps = await panels();
    const sides = await pg.evaluate(([a, r]) => { const P = window.answerDebug.P(); const E = window.ANSWER; return [E.sideNormal(P, P.panels[a], 0)[1] < 0 ? 0 : 1, E.sideNormal(P, P.panels[r], 0)[0] > 0 ? 0 : 1]; }, [ps[0], ps[3]]);
    await menu(await panelPt(ps[0], sides[0]), ['Add worksurface', '24"D']); let s = await state(); const A = s.ws[0];
    await pg.mouse.click(...(await wsPt(A.id))); await pg.waitForTimeout(300); await pg.selectOption('#wCon', 'full-depth'); await pg.waitForTimeout(300);
    await menu(await panelPt(ps[3], sides[1]), ['Add worksurface', '24"D']); s = await state(); const B = s.ws.find(w => w.id !== A.id);
    ck('#12 straight-to-straight L placed from the menu: return butts the front edge, tied, no errors', B && B.tie.some(t => t.l) && !s.err.length && s.ws.find(w => w.id === A.id).res && /ssb/.test(JSON.stringify(s.ws.find(w => w.id === A.id).res)), JSON.stringify([await toast(), s])); }
  await pg.click('#zFit'); await pg.waitForTimeout(150); await pg.locator('#planwrap').screenshot({ path: path.join(__dirname, 'overlap', 'ws2_L.png') }).catch(() => {});
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
})();
