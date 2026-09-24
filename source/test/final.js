// Final pre-release QA regressions through the interface (1440×900): collisions refused on every guarded change, workstations
// in a pod (assign, split, spec/SIF/staging/installer sheets, save/load), power-ins per circuit run, installer print, elevation
// posts, the ⊕ size, "what fits" messages, Job-wide wording, shop inspect/print, New wording, Fit for big jobs, draw on a
// worksurface, one-row header, confirmation toasts.
// Run from the repo root: NODE_PATH=$(npm root -g) node test/final.js
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info !== undefined ? ' — ' + info : '')); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open() {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage(); const dialogs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('answer.rc', '0'); }); await pg.reload(); await pg.waitForTimeout(300);
    const scr = (x, y) => pg.evaluate(([x, y]) => { window.scrollTo(0, 0); const v = window.answerDebug.view; return [v.ox + x * v.s, v.oy - y * v.s]; }, [x, y]).then(async ([sx, sy]) => { const bb = await pg.locator('#plan').boundingBox(); return [bb.x + sx, bb.y + sy]; });
    const clr = () => pg.evaluate(() => { const t = document.querySelector('#toast'); t.style.display = 'none'; t.textContent = ''; });
    const toast = () => pg.evaluate(() => { const t = document.querySelector('#toast'); return t.style.display === 'block' ? t.textContent : ''; });
    const drag = async (x0, y0, x1, y1) => { await clr(); const a = await scr(x0, y0), c = await scr(x1, y1); await pg.mouse.move(...a); await pg.mouse.down(); await pg.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await pg.mouse.move(...c, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(150); };
    const click = async (x, y) => { await pg.mouse.click(...(await scr(x, y))); await pg.waitForTimeout(150); };
    const menu = async (pt, labels) => { await clr(); await pg.mouse.click(pt[0], pt[1], { button: 'right' }); await pg.waitForTimeout(200); let sel = '.ctxmenu'; for (let i = 0; i < labels.length; i++) { const s = `${sel} ${i ? '> .sub ' : ''}> .it:has-text(${JSON.stringify(labels[i])})`; if (!(await pg.locator(s).count())) { await pg.keyboard.press('Escape'); return false; } if (i === labels.length - 1) await pg.click(s); else { await pg.hover(s); await pg.waitForTimeout(100); } sel = s; } await pg.waitForTimeout(250); return true; };
    const panelPt = (pid, side) => pg.evaluate(([pid, side]) => { const P = window.answerDebug.P(); const p = P.panels[pid]; const a = P.nodes[p.a], c = P.nodes[p.b]; const n = window.ANSWER.sideNormal(P, p, side); return [(a.x + c.x) / 2 + n[0] * 3, (a.y + c.y) / 2 + n[1] * 3]; }, [pid, side]).then(([x, y]) => scr(x, y));
    const wsPt = (wid) => pg.evaluate((wid) => { const P = window.answerDebug.P(); const w = P.worksurfaces[wid]; const g = window.ANSWER.wsGeometry(P, w); if (g.kind === 'straight') return [g.lo[0] + g.dir[0] * w.width * 0.5 + g.n[0] * g.depth * 0.8, g.lo[1] + g.dir[1] * w.width * 0.5 + g.n[1] * g.depth * 0.8]; const a = g.arms[0]; return [a.end[0] - a.dir[0] * 20 + a.n[0] * 8, a.end[1] - a.dir[1] * 20 + a.n[1] * 8]; }, wid).then(([x, y]) => scr(x, y));
    const state = () => pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); return { np: Object.keys(P.panels).length, nodes: JSON.stringify(P.nodes), ws: Object.keys(P.worksurfaces || {}).length, err: R.errors.map(e => e.msg), warn: R.warnings.map(e => e.msg) }; });
    const load = async (json, name = 'job.answer') => { await pg.setInputFiles('#fileIn', { name, mimeType: 'application/json', buffer: Buffer.from(json) }); await pg.waitForTimeout(400); await pg.click('#zFit'); await pg.waitForTimeout(150); };
    const place = async (name, x, y) => { await pg.click('#bTypicals'); await pg.waitForTimeout(150); await pg.click(`.typ:has-text(${JSON.stringify(name)})`); await pg.waitForTimeout(100); await clr(); await pg.mouse.click(...(await scr(x, y))); await pg.waitForTimeout(250); const t = await toast(); await pg.keyboard.press('Escape'); return t; };
    const hookPrint = () => pg.evaluate(() => { window.__prints = []; window.print = () => window.__prints.push(document.querySelector('#printArea').innerHTML); });
    const lastPrint = async () => { await pg.waitForTimeout(300); return pg.evaluate(() => window.__prints[window.__prints.length - 1] || ''); };
    return { ctx, pg, dialogs, scr, clr, toast, drag, click, menu, panelPt, wsPt, state, load, place, hookPrint, lastPrint };
  }
  // a 4-pack of 6×8 L's built with the engine: 66" spine of 4×48 (powerkits), 42" fins of 48+24, a 48×48 corner and a 24"W straight per station
  const podJSON = (pg) => pg.evaluate(() => {
    const E = window.ANSWER; const P = E.newProject('thin'); P.name = 'Pod'; let n = E.addNode(P, 0, 0); const J = [n]; const spine = [];
    for (let i = 0; i < 4; i++) { const q = E.addPanel(P, n, 0, 48, 66); q.power = { kind: 'powerkit', location: 'base', receptacles: [1, 1], usb: [0, 0], infeed: null }; spine.push(q); n = P.nodes[q.b]; J.push(n); }
    const fins = {}; for (const i of [0, 2, 4]) for (const a of [90, 270]) { const f1 = E.addPanel(P, J[i], a, 48, 42); const f2 = E.addPanel(P, P.nodes[f1.b], a, 24, 42); fins[i + ':' + a] = [f1, f2]; }
    E.newWorksurface(P, { kind: 'corner', node: J[0].id, legs: [spine[0].id, fins['0:90'][0].id], C: 48, D: 48 }); E.newWorksurface(P, { kind: 'corner', node: J[0].id, legs: [fins['0:270'][0].id, spine[0].id], C: 48, D: 48 });
    E.newWorksurface(P, { kind: 'corner', node: J[2].id, legs: [spine[2].id, fins['2:90'][0].id], C: 48, D: 48 }); E.newWorksurface(P, { kind: 'corner', node: J[2].id, legs: [fins['2:270'][0].id, spine[2].id], C: 48, D: 48 });
    for (const k of ['0:90', '0:270', '2:90', '2:270']) { const f = fins[k][1]; const side = E.sideNormal(P, f, 0)[0] > 0 ? 0 : 1; E.newWorksurface(P, { kind: 'straight', panel: f.id, side, off: 0, width: 24, depth: 24 }); }
    spine[0].power.infeed = { length: 6 };
    return JSON.stringify(P);
  });

  // ---- #1 collisions: moving a run onto a worksurface, a typical onto a worksurface, drawing through one ----
  { const T = await open(); const { pg } = T;
    for (let i = 0; i < 3; i++) await pg.click('#zOut');
    await T.place('U workstation 8×8, furnished', 0, 96);
    await pg.selectOption('#optWidth', '24'); await pg.keyboard.press('d'); await T.drag(-100, 0, -76, 0); await pg.keyboard.press('v'); await pg.click('#zFit'); await pg.waitForTimeout(150);
    const before = await T.state(); await T.drag(-88, 0, 48, 84); const t = await T.toast(); const after = await T.state();
    ck('#1 moving a run onto another workstation\'s corner worksurfaces is refused', after.nodes === before.nodes && !after.err.length && /Run not moved: Panel \d+ of another run stands on Corner worksurface/.test(t), t);
    await T.drag(-88, 0, -88, -40); ck('#1 a clear move still works', (await T.state()).nodes !== before.nodes);
    await pg.click('#bUndo'); await pg.waitForTimeout(150);
    const t2 = await T.place('Private office front', 10, 80); ck('#1 a typical dropped on the worksurfaces is refused', (await T.state()).np === before.np && /Typical not placed/.test(t2), t2);
    await T.click(300, 300);
    await ctxClose(T); }

  // ---- #2 workstations in a pod ----
  { const T = await open(); const { pg } = T; await T.hookPrint(); await T.load(await podJSON(pg), 'pod.answer');
    let s = await T.state(); ck('#2 pod loads clean (no errors, no warnings)', !s.err.length && !s.warn.length, JSON.stringify([s.err, s.warn]));
    ck('#2 the pod is one workstation before splitting', /^1 workstation /.test(await pg.textContent('#planInfo')), await pg.textContent('#planInfo'));
    const spineId = await pg.evaluate(() => { const P = window.answerDebug.P(); return Object.values(P.panels).find(p => { const a = P.nodes[p.a], b = P.nodes[p.b]; return a.y === 0 && b.y === 0 && Math.min(a.x, b.x) === 48; }).id; });
    ck('#2 right-click › Split this pod into stations', await T.menu(await T.panelPt(spineId, 0), ['Split this pod into stations']));
    const tsplit = await T.toast(); const info = await pg.textContent('#planInfo');
    ck('#2 split gives 4 workstations, one per corner', /^4 workstations/.test(info) && /Split into 4 workstations/.test(tsplit), info + ' | ' + tsplit);
    const W = await pg.evaluate(() => window.ANSWER.workstations(window.answerDebug.P()).map(g => ({ name: g.name, ws: g.ws.length, p: g.panels.length })));
    ck('#2 each station has its corner and straight', W.length === 4 && W.every(g => g.ws === 2), JSON.stringify(W));
    // spec grouped by workstation, SIF tags, staging, installer sheets
    await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(200); await pg.selectOption('#specGroup', 'area'); await pg.waitForTimeout(200);
    const groups = await pg.$$eval('#specBody tr.grp td', e => e.map(x => x.textContent.trim()));
    ck('#2 spec by workstation: 4 stations then Job-wide', groups.length === 5 && groups.slice(0, 4).every(g => /^Workstation 1[A-D]$/.test(g)) && groups[4] === 'Job-wide', JSON.stringify(groups));
    const whereCells = await pg.$$eval('#specBody tr:not(.grp):not(.tot) td:nth-child(8)', e => e.map(x => x.textContent.trim())); ck('#8 no raw "project" in the Where column', !whereCells.includes('project') && whereCells.includes('Job-wide'), JSON.stringify([...new Set(whereCells)].slice(0, 8)));
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSpecSif')]); const sif = require('fs').readFileSync(await dl.path(), 'utf8'); const tags = [...new Set(sif.split(/\r?\n/).filter(l => l.startsWith('TG=')).map(l => l.slice(3)))];
    ck('#2 SIF tags each record with its station', tags.filter(t => /^Workstation 1[A-D]$/.test(t)).length === 4, JSON.stringify(tags));
    await pg.click('[data-stage="install"]'); await pg.waitForTimeout(300);
    const pick = await pg.evaluate(() => +document.querySelector('#installBody h2').textContent.match(/(\d+) pieces/)[1]);
    const staged = await pg.$$eval('#installBody h3', e => e.map(x => x.textContent).filter(t => /pieces$/.test(t)));
    const stagedSum = staged.reduce((a, t) => a + +t.match(/(\d+) pieces$/)[1], 0);
    ck('#2 staging: 4 stations (+ job-wide) adding up to the pick list', staged.filter(t => /^Workstation 1[A-D]/.test(t)).length === 4 && stagedSum === pick, JSON.stringify([staged, pick]));
    const sheets = await pg.$$eval('#installBody .installsheet h2', e => e.map(x => x.textContent)); ck('#2 one installer sheet per station', sheets.filter(t => /Workstation 1[A-D]/.test(t)).length === 4, JSON.stringify(sheets));
    // #4 installer print keeps .installsheet (figures stay whole)
    await pg.click('#bInstallPrint'); const html = await T.lastPrint(); ck('#4 installer print keeps the installsheet class', (html.match(/class="psheet installsheet"/g) || []).length === sheets.length, (html.match(/class="psheet[^"]*"/g) || []).slice(0, 3).join());
    // rename a station, save, load, compare
    await pg.click('[data-stage="plan"]'); await pg.waitForTimeout(200); await pg.click('#rightcol #xClose').catch(() => {}); await T.click(400, 400); await pg.waitForTimeout(150);
    const inp = pg.locator('#rightcol input[data-area]').first(); await inp.fill('North A'); await inp.press('Enter'); await pg.waitForTimeout(250);
    const names = await pg.evaluate(() => window.ANSWER.workstations(window.answerDebug.P()).map(g => g.name)); ck('#2 renaming a split station renames it everywhere', names.includes('North A') && names.length === 4, JSON.stringify(names));
    const [sv] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSave')]); const saved = require('fs').readFileSync(await sv.path(), 'utf8');
    await pg.click('#bNew'); await pg.waitForTimeout(200); ck('#11 New asks without contradicting itself', /This replaces the job on screen/.test(T.dialogs[T.dialogs.length - 1] || ''), T.dialogs[T.dialogs.length - 1]);
    await T.load(saved); const names2 = await pg.evaluate(() => window.ANSWER.workstations(window.answerDebug.P()).map(g => g.name)); ck('#2 save and load keep the stations', JSON.stringify(names2) === JSON.stringify(names), JSON.stringify(names2));
    // assign from the inspector with a multi-selection, then back to automatic from the right-click menu
    const fins = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).filter(p => p.height === 42).slice(0, 2).map(p => p.id));
    const mid = (id) => pg.evaluate((id) => { const P = window.answerDebug.P(); const p = P.panels[id]; const a = P.nodes[p.a], b = P.nodes[p.b]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; }, id);
    await T.click(...(await mid(fins[0]))); await pg.keyboard.down('Shift'); await T.click(...(await mid(fins[1]))); await pg.keyboard.up('Shift');
    await pg.fill('#pStation', 'Reception'); await pg.press('#pStation', 'Enter'); await pg.waitForTimeout(250);
    let st = await pg.evaluate((ids) => ids.map(id => window.answerDebug.P().panels[id].station), fins); ck('#2 inspector Workstation field reaches every selected panel', st.every(x => x === 'Reception') && /2 items assigned to Reception/.test(await T.toast()), JSON.stringify(st));
    ck('#2 right-click › Assign to workstation › Automatic', await T.menu(await T.panelPt(fins[0], 0), ['Assign to workstation', 'Automatic (connected panels)']));
    st = await pg.evaluate((ids) => ids.map(id => window.answerDebug.P().panels[id].station), fins); ck('#2 back to automatic for the whole selection', st.every(x => !x), JSON.stringify(st));
    // an old job without stations still loads as connected workstations
    const old = JSON.parse(saved); for (const p of Object.values(old.panels)) delete p.station; for (const w of Object.values(old.worksurfaces)) delete w.station; delete old.power; delete old.options;
    await T.load(JSON.stringify(old)); ck('#2 an older job without stations (and without power/options blocks) loads as one workstation', /^1 workstation /.test(await pg.textContent('#planInfo')) && !(await T.state()).err.length, await pg.textContent('#planInfo'));
    await ctxClose(T); }

  // ---- #3 power-ins ----
  { const T = await open(); const { pg } = T;
    await pg.selectOption('#optWidth', '48'); await pg.keyboard.press('d'); await T.drag(0, 0, 144, 0); await pg.keyboard.press('v');
    await T.click(24, 0); await pg.keyboard.down('Shift'); await T.click(72, 0); await T.click(120, 0); await pg.keyboard.up('Shift');
    await T.clr(); await pg.click('#pPower button[data-pw="powerkit"]'); await pg.waitForTimeout(150); ck('#14 power change says what happened', /3 panels: a powerkit/.test(await T.toast()), await T.toast());
    let s = await T.state(); ck('#3 powered run without a power-in warns', s.warn.some(w => /receptacles and no power-in/.test(w)), JSON.stringify(s.warn));
    await T.clr(); await pg.selectOption('#pInfeed', '6'); await pg.waitForTimeout(150); const t = await T.toast();
    const inf = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).filter(p => p.power.infeed).length);
    s = await T.state(); ck('#3 multi-select infeed goes on one panel only and says so; no power warnings left', inf === 1 && /set on Panel \d+ only/.test(t) && !s.warn.some(w => /power-in/.test(w)), JSON.stringify([inf, t, s.warn]));
    await pg.keyboard.press('Escape');
    // typicals with power come with their infeed
    await pg.click('#bNew'); await pg.waitForTimeout(150); await T.place('U workstation 6×8', 0, 0); s = await T.state();
    const ti = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).filter(p => p.power.infeed).length);
    ck('#3 a powered typical is placed with one base power infeed and no warnings', ti === 1 && !s.warn.length && !s.err.length, JSON.stringify([ti, s.warn]));
    await ctxClose(T); }

  // ---- #5 elevation: a taller neighbor post stays inside the canvas; #6 ⊕ size; #14 height toast ----
  { const T = await open(); const { pg } = T;
    await pg.click('#trimSwitch [data-trim=oval]'); await pg.waitForTimeout(150); await pg.click('#optHeight button:has-text("66")'); await pg.selectOption('#optWidth', '48');
    await pg.keyboard.press('d'); await T.drag(0, 0, 144, 0); for (const x of [48, 96]) { await pg.keyboard.press('d'); await T.drag(x, 0, x, 48); await pg.keyboard.press('d'); await T.drag(x, 0, x, -48); } await pg.keyboard.press('v'); await pg.click('#zFit'); await pg.waitForTimeout(150);
    await T.click(24, 0); await pg.click('#pStack button[data-st="12"]'); await pg.waitForTimeout(150); ck('#14 stacking says what happened', /stacked 12" \(78" overall\)/.test(await T.toast()), await T.toast());
    await T.click(72, 0); await pg.locator('#elev').scrollIntoViewIfNeeded(); await pg.waitForTimeout(150);
    const posts = await pg.evaluate(() => window.answerDebug.elevHits().filter(h => h.kind === 'post').map(h => Math.round(h.y)));
    ck('#5 elevation posts (78" neighbor) stay inside the canvas', posts.length >= 2 && posts.every(y => y >= 10), JSON.stringify(posts));
    await pg.evaluate(() => window.scrollTo(0, 0));
    await T.clr(); await pg.click('#pH button[data-h="54"]'); await pg.waitForTimeout(150); ck('#14 height change says what happened', /Panel \d+ now 54" high/.test(await T.toast()), await T.toast());
    // ⊕ with a width chosen uses the toolbar size; with Auto it matches the run
    await pg.click('#zFit'); await pg.waitForTimeout(150);
    // the middle of the ⊕ (its first hit point sits on the edge, and the mouse lands on whole pixels); the run end is 150" out since corner allowances (p15, p24)
    const hx = await pg.evaluate(() => { const v = window.answerDebug.view; const on = []; for (let x = 144; x < 180; x += .5) { const h = window.answerDebug.hit(v.ox + x * v.s, v.oy); if (h && h.kind === 'handle') on.push(x); } return on.length ? (on[0] + on[on.length - 1]) / 2 : null; });
    await pg.click('#optHeight button:has-text("42")'); await pg.selectOption('#optWidth', '36');
    await pg.mouse.move(...(await T.scr(hx, 0))); await pg.waitForTimeout(150); const tip = await pg.textContent('#planTip');
    await T.click(hx, 0); let ps = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).map(p => [p.width, p.height])); const last = ps[ps.length - 1];
    ck('#6 ⊕ with a width chosen adds a New panels size panel (36" × 42") and the tooltip says so', last[0] === 36 && last[1] === 42 && /36" × 42" panel \(the New panels size\)/.test(tip), JSON.stringify([last, tip]));
    await pg.click('#bUndo'); await pg.waitForTimeout(150); await pg.selectOption('#optWidth', 'auto'); await T.click(hx, 0); ps = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).map(p => [p.width, p.height]));
    ck('#6 ⊕ with Auto fill widths matches the end panel (48" × 66")', JSON.stringify(ps[ps.length - 1]) === '[48,66]', JSON.stringify(ps[ps.length - 1]));
    await ctxClose(T); }

  // ---- #7 what fits; #14 draw on a worksurface ----
  // corner geometry (p15, p24, p209): the pod's free 48" spine panel now takes a 48"W worksurface wrapped by the fins and butted on its junctions (it was
  // refused only because modules started on the corner node). The refusal is set up instead with a free-standing 24" panel standing on that side 30"
  // along it: the floor space left takes a 24"W worksurface, whose far end would stop short of a junction.
  { const T = await open(); const { pg } = T; const pod = JSON.parse(await podJSON(pg));
    { const fp = pod.panels[Object.keys(pod.panels)[1]], a = pod.nodes[fp.a], c = pod.nodes[fp.b], x0 = Math.min(a.x, c.x) + 30; pod.nodes.N900 = { id: 'N900', x: x0, y: 6, wallStart: false }; pod.nodes.N901 = { id: 'N901', x: x0, y: 30, wallStart: false };
      pod.panels.P902 = Object.assign(JSON.parse(JSON.stringify(fp)), { id: 'P902', a: 'N900', b: 'N901', width: 24, height: 42, power: { kind: 'none', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null } }); pod.seq = Math.max(pod.seq, 1000); }
    await T.load(JSON.stringify(pod));
    const free = await pg.evaluate(() => Object.keys(window.answerDebug.P().panels)[1]);
    const side = await pg.evaluate((id) => { const P = window.answerDebug.P(); return window.ANSWER.sideNormal(P, P.panels[id], 0)[1] > 0 ? 0 : 1; }, free);
    await T.menu(await T.panelPt(free, side), ['Add worksurface', '24"D']); const t = await T.toast();
    console.log('   #7 message:', t); ck('#7 a refused worksurface says what fits instead', /No 24"D worksurface fits on side [AB] of Panel \d+\./.test(t) && /(What fits here|free floor space takes a \d+"W)/.test(t), t);
    const wid = await pg.evaluate(() => Object.keys(window.answerDebug.P().worksurfaces)[0]);
    await pg.keyboard.press('d'); const p = await T.wsPt(wid); await T.clr(); await pg.mouse.move(...p); await pg.mouse.down(); await pg.mouse.up(); await pg.waitForTimeout(150);
    ck('#14 Draw run pressed on a worksurface says why nothing was drawn', /runs cannot start on a worksurface/.test(await T.toast()), await T.toast());
    await ctxClose(T); }

  // ---- #9/#10 shop: refurbished parts with no paint or fabric get an inspect line; empty sections are not printed ----
  { const T = await open(); const { pg } = T; await T.hookPrint(); await T.load(await podJSON(pg));
    await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(200); const k = await pg.evaluate(() => { const s = [...document.querySelectorAll('#specBody tr')].find(r => /USSBR/.test(r.textContent)); return s && s.querySelector('select.src').dataset.k; });
    await pg.selectOption(`#specBody select.src[data-k="${k}"]`, 'refurbish'); await pg.waitForTimeout(200);
    await pg.click('#bSpecPrint'); const sp = await T.lastPrint(); ck('#10 spec print uses the spec table layout', /class="t spec"/.test(sp));
    await pg.click('[data-stage="shop"]'); await pg.waitForTimeout(200); const shop = await pg.innerText('#shopBody');
    ck('#9 a refurbished side support bracket pair gets an Inspect and clean line', /Inspect and clean · 1 line/.test(shop) && /USSBR/.test(shop), shop.slice(0, 300));
    await pg.click('#bShopPrint'); const pr = await T.lastPrint(); ck('#10 shop print leaves out empty sections', !/0 skins to re-cover|Nothing to cut|No painted parts/.test(pr) && /Inspect and clean/.test(pr) && /<h1>Shop work orders<\/h1>/.test(pr), pr.slice(0, 200) + ' | ' + await T.toast());
    await ctxClose(T); }

  // ---- #13 Fit on a big job; #14 header on one row ----
  { const T = await open(); const { pg } = T;
    const big = await pg.evaluate(() => { const E = window.ANSWER; const P = E.newProject('thin'); for (let i = 0; i < 12; i++) { const n = E.addNode(P, i * 400, 0); E.addPanel(P, n, 0, 48, 54); } return JSON.stringify(P); });
    await T.load(big); const s = await pg.evaluate(() => window.answerDebug.view.s);
    const vis = await pg.evaluate(() => { const v = window.answerDebug.view, c = document.querySelector('#plan'); const w = c.clientWidth; return Object.values(window.answerDebug.P().nodes).every(n => { const x = v.ox + n.x * v.s; return x >= 0 && x <= w; }); });
    ck('#13 Fit zooms out below 0.4 px/in so a 4,400" job fits', s < 0.4 && vis, s);
    const tops = await pg.evaluate(() => ['#jobName', '#trimSwitch', '#bFinishes', '#bGuide', '#bNew', '#bPrint'].map(q => Math.round(document.querySelector(q).getBoundingClientRect().top)));
    ck('#14 header fits on one row at 1440', Math.max(...tops) - Math.min(...tops) < 12, JSON.stringify(tops));
    await ctxClose(T); }

  // ---- #15 a job loaded or started while another stage shows is fitted when the plan shows (the hidden canvas cannot be measured) ----
  { const T = await open(); const { pg } = T; const pod = await podJSON(pg);
    await pg.click('[data-stage="install"]'); await pg.waitForTimeout(200);
    await pg.setInputFiles('#fileIn', { name: 'pod.answer', mimeType: 'application/json', buffer: Buffer.from(pod) }); await pg.waitForTimeout(400);
    await pg.click('[data-stage="plan"]'); await pg.waitForTimeout(250);
    const f = await pg.evaluate(() => { const P = window.answerDebug.P(), v = window.answerDebug.view, c = document.querySelector('#plan'); const pts = Object.values(P.nodes).map(n => [v.ox + n.x * v.s, v.oy - n.y * v.s]); const xs = pts.map(p => p[0]); return { s: v.s, inside: pts.every(([x, y]) => x > 0 && x < c.clientWidth && y > 0 && y < c.clientHeight), span: (Math.max(...xs) - Math.min(...xs)) / c.clientWidth }; });
    ck('#15 loaded on the Install stage, the plan is fitted once it shows', f.inside && f.span > 0.3 && f.s > 0.5, JSON.stringify(f));
    await pg.click('[data-stage="install"]'); await pg.waitForTimeout(200); await pg.click('#bNew'); await pg.waitForTimeout(200); await pg.click('[data-stage="plan"]'); await pg.waitForTimeout(250);
    const e = await pg.evaluate(() => { const v = window.answerDebug.view, c = document.querySelector('#plan'); return { s: v.s, ox: v.ox, oy: v.oy, h: c.clientHeight }; });
    ck('#15 New on another stage leaves the empty plan at its default view once it shows', e.s === 3 && e.ox === 80 && Math.abs(e.oy - (e.h - 80)) < 1, JSON.stringify(e));
    await ctxClose(T); }

  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
  async function ctxClose(T) { await T.ctx.close(); }
})();
