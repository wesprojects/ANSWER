/* Answer Panel Planner — plan → specification → shop → pick & install */
(function () {
  'use strict';
  const E = window.ANSWER;
  const CAT = JSON.parse(document.getElementById('catalogData').textContent);
  E.init(CAT);
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const pn = (id) => 'Panel ' + String(id).replace(/^P/, '');
  const jn = (id) => 'Junction ' + String(id).replace(/^N/, '');
  const GRID = 6;
  // The guide ships as two files to stay under GitHub's 25 MB upload limit. Printed page numbers are unchanged: answer-1.pdf holds pages 1-200, answer-2.pdf holds 201-766.
  const GUIDE_SPLIT = 200;
  const guideHref = (page) => page <= GUIDE_SPLIT ? `answer-1.pdf#page=${page}` : `answer-2.pdf#page=${page - GUIDE_SPLIT}`;
  const linkPages = (html) => html.replace(/\bp(\d{1,3})((?:[-–,]\s?\d{1,3})*)\b/g, (m, a, b) => `<a class="pg" href="${guideHref(+a)}" target="answerguide" data-page="${a}" title="Open page ${a} of the Answer specification guide">p${a}${b}</a>`);
  function openGuide(page) { const v = $('#guide'); v.classList.add('on'); $('#guideFrame').src = guideHref(page || 1) + '&zoom=page-width'; $('#guidePage').value = page || 1; $('#guideOpen').href = guideHref(page || 1); }
  document.addEventListener('click', e => { const a = e.target.closest('a.pg'); if (a) { e.preventDefault(); openGuide(+a.dataset.page); } });
  let P = E.newProject('thin'), R = null;
  let sel = new Set(), selNode = null, hover = null;
  let tool = 'select', elevSide = 0, stage = 'plan';
  let history = [], future = [];
  let placing = null; // typical being placed
  let selWs = null, selPed = null, dragWs = null, menu = null, rcWhat = ''; // worksurfaces and pedestals
  const WSFILL = 'rgba(217,203,179,.55)', WSLINE = '#8a7455';
  const HCOL = { 30: '#cfe8d5', 42: '#cfe0f7', 48: '#b7d0f0', 54: '#ffe3ad', 66: '#ffc9a3', 78: '#f3b0b0' };

  // ---------- state ----------
  function snapshot() { history.push(JSON.stringify(P)); if (history.length > 80) history.shift(); future = []; }
  function undo() { if (!history.length) return; future.push(JSON.stringify(P)); P = migrate(JSON.parse(history.pop())); refresh(); }
  function redo() { if (!future.length) return; history.push(JSON.stringify(P)); P = migrate(JSON.parse(future.pop())); refresh(); }
  // every change ends with the job's geometry normalized: node-to-node = panel width + the corner allowance at each corner end (E.normalizeGeometry, p15, p24)
  function mutate(fn) { snapshot(); fn(); E.normalizeGeometry(P); refresh(); }
  const LOOP_MSG = 'the panels close a loop that no longer fits: every corner junction (L, T, X) puts each panel that meets it 1 1/2" out from the corner (V, Y about 5/8"), so the sides of the loop do not add up (p15, p24). Change a width, or leave the loop open';
  // like mutate, but refuses (and undoes) a change that leaves panels crossing, overlapping or touching without a junction,
  // or makes a junction Answer does not offer. Returns true when the change was kept.
  function guardedMutate(fn, what) {
    const fut = future; snapshot();
    const key = (c) => c.kind + ':' + c.panels.slice().sort().join(',');
    const before = new Set(E.panelConflicts(P).map(key)); const badBefore = new Set(Object.values(P.nodes).filter(n => E.junction(P, n).type === 'unsupported').map(n => n.id));
    // worksurface, pedestal and panel footprints: a change may not create a collision that was not there (moving a run onto a worksurface, a typical on a pedestal)
    const hasWs = () => Object.keys(P.worksurfaces || {}).length > 0; const wsKey = (m) => m.id + '|' + m.msg; const wsBefore = hasWs() ? new Set(E.wsCollisions(P).map(wsKey)) : new Set();
    const loopsBefore = new Set(E.normalizeGeometry(P, { dry: true }).loops);
    let r; try { r = fn(); } catch (e) { r = false; console.error(e); }
    let msg = r === false ? '' : null;
    if (msg === null) { const g = E.normalizeGeometry(P, { dry: true }); if (g.loops.some(id => !loopsBefore.has(id))) msg = LOOP_MSG; else E.normalizeGeometry(P); }
    if (msg === null) {
      const nc = E.panelConflicts(P).filter(c => !before.has(key(c)));
      const nb = Object.values(P.nodes).map(n => [n, E.junction(P, n)]).find(([n, J]) => !badBefore.has(n.id) && J.type === 'unsupported');
      if (nc.length) msg = nc[0].msg; else if (nb) msg = nb[1].reason;
      else if (hasWs()) { const nw = E.wsCollisions(P).filter(m => !wsBefore.has(wsKey(m))); if (nw.length) msg = nw[0].msg; }
    }
    if (msg !== null) { P = migrate(JSON.parse(history.pop())); future = fut; refresh(); if (msg) toast(`${what || 'Not changed'}: ${msg}`); return false; }
    refresh(); return true;
  }
  function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', Math.min(9000, 2800 + Math.max(0, String(m).length - 90) * 35)); } // long messages stay up long enough to read
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([(/csv/.test(type || '') ? '\ufeff' : '') + text], { type: type || 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
  let geomNotice = '';
  function migrate(obj) {
    const base = E.newProject(obj.trim || 'thin'); const Q = Object.assign(base, obj);
    Q.finishes = Object.assign(base.finishes, obj.finishes || {}); if (obj.finishes && !obj.finishes.edge) { const e = E.edges().find(x => x.code === obj.finishes.plasticColor); if (e) Q.finishes.edge = { code: e.code, name: e.name }; } // jobs saved before the edge setting kept the receptacle color on the edge
    Q.power = Object.assign(base.power, obj.power || {}); Q.options = Object.assign(base.options, obj.options || {});
    Q.manual = obj.manual || []; Q.areas = obj.areas || {}; Q.worksurfaces = obj.worksurfaces || {}; for (const w of Object.values(Q.worksurfaces)) { w.supports = w.supports || { lo: 'auto', hi: 'auto' }; w.peds = w.peds || []; w.options = w.options || {}; } Q.sourcing = obj.sourcing || { byKey: {}, byCat: {} }; Q.shop = obj.shop || { done: {} }; Q.pick = obj.pick || { done: {}, bins: {} }; Q.job = Object.assign({ customer: '', number: '', planner: '', notes: '' }, obj.job || {});
    for (const p of Object.values(Q.panels)) { p.stackSides = p.stackSides || []; p.power = Object.assign({ kind: 'none', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null }, p.power || {}); p.topCap = p.topCap || { wood: false, omit: false }; }
    // jobs saved before corner junctions took their allowance (panels at an L, T, X, V or Y start 1 1/2" or about 5/8" out from the corner, p15, p24):
    // lay the runs out again; worksurfaces follow their panels
    try { const g = E.normalizeGeometry(Q); if (g.moved) geomNotice = `Corner junctions now place each panel's module 1 1/2" out from an L, T or X junction (about 5/8" at V and Y), as Answer builds them (p15, p24): ${g.moved} junction${g.moved === 1 ? '' : 's'} of this job moved to match. Worksurfaces follow their panels.`; if (g.loops.length) geomNotice = (geomNotice ? geomNotice + ' ' : '') + `A closed loop of panels (${[...new Set(g.loops)].map(pn).join(', ')}) no longer fits with the corner allowances and was left as drawn: change a width so it closes.`; } catch (e) { console.error(e); }
    return Q;
  }
  P = migrate(P);
  // sourcing, shop and pick checks used to be keyed on the line text (style, description, finish): move them to the stable line keys, drop orphans
  function migrateKeys() {
    const isOld = (k) => !k.includes('#') && !/^build\|/.test(k); const S = (P.sourcing.byKey = P.sourcing.byKey || {}), D = (P.shop.done = P.shop.done || {}), K = (P.pick.done = P.pick.done || {});
    if (!R.lines.length || ![...Object.keys(S), ...Object.keys(D), ...Object.keys(K)].some(isOld)) return;
    const v1 = new Map(R.lines.map(l => [E.lineKeyV1(l), E.lineKey(l)]));
    for (const k of Object.keys(S)) if (isOld(k)) { const n = v1.get(k); if (n && !(n in S)) S[n] = S[k]; delete S[k]; }
    for (const k of Object.keys(D)) if (isOld(k)) { const m = k.match(/^(cut\|)?(.*?)(\|s[12])?$/); const n = v1.get(m[2]); if (n) D[(m[1] || '') + n + (m[3] || '')] = D[k]; delete D[k]; }
    for (const k of Object.keys(K)) if (isOld(k)) { const st = /^stage\|/.test(k), rest = st ? k.split('|').slice(2).join('|') : k; for (const l of R.lines) if (l.style + '|' + l.spec === rest) K[(st ? 'stage|' : 'pick|') + E.lineKey(l)] = K[k]; delete K[k]; }
  }
  function refresh() {
    wsCache = null;
    for (const id of [...sel]) if (!P.panels[id]) sel.delete(id);
    if (selNode && !P.nodes[selNode]) selNode = null;
    if (selWs && !(P.worksurfaces && P.worksurfaces[selWs])) { selWs = null; selPed = null; }
    if (selPed && selWs && !P.worksurfaces[selWs].peds.some(d => d.id === selPed)) selPed = null;
    if (selTile && !sel.has(selTile.pid)) selTile = null;
    try { R = E.generate(P); } catch (e) { console.error(e); toast('Could not rebuild the parts list: ' + e.message); R = R || { lines: [], warnings: [], errors: [], nodes: {}, totals: { byCat: {}, all: 0, canadian: 0 }, footprint: [] }; }
    try { migrateKeys(); } catch (e) { console.error(e); }
    if (R.notices && R.notices.length) toast(R.notices.join(' '));
    if (geomNotice) { toast(geomNotice); geomNotice = ''; }
    try { localStorage.setItem('answer.planner', JSON.stringify(P)); } catch (e) { }
    $('#jobName').value = P.name || '';
    $$('#trimSwitch button').forEach(b => b.classList.toggle('on', b.dataset.trim === P.trim));
    { const gw = $('#optGlass') && $('#optGlass').closest('label'); if (gw) gw.style.display = P.trim === 'thin' ? '' : 'none'; }
    $('#empty').classList.toggle('hide', Object.keys(P.panels).length > 0);
    drawPlan(); drawElev(); renderRight(); renderPartCards(); renderLegend();
    { const pid = [...sel][0]; const what = pid && P.panels[pid] ? pn(pid) + (sel.size > 1 ? ' +' + (sel.size - 1) : '') : selWs && P.worksurfaces[selWs] ? E.wsName(P.worksurfaces[selWs]) : selNode ? jn(selNode) : ''; rcWhat = what; if ($('#st-plan').classList.contains('collapsed')) $('#rcToggle').title = `Show the editor: ${what || 'job'} (Tab)`; }
    if (stage === 'spec') renderSpec(); if (stage === 'shop') renderShop(); if (stage === 'install') renderInstall();
    const comps = E.workstations(P);
    $('#planInfo').textContent = `${comps.length} workstation${comps.length === 1 ? '' : 's'} · ${Object.keys(P.panels).length} panels · ${Object.keys(P.nodes).length} junctions${Object.keys(P.worksurfaces || {}).length ? ' · ' + Object.keys(P.worksurfaces).length + ' worksurfaces' : ''} · list ${money(R.totals.all)}`;
  }

  // ---------- plan canvas ----------
  const plan = $('#plan'), ctx = plan.getContext('2d');
  let view = { s: 3, ox: 0, oy: 0 }; // swapped temporarily when the scene is drawn into another canvas
  const W = () => plan.clientWidth, H = () => plan.clientHeight;
  const toS = (x, y) => [view.ox + x * view.s, view.oy - y * view.s];
  const toW = (sx, sy) => [(sx - view.ox) / view.s, (view.oy - sy) / view.s];
  const ZMIN = .05; // 0.05 px per inch: a 1,400' floor fits the plan
  function fit() {
    const ns = Object.values(P.nodes);
    if (!ns.length) { view.s = 3; view.ox = 80; view.oy = H() - 80; return; }
    const pts = [...ns.map(n => [n.x, n.y]), ...Object.values(P.worksurfaces || {}).flatMap(w => { const g = E.wsGeometry(P, w); return g ? g.poly : []; })];
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const mnx = Math.min(...xs) - 24, mxx = Math.max(...xs) + 24, mny = Math.min(...ys) - 24, mxy = Math.max(...ys) + 24;
    // pixel room for the workstation names above and below and for the hint line along the bottom of the plan
    const PT = 48, PB = 48, PX = 20; // symmetric, so Fit centres the job and the zoom buttons zoom about it
    view.s = Math.max(ZMIN, Math.min(10, Math.min((W() - 2 * PX) / (mxx - mnx), (H() - PT - PB) / (mxy - mny)))); // big jobs zoom out as far as they need
    view.ox = W() / 2 - (mnx + mxx) / 2 * view.s; view.oy = PT + (H() - PT - PB) / 2 + (mny + mxy) / 2 * view.s;
  }
  function sizeCanvases() {
    for (const c of [plan]) { const r = c.getBoundingClientRect(); const d = window.devicePixelRatio || 1; c.width = Math.max(1, r.width * d); c.height = Math.max(1, r.height * d); c.getContext('2d').setTransform(d, 0, 0, d, 0, 0); }
    drawPlan(); drawElev();
  }
  function panelRect(p) { const a = P.nodes[p.a], b = P.nodes[p.b]; return { a, b, ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
  const POST = 3; // junctions are 3" deep (p14); a corner post is 3" square
  const JW = E.JUNCTION_W; // an in-line junction is 1 1/2" along the run, centered on the node (p24); an end-of-run post is 3/4", inside the panel's nominal width (p14, p39): see E.junctionReach
  function drawPanelShape(c, p, offset, fill, stroke, lw) {
    const { a, b, ang } = panelRect(p); const t = POST * view.s / 2; const nx = -Math.sin(ang) * t, ny = Math.cos(ang) * t;
    // skins extend onto straight junctions and meet the next panel's skin at the junction centre (p16); at a run end or wall start they cover the post, which lies
    // inside the nominal width, up to the node (the trim or wall-start face is beyond it, p14, p15); at a corner they stop at the corner face, the corner
    // allowance plus the 3/4" post from the node (2 1/4" at L, T, X; E.CORNER_ALLOW, p15, p24)
    const ext = (nid) => { const J = R && R.nodes[nid]; return !J || !J.legs ? -JW / 2 : (J.type === 'inline' || J.type === 'EOR' || J.type === 'wall') ? 0 : -E.junctionReach(P.trim, J.type).in; };
    const ea = ext(p.a), eb = ext(p.b); const ux = Math.cos(ang), uy = Math.sin(ang);
    const pts = [[a.x + offset[0] - ux * ea, a.y + offset[1] - uy * ea], [b.x + offset[0] + ux * eb, b.y + offset[1] + uy * eb]].map(([x, y]) => toS(x, y));
    const [x1, y1] = pts[0], [x2, y2] = pts[1];
    c.beginPath(); c.moveTo(x1 + nx, y1 - ny); c.lineTo(x2 + nx, y2 - ny); c.lineTo(x2 - nx, y2 + ny); c.lineTo(x1 - nx, y1 + ny); c.closePath();
    c.fillStyle = fill; c.fill(); c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke();
    return { x1, y1, x2, y2, ang };
  }
  function drawPost(c, x, y, J, on, bad) {
    const h = POST * view.s / 2;
    // straight junctions (in-line, end of run, wall start) sit under the skins: only the slotted channel between two skins shows (p16)
    if (J && J.legs && ['inline', 'EOR', 'wall'].includes(J.type) && !bad) {
      const a = J.legs[0].angle * Math.PI / 180, ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux;
      if (J.type === 'inline') { c.beginPath(); c.moveTo(x + nx * h, y + ny * h); c.lineTo(x - nx * h, y - ny * h); c.lineWidth = 1.2; c.strokeStyle = '#424244'; c.stroke(); }
      if (J.type === 'wall' && E.FOOTPRINT[P.trim].wall) { const o = (J.legs[0].angle + 180) * Math.PI / 180, wx = Math.cos(o), wy = -Math.sin(o), f = E.FOOTPRINT[P.trim].wall * view.s; c.beginPath(); [[0, -h], [f, -h], [f, h], [0, h]].forEach(([u, v], i) => { const px = x + wx * u - wy * v, py = y + wy * u + wx * v; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fillStyle = '#424244'; c.fill(); } // wall-start junction face, 3/16" beyond the node (p15)
      if (on) { const Rj = E.junctionReach(P.trim, J.type), sg = J.type === 'inline' ? 1 : -1, f0 = Rj.post[0] * sg * view.s, f1 = (J.type === 'EOR' ? Rj.trim[1] : Rj.post[1]) * sg * view.s; c.beginPath(); [[f0, -h], [f1, -h], [f1, h], [f0, h]].forEach(([u, v], i) => { const px = x + ux * u + nx * v, py = y + uy * u + ny * v; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.lineWidth = 2; c.strokeStyle = '#416180'; c.stroke(); }
      if (J.type === 'EOR') drawEndTrim(c, x, y, J, h);
      return;
    }
    // corner junctions (block-and-post, p15): each leg's 3/4" post from the corner allowance out to the corner face, where the skins stop (E.CORNER_ALLOW); the cap goes over the block
    const fillC = bad ? '#e8b4b0' : on ? '#5980a6' : trimHex(), lineC = bad ? '#b3261e' : on ? '#416180' : '#424244';
    const corner = J && J.legs && J.legs.length >= 2 && !['inline', 'EOR', 'wall'].includes(J.type) && !bad;
    if (corner) { const Rc = E.junctionReach(P.trim, J.type); for (const l of J.legs) { const a = l.angle * Math.PI / 180, ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux; c.beginPath(); [[Rc.ca * view.s, -h], [Rc.in * view.s, -h], [Rc.in * view.s, h], [Rc.ca * view.s, h]].forEach(([u, v], i) => { const px = x + ux * u + nx * v, py = y + uy * u + ny * v; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fillStyle = fillC; c.fill(); c.lineWidth = on ? 2 : 1.2; c.strokeStyle = lineC; c.stroke(); } }
    // corner junction caps (p375): square 90° cap for L, T, X; triangular 120° cap for V, Y (a V also has its vertical trim on the open side, p15)
    if (J && J.family === 120) { const pts = E.cap120(0, 0, J.legs[0].angle).map(([u, v]) => [x + u * view.s, y - v * view.s]); c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath();
      if (J.type === 'V' && !bad) { const used = J.legs.map(l => ((l.angle % 360) + 360) % 360), a3 = [0, 120, 240].map(k => (J.legs[0].angle + k) % 360).find(a => !used.some(u => Math.abs(((u - a + 540) % 360) - 180) < 1)); if (a3 !== undefined) { const t = a3 * Math.PI / 180, ux = Math.cos(t), uy = -Math.sin(t), nx = -uy, ny = ux, d = E.CAP120_IN * view.s, tt = E.FOOTPRINT[P.trim].eor * view.s, hh = 1.5 * view.s; c.save(); c.beginPath(); [[d, -hh], [d + tt, -hh], [d + tt, hh], [d, hh]].forEach(([u, v], i) => { const px = x + ux * u + nx * v, py = y + uy * u + ny * v; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fillStyle = trimHex(); c.fill(); c.strokeStyle = '#424244'; c.lineWidth = 1; c.stroke(); c.restore(); c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); } }
    }
    else { const leg = J && J.legs && J.legs[0]; const straight = J && J.legs && (J.legs.length === 1 || (J.legs.length === 2 && J.type === 'inline')); const rot = leg ? (straight ? leg.angle : leg.angle % 90) * Math.PI / 180 : 0; const hl = straight ? JW / 2 * view.s : h; c.save(); c.translate(x, y); c.rotate(-rot); c.beginPath(); c.rect(-hl, -h, 2 * hl, 2 * h); c.restore(); } // in-line and end posts are 1 1/2" along the run, corner posts 3" square
    c.fillStyle = bad ? '#e8b4b0' : on ? '#5980a6' : trimHex(); c.fill(); c.lineWidth = on ? 2 : 1.2; c.strokeStyle = bad ? '#b3261e' : on ? '#416180' : '#424244'; c.stroke();
  }
  // junction caps and trims are drawn in the job's trim finish (painted colour or wood)
  function trimHex() { const F = P.finishes || {}; if (F.woodTrim || F.ovalWoodTrim) return '#a8794e'; const code = F.trimPaint && F.trimPaint.code; return (typeof PAINTHEX !== 'undefined' && PAINTHEX[code]) || '#5d5d60'; }
    // finished end: the end-of-run vertical trim over the exposed face of the post, 1/2" thin (p14, p347) or 1" oval with its rounded profile (p76)
  function drawEndTrim(c, x, y, J, h) {
    const t = E.FOOTPRINT[P.trim].eor * view.s, a = (J.legs[0].angle + 180) * Math.PI / 180, ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux;
    const at = (u, v) => [x + ux * u + nx * v, y + uy * u + ny * v], f = 0; // f: the post's end face, on the node (the post is inside the nominal width, p14, p39)
    c.beginPath(); const p0 = at(f, -h), p1 = at(f + (P.trim === 'oval' ? 0 : t), -h), p2 = at(f + (P.trim === 'oval' ? 0 : t), h), p3 = at(f, h); c.moveTo(...p0); c.lineTo(...p1);
    if (P.trim === 'oval') { const cc = at(f, 0); c.ellipse(cc[0], cc[1], t, h, Math.atan2(uy, ux), -Math.PI / 2, Math.PI / 2); } else c.lineTo(...p2);
    c.lineTo(...p3); c.closePath(); c.fillStyle = trimHex(); c.fill(); c.lineWidth = 1; c.strokeStyle = '#424244'; c.stroke();
    }
  let draw = null, dragMove = null, pan = null, swing = null;
  // plan labels are collected, then placed highest priority first at the first candidate spot clear of labels already placed and of the
  // end-of-run handles; panel bodies and posts are avoided when a clear spot exists. A label with no clear spot is left off rather than
  // drawn over another one (its detail is on hover and in the editor). keep: always drawn at its first spot (support and pedestal marks).
  // longest variant that fits the width, or '' when none does
  function fitText(c, variants, maxW) { for (const t of variants) if (t && c.measureText(t).width <= maxW) return t; return ''; }
  function Labels(c) {
    const items = [], hard = [], soft = [], placed = [];
    const quad = (cx, cy, w, h, rot) => { const co = Math.cos(rot || 0), si = Math.sin(rot || 0); return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co]); };
    const apart = (A, B) => { for (const Q of [A, B]) for (let i = 0; i < Q.length; i++) { const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % Q.length]; const nx = y2 - y1, ny = x1 - x2; let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return true; } return false; };
    return {
      box(cx, cy, w, h, isHard) { (isHard ? hard : soft).push(quad(cx, cy, w, h, 0)); },
      poly(q, isHard) { (isHard ? hard : soft).push(q); },
      // o: { text, font, size (px), color, rot, prio, keep, at: [(w, h) => [cx, cy], ...] }
      add(o) { if (o.text) items.push(o); },
      flush() {
        items.map((o, i) => [o, i]).sort((a, b) => (b[0].prio - a[0].prio) || (a[1] - b[1])).forEach(([o]) => {
          c.font = o.font; const h = o.size + 2; let best = null, bestSoft = Infinity;
          for (const text of [o.text, ...(o.alts || [])]) { const w = c.measureText(text).width + 8; for (const f of o.at) { const [cx, cy] = f(w, h); const q = quad(cx, cy, w, h, o.rot); if (hard.some(b => !apart(q, b)) || placed.some(b => !apart(q, b))) continue; const n = soft.filter(b => !apart(q, b)).length; if (n < bestSoft) { best = [cx, cy, q, text]; bestSoft = n; if (!n) break; } } if (best && !bestSoft) break; }
          if (!best && o.keep) { const w = c.measureText(o.text).width + 8; const [cx, cy] = o.at[0](w, h); best = [cx, cy, quad(cx, cy, w, h, o.rot), o.text]; }
          if (!best) return;
          placed.push(best[2]); c.save(); c.translate(best[0], best[1]); c.rotate(o.rot || 0); c.fillStyle = o.color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(best[3], 0, 0.5); c.restore();
        });
      },
    };
  }
  // the plan scene: panels, worksurfaces, pedestals, workstation names and junction posts. plain = installer figure (no handles or hover, IDs shown)
  function drawScene(ctx, plain, only) {
    const comps = E.workstations(P).filter(c => !only || c.key === only.key);
    const panels = Object.values(P.panels).filter(p => !only || (only.figPanels || only.panels).some(q => q.id === p.id));
    const nodes = Object.values(P.nodes).filter(n => !only || (only.allNodes || only.nodes).includes(n.id));
    const L = Labels(ctx);
    for (const p of panels) {
      const moving = !plain && dragMove && dragMove.ids.has(p.id); const off = moving ? [dragMove.dx, dragMove.dy] : [0, 0];
      const on = !plain && sel.has(p.id), hv = !plain && hover && hover.kind === 'panel' && hover.id === p.id;
      const g = drawPanelShape(ctx, p, off, HCOL[p.height] || '#ddd', on ? '#5980a6' : hv ? '#416180' : '#424244', on ? 3 : 1.2);
      // frameless glass (thin, 3/8" thick, p56) or oval top screen seen from above: a line down the centre of the top cap, inset from each end by its gap (p56, p60, p96)
      if ((p.glassScreen && P.trim === 'thin' && !p.glassScreen.omitGlass) || (p.topScreen && P.trim === 'oval')) { const ins = (p.glassScreen ? (p.glassScreen.attach === 'clip' ? 0.125 : 0.0625) : 1.25) * view.s + (JW / 2) * view.s, L0 = Math.hypot(g.x2 - g.x1, g.y2 - g.y1) || 1, ux = (g.x2 - g.x1) / L0, uy = (g.y2 - g.y1) / L0; ctx.save(); ctx.strokeStyle = p.glassScreen ? '#5980a6' : '#98989b'; ctx.lineWidth = Math.max(1.5, 0.375 * view.s); ctx.beginPath(); ctx.moveTo(g.x1 + ux * ins, g.y1 + uy * ins); ctx.lineTo(g.x2 - ux * ins, g.y2 - uy * ins); ctx.stroke(); ctx.restore(); }
      // stacked hatch
      if (p.stack.length) { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#424244'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); ctx.restore(); }
      { const t = POST * view.s / 2, nx = -Math.sin(g.ang) * t, ny = Math.cos(g.ang) * t; L.poly([[g.x1 + nx, g.y1 - ny], [g.x2 + nx, g.y2 - ny], [g.x2 - nx, g.y2 + ny], [g.x1 - nx, g.y1 + ny]]); }
      // width label above the panel, else below or slid along it; flags on the other side
      const mx = (g.x1 + g.x2) / 2, my = (g.y1 + g.y2) / 2; let ang = Math.atan2(g.y2 - g.y1, g.x2 - g.x1); if (ang > Math.PI / 2 + 1e-6) ang -= Math.PI; else if (ang < -Math.PI / 2 + 1e-6) ang += Math.PI;
      const co = Math.cos(ang), si = Math.sin(ang), len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1), t = 3 * view.s / 2;
      const along = (u, v) => [mx + u * co - v * si, my + u * si + v * co];
      const wsz = plain ? Math.max(11, Math.min(15, 3.6 * view.s)) : Math.max(10, Math.min(13, 3.2 * view.s));
      const sides = (h, gap) => [[0, -1], [0, 1], [-.28, -1], [.28, -1], [-.28, 1], [.28, 1]].map(([u, v]) => (w) => along(u * Math.max(0, len - w), v * (t + gap + h / 2)));
      L.add({ text: plain ? `P${p.id.slice(1)} · ${p.width}" × ${E.panelTotalHeight(p)}"` : `${p.width}"`, font: `${wsz}px Barlow, sans-serif`, size: wsz, color: '#1d1f20', rot: ang, prio: 60, at: sides(wsz, 2) });
      const flags = [p.power.kind === 'powerkit' ? 'power' : p.power.kind === 'passthrough' ? 'pass-thru' : '', p.glassScreen ? 'glass' : '', p.sides[0].some(s => s.kind === 'window') ? 'window' : '', p.stack.length ? `+${p.stack.join('+')}` : ''].filter(Boolean).join(' · ');
      if (flags && (plain || view.s > 1.6)) { const fsz = plain ? 11 : 10; L.add({ text: flags, font: `${fsz}px Barlow, sans-serif`, size: fsz, color: '#5d5d60', rot: ang, prio: 20, at: [[0, 1], [0, -1], [-.28, 1], [.28, 1], [-.28, -1], [.28, -1]].map(([u, v]) => (w) => along(u * Math.max(0, len - w), v * (t + 3 + fsz / 2))) }); }
    }
    drawWorksurfaces(ctx, plain, only, L);
    // workstation labels
    // a workstation split out of a pod is labelled at its own corner of the pod: above it, or below it when it sits on the lower side
    const allWs = E.workstations(P);
    for (const c of comps) {
      const ns = c.allNodes && c.allNodes.length ? c.allNodes : c.nodes; if (!ns.length) continue;
      const pts = [...c.panels.flatMap(p => [P.nodes[p.a], P.nodes[p.b]]).map(n => [n.x, n.y]), ...(c.ws || []).flatMap(id => { const w = P.worksurfaces[id]; const g = w && E.wsGeometry(P, w); return g ? g.poly : []; })];
      if (!pts.length) for (const n of ns) pts.push([P.nodes[n].x, P.nodes[n].y]);
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const split = c.comp && allWs.filter(g => g.comp === c.comp).length > 1;
      const cn = split ? E.components(P).find(k => k.key === c.comp) : null; const cy = ys.reduce((a, v) => a + v, 0) / ys.length;
      const below = cn && cy < cn.nodes.reduce((a, n) => a + P.nodes[n].y, 0) / cn.nodes.length - 1;
      if (below) { const [sx, sy] = toS(Math.min(...xs), Math.min(...ys)); const bot = sy + 3 * view.s / 2 + 22; L.add({ text: c.name.toUpperCase(), font: '600 12px "Barlow Condensed", sans-serif', size: 12, color: '#416180', prio: 70, at: [0, 14, 28, 42].map(dy => (w, h) => [sx - 4 + w / 2, bot + dy]) }); continue; }
      const [sx, sy] = toS(Math.min(...xs), Math.max(...ys)); const top = sy - 3 * view.s / 2 - 22;
      L.add({ text: c.name.toUpperCase(), font: '600 12px "Barlow Condensed", sans-serif', size: 12, color: '#416180', prio: 70, at: [0, -14, -28, -42].map(dy => (w, h) => [sx - 4 + w / 2, top + dy]) });
    }
    // junctions: 3" posts shared by the panels that meet there (p14)
    for (const n of nodes) {
      const J = R && R.nodes[n.id]; const moving = !plain && dragMove && dragMove.nodes.has(n.id); const [x, y] = toS(n.x + (moving ? dragMove.dx : 0), n.y + (moving ? dragMove.dy : 0));
      const on = !plain && selNode === n.id; const bad = J && J.type === 'unsupported';
      drawPost(ctx, x, y, J, on, bad); const hp = POST * view.s / 2; L.box(x, y, 2 * hp + 2, 2 * hp + 2);
      if (J && J.legs && (plain || view.s > 1.4)) { const jsz = plain ? 12 : 10; L.add({ text: (plain ? 'J' + n.id.slice(1) + ' ' : '') + jShort(J), font: plain ? '600 12px Barlow, sans-serif' : '10px Barlow, sans-serif', size: jsz, color: plain ? '#416180' : '#5d5d60', prio: 50, at: [[1, -1], [1, 1], [-1, -1], [-1, 1], [1, 0], [-1, 0]].map(([u, v]) => (w, h) => [x + u * (hp + 3 + w / 2), y + v * (hp + 2 + h / 2)]) }); }
      // end handles
      if (!plain && J && (J.type === 'EOR' || J.type === 'wall') && tool === 'select' && !dragMove) { const l = J.legs[0]; const ang = (l.angle + 180) * Math.PI / 180; const [hx, hy] = toS(n.x + Math.cos(ang) * (POST / 2 + 28 / view.s), n.y + Math.sin(ang) * (POST / 2 + 28 / view.s)); ctx.beginPath(); ctx.arc(hx, hy, HANDLE_R, 0, 7); ctx.fillStyle = hover && hover.kind === 'handle' && hover.id === n.id ? '#5980a6' : '#fff'; ctx.fill(); ctx.strokeStyle = '#5980a6'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = hover && hover.kind === 'handle' && hover.id === n.id ? '#fff' : '#5980a6'; ctx.font = '600 17px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', hx, hy + 6); L.box(hx, hy, 2 * HANDLE_R + 4, 2 * HANDLE_R + 4, true); }
    }
    L.flush();
  }
  // selection halo: a soft band around the selected panels, junction, worksurface or pedestal, pulsing briefly after it is picked in the elevation
  let pulseUntil = 0;
  function selShapes() {
    const out = [];
    for (const id of sel) { const p = P.panels[id]; if (!p) continue; const a = P.nodes[p.a], b = P.nodes[p.b]; const L0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L0 * 1.5, ny = (b.x - a.x) / L0 * 1.5; out.push({ pts: [[a.x + nx, a.y + ny], [b.x + nx, b.y + ny], [b.x - nx, b.y - ny], [a.x - nx, a.y - ny]] }); }
    if (selNode && P.nodes[selNode]) { const n = P.nodes[selNode]; out.push({ circle: [n.x, n.y, 3] }); }
    const ws = selWs && P.worksurfaces && P.worksurfaces[selWs]; if (ws) { const g = E.wsGeometry(P, ws); if (g) { const d = selPed && (ws.peds || []).find(x => x.id === selPed); out.push({ pts: d ? pedRect(ws, g, d) : g.poly }); } }
    return out;
  }
  function drawSelHalo(under) {
    const shapes = selShapes(); if (!shapes.length) return; const now = performance.now(), k = pulseUntil > now ? (pulseUntil - now) / 1200 : 0; // 1 -> 0 over the pulse
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const path = (sh) => { ctx.beginPath(); if (sh.circle) { const [x, y] = toS(sh.circle[0], sh.circle[1]); ctx.arc(x, y, Math.max(10, sh.circle[2] * view.s), 0, 7); } else sh.pts.forEach((q, i) => { const [x, y] = toS(q[0], q[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
    for (const sh of shapes) { path(sh); if (under) { ctx.strokeStyle = `rgba(89,128,166,${0.35 + 0.4 * k})`; ctx.lineWidth = 12 + 14 * k; ctx.stroke(); ctx.fillStyle = 'rgba(89,128,166,.18)'; ctx.fill(); } else { ctx.strokeStyle = '#2f6db3'; ctx.lineWidth = 2; ctx.stroke(); } } // glow under the part so its own colours stay true, outline over it
    ctx.restore();
    if (k > 0 && !under) requestAnimationFrame(drawPlan);
  }
  // glide the plan so a point (plan inches) sits in the middle of the view, keeping the zoom
  let glide = null;
  function centerPlanOn(wx, wy) {
    const tx = W() / 2 - wx * view.s, ty = H() / 2 + wy * view.s, fx = view.ox, fy = view.oy, t0 = performance.now(), dur = 320;
    if (Math.hypot(tx - fx, ty - fy) < 2) return; const my = glide = {};
    const step = (t) => { if (glide !== my) return; const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3); view.ox = fx + (tx - fx) * e; view.oy = fy + (ty - fy) * e; drawPlan(); if (u < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function drawPlan() {
    const w = W(), h = H(); if (!w) return; ctx.clearRect(0, 0, w, h);
    // dotted grid every 12", stronger every 48"
    const step = 12 * view.s;
    if (step >= 8) { ctx.fillStyle = '#c9c9cc'; for (let x = ((view.ox % step) + step) % step; x < w; x += step) for (let y = ((view.oy % step) + step) % step; y < h; y += step) { const gx = Math.round((x - view.ox) / view.s / 12), gy = Math.round((view.oy - y) / view.s / 12); const big = gx % 4 === 0 && gy % 4 === 0; ctx.beginPath(); ctx.arc(x, y, big ? 1.6 : .9, 0, 7); ctx.fill(); } }
    // scale bar
    { const L = [6, 12, 24, 48, 96, 192, 384, 768, 1536, 3072].filter(v => v * view.s <= 110).pop() || 6; ctx.strokeStyle = '#7a7a7d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, h - 14); ctx.lineTo(14 + L * view.s, h - 14); ctx.stroke(); ctx.fillStyle = '#5d5d60'; ctx.font = '12px Barlow, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(E.ftin(L), 14, h - 19); }
    drawSelHalo(true);
    drawScene(ctx, false);
    drawSelHalo();
    if (dragMove && dragMove.snap && P.nodes[dragMove.snap.node]) { const n = P.nodes[dragMove.snap.node]; const [x, y] = toS(n.x, n.y); ctx.save(); ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.strokeStyle = '#2e8b57'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'rgba(46,139,87,.18)'; ctx.fill(); ctx.restore(); } // join target
    // draw preview
    if (draw && draw.widths) {
      const dx = Math.cos(draw.ang), dy = Math.sin(draw.ang); let x = draw.x0 + dx * (draw.ca0 || 0), y = draw.y0 + dy * (draw.ca0 || 0); // modules start the corner allowance out
      for (const wdt of draw.widths) { const [ax, ay] = toS(x + dx * JW / 2, y + dy * JW / 2), [bx, by] = toS(x + dx * (wdt - JW / 2), y + dy * (wdt - JW / 2)); const t = 3 * view.s / 2; const nx = -Math.sin(draw.ang) * t, ny = Math.cos(draw.ang) * t; ctx.beginPath(); ctx.moveTo(ax + nx, ay - ny); ctx.lineTo(bx + nx, by - ny); ctx.lineTo(bx - nx, by + ny); ctx.lineTo(ax - nx, ay + ny); ctx.closePath(); ctx.fillStyle = 'rgba(89,128,166,.25)'; ctx.fill(); ctx.strokeStyle = '#5980a6'; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#416180'; ctx.font = '12px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${wdt}"`, (ax + bx) / 2, (ay + by) / 2 - t - 4); x += dx * wdt; y += dy * wdt; }
      const [ex, ey] = toS(x, y); ctx.fillStyle = '#1d1f20'; ctx.font = '600 13px Barlow, sans-serif'; ctx.fillText(`${E.ftin(draw.len)} · ${draw.widths.length} panel${draw.widths.length === 1 ? '' : 's'}`, ex, ey - 16);
    }
    if (placing && placing.ghost) { const [gx, gy] = placing.ghost; ctx.save(); ctx.globalAlpha = .45; for (const p of Object.values(placing.T.panels)) { const a = placing.T.nodes[p.a], b = placing.T.nodes[p.b]; const [x1, y1] = toS(a.x + gx, a.y + gy), [x2, y2] = toS(b.x + gx, b.y + gy); ctx.lineWidth = 3 * view.s; ctx.strokeStyle = '#5980a6'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); } ctx.restore(); }
  }
  // ---------- worksurfaces and pedestals on the plan ----------
  const PEDCFG = { A: 'BBF', B: 'FF', C: 'BF' };
  function pedRect(ws, g, d) { return E.pedRect(P, ws, g, d); } // 15" wide box under one end; depth follows the worksurface or corner arm (proud) or is 7/8" less (flush), p273

  function wsDisplayGeometry(ws) {
    if (dragWs && dragWs.id === ws.id) { const t = Object.assign({}, ws, { off: dragWs.off }); return E.wsGeometry(P, t); }
    const g = E.wsGeometry(P, ws); if (!g || !dragMove) return g;
    const host = E.hostPanelOf(P, ws.id); if (host && dragMove.ids.has(host)) { const sh = (pt) => [pt[0] + dragMove.dx, pt[1] + dragMove.dy]; return Object.assign({}, g, { poly: g.poly.map(sh), lo: g.lo && sh(g.lo), hi: g.hi && sh(g.hi), curve: g.curve && g.curve.map(sh), arms: g.arms && g.arms.map(a => Object.assign({}, a, { end: sh(a.end), front: sh(a.front) })) }); }
    return g;
  }
  function tracePoly(c, pts) { // worksurface outlines come with their curved fronts sampled (E.wsGeometry), so every shape is a plain polygon
    c.beginPath(); pts.forEach((p, i) => { const [x, y] = toS(p[0], p[1]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }); c.closePath();
  }
  function drawWorksurfaces(c, plain, only, L) {
    const ties = []; // drawn over every worksurface so the plate shows across the seam, 3" in from the user's edge (p181, p182)
    for (const ws of Object.values(P.worksurfaces || {})) {
      if (only && !(only.ws ? only.ws.includes(ws.id) : only.panels.some(q => q.id === E.hostPanelOf(P, ws.id)))) continue;
      const g = plain ? E.wsGeometry(P, ws) : wsDisplayGeometry(ws); if (!g) continue; const on = !plain && selWs === ws.id; const hv = !plain && hover && hover.kind === 'ws' && hover.id === ws.id;
      tracePoly(c, g.poly); c.fillStyle = WSFILL; c.fill(); c.lineWidth = on ? 2.5 : hv ? 1.8 : 1; c.strokeStyle = on ? '#5980a6' : WSLINE; c.stroke();
      // supports: cantilever ▲, end panel ▌, side support bracket ◆, shared —
      const res = ws._resolved || {}; c.font = '600 9px Barlow, sans-serif'; c.textAlign = 'center';
      const mark = (pt, k) => { const s = res[k]; if (!s || s === 'shared' || s === 'pedestal') return; const [x, y] = toS(pt[0], pt[1]); L.add({ text: { cantilever: 'C', endpanel: 'EP', ssb: 'SB', leg: 'L', csp: 'CS' }[s] || '', font: '600 9px Barlow, sans-serif', size: 9, color: '#416180', prio: 100, keep: true, at: [() => [x, y]] }); };
      if (plain || view.s > 1.2) { if (g.kind === 'straight') { const inset = (pt, sign) => [pt[0] + g.dir[0] * sign * 5 + g.n[0] * 6, pt[1] + g.dir[1] * sign * 5 + g.n[1] * 6]; mark(inset(g.lo, 1), 'lo'); mark(inset(g.hi, -1), 'hi'); for (const m of ws._mid || []) { const near = (q) => Object.values(P.nodes).some(nd => Math.hypot(nd.x - q[0], nd.y - q[1]) < 3.5); let q = [g.lo[0] + g.dir[0] * m, g.lo[1] + g.dir[1] * m]; if (!near(q)) q = [g.hi[0] - g.dir[0] * m, g.hi[1] - g.dir[1] * m]; const [x, y] = toS(q[0] + g.n[0] * 6, q[1] + g.n[1] * 6); L.add({ text: 'C', font: '600 9px Barlow, sans-serif', size: 9, color: '#416180', prio: 100, keep: true, at: [() => [x, y]] }); } } else { g.arms.forEach((a, i) => { mark([a.end[0] - a.dir[0] * 5 + a.n[0] * 6, a.end[1] - a.dir[1] * 5 + a.n[1] * 6], 'arm' + i); }); const [ox, oy] = toS(g.o[0] + (g.arms[0].dir[0] + g.arms[1].dir[0]) * 5, g.o[1] + (g.arms[0].dir[1] + g.arms[1].dir[1]) * 5); L.add({ text: 'SB', font: '600 9px Barlow, sans-serif', size: 9, color: '#416180', prio: 100, keep: true, at: [() => [ox, oy]] }); for (const [i, tm] of ws._armMid || []) { const a = g.arms[i]; if (!a) continue; const back = a.reach - tm; const [x, y] = toS(a.end[0] - a.dir[0] * back + a.n[0] * 6, a.end[1] - a.dir[1] * back + a.n[1] * 6); L.add({ text: 'C', font: '600 9px Barlow, sans-serif', size: 9, color: '#416180', prio: 100, keep: true, at: [() => [x, y]] }); } } }
      // tie plates across the seams this worksurface shares (3 3/4"L flat plate underneath, p546)
      // supports under the worksurface, drawn dashed where they sit (the same records the spec counts): cantilever 15 1/2" deep in the junction slots (p545),
      // center support panel 11" (p547), end panel full depth at the end, side support bracket on the return, post leg at the front corner (p552)
      if (plain || view.s > 0.9) for (const sp of ws._supports || []) {
        const face = [sp.at[0] + sp.n[0] * 1.5, sp.at[1] + sp.n[1] * 1.5], quad = (a0, a1, b0, b1, base) => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(([u, v]) => toS(base[0] + sp.u[0] * u + sp.n[0] * v, base[1] + sp.u[1] * u + sp.n[1] * v));
        let q = null;
        if (sp.kind === 'cantilever') q = quad(-0.5, 0.5, 0, 15.5, face); else if (sp.kind === 'csp') q = quad(-0.5, 0.5, 0, 11, face); else if (sp.kind === 'endpanel') q = quad(0, 1, 0, sp.depth, [sp.end[0] + sp.n[0] * 1.5, sp.end[1] + sp.n[1] * 1.5]); else if (sp.kind === 'ssb') q = quad(0, 1, 0, 6, [sp.end[0] + sp.n[0] * 1.5, sp.end[1] + sp.n[1] * 1.5]);
        c.save(); c.setLineDash([3, 2]); c.strokeStyle = '#416180'; c.lineWidth = 1.2; c.fillStyle = 'rgba(65,97,128,.18)';
        if (q) { c.beginPath(); q.forEach((pt, i) => i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1])); c.closePath(); c.fill(); c.stroke(); }
        if (sp.kind === 'leg') { const f = [sp.front[0] + sp.u[0] * 2 - sp.n[0] * 2, sp.front[1] + sp.u[1] * 2 - sp.n[1] * 2], [x, y] = toS(f[0], f[1]); c.beginPath(); c.arc(x, y, Math.max(3, 1.25 * view.s), 0, 7); c.fill(); c.stroke(); }
        c.restore();
      }
      if ((plain || view.s > 0.9) && g.kind !== 'straight' && g.o) { const [a0, a1] = g.arms, q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => toS(g.o[0] + a0.dir[0] * u * 4 + a1.dir[0] * v * 4, g.o[1] + a0.dir[1] * u * 4 + a1.dir[1] * v * 4)); c.save(); c.setLineDash([3, 2]); c.strokeStyle = '#416180'; c.lineWidth = 1.2; c.fillStyle = 'rgba(65,97,128,.18)'; c.beginPath(); q.forEach((pt, i) => i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1])); c.closePath(); c.fill(); c.stroke(); c.restore(); } // side support bracket at the corner's rear inside corner (p545)
      ties.push(...(ws._tie || []));
      // label
      let cxs = g.poly.reduce((a, p) => a + p[0], 0) / g.poly.length, cys = g.poly.reduce((a, p) => a + p[1], 0) / g.poly.length;
      if (g.kind === 'straight') { const pl = (ws.peds || []).some(d => d.at === 'lo') ? E.PED_W + 1 : 0, ph = (ws.peds || []).some(d => d.at === 'hi') ? E.PED_W + 1 : 0; const mid = (pl + (ws.width - ph)) / 2; cxs = g.lo[0] + g.dir[0] * mid + g.n[0] * g.depth / 2; cys = g.lo[1] + g.dir[1] * mid + g.n[1] * g.depth / 2; }
      const [lx, ly] = toS(cxs, cys);
      const lsz = Math.max(9, Math.min(12, 3 * view.s));
      for (const d of ws.peds || []) L.poly(pedRect(ws, g, d).map(q => toS(q[0], q[1])));
      const nm = g.kind === 'straight' ? `${ws.width}" × ${ws.depth}"D` : `${ws.C}×${ws.D} ${ws.kind === 'corner120' ? '120°' : 'corner'}`, nm2 = g.kind === 'straight' ? `${ws.width}×${ws.depth}` : `${ws.C}×${ws.D}`;
      L.add({ text: (plain ? ws.id + ' · ' : '') + nm, alts: plain ? [ws.id + ' · ' + nm2, ws.id] : [nm2], font: `${lsz}px Barlow, sans-serif`, size: lsz, color: '#4a3f30', prio: 80, at: [0, -1, 1, -2, 2].map(k => () => [lx, ly + k * (lsz + 2)]) });
      // pedestals
      for (const d of ws.peds || []) {
        const r = pedRect(ws, g, d); const onP = !plain && selPed === d.id; tracePoly(c, r); c.fillStyle = d.type === 'mobile' ? '#e9e4dc' : '#dcd5c8'; c.fill(); c.lineWidth = onP ? 2.5 : 1; c.strokeStyle = onP ? '#5980a6' : '#6f6455'; c.stroke();
        if (plain || view.s > 1.4) { const [px, py] = toS((r[0][0] + r[2][0]) / 2, (r[0][1] + r[2][1]) / 2); L.add({ text: PEDCFG[d.config] || 'BBF', font: '600 9px Barlow, sans-serif', size: 9, color: '#4a3f30', prio: 95, keep: true, at: [() => [px, py]] }); }
      }
    }
    for (const t of ties) { const back = Math.max(5, (t.depth || 24) - 3); const c0 = [t.pt[0] + t.n[0] * back, t.pt[1] + t.n[1] * back], hl = 1.875, hw = 0.75; const q = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => toS(c0[0] + t.dir[0] * u + t.n[0] * v, c0[1] + t.dir[1] * u + t.n[1] * v)); c.beginPath(); q.forEach((pt, i) => i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1])); c.closePath(); c.fillStyle = '#5d5d60'; c.fill(); L.poly(q, true); }
    if (!plain && dragWs) { const [x, y] = toS(dragWs.px, dragWs.py); ctx.fillStyle = '#1d1f20'; ctx.font = '600 12px Barlow, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(dragWs.label || '', x + 12, y - 12); }
  }
  function inPoly(pt, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
  function hitWs(wx, wy) {
    for (const ws of Object.values(P.worksurfaces || {})) { const g = E.wsGeometry(P, ws); if (!g) continue; for (const d of ws.peds || []) if (inPoly([wx, wy], pedRect(ws, g, d))) return { kind: 'ped', id: d.id, ws: ws.id }; if (inPoly([wx, wy], g.poly)) return { kind: 'ws', id: ws.id }; }
    return null;
  }
  // snap a straight worksurface start offset (host-panel frame) to post centers, post faces, other worksurface ends or the 6" grid
  function snapWsOff(ws, off) {
    const run = E.runOf(P, ws.panel); const host = run.panels.find(r => r.id === ws.panel); const toRun = (o) => host.from + o; const fromRun = (t) => t - host.from;
    const cands = [];
    // seams: the panels' module lines. At a corner the run's first module starts the corner allowance out from the node (E.CORNER_ALLOW), at the return
    // panel's face, so a worksurface wrapped by the return starts (or ends) there
    for (const r of run.panels) cands.push(r.from, r.to, r.to - ws.width);
    cands.push(...lJointStarts(ws, run));
    for (const o of Object.values(P.worksurfaces)) { if (o.id === ws.id) continue; const sp = o.kind === 'straight' ? E.wsSpanInRun(P, o, run) : null; if (sp && sp.side === ws.side) { cands.push(sp.to, sp.from - ws.width); } if (o.kind !== 'straight') { const g = E.wsGeometry(P, o); if (g) for (const a of g.arms) { const t = E.runOffset(run, a.end[0], a.end[1]); const along = Math.abs(a.dir[0] * run.dir[0] + a.dir[1] * run.dir[1]) > .99; if (along) { const out = a.dir[0] * run.dir[0] + a.dir[1] * run.dir[1] > 0; cands.push(out ? t : t - ws.width); } } } }
    const t = toRun(off); let best = null, bd = 9;
    for (const cnd of cands) { const d = Math.abs(cnd - t); if (d < bd) { bd = d; best = cnd; } }
    const snapped = best !== null ? best : run.panels[0].from + Math.round((t - run.panels[0].from) / GRID) * GRID; // the 6" grid from the run's first module line
    const al = E.runEndAllow(P, run), lo = -al.lo, hi = run.length + al.hi - ws.width; const clamped = Math.max(lo, Math.min(hi, snapped));
    return { off: fromRun(clamped), snapped: best !== null };
  }
  // run offsets where a straight worksurface on this run starts (or ends) against the front edge of a perpendicular straight worksurface: an L-configuration (p209 tip, p226)
  function lJointStarts(ws, run) {
    const out = []; const [nx, ny] = ws.side === 0 ? [run.dir[1], -run.dir[0]] : [-run.dir[1], run.dir[0]]; const h = 1.5 + E.wsBackGap(ws);
    for (const o of Object.values(P.worksurfaces || {})) {
      if (o.id === ws.id || o.kind !== 'straight') continue; const g = E.wsGeometry(P, o); if (!g) continue; const dn = run.dir[0] * g.n[0] + run.dir[1] * g.n[1]; if (Math.abs(dn) < 0.99) continue;
      const f0 = g.front[0]; const t = ((f0[0] - run.start.x - nx * h) * g.n[0] + (f0[1] - run.start.y - ny * h) * g.n[1]) / dn; out.push(dn > 0 ? t : t - ws.width);
    }
    return out;
  }
  function wsSideOfClick(p, wx, wy) { const a = P.nodes[p.a], b = P.nodes[p.b]; const cross = (b.x - a.x) * (wy - a.y) - (b.y - a.y) * (wx - a.x); return cross < 0 ? 0 : 1; }
  function jShort(J) { const m = { inline: 'in-line', L: 'L', T: 'T', X: 'X', V: 'V 120°', Y: 'Y 120°', EOR: 'end', wall: 'wall', unsupported: '!' }; const hs = [...new Set(J.legs.map(l => l.total))].sort((a, b) => a - b).join('/'); return `${m[J.type] || J.type} ${hs}"`; }
  const HANDLE_R = 12, HANDLE_HIT = 20; // the ⊕ at a free end: drawn 24px across, clickable anywhere within 40px
  function hit(sx, sy) {
    for (const n of Object.values(P.nodes)) { const J = R.nodes[n.id]; if (J && (J.type === 'EOR' || J.type === 'wall')) { const l = J.legs[0]; const ang = (l.angle + 180) * Math.PI / 180; const [hx, hy] = toS(n.x + Math.cos(ang) * (POST / 2 + 28 / view.s), n.y + Math.sin(ang) * (POST / 2 + 28 / view.s)); if (Math.hypot(hx - sx, hy - sy) < HANDLE_HIT) return { kind: 'handle', id: n.id }; } }
    for (const n of Object.values(P.nodes)) { const [x, y] = toS(n.x, n.y); if (Math.hypot(x - sx, y - sy) < Math.max(9, POST * view.s / 2 + 2)) return { kind: 'node', id: n.id }; }
    let nearest = null, nd = 1e9;
    for (const p of Object.values(P.panels)) { const { a, b } = panelRect(p); const [x1, y1] = toS(a.x, a.y), [x2, y2] = toS(b.x, b.y); const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1; let t = ((sx - x1) * (x2 - x1) + (sy - y1) * (y2 - y1)) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(sx - (x1 + t * (x2 - x1)), sy - (y1 + t * (y2 - y1))); if (d < nd) { nd = d; nearest = p; } }
    if (nearest && nd <= 1.5 * view.s + 3) return { kind: 'panel', id: nearest.id };
    const [wx, wy] = toW(sx, sy); const hw = hitWs(wx, wy); if (hw) return hw;
    if (nearest && nd < Math.max(12, 1.5 * view.s + 8)) return { kind: 'panel', id: nearest.id };
    return null;
  }
  const snapW = (v) => Math.round(v / GRID) * GRID;
  function snapPoint(wx, wy) { for (const n of Object.values(P.nodes)) { const [x, y] = toS(n.x, n.y); const [sx, sy] = toS(wx, wy); if (Math.hypot(x - sx, y - sy) < 12) return [n.x, n.y, n]; } return [snapW(wx), snapW(wy), null]; }
  // moving a run: when one of its junctions comes near a junction of another run, snap onto it if the joined junction is one Answer makes
  // (end of run onto an in-line junction = T, onto an end of run = in-line or L, onto an L = T, onto a T = X; 120° families alike) and the
  // join adds no rule error (panels or worksurfaces overlapping, heights). Otherwise the run just moves on the 6" grid and does not join.
  function joinSnap(dm, rdx, rdy) {
    const reach = Math.max(24 / view.s, 2); const cands = [];
    for (const mid of dm.nodes) { const m = P.nodes[mid]; if (!m) continue; for (const o of Object.values(P.nodes)) { if (dm.nodes.has(o.id)) continue; const d = Math.hypot(m.x + rdx - o.x, m.y + rdy - o.y); if (d < reach) cands.push({ m, o, d }); } }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands.slice(0, 4)) {
      const dx = Math.round((c.o.x - c.m.x) * 1000) / 1000, dy = Math.round((c.o.y - c.m.y) * 1000) / 1000, key = c.m.id + '>' + c.o.id;
      if (!(key in dm.tried)) { const Q = JSON.parse(JSON.stringify(P)); let ok = E.moveNodes(Q, [...dm.nodes], dx, dy); let type = ''; if (ok) { const G = E.generate(Q); ok = G.errors.length <= dm.errs; const J = Object.values(G.nodes).find(j => j.node && j.node.id === c.o.id) || G.nodes[c.o.id]; type = J ? J.type : ''; } dm.tried[key] = ok ? { dx, dy, node: c.o.id, type } : null; }
      if (dm.tried[key]) return dm.tried[key];
    }
    return null;
  }
  function mousePos(e) { const r = plan.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  plan.addEventListener('mousedown', e => {
    const [sx, sy] = mousePos(e); const [wx, wy] = toW(sx, sy);
    if (placing) { placeTypical(placing.T, placing.ghost || [snapW(wx), snapW(wy)]); return; }
    let h = hit(sx, sy);
    if (h && h.kind === 'handle' && e.button !== 0) return; // right-click on ⊕ only opens the direction menu (contextmenu), never adds
    if (h && h.kind === 'handle') { // ⊕ at a free end: click adds one panel straight on, drag draws a run from that end (Shift for 120°)
      const J = R.nodes[h.id]; const l = J.legs[0]; const n = P.nodes[h.id];
      draw = { x0: n.x, y0: n.y, n0: n, shift: e.shiftKey, handle: { nid: h.id, ang: (l.angle + 180) % 360, src: l.panel.id } }; return;
    }
    if (tool === 'ws' && e.button === 0) { // Add worksurface tool: a panel side takes a straight, a corner junction a corner worksurface; stays on for the next one
      if (h && h.kind === 'panel') { addStraightWs(h.id, wsSideOfClick(P.panels[h.id], wx, wy), wx, wy, wsDepth(), wsWidth()); return; }
      if (h && h.kind === 'node') { const J = R.nodes[h.id]; if (J && J.legs && J.legs.length >= 2 && J.type !== 'inline') { addCornerWs(h.id, wx, wy, J.family === 120); return; } toast('Corner worksurfaces go on an L, T, X, V or Y junction. For a straight, click the side of a panel.'); return; }
      if (h && (h.kind === 'ws' || h.kind === 'ped')) { selWs = h.kind === 'ws' ? h.id : h.ws; selPed = h.kind === 'ped' ? h.id : null; sel = new Set(); selNode = null; refresh(); return; }
      toast('Click the side of a panel where the worksurface goes, or a corner junction for a corner worksurface.'); return;
    }
    if (tool === 'draw') {
      // a junction (or open floor) starts a run; pressing a panel, worksurface or pedestal selects it without moving anything. A press within the
      // junction snap distance starts at the junction even over a panel's end: corner allowances (E.CORNER_ALLOW) put junctions off the 6" grid
      if (h && h.kind === 'panel' && snapPoint(wx, wy)[2]) h = { kind: 'node', id: snapPoint(wx, wy)[2].id };
      if (h && h.kind !== 'node') {
        setTool('select'); sel = new Set(); selNode = null; selWs = null; selPed = null;
        if (h.kind === 'panel') { sel = new Set([h.id]); toast('Runs start on open floor or at a junction post. To branch off this run, press on one of its posts and drag.'); }
        else if (h.kind === 'ws' || h.kind === 'ped') { selWs = h.kind === 'ws' ? h.id : h.ws; selPed = h.kind === 'ped' ? h.id : null; }
        refresh(); if (h.kind === 'ws' || h.kind === 'ped') toast(`${E.wsName(P.worksurfaces[selWs])} selected: runs cannot start on a worksurface or pedestal. Start on open floor or at a junction post; Draw run is off.`); return;
      }
      const [x0, y0, n0] = snapPoint(wx, wy); draw = { x0, y0, n0, shift: e.shiftKey, clickNode: h && h.kind === 'node' ? h.id : null }; return;
    }
    if (h && h.kind === 'panel') {
      if (e.shiftKey) { sel.has(h.id) ? sel.delete(h.id) : sel.add(h.id); } else if (!sel.has(h.id)) sel = new Set([h.id]);
      selNode = null;
      const p = P.panels[h.id]; const Ja = R.nodes[p.a], Jb = R.nodes[p.b];
      const freeA = Ja && Ja.legs.length === 1, freeB = Jb && Jb.legs.length === 1;
      if (!e.shiftKey && sel.size === 1 && (freeA !== freeB)) {
        // one free end: grabbing the outer half swings the panel around the shared junction
        const fixed = freeA ? P.nodes[p.b] : P.nodes[p.a], free = freeA ? P.nodes[p.a] : P.nodes[p.b];
        const [fx, fy] = toS(fixed.x, fixed.y), [ex, ey] = toS(free.x, free.y);
        const t = ((sx - fx) * (ex - fx) + (sy - fy) * (ey - fy)) / (((ex - fx) ** 2 + (ey - fy) ** 2) || 1);
        if (t > 0.75) { swing = { pid: p.id, fixed, free, orig: { x: free.x, y: free.y }, allowed: E.allowedAngles(P, fixed, p.id), moved: false }; refresh(); return; }
      }
      const ids = new Set(); const nodes = new Set(); for (const c of E.components(P)) if (c.panels.some(q => sel.has(q.id))) { c.panels.forEach(q => ids.add(q.id)); c.nodes.forEach(n => nodes.add(n)); }
      dragMove = { sx, sy, ids, nodes, dx: 0, dy: 0, moved: false, errs: R.errors.length, tried: {} }; refresh(); return;
    }
    if (h && h.kind === 'node') { selNode = h.id; sel = new Set(); selWs = null; selPed = null; refresh(); return; }
    if (h && (h.kind === 'ws' || h.kind === 'ped')) {
      selWs = h.kind === 'ws' ? h.id : h.ws; selPed = h.kind === 'ped' ? h.id : null; sel = new Set(); selNode = null;
      const ws = P.worksurfaces[selWs];
      if (h.kind === 'ws' && ws.kind === 'straight') { const run = E.runOf(P, ws.panel); const t0 = E.runOffset(run, wx, wy); dragWs = { id: ws.id, off: ws.off, off0: ws.off, t0, moved: false, px: wx, py: wy }; }
      refresh(); return;
    }
    sel = new Set(); selNode = null; selWs = null; selPed = null; pan = { sx, sy, ox: view.ox, oy: view.oy }; refresh();
  });
  // ---------- right-click menu ----------
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function showMenu(x, y, items) {
    closeMenu(); const m = document.createElement('div'); m.className = 'ctxmenu'; menu = m;
    const build = (list, root) => { for (const it of list) { if (it === '-') { const d = document.createElement('div'); d.className = 'sep'; root.appendChild(d); continue; } if (it.head) { const d = document.createElement('div'); d.className = 'head'; d.textContent = it.head; root.appendChild(d); continue; } const d = document.createElement('div'); d.className = 'it' + (it.dis ? ' dis' : '') + (it.children ? ' has' : ''); d.innerHTML = `<span>${esc(it.label)}</span>${it.children ? '<span class="arrow">▸</span>' : it.hint ? `<span class="hint">${esc(it.hint)}</span>` : ''}`; if (it.children) { const sub = document.createElement('div'); sub.className = 'ctxmenu sub'; build(it.children, sub); d.appendChild(sub); } if (it.run) d.onclick = (e) => { e.stopPropagation(); closeMenu(); it.run(); }; root.appendChild(d); } }; // a row with a submenu and its own action: click it for the default, hover for the choices
    build(items, m); document.body.appendChild(m);
    const r = m.getBoundingClientRect(); m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    // each submenu is placed when it opens (nested ones are hidden until then, so they cannot be measured earlier): to the left when it would run off the right edge, up when it would run off the bottom
    $$('.sub', m).forEach(sm => { const it = sm.parentElement;
      it.addEventListener('mouseenter', () => { sm.style.left = ''; sm.style.right = ''; sm.style.top = '-5px'; let r = sm.getBoundingClientRect(); if (r.right > window.innerWidth - 8) { sm.style.left = 'auto'; sm.style.right = '100%'; r = sm.getBoundingClientRect(); } const over = r.bottom - (window.innerHeight - 8); if (over > 0) sm.style.top = (-5 - Math.min(over, r.top - 8)) + 'px'; }); });
  }
  document.addEventListener('mousedown', e => { if (menu && !menu.contains(e.target)) closeMenu(); });
  const curH = () => +$('#optHeight .on').dataset.h, curW = () => { const v = $('#optWidth').value; return v === 'auto' ? 48 : +v; };
  const DIRS = { 0: '→ east', 90: '↑ north', 180: '← west', 270: '↓ south', 30: '↗ 30°', 60: '↗ 60°', 120: '↖ 120°', 150: '↖ 150°', 210: '↙ 210°', 240: '↙ 240°', 300: '↘ 300°', 330: '↘ 330°' };
  // a worksurface the planner places must have its own floor space and no rule errors (supports on junctions p216, butted at the seams p209)
  function wsIssues(ws) { const re = new RegExp(E.wsName(ws) + '\\b'); return E.generate(P).errors.filter(m => m.panel === ws.id || re.test(m.msg)).map(m => m.msg); }
  function wsFits(ws) { return !wsIssues(ws).length; }
  function wsFree(ws) { const re = new RegExp(E.wsName(ws) + '\\b'); return !E.wsCollisions(P).some(m => m.id === ws.id || re.test(m.msg)); } // own floor space only, supports aside
  // try a change on a worksurface: the rule errors it would add (none = it fits). The worksurface is always put back as it was.
  function trialWs(ws, apply) { const keep = JSON.stringify(ws); const before = new Set(wsIssues(ws)); let bad; try { apply(); bad = wsIssues(ws).filter(m => !before.has(m)); } finally { const k = JSON.parse(keep); for (const x of Object.keys(ws)) delete ws[x]; Object.assign(ws, k); R = E.generate(P); } return bad; }
  // size, depth, construction, side and pedestal changes go through the same fit check as placing a worksurface (p209, p216): a change that adds a rule error is refused and nothing changes
  function tryWs(ws, apply, done) { const bad = trialWs(ws, apply); if (bad.length) { toast(`Not changed: ${bad[0]}`); return false; } mutate(apply); if (done) toast(typeof done === 'function' ? done(ws) : done); return true; }
  // fit lists are remembered until the plan changes (each trial rebuilds the parts list)
  let fitCache = { key: '', map: {} };
  function planKey() { return JSON.stringify([Object.values(P.worksurfaces || {}).map(w => Object.fromEntries(Object.entries(w).filter(([k]) => k[0] !== '_'))), Object.values(P.panels).map(p => [p.id, p.a, p.b, p.width]), Object.values(P.nodes).map(n => [n.id, n.x, n.y])]); }
  function memoFit(tag, fn) { const k = planKey(); if (fitCache.key !== k) fitCache = { key: k, map: {} }; if (!(tag in fitCache.map)) fitCache.map[tag] = fn(); return fitCache.map[tag].slice(); }
  const fitting = (ws, opts, apply, tag) => tag ? memoFit(tag, () => opts.filter(z => !trialWs(ws, () => apply(z)).length)) : opts.filter(z => !trialWs(ws, () => apply(z)).length);
  // corner sizes in the guide's terms (C and depth A are the user's left arm, p521, p524, p526), whichever leg the corner was drawn from
  function cornerSize(ws) { const dm = E.cornerDims(P, ws); return dm ? { C: dm.C, D: dm.D, depthA: dm.depthA, depthB: dm.depthB, hand: dm.hand || 'L' } : { C: ws.C, D: ws.D, depthA: ws.depthA, depthB: ws.depthB, hand: ws.hand }; }
  function setCornerSize(ws, z) { const dm = E.cornerDims(P, ws); if (dm && !dm.leftFirst) Object.assign(ws, { C: z.D, D: z.C, depthA: z.depthB, depthB: z.depthA, hand: z.hand }); else Object.assign(ws, { C: z.C, D: z.D, depthA: z.depthA, depthB: z.depthB, hand: z.hand }); }
  const sameSize = (a, b) => a.C === b.C && a.D === b.D && a.depthA === b.depthA && a.depthB === b.depthB;
  const sizeName = (ws, z) => `${z.C}×${z.D} · ${z.depthA}"D/${z.depthB}"D${ws.kind === 'extcorner' ? ' · ' + (z.hand === 'L' ? 'left-hand' : 'right-hand') : ''}`;
  // the corner sizes that fit where this corner is (arms on panel seams, no overlaps), plus the current one
  function cornerFits(ws) { const cur = cornerSize(ws); return memoFit('size:' + ws.id, () => E.cornerSizes(ws.kind, ws.construction).filter(z => sameSize(z, cur) || !trialWs(ws, () => setCornerSize(ws, z)).length)); }
  function changeCornerKind(ws, kind) {
    const cur = cornerSize(ws); const opts = E.cornerSizes(kind, ws.construction).sort((a, b) => ((a.depthA !== cur.depthA) + (a.depthB !== cur.depthB)) - ((b.depthA !== cur.depthA) + (b.depthB !== cur.depthB)) || (Math.abs(a.C - cur.C) + Math.abs(a.D - cur.D)) - (Math.abs(b.C - cur.C) + Math.abs(b.D - cur.D)));
    const z = opts.find(o => !trialWs(ws, () => { ws.kind = kind; setCornerSize(ws, o); }).length);
    const what = kind === 'extcorner' ? 'extended corner' : 'standard corner';
    if (!z) { toast(`No ${what} worksurface fits at ${jn(ws.node)}: its arms have to end on panel seams (p209, p216) without running into a panel or another worksurface. Nothing changed.`); return; }
    mutate(() => { ws.kind = kind; setCornerSize(ws, z); }); toast(`Now a ${sizeName(ws, z)} ${what} (${z.style}).`);
  }
  function changeConstruction(ws, con) {
    if (ws.kind === 'straight') return tryWs(ws, () => { ws.construction = con; if (con === 'full-depth') { ws.material = 'laminate'; if (!['3mm', 'K'].includes(ws.edge)) ws.edge = '3mm'; } else if (ws.edge === 'K') ws.edge = '3mm'; }, () => `Now ${con === 'full-depth' ? 'full depth' : 'with the 1/2" cord drop'}.`);
    const cur = cornerSize(ws); const z = E.cornerSizes(ws.kind, con).find(x => sameSize(x, cur) && (ws.kind !== 'extcorner' || x.hand === cur.hand));
    if (!z) { toast(`The guide has no ${con === 'full-depth' ? 'full-depth' : '1/2" cord-drop'} ${cur.C}×${cur.D} ${cur.depthA}"D/${cur.depthB}"D ${ws.kind === 'extcorner' ? 'extended corner' : 'corner'} (p521-526). Nothing changed.`); return false; }
    return tryWs(ws, () => { ws.construction = con; if (con === 'full-depth') { ws.material = 'laminate'; if (!['3mm', 'K'].includes(ws.edge)) ws.edge = '3mm'; } setCornerSize(ws, z); }, `Now ${con === 'full-depth' ? 'full depth' : 'with the 1/2" cord drop'} (${z.style}).`);
  }
  function setStraightDepth(ws, d) {
    const cands = [...E.wsWidths(P, Object.assign({}, ws, { depth: d }))].sort((a, b) => Math.abs(a - ws.width) - Math.abs(b - ws.width) || b - a);
    const w = cands.find(x => !trialWs(ws, () => { ws.depth = d; ws.width = x; }).length);
    if (w === undefined) { toast(`No ${d}"D worksurface fits here: it would miss a junction or run into a panel or another worksurface. Nothing changed.`); return; }
    mutate(() => { ws.depth = d; ws.width = w; }); toast(`Now ${w}"W × ${d}"D.`);
  }
  function swapLongArm(ws) {
    const cur = cornerSize(ws); const z = E.cornerSizes('extcorner', ws.construction).find(x => x.hand !== cur.hand && x.C === cur.D && x.D === cur.C && x.depthA === cur.depthB && x.depthB === cur.depthA);
    if (!z) { toast('The guide has no mirror-image size for this extended corner (p525).'); return; }
    tryWs(ws, () => setCornerSize(ws, z), `Long arm swapped: now ${sizeName(ws, z)} (${z.style}).`);
  }
  function addPed(ws, spec) {
    const old = ws.peds.find(x => x.at === spec.at); const where = E.endName(ws, spec.at);
    tryWs(ws, () => E.addPedestal(P, ws, spec), old ? `Replaced the ${old.type} ${PEDCFG[old.config]} pedestal at the ${where} end.` : `${spec.type === 'mobile' ? 'Mobile' : 'Fixed'} ${PEDCFG[spec.config]} pedestal added at the ${where} end.`);
  }
  // the first width and position on this side of the panel that has its own floor space and lands its ends on junctions:
  // the clicked spot, then the host panel's module, then inside the post faces of a wrapping panel. `commit` keeps it.
  function straightWidths(depth) { return [...new Set(E.catalog().products.find(x => x.id === 'uw-straight').rows.filter(r => r.attrs.depth === E.wsDepthActual(depth, 'cord-drop')).map(r => r.attrs.width))].sort((a, b) => b - a); }
  // wantW: that width only, anywhere along the run that covers the clicked panel with both ends on junctions (a 60" spans two 30" panels, p209);
  // otherwise the panel's own width first, then narrower ones
  function findStraight(pid, side, t, depth, commit, wantW) {
    const p = P.panels[pid]; const run = E.runOf(P, pid); const host = run.panels.find(r => r.id === pid);
    const widths = straightWidths(depth); const roomAll = run.length + 3; const width = wantW || widths.find(w => w === p.width && w <= roomAll) || widths.find(w => w <= Math.min(p.width, roomAll)) || widths[widths.length - 1];
    const seq = P.seq; const ws = E.newWorksurface(P, { kind: 'straight', panel: pid, side, off: 0, width, depth, edge: '3mm', material: 'laminate' }); let found = null;
    const spans = (w) => { const out = []; for (const r of run.panels) for (const s of [r.from, r.to - w, r.from + 1.5, r.to - w - 1.5]) { const o = Math.round((s - host.from) * 1000) / 1000; if (o < p.width && o + w > 0) out.push(o); } return out.sort((a, b) => Math.abs(a + w / 2 - (t - host.from)) - Math.abs(b + w / 2 - (t - host.from))); }; // nearest the click first
    for (const w of wantW ? [wantW] : [width, ...widths.filter(x => x < width)]) { ws.width = w; const offs = [Math.round(snapWsOff(ws, t - host.from - w / 2).off * 2) / 2, 0, p.width - w, 1.5, p.width - w - 1.5, ...lJointStarts(ws, run).map(x => Math.round((x - host.from) * 1000) / 1000), ...(wantW ? spans(w) : [])]; const ok = offs.find(o => { ws.off = o; return E.wsWidths(P, ws).includes(w) && wsFits(ws); }); if (ok !== undefined) { ws.off = ok; found = ws; break; } }
    let why = ''; if (!found && wantW) { ws.off = Math.round(snapWsOff(ws, t - host.from - wantW / 2).off * 2) / 2; why = E.wsWidths(P, ws).includes(wantW) ? (wsIssues(ws)[0] || '') : `the run is ${run.length}" long`; }
    let loose = 0; // widest worksurface with its own floor space on this panel, ignoring where its ends land
    if (!found && !commit) for (const w of widths) { if (w > p.width + 3) continue; ws.width = w; for (let o = -3; o <= p.width - w + 3 && !loose; o += 1.5) { ws.off = o; if (wsFree(ws)) loose = w; } if (loose) break; }
    if (!found || !commit) { E.removeWorksurface(P, ws.id); P.seq = seq; }
    return { ws: found, width: found ? found.width : 0, loose, why };
  }
  function addStraightWs(pid, side, wx, wy, depth, wantW) {
    const p = P.panels[pid]; const run = E.runOf(P, pid); const t = E.runOffset(run, wx, wy);
    let placed = null; const trial = findStraight(pid, side, t, depth, false, wantW);
    if (trial.width) mutate(() => { const r = findStraight(pid, side, t, depth, true, wantW); placed = r.ws; if (placed) { selWs = placed.id; selPed = null; sel = new Set(); selNode = null; } });
    if (placed) { toast(`${depth}"D × ${placed.width}"W worksurface added${!wantW && placed.width < p.width ? ' to clear the neighboring panel or worksurface' : ''}. Drag it along the run, right-click for pedestals.`); return; }
    if (wantW) { const fits = straightWidths(depth).filter(w => w !== wantW && w <= run.length + 3).filter(w => findStraight(pid, side, t, depth, false, w).width); toast(`A ${wantW}"W × ${depth}"D does not fit on side ${side === 0 ? 'A' : 'B'} of ${pn(pid)}: ${trial.why ? trial.why.replace(/\.$/, '') : 'no place on this run has both its ends on junctions and its own floor space'}. ${fits.length ? `What fits here at ${depth}"D: ${fits.map(w => w + '"W').join(', ')}.` : `Nothing fits here at ${depth}"D.`}`); return; }
    // say what does fit here instead
    const others = E.WS_DEPTHS.filter(d => d !== depth).map(d => [d, findStraight(pid, side, t, d, false)]).filter(([, r]) => r.width);
    const loose = findStraight(pid, side, t, depth, false).loose;
    const parts = [`No ${depth}"D worksurface fits on side ${side === 0 ? 'A' : 'B'} of ${pn(pid)}.`];
    if (others.length) parts.push(`What fits here: ${others.map(([d, r]) => `${r.width}"W × ${d}"D`).join(', ')} (right-click › Add worksurface on this side).`);
    if (loose) parts.push(`The free floor space takes a ${loose}"W × ${depth}"D, but its end would stop short of a junction, where it has nothing to hang on (p209, p216). Change ${pn(pid)}'s width so a worksurface spans junction to junction, or use a corner worksurface at the junction.`);
    else parts.push('A panel or another worksurface takes the floor space on this side of the panel (p209).');
    toast(parts.join(' '));
  }
  function addCornerWs(nid, wx, wy, kind120) {
    const n = P.nodes[nid]; const J = R.nodes[nid]; const legs = J.legs; if (!legs || legs.length < 2) return;
    const ang = ((Math.atan2(wy - n.y, wx - n.x) * 180 / Math.PI) + 360) % 360;
    // the pair of legs whose sector holds the click
    let pair = null; const L = legs.slice().sort((a, b) => a.angle - b.angle);
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; const span = ((b.angle - a.angle) + 360) % 360 || 360; const rel = ((ang - a.angle) + 360) % 360; if (rel <= span) { pair = [a, b, span]; break; } }
    if (!pair) pair = [L[0], L[1], ((L[1].angle - L[0].angle) + 360) % 360];
    const want = kind120 ? 120 : 90; if (Math.abs(pair[2] - want) > 1) { toast(`That corner is ${pair[2]}°. ${want === 90 ? 'Corner worksurfaces fit 90° corners' : '120° corner worksurfaces fit 120° corners'}.`); return; }
    const sizes = E.cornerSizes(kind120 ? 'corner120' : 'corner', 'cord-drop').filter(z => z.depthA === 24 && z.depthB === 24 && z.C === z.D).sort((a, b) => b.C - a.C);
    // sizes whose arms end on panel seams (p209, p216), the first panel of each leg first, then the first one with its own floor space
    const d0 = seamDists(nid, pair[0].panel.id), d1 = seamDists(nid, pair[1].panel.id);
    const onSeams = sizes.filter(z => d0.includes(z.C) && d1.includes(z.D)).sort((a, b) => ((b.C === d0[0] && b.D === d1[0]) - (a.C === d0[0] && a.D === d1[0])));
    let placed = null;
    if (onSeams.length) mutate(() => {
      const ws = E.newWorksurface(P, { kind: kind120 ? 'corner120' : 'corner', node: nid, legs: [pair[0].panel.id, pair[1].panel.id], C: onSeams[0].C, D: onSeams[0].D, depthA: 24, depthB: 24, supports: { arm0: 'auto', arm1: 'auto' } });
      const clear = () => wsFits(ws);
      for (const z of onSeams) { Object.assign(ws, { C: z.C, D: z.D }); if (clear()) { placed = ws; break; } }
      if (!placed) { E.removeWorksurface(P, ws.id); return; }
      selWs = ws.id; selPed = null; sel = new Set(); selNode = null;
    });
    toast(placed ? `${placed.C}×${placed.D} corner worksurface added at ${jn(nid)}` : !onSeams.length ? `No ${kind120 ? '120° ' : ''}corner worksurface fits at ${jn(nid)}: its arms have to end on panel seams (p209, p216) and the seams here are ${d0.slice(0, 3).join('/')}" and ${d1.slice(0, 3).join('/')}" out. Change a panel width, or use straight worksurfaces.` : `No room for a corner worksurface at ${jn(nid)}: it would overlap a panel or another worksurface, or break a support rule (p209, p216).`);
  }
  // the corner arm sizes that end on a panel seam along one leg's run: each seam's distance from the corner node less the corner allowance (a corner arm
  // of nominal C ends the allowance + C out, E.CORNER_ALLOW, p209, p521)
  function seamDists(nid, pid) { const n = P.nodes[nid], p = P.panels[pid]; const run = E.runOf(P, pid); const t = E.runOffset(run, n.x, n.y); const o = P.nodes[p.a === nid ? p.b : p.a]; const sg = ((o.x - n.x) * run.dir[0] + (o.y - n.y) * run.dir[1]) > 0 ? 1 : -1; const ca = E.nodeAllow(P, nid); return [...new Set(run.panels.flatMap(r => [r.from, r.to]))].map(x => Math.round(((x - t) * sg - ca) * 1000) / 1000).filter(d => d > 1).sort((a, b) => a - b); }
  function endKeys(ws) { if (ws.kind === 'straight') return ws.side === 0 ? { left: 'lo', right: 'hi' } : { left: 'hi', right: 'lo' }; const leftFirst = !(ws._armNames && ws._armNames[0] === 'right arm'); return leftFirst ? { left: 'arm0', right: 'arm1' } : { left: 'arm1', right: 'arm0' }; }
  const endLabel = (ws, side) => ws.kind === 'straight' ? (side === 'left' ? 'Left end' : 'Right end') : (side === 'left' ? 'Left arm end' : 'Right arm end');
  function pedItems(ws) {
    const ek = endKeys(ws); const legOf = (k) => ws.kind === 'straight' ? '' : ` (${pn(ws.legs[k === 'arm1' ? 1 : 0])})`;
    const endItem = (k, side, type, cfg) => { const old = ws.peds.find(x => x.at === k); return { label: `${endLabel(ws, side)}${legOf(k)}${old ? ` — replaces the ${old.type} ${PEDCFG[old.config]}` : ''}`, run: () => addPed(ws, { at: k, type, config: cfg }) }; };
    const mk = (type, cfg, label) => ({ label, children: [endItem(ek.left, 'left', type, cfg), endItem(ek.right, 'right', type, cfg)] });
    return [mk('fixed', 'A', 'Fixed pedestal, box/box/file'), mk('fixed', 'B', 'Fixed pedestal, file/file'), mk('mobile', 'A', 'Mobile pedestal, box/box/file'), mk('mobile', 'C', 'Mobile pedestal, box/file 21"H'), mk('mobile', 'B', 'Mobile pedestal, file/file')];
  }
  // the panels an edit applies to: the whole selection when the clicked panel is part of it, else just that panel
  // width for one more panel on the end of a run: the "New panels" width, or the end panel's own width when that is set to Auto
  function extW(src) { const v = $('#optWidth').value; return v === 'auto' ? src.width : +v; }
  // panels added from the ⊕ at a free end (and Continue the run): with "Auto fill widths" they match the neighboring panel
  // (height, width, tiles, glass, power); with a width chosen they use the toolbar's width and height ("New panels")
  const matchMode = () => $('#optWidth').value === 'auto';
  function extH(src) { return matchMode() ? src.height : curH(); }
  function extPanel(src, q) { if (q.height === src.height) { const w = q.width; copyPanelSettings(src, q); q.width = w; } else applyDefaults(q); }
  // "Assign to workstation" submenu for panels (multi-select aware) or one worksurface
  function stationItems(panels, wsl) {
    const groups = E.workstations(P); const cur = new Set([...panels.map(q => q.station || ''), ...(wsl || []).map(w => w.station || '')]);
    const nextName = () => { const used = new Set(groups.map(g => g.name)); let n = groups.length + 1; while (used.has('Workstation ' + n)) n++; return 'Workstation ' + n; };
    return [...groups.map(g => ({ label: g.name + (cur.size === 1 && cur.has(g.name) ? '  ✓' : ''), run: () => assignStation(panels, g.name, wsl) })),
      { label: 'New workstation…', run: () => { const nm = (prompt('Name of the new workstation', nextName()) || '').trim(); if (nm) assignStation(panels, nm, wsl); } },
      { label: wsl && wsl.length ? 'Same as its panel (automatic)' : 'Automatic (connected panels)', run: () => assignStation(panels, '', wsl) }];
  }
  function targetsOf(p) { return sel.has(p.id) && sel.size > 1 ? [...sel].map(id => P.panels[id]).filter(Boolean) : [p]; }
  const who = (list) => list.length === 1 ? pn(list[0].id) : `${list.length} panels`;
  const PWNAME = { none: 'no power', powerkit: 'a powerkit', passthrough: 'a pass-through powerkit' };
  function setPower(ts, kind, per = 2) {
    mutate(() => ts.forEach(q => { if (kind === 'powerkit') { if (q.width < 24) return; const cap = E.powerBlocksPerSide(q.width); if (q.power.kind !== 'powerkit' || !q.power.receptacles.some(x => x)) { const n = Math.min(per, cap); q.power.receptacles = [n, n]; } q.power.kind = 'powerkit'; q.power.location = q.power.location || 'base'; } else { q.power.kind = kind; if (kind !== 'powerkit') q.power.infeed = null; } }));
    const skipped = kind === 'powerkit' ? ts.filter(q => q.width < 24).length : 0;
    toast(`${who(ts)}: ${PWNAME[kind]}${skipped ? ` (${skipped} panel${skipped === 1 ? '' : 's'} under 24"W left as ${skipped === 1 ? 'it was' : 'they were'}: powerkits start at 24"W)` : ''}${kind === 'powerkit' ? '. Give one panel of the run a power infeed (p158).' : ''}`);
  }
  function powerItems(p) {
    const ts = targetsOf(p); const few = ts.length > 1 ? ` (${ts.length} panels)` : '';
    return [{ label: 'None' + few, run: () => setPower(ts, 'none') },
      { label: 'Powerkit, receptacles both sides' + few, dis: ts.every(q => q.width < 24), run: () => setPower(ts, 'powerkit') },
      { label: 'Pass-through' + few, run: () => setPower(ts, 'passthrough') }];
  }
  // stackers that no longer fit under the 90" maximum are trimmed by E.setStack (largest part that fits); say what changed
  function setHeights(list, hh) {
    const msgs = []; mutate(() => { for (const q of list) { const before = q.stack.slice(); E.setHeight(P, q, hh); if (before.join() !== q.stack.join()) msgs.push(`${pn(q.id)}: ${hh}" + ${before.join('" + ')}" is over the 90" maximum, so the stack is now ${q.stack.length ? q.stack.join('" + ') + '"' : 'removed'} (p27).`); } });
    toast(msgs.length ? msgs.join(' ') : `${who(list)} now ${hh}" high`);
  }
  // change a panel's width, moving everything beyond its far junction along the panel; refuses a panel that closes a loop
  function changeWidth(p, ww) {
    const d = ww - p.width; if (!d) return true; const b = P.nodes[p.b], a = P.nodes[p.a]; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const comp = E.components(P).find(c => c.panels.some(q => q.id === p.id)); const downstream = new Set(); const stack = [p.b]; const seen = new Set([p.a]);
    while (stack.length) { const nid = stack.pop(); if (seen.has(nid)) continue; seen.add(nid); downstream.add(nid); for (const q of comp.panels) { if (q.id === p.id) continue; if (q.a === nid && !seen.has(q.b)) stack.push(q.b); if (q.b === nid && !seen.has(q.a)) stack.push(q.a); if ((q.a === nid && q.b === p.a) || (q.b === nid && q.a === p.a)) downstream.add(p.a); } }
    if (downstream.has(p.a)) { toast(`${pn(p.id)} closes a loop, so its width cannot change here. Delete a panel in the loop first.`); return false; }
    p.width = ww; for (const nid of downstream) { P.nodes[nid].x += ux * d; P.nodes[nid].y += uy * d; }
    return true;
  }
  function setWidths(list, ww) { guardedMutate(() => { for (const q of list) if (!changeWidth(q, ww)) return false; }, 'Width not changed'); }
  function contextItems(h, wx, wy) {
    if (!h) return [{ head: 'Plan' }, { label: 'Draw a run here', hint: 'D', run: () => { setTool('draw'); toast('Click and drag along the wall line. Shift for 120° angles.'); } }, { label: 'Add worksurfaces…', hint: 'W', run: () => setTool('ws') }, { label: 'Add typical here…', run: () => { placeAt = [snapW(wx), snapW(wy)]; renderTypicals(); $('#typicals').classList.add('on'); } }, { label: 'Add workstation here…', hint: 'with worksurfaces', run: () => { placeAt = [snapW(wx), snapW(wy)]; renderTypicals(true); $('#typicals').classList.add('on'); } }, '-', { label: 'Fit to window', run: () => { fit(); drawPlan(); } }];
    if (h.kind === 'panel') {
      const p = P.panels[h.id]; const side = wsSideOfClick(p, wx, wy); const Ja = R.nodes[p.a], Jb = R.nodes[p.b];
      const ends = [[p.a, Ja], [p.b, Jb]].filter(([nid, J]) => J && J.legs.length === 1);
      return [{ head: `${pn(p.id)} · ${p.width}"W × ${E.panelTotalHeight(p)}"H · side ${side === 0 ? 'A' : 'B'}` },
        { label: 'Add worksurface on this side', children: [24, 30, 18].map(d => ({ label: `${d}"D worksurface`, run: () => addStraightWs(p.id, side, wx, wy, d), children: [{ label: 'Fit the panel', hint: 'auto', run: () => addStraightWs(p.id, side, wx, wy, d) }, '-', ...straightWidths(d).filter(w => w <= E.runOf(P, p.id).length + 3).sort((a, b) => a - b).map(w => ({ label: `${w}"W × ${d}"D`, run: () => addStraightWs(p.id, side, wx, wy, d, w) }))] })) }, // 36"D (35 1/2") straights are freestanding only (p508 tip)
        { label: 'Continue the run', dis: !ends.length, children: ends.map(([nid, J]) => ({ label: `Add ${extW(p)}" × ${extH(p)}" panel at ${jn(nid)}`, run: () => guardedMutate(() => { const l = J.legs[0]; const q = E.addPanel(P, P.nodes[nid], (l.angle + 180) % 360, extW(p), extH(p)); extPanel(p, q); sel = new Set([q.id]); selNode = null; selWs = null; }, 'Panel not added') })) },
        { label: 'Height', children: E.HEIGHTS.map(hh => ({ label: `${hh}"${hh === p.height ? '  ✓' : ''}`, run: () => setHeights(targetsOf(p), hh) })) },
        { label: 'Width', children: E.WIDTHS.map(ww => ({ label: `${ww}"${ww === p.width ? '  ✓' : ''}`, run: () => setWidths(targetsOf(p), ww) })) },
        P.trim === 'thin' ? { label: p.glassScreen ? 'Remove glass screen' : 'Add 12" frameless glass screen', dis: p.width < 24, run: () => mutate(() => { const on = !p.glassScreen; for (const q of targetsOf(p)) q.glassScreen = on && q.width >= 24 ? (q.glassScreen || { attach: 'recessed', height: 12, frosted: false, omitGlass: false }) : null; }) } : { label: p.stack.length ? 'Remove stacker' : 'Add 12" stacker', run: () => mutate(() => { const on = !p.stack.length; for (const q of targetsOf(p)) E.setStack(P, q, on ? [12] : []); }) },
        { label: 'Power', children: powerItems(p) },
        { label: 'Assign to workstation', children: stationItems(targetsOf(p)) },
        { label: 'Split this pod into stations', dis: Object.values(P.worksurfaces || {}).filter(w => { const c = E.components(P).find(x => x.panels.some(q => q.id === p.id)); return c && c.panels.some(q => q.id === E.hostPanelOf(P, w.id)); }).length < 2, run: () => { const c = E.components(P).find(x => x.panels.some(q => q.id === p.id)); if (c) splitPod(c.key); } },
        '-', { label: 'Select this run', run: () => { sel = new Set(chainOf(p.id).map(q => q.id)); selNode = null; selWs = null; refresh(); } },
        { label: 'Delete panel', hint: 'Del', run: () => mutate(() => { for (const id of (sel.has(p.id) ? [...sel] : [p.id])) E.removePanel(P, id); sel = new Set(); }) }];
    }
    if (h.kind === 'handle') { // extend from this free end: every direction Answer offers here, straight on first
      const nid = h.id, n = P.nodes[nid], J = R.nodes[nid], l = J.legs[0], src = P.panels[l.panel.id], straight = (l.angle + 180) % 360; const allowed = E.allowedAngles(P, n).slice().sort((a, b) => (b === straight) - (a === straight));
      const add = (a) => guardedMutate(() => { const q = E.addPanel(P, n, a, extW(src), extH(src)); extPanel(src, q); sel = new Set([q.id]); selNode = null; selWs = null; selPed = null; }, 'Panel not added');
      return [{ head: `Extend ${pn(src.id)} · ${extW(src)}" × ${extH(src)}" panel` }, ...(allowed.length ? allowed.map(a => ({ label: (DIRS[a] || a + '°') + (a === straight ? '  (straight on)' : a % 90 ? '  (120° V)' : '  (90° L)'), run: () => add(a) })) : [{ label: 'No compliant direction from here', dis: true }]),
        '-', { label: n.wallStart ? 'Not a wall start' : 'Starts at a wall (wall-start junction)', dis: l.base === 30, run: () => mutate(() => n.wallStart = !n.wallStart) }];
    }
    if (h.kind === 'node') {
      const nid = h.id; const n = P.nodes[nid]; const J = R.nodes[nid]; const allowed = E.allowedAngles(P, n); const nLegs = (J.legs || []).length;
      return [{ head: `${jn(nid)} · ${jShort(J)}` },
        { label: 'Add corner worksurface here', dis: !(J.family !== 120 && nLegs >= 2), run: () => addCornerWs(nid, wx, wy, false) },
        { label: 'Add 120° corner worksurface here', dis: !(J.family === 120 && nLegs >= 2), run: () => addCornerWs(nid, wx, wy, true) },
        { label: `Add ${curW()}" × ${curH()}" panel`, dis: !allowed.length, children: allowed.map(a => ({ label: DIRS[a] || a + '°', run: () => guardedMutate(() => { const q = E.addPanel(P, n, a, curW(), curH()); applyDefaults(q); sel = new Set([q.id]); selNode = null; selWs = null; }, 'Panel not added') })) },
        nLegs === 1 ? { label: n.wallStart ? 'Not a wall start' : 'Starts at a wall (wall-start junction)', dis: J.legs[0].base === 30, run: () => mutate(() => n.wallStart = !n.wallStart) } : '-',
        { label: 'Delete junction and its panels', run: () => mutate(() => { for (const l of (J.legs || [])) E.removePanel(P, l.panel.id); if (P.nodes[nid]) delete P.nodes[nid]; selNode = null; sel = new Set(); }) }];
    }
    if (h.kind === 'ws' || h.kind === 'ped') {
      const ws = P.worksurfaces[h.kind === 'ws' ? h.id : h.ws]; const ek = endKeys(ws); const items = [{ head: `${E.wsName(ws)}` }];
      if (h.kind === 'ped') {
        const d = ws.peds.find(x => x.id === h.id); const other = d.at === ek.left ? ek.right : ek.left; const there = ws.peds.find(x => x !== d && x.at === other);
        items.push({ head: `${d.type} pedestal ${PEDCFG[d.config]}` }, { label: 'Drawers', children: (d.type === 'mobile' ? [['A', 'Box/box/file'], ['B', 'File/file'], ['C', 'Box/file 21"H']] : [['A', 'Box/box/file'], ['B', 'File/file']]).map(([c, l]) => ({ label: l + (d.config === c ? '  ✓' : ''), run: () => mutate(() => d.config = c) })) }, { label: 'Front', children: [['F', 'Flush steel'], ['P', 'Proud steel'], ['W', 'Proud wood']].map(([c, l]) => ({ label: l + (d.front === c ? '  ✓' : ''), run: () => mutate(() => d.front = c) })) }, { label: d.type === 'fixed' ? 'Make it mobile' : 'Make it fixed (supports the worksurface)', run: () => tryWs(ws, () => { const x = ws.peds.find(y => y.id === d.id); x.type = x.type === 'fixed' ? 'mobile' : 'fixed'; if (x.type === 'fixed' && x.config === 'C') x.config = 'A'; }) },
          { label: there ? `Swap with the ${there.type} ${PEDCFG[there.config]} at the other end` : 'Move to the other end', run: () => tryWs(ws, () => { const x = ws.peds.find(y => y.id === d.id), t = there && ws.peds.find(y => y.id === there.id); if (t) t.at = x.at; x.at = other; }, there ? 'Pedestals swapped.' : `Pedestal moved to the ${E.endName(ws, other)} end.`) }, '-', { label: 'Delete pedestal', hint: 'Del', run: () => mutate(() => E.removePedestal(P, ws, d.id)) });
        return items;
      }
      items.push({ label: 'Add pedestal', children: pedItems(ws) });
      if (ws.kind === 'straight') {
        const widths = fitting(ws, E.wsWidths(P, ws), w => { ws.width = w; ws.off = snapWsOff(ws, ws.off).off; }, 'width:' + ws.id); if (!widths.includes(ws.width)) widths.push(ws.width); widths.sort((a, b) => a - b);
        items.push({ label: 'Width', children: widths.map(w => ({ label: `${w}"${w === ws.width ? '  ✓' : ''}`, run: () => tryWs(ws, () => { ws.width = w; ws.off = snapWsOff(ws, ws.off).off; }, `Now ${w}"W.`) })) });
        items.push({ label: 'Depth', children: E.WS_DEPTHS.map(d => ({ label: `${d}"${d === ws.depth ? '  ✓' : ''}`, run: () => setStraightDepth(ws, d) })) });
        items.push({ label: 'Move to the other side of the panel', run: () => tryWs(ws, () => { ws.side = 1 - ws.side; }, 'Moved to the other side of the panel.') });
      } else {
        const cur = cornerSize(ws);
        items.push({ label: 'Size', children: cornerFits(ws).map(z => ({ label: sizeName(ws, z) + (sameSize(z, cur) ? '  ✓' : ''), run: () => tryWs(ws, () => setCornerSize(ws, z), `Now ${sizeName(ws, z)} (${z.style}).`) })) });
        if (ws.kind !== 'corner120') items.push({ label: ws.kind === 'corner' ? 'Make it an extended corner' : 'Make it a standard corner', run: () => changeCornerKind(ws, ws.kind === 'corner' ? 'extcorner' : 'corner') });
        if (ws.kind === 'extcorner') items.push({ label: 'Swap the long arm to the other leg', run: () => swapLongArm(ws) });
      }
      const supportOpts = [['auto', 'Automatic (per the guide)'], ['cantilever', 'Cantilever'], ['endpanel', 'End panel'], ['leg', 'Post leg'], ['csp', 'Center support panel (shared at a seam)'], ['ssb', 'Side support bracket (wrapped end)']];
      for (const side of ['left', 'right']) { const k = ek[side]; items.push({ label: `Support at the ${endLabel(ws, side).toLowerCase()}`, children: supportOpts.map(([v, l]) => ({ label: l + ((ws.supports[k] || 'auto') === v ? '  ✓' : ''), run: () => mutate(() => ws.supports[k] = v) })) }); }
      items.push({ label: 'Assign to workstation', children: stationItems([], [ws]) });
      items.push('-', { label: 'Delete worksurface', hint: 'Del', run: () => mutate(() => E.removeWorksurface(P, ws.id)) });
      return items;
    }
    return [];
  }
  let placeAt = null;
  plan.addEventListener('contextmenu', e => {
    e.preventDefault(); const [sx, sy] = mousePos(e); const [wx, wy] = toW(sx, sy); draw = null; dragMove = null; dragWs = null; swing = null; pan = null;
    if (placing) { placing = null; plan.className = ''; drawPlan(); return; }
    const h = hit(sx, sy);
    if (h && h.kind === 'panel' && !sel.has(h.id)) { sel = new Set([h.id]); selNode = null; selWs = null; selPed = null; refresh(); }
    if (h && h.kind === 'node') { selNode = h.id; sel = new Set(); selWs = null; refresh(); }
    if (h && (h.kind === 'ws' || h.kind === 'ped')) { selWs = h.kind === 'ws' ? h.id : h.ws; selPed = h.kind === 'ped' ? h.id : null; sel = new Set(); selNode = null; refresh(); }
    showMenu(e.clientX, e.clientY, contextItems(h, wx, wy));
  });
  window.addEventListener('mousemove', e => {
    const [sx, sy] = mousePos(e); const [wx, wy] = toW(sx, sy);
    if (draw) {
      const rawA = Math.atan2(wy - draw.y0, wx - draw.x0); const step = (e.shiftKey || draw.shift) ? Math.PI / 6 : Math.PI / 2; const ang = Math.round(rawA / step) * step;
      let len = Math.max(0, (wx - draw.x0) * Math.cos(ang) + (wy - draw.y0) * Math.sin(ang));
      // snap end to an existing node along the line
      // corner allowances the run will take at its ends (E.CORNER_ALLOW): its first panel starts 1 1/2" out from a start junction that becomes an L or T
      const angD = ang * 180 / Math.PI, ca0 = draw.n0 ? E.allowIfAdded(P, draw.n0, angD) : 0;
      // a run ending on an existing junction is kept only when its panels land exactly on it once the corner allowances are laid out (tried on a copy)
      let endNode = null, ca1 = 0, endSeg = null; for (const n of Object.values(P.nodes)) { const d = Math.hypot(n.x - (draw.x0 + Math.cos(ang) * len), n.y - (draw.y0 + Math.sin(ang) * len)); if (d < 12 / view.s && n !== draw.n0) { const L = Math.hypot(n.x - draw.x0, n.y - draw.y0); const c1 = E.allowIfAdded(P, n, angD + 180); const seg = E.segmentRun(L - ca0 - c1, $('#optWidth').value); if (seg.widths.length && closesOn(draw, angD, seg.widths, n)) { endNode = n; len = L; ca1 = c1; endSeg = seg; } } }
      const seg = endSeg || E.segmentRun(Math.max(0, len - ca0), $('#optWidth').value); Object.assign(draw, { ang, len: seg.length + ca0 + ca1, widths: seg.widths, endNode, ca0 }); drawPlan(); return;
    }
    if (swing) {
      const p = P.panels[swing.pid]; const raw = Math.atan2(wy - swing.fixed.y, wx - swing.fixed.x) * 180 / Math.PI;
      let best = null, bd = 1e9; for (const a of swing.allowed) { let d = Math.abs((((raw - a) % 360) + 540) % 360 - 180); if (d < bd) { bd = d; best = a; } }
      if (best !== null) { const rad = best * Math.PI / 180, len = p.width + E.allowIfAdded(P, swing.fixed, best, p.id); swing.free.x = Math.round((swing.fixed.x + Math.cos(rad) * len) * 1000) / 1000; swing.free.y = Math.round((swing.fixed.y + Math.sin(rad) * len) * 1000) / 1000; swing.angle = best; swing.moved = true; drawPlan(); }
      return;
    }
    if (dragWs) { const ws = P.worksurfaces[dragWs.id]; if (!ws) { dragWs = null; return; } const run = E.runOf(P, ws.panel); const t = E.runOffset(run, wx, wy); const raw = dragWs.off0 + (t - dragWs.t0); const sn = snapWsOff(ws, raw); dragWs.off = Math.round(sn.off * 2) / 2; if (Math.abs(dragWs.off - dragWs.off0) > 0.01) dragWs.moved = true; dragWs.px = wx; dragWs.py = wy; dragWs.label = sn.snapped ? 'snap' : ''; drawPlan(); return; }
    if (dragMove) { const rdx = (sx - dragMove.sx) / view.s, rdy = -(sy - dragMove.sy) / view.s; const sn = joinSnap(dragMove, rdx, rdy); const dx = sn ? sn.dx : snapW(rdx), dy = sn ? sn.dy : snapW(rdy); dragMove.snap = sn; if (dx || dy) dragMove.moved = true; dragMove.dx = dx; dragMove.dy = dy; drawPlan(); return; }
    if (pan) { view.ox = pan.ox + (sx - pan.sx); view.oy = pan.oy + (sy - pan.sy); drawPlan(); return; }
    if (placing) { placing.ghost = [snapW(wx), snapW(wy)]; drawPlan(); return; }
    const h = hit(sx, sy); const changed = JSON.stringify(h) !== JSON.stringify(hover); hover = h;
    const tip = $('#planTip');
    if (h && h.kind === 'panel') { const p = P.panels[h.id]; const JA = R.nodes[p.a], JB = R.nodes[p.b]; const oneFree = JA && JB && ((JA.legs.length === 1) !== (JB.legs.length === 1)); tip.textContent = `${pn(p.id)} · ${p.width}"W × ${E.panelTotalHeight(p)}"H · click to edit · ${oneFree ? 'drag to move the run, drag the free tip to swing it' : 'drag to move the run'}`; tip.style.display = 'block'; tip.style.left = sx + 14 + 'px'; tip.style.top = sy + 10 + 'px'; }
    else if (h && h.kind === 'ws') { const ws = P.worksurfaces[h.id]; tip.textContent = `${E.wsName(ws)} · ${ws.kind === 'straight' ? ws.width + '"W × ' + ws.depth + '"D · drag along the run' : ws.C + '×' + ws.D} · right-click for pedestals and supports`; tip.style.display = 'block'; tip.style.left = sx + 14 + 'px'; tip.style.top = sy + 10 + 'px'; }
    else if (h && h.kind === 'ped') { const ws = P.worksurfaces[h.ws]; const d = ws.peds.find(x => x.id === h.id); tip.textContent = `${d.type} pedestal ${PEDCFG[d.config]} · right-click to change`; tip.style.display = 'block'; tip.style.left = sx + 14 + 'px'; tip.style.top = sy + 10 + 'px'; }
    else if (h && h.kind === 'handle') { { const J = R.nodes[h.id]; const src = J && J.legs && J.legs[0] && P.panels[J.legs[0].panel.id]; tip.textContent = src ? (matchMode() ? `Click: one more ${src.width}" × ${src.height}" panel matching this run · drag: turn a corner (Auto fill widths: new panels match the run)` : `Click: one more ${curW()}" × ${curH()}" panel (the New panels size) · drag: turn a corner`) : 'Click: one more panel · drag: turn a corner'; } tip.style.display = 'block'; tip.style.left = sx + 14 + 'px'; tip.style.top = sy + 10 + 'px'; }
    else if (h && h.kind === 'node') { const J = R.nodes[h.id]; tip.textContent = `${jn(h.id)} · ${J.legs.length} panel${J.legs.length === 1 ? '' : 's'} · ${jShort(J)}`; tip.style.display = 'block'; tip.style.left = sx + 14 + 'px'; tip.style.top = sy + 10 + 'px'; }
    else tip.style.display = 'none';
    if (tip.style.display === 'block') { const W0 = plan.clientWidth, H0 = plan.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight; tip.style.left = Math.max(4, sx + 14 + tw > W0 - 4 ? sx - 14 - tw : sx + 14) + 'px'; tip.style.top = Math.max(4, sy + 10 + th > H0 - 4 ? sy - 10 - th : sy + 10) + 'px'; } // keep the tip inside the plan
    plan.className = tool === 'draw' ? 'draw' : placing ? 'place' : (h ? '' : 'grab');
    if (changed) drawPlan();
  });
  // would a run of these widths from the draw start end on node `end`, with every loop it closes fitting (E.normalizeGeometry)? Tried on a copy of the job.
  function closesOn(d, angD, widths, end) {
    try {
      const Q = JSON.parse(JSON.stringify({ nodes: P.nodes, panels: P.panels, seq: P.seq, finishes: P.finishes, trim: P.trim }));
      let n = d.n0 ? Q.nodes[d.n0.id] : (E.nodeAt(Q, d.x0, d.y0, 1) || E.addNode(Q, d.x0, d.y0)); let last = null;
      for (const w of widths) { last = E.addPanel(Q, n, angD, w, 54); n = Q.nodes[last.b]; }
      return !!last && last.b === end.id && !E.normalizeGeometry(Q, { dry: true }).loops.length;
    } catch (e) { return false; }
  }
  window.addEventListener('mouseup', e => {
    if (draw) { const d = draw; draw = null;
      const src = d.handle && P.panels[d.handle.src];
      if (d.handle && !(d.widths && d.widths.length)) { // plain click on ⊕: one more panel straight on, same as its neighbour
        if (!src || !P.nodes[d.handle.nid]) { drawPlan(); return; }
        guardedMutate(() => { const w = extW(src); const q = E.addPanel(P, P.nodes[d.handle.nid], d.handle.ang, w, extH(src)); extPanel(src, q); sel = new Set([q.id]); selNode = null; selWs = null; selPed = null; }, 'Panel not added');
        return;
      }
      if (!d.widths && d.clickNode) { setTool('select'); selNode = d.clickNode; sel = new Set(); selWs = null; selPed = null; refresh(); return; }
      if (d.widths && d.widths.length) {
        const ok = guardedMutate(() => { let n = d.n0 || E.nodeAt(P, d.x0, d.y0, 1) || E.addNode(P, d.x0, d.y0); const ids = []; for (const wdt of d.widths) { const q = E.addPanel(P, n, d.ang * 180 / Math.PI, wdt, src ? extH(src) : curH()); if (src) extPanel(src, q); else applyDefaults(q); ids.push(q.id); n = P.nodes[q.b]; } sel = new Set([ids[ids.length - 1]]); selNode = null; selWs = null; selPed = null; }, 'Run not drawn');
        if (ok) toast(`${d.widths.length} panel${d.widths.length === 1 ? '' : 's'} added`);
      } else drawPlan();
      return; }
    if (swing) {
      const sw = swing; swing = null;
      if (sw.moved && (sw.free.x !== sw.orig.x || sw.free.y !== sw.orig.y)) {
        const nx = sw.free.x, ny = sw.free.y; sw.free.x = sw.orig.x; sw.free.y = sw.orig.y; // revert, then apply through the merge-aware move
        guardedMutate(() => { if (!E.moveNodes(P, [sw.free.id], nx - sw.orig.x, ny - sw.orig.y)) { toast('That direction would join a junction Answer does not offer.'); return false; } }, 'Panel not swung');
      } else { sw.free.x = sw.orig.x; sw.free.y = sw.orig.y; drawPlan(); }
      return;
    }
    if (dragWs) { const d = dragWs; dragWs = null; if (d.moved) mutate(() => { if (P.worksurfaces[d.id]) P.worksurfaces[d.id].off = d.off; }); else drawPlan(); return; }
    if (dragMove) { const dm = dragMove; dragMove = null; if (dm.moved && (dm.dx || dm.dy)) { const ok = guardedMutate(() => { if (!E.moveNodes(P, [...dm.nodes], dm.dx, dm.dy)) { toast('Cannot join there: panels would meet at an angle Answer does not support.'); return false; } }, 'Run not moved'); if (ok && dm.snap) toast(`Runs joined at ${jn(dm.snap.node)}: ${jShort(R.nodes[dm.snap.node]) || dm.snap.type} junction.`); } else drawPlan(); return; }
    if (pan) { pan = null; }
  });
  const ZMAX = 14;
  function zoomAt(sx, sy, f) { const [wx, wy] = toW(sx, sy); view.s = Math.max(ZMIN, Math.min(ZMAX, view.s * f)); view.ox = sx - wx * view.s; view.oy = sy + wy * view.s; drawPlan(); }
  plan.addEventListener('wheel', e => { e.preventDefault(); const [sx, sy] = mousePos(e); zoomAt(sx, sy, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  $('#zIn').onclick = () => zoomAt(W() / 2, H() / 2, 1.25); $('#zOut').onclick = () => zoomAt(W() / 2, H() / 2, 1 / 1.25); $('#zFit').onclick = () => { fit(); drawPlan(); };
  $$('#toolgroup [data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  function setTool(t) { tool = t; placing = null; $$('#toolgroup [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); plan.className = t === 'draw' ? 'draw' : t === 'ws' ? 'place' : ''; if (t === 'ws') toast('Add worksurface: click the side of a panel for a straight, or a corner junction for a corner worksurface. Esc when done.'); drawPlan(); }
  const wsDepth = () => +($('#optWsDepth') ? $('#optWsDepth').value : 24);
  const wsWidth = () => { const v = $('#optWsWidth') ? $('#optWsWidth').value : 'auto'; return v === 'auto' ? undefined : +v; };
  function fillWsWidths() { const sel = $('#optWsWidth'); if (!sel) return; const keep = sel.value; const ws = straightWidths(wsDepth()).slice().sort((a, b) => a - b); sel.innerHTML = '<option value="auto">Auto width</option>' + ws.map(w => `<option value="${w}">${w}"W</option>`).join(''); sel.value = ws.includes(+keep) ? keep : 'auto'; }
  if ($('#optWsDepth')) { $('#optWsDepth').addEventListener('change', fillWsWidths); fillWsWidths(); }
  function applyDefaults(q) { const g = $('#optGlass'); if (g && g.checked && P.trim === 'thin' && q.width >= 24) q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; }
  function copyPanelSettings(from, to) { const keep = { id: to.id, a: to.a, b: to.b }; Object.assign(to, JSON.parse(JSON.stringify(from)), keep); to.label = ''; if (to.power) to.power.infeed = null; } // one building infeed per circuit run, never copied
  // ---------- workstations: assignment, rename, split ----------
  // assigning panels to the name of an automatic workstation (a connected group) names that whole group, so they join it
  function assignStation(list, name, wsList) {
    const groups = E.workstations(P); const auto = name && groups.find(g => g.name === name && !g.key.startsWith('st:'));
    mutate(() => { if (auto) for (const q of auto.panels) q.station = name; for (const q of list) q.station = name || ''; for (const w of wsList || []) w.station = name || ''; });
    const n = list.length + (wsList || []).length;
    toast(name ? `${n === 1 ? (list[0] ? pn(list[0].id) : E.wsName(wsList[0])) : n + ' items'} assigned to ${name}${list.length ? ' (worksurfaces on these panels follow them)' : ''}` : `${n === 1 ? (list[0] ? pn(list[0].id) : E.wsName(wsList[0])) : n + ' items'} back to automatic grouping by connected panels`);
  }
  function renameStation(key, name) {
    if (!name) { refresh(); return; }
    if (key.startsWith('st:')) { const old = key.slice(3); mutate(() => { for (const q of Object.values(P.panels)) if (q.station === old) q.station = name; for (const w of Object.values(P.worksurfaces || {})) if (w.station === old) w.station = name; }); }
    else mutate(() => { P.areas[key] = name; });
  }
  function splitPod(compKey) {
    const c = E.workstations(P).find(g => g.comp === compKey && !g.key.startsWith('st:')) || E.workstations(P).find(g => g.comp === compKey);
    const base = (c ? c.name : 'Workstation') + ' ';
    snapshot(); const names = E.splitStations(P, compKey, base.replace(/ $/, ''));
    if (!names) { history.pop(); toast('Nothing to split: stations are found from worksurfaces that touch, and this group has only one such cluster. Assign panels by name instead (right-click › Assign to workstation).'); return; }
    refresh(); toast(`Split into ${names.length} workstations: ${names.join(', ')}. Rename them under Workstations; right-click › Assign to workstation to adjust.`);
  }
  function renderLegend() { $('#legend').innerHTML = Object.entries(HCOL).map(([h, c]) => `<span><span class="sw" style="background:${c}"></span>${h}" high</span>`).join('') + '<span><span class="sw" style="background:#d9cbb3"></span>worksurface · C cantilever · EP end panel · SB side bracket · <span class="sw" style="background:#5d5d60;height:5px"></span>tie plate at a seam</span><span>· grey square = shared 3" junction post · dashed = stacked · ⊕ = click to add a panel, drag to turn a corner · right-click for more</span>'; }

  // ---------- elevation ----------
  const elev = $('#elev'), ectx = elev.getContext('2d');
  const FILL = { 'tackable acoustical': '#c9d5e6', 'performance tackable acoustical': '#bccbe0', steel: '#b9bdc4', laminate: '#d9cbb3', wood: '#c8a27a', markerboard: '#ffffff', slatwall: '#c2c6cc', technology: '#a9b4c6', window: '#d6ecff' };
  const postH = (nid) => { const J = R && R.nodes[nid]; return J && J.legs && J.legs.length ? Math.max(...J.legs.map(l => l.total)) : 0; }; // junction post height: its tallest panel
  function chainOf(pid) { // in-line chain through pid, ordered
    const p = P.panels[pid]; if (!p) return [];
    const walk = (nid, from) => { const out = []; let cur = from, node = nid; while (true) { const J = R.nodes[node]; if (!J || J.type !== 'inline') break; const nx = J.legs.find(l => l.panel.id !== cur.id); if (!nx) break; out.push(nx.panel); cur = nx.panel; node = nx.farNode; if (out.length > 40) break; } return out; };
    return [...walk(p.a, p).reverse(), p, ...walk(p.b, p)];
  }
  // Elevation of an in-line run. `side` is the viewer side relative to the chain direction (chain[0] -> last).
  // Panels drawn from the other direction are flipped so the correct physical face shows. opts.hits collects hit regions.
  function renderElevation(c, chain, side, w, h, opts) {
    const cx = c.getContext('2d'); cx.clearRect(0, 0, w, h); if (!chain.length) return; opts = opts || {}; const hits = opts.hits;
    const run = E.runOf(P, chain[0].id); const rev = chain.length > 1 && run.panels[0].id !== chain[0].id;
    const entries = (rev ? run.panels.slice().reverse() : run.panels).filter(r => chain.some(p => p.id === r.id)); // chain order
    const faceOf = (r) => (r.flip === rev) ? side : 1 - side; // physical side index of this panel that faces the viewer
    const seq = side === 0 ? entries : entries.slice().reverse();
    // junctions in viewing order, left to right: every panel's far node follows its near node
    const farOf = (r) => ((side === 0) === (r.flip === rev)) ? r.panel.b : r.panel.a, nearOf = (r) => ((side === 0) === (r.flip === rev)) ? r.panel.a : r.panel.b;
    const nodes = [nearOf(seq[0]), ...seq.map(farOf)];
    const Jof = (nid) => R && R.nodes[nid] && R.nodes[nid].legs && R.nodes[nid].legs.length ? R.nodes[nid] : null;
    const typeOf = (nid) => { const J = Jof(nid); return J ? J.type : 'L'; }, straightJ = (nid) => ['inline', 'EOR', 'wall'].includes(typeOf(nid));
    const reach = (nid) => E.junctionReach(P.trim, typeOf(nid));
    const capF = E.CAP_FACE[P.trim] || 0.625, fp = E.FOOTPRINT[P.trim];
    const topOf = (p) => E.actualTop(P.trim, P.panels[p.id] || p); // actual floor-to-top-of-cap height (p11, p74; stackers p26)
    const legTops = (nid) => { const J = Jof(nid); return J ? J.legs.map(l => topOf(l.panel)) : []; };
    const jTop = (nid) => { const t = legTops(nid); return t.length ? Math.max(...t) : 0; };
    // overall length by the footprint rules: nominal widths, plus end-of-run trim (1/2" thin, 1" oval, p14, p76) or wall start (3/16", p15) at each end; at a
    // corner end the corner allowance to the node (1 1/2" at L, T, X, E.CORNER_ALLOW, p15, p24) and the junction block beyond it (1 1/2", the other leg's
    // outer face), or the far panel's post when a panel continues straight on through a T or X
    const through = (nid) => { const J = Jof(nid); if (!J) return false; const mine = J.legs.filter(l => chain.some(p => p.id === l.panel.id)); return mine.some(m => J.legs.some(l => l !== m && Math.abs((((l.angle - m.angle) % 360) + 360) % 360 - 180) < 1)); };
    const outOf = (nid) => straightJ(nid) ? reach(nid).out : through(nid) ? reach(nid).in : reach(nid).out;
    const spanOf = (p) => E.panelSpan(P, P.panels[p.id] || p), caOf = (nid) => straightJ(nid) ? 0 : reach(nid).ca;
    const sumW = sum(chain.map(p => p.width)), outL = outOf(nodes[0]), outR = outOf(nodes[nodes.length - 1]), totalW = sum(chain.map(spanOf)) + outL + outR;
    const glassH = (p) => p.glassScreen && P.trim === 'thin' ? E.glassHeight(p.glassScreen) : 0;
    const maxH = Math.max(...chain.map(p => topOf(p) + glassH(p) + (p.topScreen ? E.TOP_SCREEN.height : 0)), ...nodes.map(jTop));
    const pad = 30; const s = opts.fixedScale || Math.min((w - 2 * pad) / totalW, (h - pad - 52) / maxH); const y0 = h - 46; const padL = pad + Math.max(0, (w - 2 * pad - totalW * s) / 2);
    const X0 = padL + outL * s; const nodeX = [X0]; for (const r of seq) nodeX.push(nodeX[nodeX.length - 1] + spanOf(r.panel) * s); // node to node: width + corner allowances
    const hit = (o) => { if (hits) hits.push(o); };
    cx.font = '11px Barlow, sans-serif';
    const selTile = opts.selTile; // {pid, key, i}
    const postX = [];
    const drawPost = (i) => { // junction at nodes[i]: corner posts exposed and 3" wide; straight junctions under the skins (slotted channel, change-of-height trim, finished end)
      const nid = nodes[i], xn = nodeX[i], J = Jof(nid), t = typeOf(nid), Rj = reach(nid); const tops = legTops(nid); const top = tops.length ? Math.max(...tops) : 0, low = tops.length ? Math.min(...tops) : 0;
      const dirOut = i === 0 ? -1 : 1; // outward direction at a run end
      // post extents on screen: in-line and corner posts are symmetric; an end-of-run post lies inward of its node (to the right at the left end)
      let x0 = t === 'EOR' ? (dirOut < 0 ? xn : xn - E.EOR_POST * s) : xn + Rj.post[0] * s, x1 = t === 'EOR' ? (dirOut < 0 ? xn + E.EOR_POST * s : xn) : xn + Rj.post[1] * s;
      if (!straightJ(nid)) { const inw = Rj.in * s, away = outOf(nid) * s; x0 = dirOut < 0 ? xn - away : xn - inw; x1 = dirOut < 0 ? xn + inw : xn + away; } // corner: block + posts, to the corner face on the panel's side
      if (t === 'inline') {
        cx.strokeStyle = '#424244'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(xn, y0); cx.lineTo(xn, y0 - (low - capF) * s); cx.stroke();
        if (top > low + 0.01) { // change-of-height trim over the lower panel, its top level with the taller top cap (p18); oval 1 1/8" slim / 2 1/4" cable routing (p80)
          const wT = E.cohTrimWidth(P) * s, leftTall = topOf(seq[i - 1].panel) > low + 0.01; const lx = leftTall ? xn : xn - wT;
          cx.fillStyle = '#5d5d60'; cx.fillRect(lx, y0 - top * s, wT, (top - low) * s); x0 = Math.min(x0, lx); x1 = Math.max(x1, lx + wT); }
      } else if (t === 'EOR') { // the post is under the skins, inside the nominal width; the trim covers its end, top at the cap underside (p14, p30, p76)
        const et = fp.eor * s, tx = dirOut < 0 ? xn - et : xn; cx.fillStyle = '#5d5d60'; cx.fillRect(tx, y0 - (top - capF) * s, et, (top - capF) * s); x0 = Math.min(x0, tx); x1 = Math.max(x1, tx + et);
      } else if (t === 'wall') { // wall-start junction face 3/16" beyond the node (p15)
        const wf = fp.wall * s; if (wf) { const tx = dirOut < 0 ? xn - wf : xn; cx.fillStyle = '#424244'; cx.fillRect(tx, y0 - (top - capF) * s, wf, (top - capF) * s); }
        x0 = dirOut < 0 ? xn - wf : xn - E.EOR_POST * s; x1 = dirOut < 0 ? xn + E.EOR_POST * s : xn + wf;
      } else { // corner: the junction block and posts (p14, p15), full height to its junction cap level with the tallest top cap
        const ht = top || jTop(nid); cx.fillStyle = '#e7e7ea'; cx.fillRect(x0, y0 - ht * s, x1 - x0, ht * s); cx.strokeStyle = '#7a7a7d'; cx.lineWidth = 1; cx.strokeRect(x0, y0 - ht * s, x1 - x0, ht * s); }
      postX.push([x0, x1]); hit({ kind: 'post', nid, x: x0 - 2, y: y0 - top * s, w: x1 - x0 + 4, h: top * s });
      if (J && opts.junctionLabels) { cx.fillStyle = '#416180'; cx.font = '600 10px Barlow, sans-serif'; cx.textAlign = 'center'; cx.fillText(jn(nid).replace('Junction ', 'J'), xn, y0 - top * s - 6); cx.font = '11px Barlow, sans-serif'; }
    };
    seq.forEach((r, i) => {
      const p = r.panel; const face = faceOf(r); const segs = p.sides[face]; const nl = nodes[i], nr = nodes[i + 1], xl = nodeX[i], xr = nodeX[i + 1];
      // skins run over straight junctions to the node (in-line center p16, end-of-run and wall-start posts are inside the nominal width); at a corner they stop at
      // the corner face, the corner allowance + 3/4" post from the node (E.CORNER_ALLOW), and the junction stays exposed
      const x = xl + (straightJ(nl) ? 0 : reach(nl).in * s), pw = xr - (straightJ(nr) ? 0 : reach(nr).in * s) - x;
      let y = y0;
      if (p.openBase) { // open base trim: bottom 3 1/4", opening 2 1/2" (p51, p89)
        const ob = E.OPEN_BASE; cx.fillStyle = '#8a8a8d'; cx.fillRect(x, y - ob.height * s, pw, (ob.height - ob.opening) * s); cx.save(); cx.setLineDash([3, 3]); cx.strokeStyle = '#8a8a8d'; cx.lineWidth = 1; cx.strokeRect(x, y - ob.opening * s, pw, ob.opening * s); cx.restore(); }
      else if (!p.skinsToFloor) { cx.fillStyle = '#8a8a8d'; cx.fillRect(x, y - E.BASE_TRIM_H * s, pw, E.BASE_TRIM_H * s); }
      if (!p.openBase) hit({ kind: 'base', pid: p.id, x, y: y - E.BASE_TRIM_H * s, w: pw, h: E.BASE_TRIM_H * s });
      y -= E.BASE_TRIM_H * s;
      const drawSegs = (list, yb, key, ext, k) => { let yy = yb; list.forEach((sg, i) => { const t = sg.kind === 'window' ? 'window' : sg.type; const hh = sg.height * s * (k || 1); const e0 = i === 0 && ext ? ext * s : 0; cx.fillStyle = FILL[t] || '#ccc'; cx.fillRect(x, yy - hh, pw, hh + e0); const on = selTile && selTile.pid === p.id && selTile.key === key && selTile.i === i; cx.strokeStyle = on ? '#5980a6' : '#7a7a7d'; cx.lineWidth = on ? 2.5 : .8; cx.strokeRect(x, yy - hh, pw, hh + e0); if (hh > 12) { cx.fillStyle = '#1d1f20'; cx.textAlign = 'center'; cx.fillText(fitText(cx, [`${sg.height}" ${t}`, `${sg.height}" ${t.split(' ')[0]}`, `${sg.height}"`], pw - 4), x + pw / 2, yy - hh / 2 + 4); } hit({ kind: 'tile', pid: p.id, face, key, i, x, y: yy - hh, w: pw, h: hh + e0 }); yy -= hh; }); return yy; };
      // base skins fill from the base trim to the underside of the cap at the actual panel height (p11, p13, p50); nominal sizes total panel height - 6"
      const Ha = E.actualBaseHeight(P.trim, p.height);
      drawSegs(segs, y, 's' + face, p.skinsToFloor ? E.BASE_TRIM_H : 0, (Ha - E.BASE_TRIM_H - capF) / (p.height - E.SKIN_TRIM_ALLOWANCE));
      // stacker skins sit on the base skins, each stacker adding its stacking junction's actual height (p26); the base panel's top cap moves up to trim the stack
      const capH = capF * s; let yb = y0 - (Ha - capF) * s; p.stack.forEach((st, k) => { const sa = E.STACK_ACTUAL[st] || st; drawSegs(p.stackSides[k] ? p.stackSides[k][face] : [], yb, 'k' + k + face, 0, sa / st); yb -= sa * s; });
      if (!p.topCap.omit) { cx.fillStyle = p.topCap.wood ? '#a8794e' : '#5d5d60'; if (P.trim === 'oval') { const rr = Math.min(capH, 6); cx.beginPath(); cx.moveTo(x, yb); cx.lineTo(x, yb - capH + rr); cx.quadraticCurveTo(x, yb - capH, x + rr, yb - capH); cx.lineTo(x + pw - rr, yb - capH); cx.quadraticCurveTo(x + pw, yb - capH, x + pw, yb - capH + rr); cx.lineTo(x + pw, yb); cx.closePath(); cx.fill(); } else cx.fillRect(x, yb - capH, pw, Math.max(1.5, capH)); } else { cx.save(); cx.setLineDash([3, 3]); cx.strokeStyle = '#98989b'; cx.lineWidth = 1; cx.strokeRect(x, yb - capH, pw, capH); cx.restore(); }
      hit({ kind: 'topcap', pid: p.id, x, y: yb - capH - 3, w: pw, h: capH + 3 }); yb -= capH;
      // frameless glass (thin): actual glass height above the cap (p56 9 5/16", 15 1/2", 21 5/8"; clip 11 3/4" p60); each end stops half the screen-to-screen gap
      // short of the junction center, or 1/2" (recessed) / 5/8" (clip) at an in-line change of height (p56, p57, p60)
      if (p.glassScreen && P.trim === 'thin') {
        const G = p.glassScreen.attach === 'clip' ? E.GLASS.clip : E.GLASS.recessed, gh = E.glassHeight(p.glassScreen) * s;
        const coh = (nid) => typeOf(nid) === 'inline' && new Set(legTops(nid).map(v => v.toFixed(3))).size > 1;
        const gx = xl + (caOf(nl) + (coh(nl) ? G.cohEnd : G.end)) * s, gw = xr - (caOf(nr) + (coh(nr) ? G.cohEnd : G.end)) * s - gx; // from the module lines
        cx.fillStyle = p.glassScreen.frosted ? 'rgba(200,225,245,.8)' : 'rgba(180,215,245,.5)'; cx.fillRect(gx, yb - gh, gw, gh); cx.strokeStyle = '#5980a6'; cx.lineWidth = 1; cx.strokeRect(gx, yb - gh, gw, gh); hit({ kind: 'glass', pid: p.id, x: gx, y: yb - gh, w: gw, h: gh });
      }
      if (p.topScreen && P.trim === 'oval') { const T = E.TOP_SCREEN, sx = xl + (caOf(nl) + T.inset) * s, sw = xr - (caOf(nr) + T.inset) * s - sx; cx.fillStyle = 'rgba(230,230,230,.8)'; cx.fillRect(sx, yb - T.height * s, sw, T.height * s); cx.strokeStyle = '#98989b'; cx.strokeRect(sx, yb - T.height * s, sw, T.height * s); hit({ kind: 'glass', pid: p.id, x: sx, y: yb - T.height * s, w: sw, h: T.height * s }); } // 12"H, 1 1/4" in from each end (p96, p97)
      // labels
      cx.fillStyle = sel.has(p.id) && opts.highlightSel ? '#416180' : '#5d5d60'; cx.font = sel.has(p.id) && opts.highlightSel ? '600 11px Barlow, sans-serif' : '11px Barlow, sans-serif'; cx.textAlign = 'center'; cx.fillText(fitText(cx, [`${pn(p.id)} · ${p.width}"W × ${E.panelTotalHeight(p)}"H · face ${face === 0 ? 'A' : 'B'}`, `P${p.id.slice(1)} · ${p.width}×${E.panelTotalHeight(p)} · ${face === 0 ? 'A' : 'B'}`, `P${p.id.slice(1)} · ${face === 0 ? 'A' : 'B'}`, `P${p.id.slice(1)}`], xr - xl - 4), (xl + xr) / 2, y0 + 14); cx.font = '11px Barlow, sans-serif';
      hit({ kind: 'label', pid: p.id, x: xl, y: y0 + 2, w: xr - xl, h: 16 });
    });
    nodes.forEach((nid, i) => drawPost(i));
    // worksurfaces and pedestals on this side of the run (seated height 28 1/2", p272; 1 3/16" thick, p206)
    {
      const runLen = run.length;
      const tC = (t) => rev ? runLen - t : t; const sideC = (sd) => rev ? 1 - sd : sd;
      const X = (t) => side === 0 ? X0 + tC(t) * s : X0 + (runLen - tC(t)) * s;
      const PI = E.PED_INSET;
      for (const ws of Object.values(P.worksurfaces || {})) {
        let from, to, sd, peds = [];
        if (ws.kind === 'straight') { const sp = E.wsSpanInRun(P, ws, run); if (!sp) continue; from = sp.from; to = sp.to; sd = sp.side; const flip = run.panels.find(r => r.id === ws.panel).flip; peds = (ws.peds || []).map(d => { const atFrom = (d.at === 'lo') !== flip; return { d, a: atFrom ? from + PI : to - PI - E.PED_W, b: atFrom ? from + PI + E.PED_W : to - PI }; }); }
        else { const g = E.wsGeometry(P, ws); if (!g) continue; const ai = g.arms.findIndex(a => run.panels.some(r => r.id === a.panel.id)); if (ai < 0) continue; const arm = g.arms[ai], other = g.arms[1 - ai]; const t0 = E.runOffset(run, g.o[0], g.o[1]), t1 = E.runOffset(run, arm.end[0], arm.end[1]); from = Math.min(t0, t1); to = Math.max(t0, t1); const cross = run.dir[0] * other.dir[1] - run.dir[1] * other.dir[0]; sd = cross < 0 ? 0 : 1; peds = (ws.peds || []).filter(d => d.at === 'arm' + ai).map(d => ({ d, a: t1 > t0 ? to - PI - E.PED_W : from + PI, b: t1 > t0 ? to - PI : from + PI + E.PED_W })); }
        if (sideC(sd) !== side) continue;
        const xa = Math.min(X(from), X(to)), xb = Math.max(X(from), X(to)); const yt = y0 - E.WS_HEIGHT * s; const th = Math.max(2, E.WS_THICK * s);
        cx.fillStyle = 'rgba(217,203,179,.9)'; cx.fillRect(xa, yt, xb - xa, th); cx.strokeStyle = selWs === ws.id ? '#5980a6' : WSLINE; cx.lineWidth = selWs === ws.id ? 2.5 : 1; cx.strokeRect(xa, yt, xb - xa, th); hit({ kind: 'ws', id: ws.id, x: xa, y: yt - 3, w: xb - xa, h: th + 6 });
        for (const { d, a, b } of peds) { const x1 = Math.min(X(a), X(b)), x2 = Math.max(X(a), X(b)); const hh = (d.type === 'mobile' && d.config === 'C' ? 21 : 27) * s; cx.fillStyle = '#dcd5c8'; cx.fillRect(x1, y0 - hh, x2 - x1, hh); cx.strokeStyle = selPed === d.id ? '#5980a6' : '#6f6455'; cx.lineWidth = selPed === d.id ? 2.5 : 1; cx.strokeRect(x1, y0 - hh, x2 - x1, hh); if (hh > 14) { cx.fillStyle = '#4a3f30'; cx.fillText(PEDCFG[d.config] || '', (x1 + x2) / 2, y0 - hh / 2 + 4); } hit({ kind: 'ped', ws: ws.id, id: d.id, x: x1, y: y0 - hh, w: x2 - x1, h: hh }); }
        { // label in the widest stretch of the worksurface clear of posts and pedestals
          const cuts = [...postX, ...peds.map(({ a, b }) => [Math.min(X(a), X(b)), Math.max(X(a), X(b))])].filter(([u, v]) => v > xa && u < xb).sort((m, n) => m[0] - n[0]);
          let best = [xa, xa], at = xa; for (const [u, v] of cuts) { if (u - at > best[1] - best[0]) best = [at, u]; at = Math.max(at, v); } if (xb - at > best[1] - best[0]) best = [at, xb];
          cx.fillStyle = '#4a3f30'; cx.textAlign = 'center'; const nm = ws.kind === 'straight' ? [`${ws.width}" × ${ws.depth}"D worksurface`, `${ws.width}" × ${ws.depth}"D`, `${ws.width}×${ws.depth}`] : [`${ws.C}×${ws.D} ${ws.kind === 'corner120' ? '120° ' : ''}corner worksurface`, `${ws.C}×${ws.D} ${ws.kind === 'corner120' ? '120°' : 'corner'}`, `${ws.C}×${ws.D}`];
          cx.fillText(fitText(cx, nm, best[1] - best[0] - 4), (best[0] + best[1]) / 2, yt + th + 11);
        }
      }
    }
    // dimension line: overall length by the footprint rules (p14, p15, p76)
    const endNote = (nid) => { const t = typeOf(nid); return t === 'EOR' ? 'end trim' : t === 'wall' ? 'wall start' : t === 'inline' ? '' : 'corner junction'; };
    const notes = [...new Set([endNote(nodes[0]), endNote(nodes[nodes.length - 1])].filter(Boolean))];
    cx.strokeStyle = '#98989b'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(padL, y0 + 26); cx.lineTo(padL + totalW * s, y0 + 26); cx.stroke(); cx.fillStyle = '#5d5d60'; cx.textAlign = 'center';
    const lbl = `${E.ftin(sumW)} nominal · ${E.ftin(totalW)} overall${notes.length ? ' incl. ' + notes.join(' and ') : ''}`; cx.fillText(lbl, padL + totalW * s / 2, y0 + 40);
    if (opts.info) Object.assign(opts.info, { label: lbl, totalW, sumW, s, X0, nodeX, y0 });
  }
  let elevHits = [], elevLock = null, selTile = null, elevInfo = {};
  function drawElev() {
    const w = elev.clientWidth, h = elev.clientHeight; if (!w) return;
    let pid = [...sel][0] || (selWs && E.hostPanelOf(P, selWs));
    // a junction selected (on the plan or by clicking its post here): keep showing the run it belongs to, else a run through it
    if (!pid && selNode && P.nodes[selNode]) { const atNode = (q) => q.a === selNode || q.b === selNode; pid = (elevLock && P.panels[elevLock] && chainOf(elevLock).some(atNode)) ? elevLock : (Object.values(P.panels).find(atNode) || {}).id; }
    if (elevLock && P.panels[elevLock] && pid && chainOf(elevLock).some(p => p.id === pid)) pid = elevLock; // keep the run steady while editing inside it
    if (!pid || !P.panels[pid]) { ectx.clearRect(0, 0, w, h); elevHits = []; elevLock = null; $('#elevInfo').textContent = 'Select a panel to see its run.'; return; }
    elevLock = pid;
    const chain = chainOf(pid); $('#elevInfo').textContent = `${chain.length} panel run · ${E.ftin(sum(chain.map(p => p.width)))} · side ${elevSide === 0 ? 'A' : 'B'} · click a tile to edit it, right-click for options`;
    const totalW = sum(chain.map(p => E.panelSpan(P, p))) + E.CORNER_POST; const maxH = Math.max(...chain.map(p => E.panelTotalHeight(p) + (p.glassScreen ? 18 : 0) + (p.topScreen ? 12 : 0)), ...chain.flatMap(p => [p.a, p.b]).map(n => postH(n) + 4));
    const wrapW = elev.parentElement.clientWidth - 2; const MIN_S = 2.2; // never below 2.2 px per inch: 12" tiles stay readable, long runs scroll sideways
    let es = Math.max(MIN_S, (wrapW - 60) / totalW); const cw = Math.max(wrapW, Math.round(totalW * es + 60)); const ch = Math.min(560, Math.max(240, Math.round(maxH * es + 100))); es = Math.min(es, (ch - 100) / maxH);
    const d = window.devicePixelRatio || 1; elev.style.width = cw + 'px'; elev.style.height = ch + 'px'; elev.width = Math.round(cw * d); elev.height = Math.round(ch * d); ectx.setTransform(d, 0, 0, d, 0, 0);
    elevHits = []; elevInfo = {}; renderElevation(elev, chain, elevSide, cw, ch, { junctionLabels: true, hits: elevHits, selTile, highlightSel: true, fixedScale: es, info: elevInfo });
    // halo around the selected part in the elevation too
    const pick = elevHits.filter(o => o.kind !== 'label' && ((selNode && o.kind === 'post' && o.nid === selNode) || (selPed && o.kind === 'ped' && o.id === selPed) || (!selPed && selWs && o.kind === 'ws' && o.id === selWs) || (!selNode && !selWs && o.pid && sel.has(o.pid) && ['tile', 'base', 'topcap', 'glass'].includes(o.kind))));
    const byPid = {}; for (const o of pick) { const k = o.pid || o.nid || o.id; const b = byPid[k] || (byPid[k] = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }); b.x0 = Math.min(b.x0, o.x); b.y0 = Math.min(b.y0, o.y); b.x1 = Math.max(b.x1, o.x + o.w); b.y1 = Math.max(b.y1, o.y + o.h); }
    ectx.save(); for (const b of Object.values(byPid)) { ectx.strokeStyle = 'rgba(89,128,166,.35)'; ectx.lineWidth = 8; ectx.strokeRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4); ectx.strokeStyle = '#2f6db3'; ectx.lineWidth = 2; ectx.strokeRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4); } ectx.restore();
  }
  $$('#elevSide button').forEach(b => b.onclick = () => { elevSide = +b.dataset.side; $$('#elevSide button').forEach(x => x.classList.toggle('on', x === b)); drawElev(); });
  const ELEV_ORDER = { ped: 0, ws: 1, tile: 2, glass: 2, topcap: 3, base: 3, post: 4, label: 5 };
  function elevHit(sx, sy) { const c = elevHits.filter(o => sx >= o.x && sx <= o.x + o.w && sy >= o.y && sy <= o.y + o.h); c.sort((a, b) => ELEV_ORDER[a.kind] - ELEV_ORDER[b.kind]); return c[0] || null; }
  function elevPos(e) { const r = elev.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function selectFromElev(h) {
    if (!h) return; selTile = null;
    if (h.kind === 'post') { selNode = h.nid; sel = new Set(); selWs = null; selPed = null; }
    else if (h.kind === 'ws' || h.kind === 'ped') { selWs = h.kind === 'ws' ? h.id : h.ws; selPed = h.kind === 'ped' ? h.id : null; sel = new Set(); selNode = null; }
    else { sel = new Set([h.pid]); selNode = null; selWs = null; selPed = null; if (h.kind === 'tile') selTile = { pid: h.pid, key: h.key, i: h.i }; }
    const keepY = window.scrollY; refresh(); window.scrollTo(window.scrollX, keepY); // the page stays where it is
    // centre the plan on the part and pulse its highlight
    let pt = null;
    if (h.kind === 'post' && P.nodes[h.nid]) pt = [P.nodes[h.nid].x, P.nodes[h.nid].y];
    else if ((h.kind === 'ws' || h.kind === 'ped') && P.worksurfaces[selWs]) { const ws = P.worksurfaces[selWs], g = E.wsGeometry(P, ws); const d = selPed && ws.peds.find(x => x.id === selPed); const q = g ? (d ? pedRect(ws, g, d) : g.poly) : null; if (q) pt = [q.reduce((a, v) => a + v[0], 0) / q.length, q.reduce((a, v) => a + v[1], 0) / q.length]; }
    else if (h.pid && P.panels[h.pid]) { const p = P.panels[h.pid], a = P.nodes[p.a], b = P.nodes[p.b]; pt = [(a.x + b.x) / 2, (a.y + b.y) / 2]; }
    pulseUntil = performance.now() + 1200; if (pt) centerPlanOn(pt[0], pt[1]); else drawPlan();
    // point at the matching editor row without scrolling the page
    const row = h.kind === 'tile' ? $(`#rightcol .tile[data-key="${h.key}"][data-i="${h.i}"]`) : h.kind === 'glass' ? ($('#pGlass') || $('#pTopScreen')) : null;
    if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1400); }
    requestAnimationFrame(() => window.scrollTo(window.scrollX, keepY));
  }
  elev.addEventListener('mousedown', e => { if (e.button !== 0) return; const [sx, sy] = elevPos(e); const h = elevHit(sx, sy); if (h) selectFromElev(h); });
  elev.addEventListener('mousemove', e => { const [sx, sy] = elevPos(e); const h = elevHit(sx, sy); elev.style.cursor = h ? 'pointer' : 'default'; elev.title = h ? (h.kind === 'tile' ? 'Click to edit this tile, right-click for options' : h.kind === 'post' ? 'Junction' : '') : ''; });
  function elevTileItems(h) {
    const p = P.panels[h.pid]; const segsOf = (key) => key === 's0' ? p.sides[0] : key === 's1' ? p.sides[1] : p.stackSides[+key[1]][+key[2]]; const targetOf = (key) => key[0] === 's' ? p.height - 6 : p.stack[+key[1]];
    const segs = segsOf(h.key), sg = segs[h.i], t = tileType(sg); const target = targetOf(h.key);
    const edit = (fn, mirror) => mutate(() => { fn(); E.normalizeSegs(segs, target, P.finishes.skinType); if (mirror) mirrorWindows(p, h.key); });
    const chain = chainOf(p.id);
    const items = [{ head: `${pn(p.id)} · face ${h.face === 0 ? 'A' : 'B'} · ${sg.height}" ${TILE_LABEL[t] || t}` },
      { label: 'Material', children: [...SKIN_TYPES.map(x => ({ label: SKIN_LABEL[x] + (t === x ? '  ✓' : ''), run: () => edit(() => { sg.kind = 'skin'; sg.type = x; delete sg.pane; delete sg.frosted; }, true) })), { label: 'Glass window' + (t === 'window' ? '  ✓' : ''), run: () => edit(() => { sg.kind = 'window'; delete sg.type; sg.pane = 'single'; }, true) }] },
      { label: 'Height', children: E.skinHeightsFor(sg).map(hh => ({ label: `${hh}"${hh === sg.height ? '  ✓' : ''}`, run: () => edit(() => sg.height = hh, true) })) }];
    if (t === 'tackable acoustical' || t === 'performance tackable acoustical') items.push({ label: 'Fabric', children: [{ label: `Job fabric (${P.finishes.fabric.code} ${P.finishes.fabric.name})${!sg.fabric ? '  ✓' : ''}`, run: () => edit(() => delete sg.fabric) }, ...[...new Set(Object.values(P.panels).flatMap(q => [...q.sides.flat(), ...q.stackSides.flat(2)]).filter(x => x.fabric).map(x => x.fabric.code))].slice(0, 8).map(code => { const fb = E.fabrics().find(x => x.code === code); return { label: `${code} ${fb ? fb.name : ''}${sg.fabric && sg.fabric.code === code ? '  ✓' : ''}`, run: () => edit(() => sg.fabric = { code: fb.code, name: (fb.collection ? fb.collection + ' ' : '') + fb.name, group: fb.group }) }; }), { label: 'Choose another in the panel editor…', run: () => selectFromElev(h) }] });
    if (t === 'steel') items.push({ label: 'Steel finish', children: [['', 'Smooth'], ['perforated', 'Perforated'], ['ribbed', 'Ribbed']].map(([v, l]) => ({ label: l + ((sg.finish || '') === v ? '  ✓' : ''), run: () => edit(() => sg.finish = v || undefined) })) });
    if (t === 'window') items.push({ label: 'Glazing', children: [['single', 'Clear'], ['frosted', 'Frosted'], ['double', 'Double-pane frosted']].map(([v, l]) => ({ label: l + ((sg.pane === 'double' ? 'double' : sg.frosted ? 'frosted' : 'single') === v ? '  ✓' : ''), run: () => edit(() => { sg.pane = v === 'double' ? 'double' : 'single'; sg.frosted = v === 'frosted'; }, true) })) });
    if (t === 'technology') items.push({ label: 'Cutouts', children: ['All', 'Right', 'Left'].map(v => ({ label: v + ((sg.cutouts || 'All') === v ? '  ✓' : ''), run: () => edit(() => sg.cutouts = v) })) });
    items.push('-',
      { label: 'Split this tile', run: () => { const copy = JSON.parse(JSON.stringify(segs)); const hs = E.skinHeightsFor(sg).filter(x => x < sg.height); const a = hs.find(x => E.skinHeightsFor(sg).includes(sg.height - x) && E.SKIN_HEIGHTS_BY_TYPE[P.finishes.skinType].includes(x)); if (!a) { toast('This tile is already at its smallest height.'); return; } edit(() => { const rest = sg.height - a; sg.height = rest; segs.splice(h.i + 1, 0, { kind: 'skin', type: P.finishes.skinType, height: a }); }, true); } },
      { label: 'Remove this tile (height goes to the tile below)', dis: segs.length < 2, run: () => edit(() => { const hh = segs[h.i].height; segs.splice(h.i, 1); const nb = segs[Math.max(0, h.i - 1)]; if (E.skinHeightsFor(nb).includes(nb.height + hh)) nb.height += hh; }, true) },
      '-',
      { label: 'Copy this face to the other face', run: () => mutate(() => { const other = h.key[0] === 's' ? 's' + (1 - h.face) : 'k' + h.key[1] + (1 - h.face); const dst = segsOf(other); dst.length = 0; dst.push(...JSON.parse(JSON.stringify(segs))); E.normalizeSegs(dst, target, P.finishes.skinType); }) },
      { label: `Same tiles on this face of every panel in the run (${chain.length} panels)`, dis: chain.length < 2 || h.key[0] !== 's', run: () => mutate(() => { const run = E.runOf(P, p.id); const flipOf = (id) => { const e = run && run.panels.find(x => x.id === id); return e ? e.flip : null; }; const fp = flipOf(p.id); for (const q of chain) { if (q.id === p.id) continue; const fq = flipOf(q.id); if (fq === null) continue; const face = fq === fp ? h.face : 1 - h.face; const qs = q.sides[face]; qs.length = 0; qs.push(...JSON.parse(JSON.stringify(segs))); E.normalizeSegs(qs, q.height - 6, P.finishes.skinType); mirrorWindows(q, 's' + face); } }) },
      '-', { label: 'Open in the panel editor', run: () => selectFromElev(h) });
    return items;
  }
  elev.addEventListener('contextmenu', e => {
    e.preventDefault(); const [sx, sy] = elevPos(e); const h = elevHit(sx, sy); if (!h) return;
    const p = h.pid && P.panels[h.pid];
    if (h.kind === 'tile') { showMenu(e.clientX, e.clientY, elevTileItems(h)); return; }
    if (h.kind === 'post') { const n = P.nodes[h.nid]; if (!P.nodes[h.nid]) return; showMenu(e.clientX, e.clientY, contextItems({ kind: 'node', id: h.nid }, n.x, n.y)); return; }
    if (h.kind === 'ws' || h.kind === 'ped') { showMenu(e.clientX, e.clientY, contextItems(h, 0, 0)); return; }
    if (h.kind === 'glass') { const items = [{ head: `${pn(p.id)} · ${P.trim === 'thin' ? 'frameless glass screen' : 'top screen'}` }]; if (P.trim === 'thin' && p.glassScreen) { items.push({ label: 'Height', children: [6, 12, 18].map(hh => ({ label: `${hh}"${p.glassScreen.height === hh ? '  ✓' : ''}`, dis: p.glassScreen.attach === 'clip', run: () => mutate(() => p.glassScreen.height = hh) })) }, { label: p.glassScreen.frosted ? 'Clear glass' : 'Frosted glass', run: () => mutate(() => p.glassScreen.frosted = !p.glassScreen.frosted) }, { label: p.glassScreen.attach === 'clip' ? 'Recessed attachment' : 'Clip-on attachment (12")', run: () => mutate(() => p.glassScreen.attach = p.glassScreen.attach === 'clip' ? 'recessed' : 'clip') }, '-', { label: 'Remove glass screen', run: () => mutate(() => p.glassScreen = null) }); } else items.push({ label: 'Remove top screen', run: () => mutate(() => p.topScreen = false) }); showMenu(e.clientX, e.clientY, items); return; }
    if (h.kind === 'topcap') { showMenu(e.clientX, e.clientY, [{ head: `${pn(p.id)} · top cap` }, { label: 'Painted' + (!p.topCap.wood && !p.topCap.omit ? '  ✓' : ''), run: () => mutate(() => { p.topCap.wood = false; p.topCap.omit = false; }) }, { label: 'Wood' + (p.topCap.wood ? '  ✓' : ''), run: () => mutate(() => { p.topCap.wood = true; p.topCap.omit = false; }) }, { label: 'Omit (thin trim)' + (p.topCap.omit ? '  ✓' : ''), dis: P.trim !== 'thin', run: () => mutate(() => { p.topCap.omit = true; p.topCap.wood = false; }) }, '-', ...(P.trim === 'thin' ? [{ label: p.glassScreen ? 'Remove glass screen' : 'Add 12" frameless glass screen', dis: p.width < 24, run: () => mutate(() => p.glassScreen = p.glassScreen ? null : { attach: 'recessed', height: 12, frosted: false, omitGlass: false }) }] : []), { label: 'Stack on top', children: [{ label: 'None' + (!p.stack.length ? '  ✓' : ''), run: () => mutate(() => E.setStack(P, p, [])) }, ...E.stackOptions(p.height).filter(st => st.length).map(st => ({ label: st.join('" + ') + '"' + (JSON.stringify(st) === JSON.stringify(p.stack) ? '  ✓' : ''), run: () => mutate(() => E.setStack(P, p, st)) }))] }]); return; }
    if (h.kind === 'base') { showMenu(e.clientX, e.clientY, [{ head: `${pn(p.id)} · base` }, { label: (p.openBase ? '✓ ' : '') + 'Open base (no base trim, no power in the base)', run: () => mutate(() => p.openBase = !p.openBase) }, { label: (p.skinsToFloor ? '✓ ' : '') + 'Skins run to the floor', run: () => mutate(() => p.skinsToFloor = !p.skinsToFloor) }, { label: (p.baseCableTray ? '✓ ' : '') + 'Base cable tray', run: () => mutate(() => p.baseCableTray = !p.baseCableTray) }, '-', { label: 'Power', children: powerItems(p) }]); return; }
    if (h.kind === 'label') { const a = P.nodes[p.a], b = P.nodes[p.b]; const [nx, ny] = E.sideNormal(P, p, elevSide); showMenu(e.clientX, e.clientY, contextItems({ kind: 'panel', id: p.id }, (a.x + b.x) / 2 + nx * 10, (a.y + b.y) / 2 + ny * 10)); }
  });

  // ---------- part cards (selected panel or job summary) ----------
  const CATDESC = { Junction: 'Vertical junction shared by the panels that meet here', Stacking: 'Stacking junction added on top of the base junction', Trim: 'Vertical or change-of-height trim', Panel: 'Frame package or panel package (bars, top cap, base trims)', Frame: 'Horizontal bar for a stacked tier', Skins: 'Skin for one face of the panel', Glass: 'Glass screen or window', Power: 'Electrical', Accessories: 'Accessory', Worksurface: 'Universal Systems worksurface', Supports: 'Panel-mounted worksurface support', Storage: 'Pedestal or storage' };
  function renderPartCards() {
    const el = $('#partcards'); const pid = [...sel][0];
    let lines; let title;
    if (pid && P.panels[pid]) { const p = P.panels[pid]; lines = R.lines.filter(l => l.src === pid || l.src === p.a || l.src === p.b); title = `Parts for ${pn(pid)} and its two junctions`; }
    else if (selWs) { lines = R.lines.filter(l => l.src === selWs); }
    else if (selNode) { lines = R.lines.filter(l => l.src === selNode); title = `Parts at ${jn(selNode)}`; }
    else { lines = []; }
    if (!lines.length) { el.innerHTML = ''; return; }
    const agg = E.aggregate(lines); agg.forEach(a => { const l = lines.find(x => x.style === a.style && x.spec === a.spec); a.contents = l ? l.contents : []; });
    el.innerHTML = agg.map(a => `<div class="partcard"><span class="qty">${a.qty}</span><div class="cat">${esc(a.cat)}</div><div class="sn">${esc(a.style)}</div><p>${esc(a.desc.replace(/ — side \d.*$/, ''))}</p>${a.spec ? `<p style="margin-top:4px">${esc(a.spec)}</p>` : ''}<p style="margin-top:4px">${money(a.unit)} list · guide ${linkPages('p' + a.page)}</p>${a.contents && a.contents.length ? `<div class="contains">${a.contents.map(x => `<span>${x.qty}× ${esc(x.item)}</span>`).join('')}</div>` : ''}${a.flags.map(f => `<div class="flag">⚠ ${esc(f)}</div>`).join('')}</div>`).join('');
  }

  // ---------- right column ----------
  const seg = (vals, cur, fmt, attr) => vals.map(v => `<button data-${attr || 'v'}="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${fmt ? fmt(v) : v}</button>`).join('');
  const SKIN_TYPES = ['tackable acoustical', 'performance tackable acoustical', 'steel', 'laminate', 'wood', 'markerboard', 'slatwall', 'technology'];
  const SKIN_LABEL = { 'tackable acoustical': 'Fabric, tackable', 'performance tackable acoustical': 'Fabric, performance', steel: 'Steel', laminate: 'Laminate', wood: 'Wood veneer', markerboard: 'Markerboard', slatwall: 'Slatwall', technology: 'Technology (steel)' };
  function renderRight() {
    const r = $('#rightcol'); const pid = [...sel][0];
    if (pid && P.panels[pid]) return renderPanel(r, P.panels[pid]);
    if (selWs && P.worksurfaces[selWs]) return renderWorksurface(r, P.worksurfaces[selWs]);
    if (selNode && P.nodes[selNode]) return renderJunction(r, P.nodes[selNode]);
    renderJob(r);
  }
  function issuesHTML() {
    const items = [...R.errors.map(e => ({ cls: 'err', ...e })), ...R.warnings.map(w => ({ cls: 'warn', ...w }))];
    if (!items.length) return '<div class="msg info">No issues. Every part resolves to a style number in the guide.</div>';
    return items.slice(0, 12).map(i => `<div class="msg ${i.cls}"><span class="go" data-go="${esc(i.panel || i.node || '')}">show</span>${esc(i.msg)}</div>`).join('') + (items.length > 12 ? `<div class="muted">${items.length - 12} more on the Specification tab</div>` : '');
  }
  function bindGo(root) { $$('[data-go]', root).forEach(g => g.onclick = () => { const id = g.dataset.go.split(',')[0]; selWs = null; selPed = null; if (P.panels[id]) { sel = new Set([id]); selNode = null; } else if (P.nodes[id]) { selNode = id; sel = new Set(); } else if (P.worksurfaces[id]) { selWs = id; sel = new Set(); selNode = null; } refresh(); }); }
  function renderJob(r) {
    const comps = E.workstations(P); const T = R.totals;
    r.innerHTML = `<div class="card">
      <div class="sec">Job</div>
      <div class="fields2"><div class="field"><label>Customer</label><input type="text" id="jCustomer" value="${esc(P.job.customer)}"></div><div class="field"><label>Job number</label><input type="text" id="jNumber" value="${esc(P.job.number)}"></div></div>
      <div class="fields2"><div class="field"><label>Planner</label><input type="text" id="jPlanner" value="${esc(P.job.planner)}"></div><div class="field"><label>Trim style</label><div class="muted" style="padding-top:6px">${P.trim === 'thin' ? 'Thin trim' : 'Oval trim'} · change in the header</div></div></div>
      <div class="sec">Summary</div>
      <div class="kv"><span>Workstations</span><b>${comps.length}</b></div><div class="kv"><span>Panels</span><b>${Object.keys(P.panels).length}</b></div><div class="kv"><span>Junctions</span><b>${Object.keys(P.nodes).length}</b></div>
      <div class="kv"><span>U.S. list, all parts</span><b>${money(T.all)}</b></div>
      ${comps.map(c => `<div class="kv"><span>${esc(c.name)} · ${c.panels.length} panels</span><b>${money(R.lines.filter(l => inComp(c, l)).reduce((a, l) => a + l.ext, 0))}</b></div>`).join('')}
      <div class="sec">Issues</div>${issuesHTML()}
      <div class="sec">Workstations</div>
      ${comps.map(c => `<div class="control"><input type="text" data-area="${esc(c.key)}" value="${esc(c.name)}" style="flex:1" title="Rename this workstation"><button class="btn small" data-selc="${esc(c.key)}">Show</button>${!c.key.startsWith('st:') && Object.values(P.worksurfaces || {}).filter(w => c.panels.some(p => p.id === E.hostPanelOf(P, w.id))).length > 1 ? `<button class="btn small" data-split="${esc(c.comp)}" title="Split this pod into stations: worksurfaces that touch form a station, and each panel joins the station mounted on it or the nearest one">Split</button>` : ''}</div>`).join('') || '<div class="muted">Draw a run to start.</div>'}
      ${comps.length ? '<div class="muted">A workstation is a connected group of panels unless panels are assigned to one by name (panel editor, or right-click › Assign to workstation).</div>' : ''}
      <div class="sec">Bill of materials</div>
      <div class="bomlist">${E.aggregate(R.lines).slice(0, 60).map(a => `<div class="r"><span class="sn">${esc(a.style)}</span><span class="d">${esc(a.desc.replace(/ — side \d.*$/, '').replace(/\(\d+"→\d+"\)/, ''))}</span><span class="q">${a.qty}</span></div>`).join('') || '<div class="muted">Nothing yet.</div>'}</div>
    </div>`;
    for (const [id, k] of [['jCustomer', 'customer'], ['jNumber', 'number'], ['jPlanner', 'planner']]) $('#' + id).onchange = e => mutate(() => P.job[k] = e.target.value);
    r.innerHTML = linkPages(r.innerHTML);
    $$('[data-area]', r).forEach(i => i.onchange = () => renameStation(i.dataset.area, i.value.trim()));
    $$('[data-selc]', r).forEach(b => b.onclick = () => { const c = E.workstations(P).find(x => x.key === b.dataset.selc); if (!c) return; sel = new Set(c.panels.map(p => p.id)); selNode = null; selWs = null; refresh(); });
    $$('[data-split]', r).forEach(b => b.onclick = () => splitPod(b.dataset.split));
    bindGo(r);
  }
  function fabricOptions(cur) { const fs = E.fabrics().filter(f => f.code && f.group && f.group !== 'n/a'); return `<option value="">Job fabric (${esc(P.finishes.fabric.code)} ${esc(P.finishes.fabric.name)})</option>` + fs.map(f => `<option value="${f.code}"${cur === f.code ? ' selected' : ''}>${f.code} ${esc((f.collection ? f.collection + ' ' : '') + f.name)} · gr ${f.group}</option>`).join(''); }
  const TILE_LABEL = Object.assign({ window: 'Glass window' }, SKIN_LABEL);
  function tileType(sg) { return sg.kind === 'window' ? 'window' : sg.type; }
  function segRows(segs, key) {
    // tiles listed top to bottom, like the elevation
    const rows = segs.map((sg, i) => { const hs = E.skinHeightsFor(sg); const t = tileType(sg); return `<div class="tile" data-key="${key}" data-i="${i}" style="border-left:6px solid ${FILL[t] || '#ccc'}">
      <span class="pos">${i === segs.length - 1 ? 'top' : i === 0 ? 'bottom' : ''}</span>
      <select data-f="type" title="Tile material">${SKIN_TYPES.map(x => `<option value="${x}"${t === x ? ' selected' : ''}>${SKIN_LABEL[x]}</option>`).join('')}<option value="window"${t === 'window' ? ' selected' : ''}>Glass window</option></select>
      <select data-f="height" title="Tile height">${hs.map(h => `<option value="${h}"${sg.height === h ? ' selected' : ''}>${h}"</option>`).join('')}</select>
      ${t === 'window' ? `<select data-f="pane"><option value="single"${sg.pane !== 'double' && !sg.frosted ? ' selected' : ''}>Clear</option><option value="frosted"${sg.frosted ? ' selected' : ''}>Frosted</option><option value="double"${sg.pane === 'double' ? ' selected' : ''}>Double-pane frosted</option></select>` :
        t === 'slatwall' ? `<select data-f="brace" title="Slatwall brace package: required only with a Details flat panel monitor arm (p113)"><option value="">No brace</option><option value="1"${sg.brace ? ' selected' : ''}>Brace (monitor arm)</option></select>` :
        t === 'steel' ? `<select data-f="finish"><option value=""${!sg.finish ? ' selected' : ''}>Smooth</option><option value="perforated"${sg.finish === 'perforated' ? ' selected' : ''}>Perforated</option><option value="ribbed"${sg.finish === 'ribbed' ? ' selected' : ''}>Ribbed</option></select>` :
        t === 'technology' ? `<select data-f="cutouts"><option${(sg.cutouts || 'All') === 'All' ? ' selected' : ''}>All</option><option${sg.cutouts === 'Right' ? ' selected' : ''}>Right</option><option${sg.cutouts === 'Left' ? ' selected' : ''}>Left</option></select>` :
        (t === 'tackable acoustical' || t === 'performance tackable acoustical') ? `<select data-f="fabric" title="Fabric for this tile">${fabricOptions(sg.fabric ? sg.fabric.code : '')}</select>` : '<span></span>'}
      <button class="x" data-f="del" title="Remove this tile (its height goes to the tile below)"${segs.length === 1 ? ' disabled' : ''}>×</button></div>`; });
    return rows.reverse().join('');
  }
  // split the tallest splittable tile into two valid tiles; returns false when every tile is already at its minimum
  function addTile(segs, target, fallbackType) {
    const order = segs.map((sg, i) => ({ sg, i })).sort((x, y) => y.sg.height - x.sg.height);
    for (const { sg, i } of order) {
      const hs = E.skinHeightsFor(sg).filter(h => h < sg.height).sort((x, y) => x - y);
      for (const a of hs) { const rest = sg.height - a; if (E.skinHeightsFor(sg).includes(rest) && E.SKIN_HEIGHTS_BY_TYPE[fallbackType].includes(a)) { sg.height = rest; segs.splice(i + 1, 0, { kind: 'skin', type: fallbackType, height: a }); E.normalizeSegs(segs, target, fallbackType); return true; } }
    }
    return false;
  }
  function miniElev(canvas, segs, target, toFloor, openBase) { // skins fill from the base trim up to the cap underside at the actual panel height (p11, p13, p50); nominal sizes total panel height - 6"
    const c = canvas.getContext('2d'); const w = canvas.width = 104, h = canvas.height = 236; c.clearRect(0, 0, w, h); const H = E.actualBaseHeight(P.trim, target + 6), capF = E.CAP_FACE[P.trim] || 0.625, s = (h - 20) / H, k = (H - E.BASE_TRIM_H - capF) / target, B = E.BASE_TRIM_H; let y = h - 8;
    if (openBase) { const ob = E.OPEN_BASE; c.fillStyle = '#8a8a8d'; c.fillRect(10, y - ob.height * s, w - 20, (ob.height - ob.opening) * s); c.strokeStyle = '#8a8a8d'; c.setLineDash([3, 3]); c.strokeRect(10, y - ob.opening * s, w - 20, ob.opening * s); c.setLineDash([]); } // open base: 3 1/4" with a 2 1/2" opening (p51)
    else if (!toFloor) { c.fillStyle = '#8a8a8d'; c.fillRect(10, y - B * s, w - 20, B * s); } y -= B * s;
    segs.forEach((sg, i) => { const t = sg.kind === 'window' ? 'window' : sg.type; const hh = sg.height * s * k, e0 = i === 0 && toFloor ? B * s : 0; c.fillStyle = FILL[t] || '#ccc'; c.fillRect(10, y - hh, w - 20, hh + e0); c.strokeStyle = '#7a7a7d'; c.strokeRect(10, y - hh, w - 20, hh + e0); y -= hh; });
    c.fillStyle = '#5d5d60'; c.fillRect(10, y - Math.max(2, capF * s), w - 20, Math.max(2, capF * s));
  }
  function renderPanel(r, p) {
    const Ja = R.nodes[p.a], Jb = R.nodes[p.b]; const thin = P.trim === 'thin'; const skinH = p.height - 6; const multi = sel.size > 1;
    const comp = E.workstationOf(P, p.id);
    const stations = E.workstations(P);
    const cap = E.powerBlocksPerSide(p.width);
    const stackOpts = E.stackOptions(p.height);
    r.innerHTML = `<div class="card">
      <div class="itemcard"><div class="head"><h2>${pn(p.id)}${multi ? ` <span class="muted">+${sel.size - 1} more selected</span>` : ''}</h2><button class="x" id="xClose" title="Deselect">×</button></div>
      <div class="muted">${esc(comp ? comp.name : '')} · ends at ${jn(p.a)} (${Ja ? jShort(Ja) : ''}) and ${jn(p.b)} (${Jb ? jShort(Jb) : ''})</div></div>
      ${multi ? `<div class="msg info">Every change here applies to all ${sel.size} selected panels. Tile edits copy this panel’s tiles to the same side of the others.</div>` : ''}
      <div class="control" title="Name a workstation to split a pod: the panels (and the worksurfaces on them) go to that workstation on the Specification, SIF, staging and installer sheets. Leave empty to group by connected panels."><label>Workstation</label><input type="text" id="pStation" list="stationNames" value="${esc(p.station || '')}" placeholder="${esc(comp && !p.station ? comp.name : 'automatic')} (automatic)" style="flex:1"><datalist id="stationNames">${stations.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
      <div class="sec">Size</div>
      <div class="control"><label>Height</label><div class="seg" id="pH">${seg(E.HEIGHTS, p.height, v => v + '"', 'h')}</div></div>
      <div class="control"><label>Width</label><div class="seg wrap" id="pW">${seg(E.WIDTHS, p.width, v => v + '"', 'w')}</div></div>
      <div class="control"><label>Stack on top</label><div class="seg wrap" id="pStack">${stackOpts.map(st => `<button data-st="${st.join(',')}" class="${st.join(',') === p.stack.join(',') ? 'on' : ''}">${st.length ? st.map(x => x + '"').join(' + ') : 'none'}</button>`).join('')}</div></div>
      <div class="muted">Total height ${E.panelTotalHeight(p)}" · limits: 36" stacked, two stackers, 90" overall</div>
      <div class="sec">Tiles · side A <span class="muted" style="text-transform:none;letter-spacing:0">(${skinH}" of tiles top to bottom, 6" is trim)</span></div><div class="muted">Tiles are any mix of 12"–60" fabric, steel, laminate, wood, markerboard, slatwall, technology tiles or glass windows, as long as they add up to ${skinH}". Windows go through both sides.</div>
      <div class="skinside"><canvas id="miniA"></canvas><div style="flex:1">${segRows(p.sides[0], 's0')}<div class="control" style="margin-top:6px"><button class="btn small" data-add="s0">+ Add tile</button><button class="btn small" data-preset="s0:mono">One piece</button><button class="btn small" data-preset="s0:win">Window on top</button><button class="btn small" data-preset="s0:two">Two-tone</button></div></div></div>
      <div class="sec">Tiles · side B</div>
      <div class="skinside"><canvas id="miniB"></canvas><div style="flex:1">${segRows(p.sides[1], 's1')}<div class="control" style="margin-top:6px"><button class="btn small" data-add="s1">+ Add tile</button><button class="btn small" data-preset="s1:copy">Same as side A</button><button class="btn small" data-preset="s1:mono">One piece</button></div></div></div>
      ${p.stack.map((st, i) => `<div class="sec">Stacked tier ${i + 1} (${st}") tiles</div><div class="muted">Side A</div>${segRows(p.stackSides[i][0], 'k' + i + '0')}<div class="control"><button class="btn small" data-add="k${i}0">+ Add tile</button></div><div class="muted">Side B</div>${segRows(p.stackSides[i][1], 'k' + i + '1')}<div class="control"><button class="btn small" data-add="k${i}1">+ Add tile</button><button class="btn small" data-preset="k${i}:win">Window both sides</button><button class="btn small" data-preset="k${i}:mono">Skins both sides</button></div>`).join('')}
      <div class="sec">Top and base</div>
      <div class="control"><label>Top cap</label><div class="seg" id="pTop"><button data-tc="paint" class="${!p.topCap.wood && !p.topCap.omit ? 'on' : ''}">Painted</button><button data-tc="wood" class="${p.topCap.wood ? 'on' : ''}">Wood</button>${thin ? `<button data-tc="omit" class="${p.topCap.omit ? 'on' : ''}">Omit</button>` : ''}</div></div>
      <div class="control"><label>Base trim</label><select id="pBase"><option value="knockouts"${p.baseTrim === 'knockouts' ? ' selected' : ''}>Knockouts both sides (standard)</option><option value="knockoutsOneSidePlainOneSide"${p.baseTrim === 'knockoutsOneSidePlainOneSide' ? ' selected' : ''}>Knockouts one side, plain the other</option><option value="plainBothSides"${p.baseTrim === 'plainBothSides' ? ' selected' : ''}>Plain both sides</option><option value="hardwire"${p.baseTrim === 'hardwire' ? ' selected' : ''}>Hardwire base trims</option></select></div>
      <label class="check"><input type="checkbox" id="pOpen"${p.openBase ? ' checked' : ''}>Open base (no base trim, no power in the base)</label>
      <label class="check"><input type="checkbox" id="pFloor"${p.skinsToFloor ? ' checked' : ''}${p.sides[0][0].kind === 'window' || p.sides[0][0].height < 24 ? ' disabled' : ''}>Skins run to the floor (bottom skin 24" or taller)</label>
      <label class="check"><input type="checkbox" id="pTray"${p.cableTray ? ' checked' : ''}>Cable tray</label>
      <label class="check"><input type="checkbox" id="pBTray"${p.baseCableTray ? ' checked' : ''}${p.openBase || p.skinsToFloor || p.baseTrim === 'hardwire' ? ' disabled' : ''}>Base cable tray</label>
      <div class="sec">Worksurfaces</div>
      <div class="control"><label>Add on side A</label><div class="seg" id="pWsA">${[24, 30, 18].map(d => `<button data-d="${d}">${d}"D</button>`).join('')}</div></div>
      <div class="control"><label>Add on side B</label><div class="seg" id="pWsB">${[24, 30, 18].map(d => `<button data-d="${d}">${d}"D</button>`).join('')}</div></div>
      <div class="muted" style="margin:-2px 0 8px">Sized to fit this panel and supported per the guide (cantilevers, side support brackets, tie plates). For a corner worksurface, click the corner junction with Add worksurface, or right-click it.</div>
      <div class="sec">Power</div>
      <div class="control"><label>Power in panel</label><div class="seg" id="pPower"><button data-pw="none" class="${p.power.kind === 'none' ? 'on' : ''}">None</button><button data-pw="powerkit" class="${p.power.kind === 'powerkit' ? 'on' : ''}"${p.width < 24 ? ' disabled title="18 inch panels take pass-through only"' : ''}>Powerkit</button><button data-pw="passthrough" class="${p.power.kind === 'passthrough' ? 'on' : ''}">Pass-through</button></div></div>
      ${p.power.kind === 'powerkit' ? `<div class="control"><label>Location</label><div class="seg" id="pLoc"><button data-loc="base" class="${p.power.location === 'base' ? 'on' : ''}">Base</button><button data-loc="worksurface" class="${p.power.location === 'worksurface' ? 'on' : ''}">Worksurface height</button></div></div>
      <div class="control"><label>Outlets side A</label><div class="stepper" data-st="r0"><button>−</button><span>${p.power.receptacles[0]}</span><button>+</button></div><span class="muted">of ${cap}</span></div>
      <div class="control"><label>Outlets side B</label><div class="stepper" data-st="r1"><button>−</button><span>${p.power.receptacles[1]}</span><button>+</button></div><span class="muted">of ${cap}</span></div>
      <div class="control"><label>USB side A / B</label><div class="stepper" data-st="u0"><button>−</button><span>${p.power.usb[0]}</span><button>+</button></div><div class="stepper" data-st="u1"><button>−</button><span>${p.power.usb[1]}</span><button>+</button></div></div>
      <div class="control"><label>Building feed</label><select id="pInfeed"><option value=""${!p.power.infeed ? ' selected' : ''}>No infeed here</option><option value="6"${p.power.infeed && p.power.infeed.length === 6 ? ' selected' : ''}>Base power infeed, 6 ft</option><option value="12"${p.power.infeed && p.power.infeed.length === 12 ? ' selected' : ''}>Base power infeed, 12 ft</option></select></div>` : ''}
      ${thin ? `<div class="sec">Glass screen on top</div><div class="control"><label>Frameless glass</label><select id="pGlass"><option value=""${!p.glassScreen ? ' selected' : ''}>None</option><option value="r6"${p.glassScreen && p.glassScreen.attach === 'recessed' && p.glassScreen.height === 6 ? ' selected' : ''}>Recessed, 6" high</option><option value="r12"${p.glassScreen && p.glassScreen.attach === 'recessed' && p.glassScreen.height === 12 ? ' selected' : ''}>Recessed, 12" high</option><option value="r18"${p.glassScreen && p.glassScreen.attach === 'recessed' && p.glassScreen.height === 18 ? ' selected' : ''}>Recessed, 18" high</option><option value="c12"${p.glassScreen && p.glassScreen.attach === 'clip' ? ' selected' : ''}>Clip-on, 12" high</option></select></div>${p.glassScreen ? `<label class="check"><input type="checkbox" id="pFrost"${p.glassScreen.frosted ? ' checked' : ''}>Frosted glass</label><label class="check"><input type="checkbox" id="pOmitGlass"${p.glassScreen.omitGlass ? ' checked' : ''}>Customer supplies the glass (omit glass)</label>` : ''}` :
        `<div class="sec">Screen on top</div><label class="check"><input type="checkbox" id="pTopScreen"${p.topScreen ? ' checked' : ''}${![30, 36, 42, 48].includes(p.width) || p.topCap.wood ? ' disabled' : ''}>12" translucent panel top screen (30–48" wide, painted top cap only)</label>`}
      <div class="sec">Issues</div>${issuesFor(p)}
      <div class="control" style="margin-top:14px"><button class="btn danger" id="pDel">Delete panel${multi ? 's' : ''}</button></div>
    </div>`;
    r.innerHTML = linkPages(r.innerHTML);
    miniElev($('#miniA'), p.sides[0], skinH, p.skinsToFloor, p.openBase); miniElev($('#miniB'), p.sides[1], skinH, p.skinsToFloor, p.openBase);
    const targets = () => { const t = [...sel].map(id => P.panels[id]).filter(Boolean); return t.length ? t : [p]; };
    $('#xClose').onclick = () => { sel = new Set(); refresh(); };
    $('#pStation').onchange = e => assignStation(targets(), e.target.value.trim());
    $$('#pH button').forEach(b => b.onclick = () => setHeights(targets(), +b.dataset.h));
    $$('#pW button').forEach(b => b.onclick = () => setWidths(targets(), +b.dataset.w));
    $$('#pStack button').forEach(b => b.onclick = () => { const want = b.dataset.st ? b.dataset.st.split(',').map(Number) : []; const msgs = []; mutate(() => targets().forEach(q => { E.setStack(P, q, want); if (q.stack.join() !== want.join()) msgs.push(`${pn(q.id)}: ${q.height}" + ${want.join('" + ')}" is over 90", so it is stacked ${q.stack.length ? q.stack.join('" + ') + '"' : 'none'} (p27).`); })); toast(msgs.length ? msgs.join(' ') : want.length ? `${who(targets())}: stacked ${want.join('" + ')}" (${targets().map(q => E.panelTotalHeight(q) + '"').filter((v, i, a) => a.indexOf(v) === i).join(', ')} overall)` : `${who(targets())}: stacker removed`); });
    $$('#pTop button').forEach(b => b.onclick = () => mutate(() => targets().forEach(q => { q.topCap.wood = b.dataset.tc === 'wood'; q.topCap.omit = b.dataset.tc === 'omit'; })));
    $('#pBase').onchange = e => mutate(() => targets().forEach(q => q.baseTrim = e.target.value));
    $('#pOpen').onchange = e => mutate(() => targets().forEach(q => q.openBase = e.target.checked));
    $('#pFloor').onchange = e => mutate(() => targets().forEach(q => q.skinsToFloor = e.target.checked));
    $('#pTray').onchange = e => mutate(() => targets().forEach(q => q.cableTray = e.target.checked));
    $('#pBTray').onchange = e => mutate(() => targets().forEach(q => q.baseCableTray = e.target.checked));
    $$('#pPower button').forEach(b => b.onclick = () => setPower(targets(), b.dataset.pw, 1));
    { const a = P.nodes[p.a], c = P.nodes[p.b]; const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2; [['#pWsA', 0], ['#pWsB', 1]].forEach(([id, side]) => $$(id + ' button').forEach(b => b.onclick = () => addStraightWs(p.id, side, mx, my, +b.dataset.d))); } // side 0 = A
    $$('#pLoc button').forEach(b => b.onclick = () => mutate(() => targets().forEach(q => q.power.location = b.dataset.loc)));
    // outlet and USB steppers step every selected powerkit by the same amount, each within its own width's capacity
    $$('.stepper', r).forEach(st => { const k = st.dataset.st; const [minus, plus] = st.querySelectorAll('button'); const f = (d) => mutate(() => targets().filter(q => q.power.kind === 'powerkit').forEach(q => { const qc = E.powerBlocksPerSide(q.width); const arr = k[0] === 'r' ? q.power.receptacles : q.power.usb; const i = +k[1]; arr[i] = Math.max(0, Math.min(qc, (arr[i] | 0) + d)); })); minus.onclick = () => f(-1); plus.onclick = () => f(1); });
    // one building power-in per circuit run (p146, p158): with several panels selected the infeed goes on the first powerkit only
    const inf = $('#pInfeed'); if (inf) inf.onchange = e => { const v = e.target.value; const kits = targets().filter(q => q.power.kind === 'powerkit'); if (!kits.length) return; const first = kits.includes(p) ? p : kits[0];
      mutate(() => { if (v) { first.power.infeed = { length: +v }; } else kits.forEach(q => q.power.infeed = null); });
      if (v && kits.length > 1) toast(`Power infeed ${v}' set on ${pn(first.id)} only: one building power-in feeds a circuit run (p146, p158). The other ${kits.length - 1} selected panel${kits.length > 2 ? 's keep their' : ' keeps its'} setting.`); else toast(v ? `${pn(first.id)}: ${v}' base power infeed` : `Power infeed removed from ${kits.length === 1 ? pn(kits[0].id) : kits.length + ' panels'}`); };
    const g = $('#pGlass'); if (g) g.onchange = e => mutate(() => { const v = e.target.value; targets().forEach(q => q.glassScreen = v ? { attach: v[0] === 'c' ? 'clip' : 'recessed', height: +v.slice(1), frosted: q.glassScreen ? q.glassScreen.frosted : false, omitGlass: q.glassScreen ? q.glassScreen.omitGlass : false } : null); });
    const fr = $('#pFrost'); if (fr) fr.onchange = e => mutate(() => targets().forEach(q => { if (q.glassScreen) q.glassScreen.frosted = e.target.checked; }));
    const og = $('#pOmitGlass'); if (og) og.onchange = e => mutate(() => targets().forEach(q => { if (q.glassScreen) q.glassScreen.omitGlass = e.target.checked; }));
    const ts = $('#pTopScreen'); if (ts) ts.onchange = e => mutate(() => targets().forEach(q => q.topScreen = e.target.checked));
    $('#pDel').onclick = () => mutate(() => { targets().forEach(q => E.removePanel(P, q.id)); sel = new Set(); });
    const segsOf = (key) => key === 's0' ? p.sides[0] : key === 's1' ? p.sides[1] : p.stackSides[+key[1]][+key[2]];
    const targetOf = (key) => key[0] === 's' ? skinH : p.stack[+key[1]];
    // with several panels selected, a tile edit copies this panel's tiles on that side to the same side of the others
    const spreadTiles = (key) => { for (const q of targets()) { if (q === p) continue; if (key[0] === 's') { const i = +key[1]; q.sides[i] = JSON.parse(JSON.stringify(p.sides[i])); E.normalizeSegs(q.sides[i], q.height - 6, P.finishes.skinType); mirrorWindows(q, key); } else { const i = +key[1], f = +key[2]; if (q.stack[i] !== p.stack[i]) continue; q.stackSides[i][f] = JSON.parse(JSON.stringify(p.stackSides[i][f])); mirrorWindows(q, key); } } };
    $$('.tile', r).forEach(row => {
      const segs = segsOf(row.dataset.key), i = +row.dataset.i, sg = segs[i];
      $$('[data-f]', row).forEach(el => {
        const f = el.dataset.f;
        if (f === 'del') el.onclick = () => mutate(() => { if (segs.length > 1) { const h = segs[i].height; segs.splice(i, 1); const nb = segs[Math.max(0, i - 1)]; const hs = E.skinHeightsFor(nb); if (hs.includes(nb.height + h)) nb.height += h; } E.normalizeSegs(segs, targetOf(row.dataset.key), P.finishes.skinType); mirrorWindows(p, row.dataset.key); spreadTiles(row.dataset.key); });
        else el.onchange = () => mutate(() => {
          const v = el.value;
          if (f === 'type') { if (v === 'window') { sg.kind = 'window'; delete sg.type; sg.pane = 'single'; } else { sg.kind = 'skin'; sg.type = v; delete sg.pane; delete sg.frosted; } }
          else if (f === 'height') sg.height = +v;
          else if (f === 'pane') { sg.pane = v === 'double' ? 'double' : 'single'; sg.frosted = v === 'frosted'; }
          else if (f === 'finish') sg.finish = v || undefined;
          else if (f === 'brace') sg.brace = v ? true : undefined;
          else if (f === 'cutouts') sg.cutouts = v;
          else if (f === 'fabric') { const fb = E.fabrics().find(x => x.code === v); if (fb) sg.fabric = { code: fb.code, name: (fb.collection ? fb.collection + ' ' : '') + fb.name, group: fb.group }; else delete sg.fabric; }
          E.normalizeSegs(segs, targetOf(row.dataset.key), P.finishes.skinType);
          if (f === 'type' || f === 'height' || f === 'pane') mirrorWindows(p, row.dataset.key);
          spreadTiles(row.dataset.key);
        });
      });
    });
    $$('[data-add]', r).forEach(b => b.onclick = () => { const key = b.dataset.add; const segs = segsOf(key); const target = targetOf(key); const before = JSON.stringify(segs); const ok = addTile(JSON.parse(before), target, P.finishes.skinType); if (!ok) { toast('Every tile is already at its smallest height (12", or 6" for technology tiles). Make a tile taller first, then split it.'); return; } mutate(() => { addTile(segs, target, P.finishes.skinType); spreadTiles(key); }); });
    const preset = (q, key, what) => {
      const qH = q.height - 6;
      if (key[0] === 'k') { const i = +key[1]; const st = q.stack[i]; if (!st) return; q.stackSides[i] = what === 'win' ? [[{ kind: 'window', height: Math.min(24, st), pane: 'single' }], [{ kind: 'window', height: Math.min(24, st), pane: 'single' }]] : [E.defaultSegs(st, P.finishes.skinType), E.defaultSegs(st, P.finishes.skinType)]; for (const s of [0, 1]) E.normalizeSegs(q.stackSides[i][s], st, P.finishes.skinType); return; }
      const si = +key[1];
      if (what === 'mono') { q.sides[si] = E.defaultSegs(qH, P.finishes.skinType); mirrorWindows(q, 's' + si); }
      if (what === 'copy') q.sides[1] = JSON.parse(JSON.stringify(q.sides[0]));
      if (what === 'two') { const a = [24, 18, 12].find(x => E.SKIN_HEIGHTS_BY_TYPE[P.finishes.skinType].includes(qH - x)); q.sides[si] = a ? [{ kind: 'skin', type: P.finishes.skinType, height: qH - a }, { kind: 'skin', type: 'steel', height: a }] : E.defaultSegs(qH, P.finishes.skinType); E.normalizeSegs(q.sides[si], qH, P.finishes.skinType); mirrorWindows(q, 's' + si); }
      if (what === 'win') { const wh = [12, 18, 24].find(x => E.SKIN_HEIGHTS_BY_TYPE[P.finishes.skinType].includes(qH - x)) || 12; q.sides[0] = [...E.defaultSegs(qH - wh, P.finishes.skinType), { kind: 'window', height: wh, pane: 'single' }]; q.sides[1] = JSON.parse(JSON.stringify(q.sides[0])); }
    };
    $$('[data-preset]', r).forEach(b => b.onclick = () => mutate(() => { const [key, what] = b.dataset.preset.split(':'); targets().forEach(q => preset(q, key, what)); }));
    bindGo(r);
  }
  function mirrorWindows(p, key) {
    const pair = key[0] === 's' ? [p.sides[0], p.sides[1]] : [p.stackSides[+key[1]][0], p.stackSides[+key[1]][1]];
    const from = key[0] === 's' ? +key[1] : +key[2]; const src = pair[from], dst = pair[1 - from];
    if (!src.some(x => x.kind === 'window') && !dst.some(x => x.kind === 'window')) return;
    // windows must sit at the same height on both faces: rebuild the other side with the same tile heights, windows mirrored, other tiles kept where possible
    let y = 0; const out = [];
    for (const sg of src) { if (sg.kind === 'window') out.push(JSON.parse(JSON.stringify(sg))); else { const old = dst.find(d => d.kind !== 'window' && d._y === y) || dst.find(d => d.kind !== 'window'); out.push(Object.assign({ kind: 'skin', type: P.finishes.skinType }, old ? JSON.parse(JSON.stringify(old)) : {}, { height: sg.height })); } y += sg.height; }
    pair[1 - from].splice(0, pair[1 - from].length, ...out);
    toast('Windows go through the panel, so side ' + (from === 0 ? 'B' : 'A') + ' was matched (guide p12).');
  }
  function issuesFor(p) { const items = [...R.errors.filter(e => (e.panel || '').split(',').includes(p.id)).map(e => ({ cls: 'err', ...e })), ...R.warnings.filter(w => (w.panel || '').split(',').includes(p.id)).map(w => ({ cls: 'warn', ...w })), ...R.lines.filter(l => l.src === p.id && l.flags.length).flatMap(l => l.flags.map(f => ({ cls: 'warn', msg: l.style + ': ' + f })))]; return items.length ? items.map(i => `<div class="msg ${i.cls}">${esc(i.msg)}</div>`).join('') : '<div class="msg info">No issues with this panel.</div>'; }
  function renderJunction(r, n) {
    const J = R.nodes[n.id]; const lines = R.lines.filter(l => l.src === n.id); const legs = J.legs || [];
    const allowed = E.allowedAngles(P, n); const dirs = { 90: '↑', 45: '↗', 0: '→', 315: '↘', 270: '↓', 225: '↙', 180: '←', 135: '↖' };
    r.innerHTML = `<div class="card"><div class="itemcard"><div class="head"><h2>${jn(n.id)}</h2><button class="x" id="xClose">×</button></div><div class="muted">${J.type === 'none' ? 'No panels yet' : esc(jShort(J))} · ${legs.length} panel${legs.length === 1 ? '' : 's'}${J.reason ? `<div class="msg err">${esc(J.reason)}</div>` : ''}</div></div>
      ${legs.length === 1 ? `<label class="check"><input type="checkbox" id="nWall"${n.wallStart ? ' checked' : ''}${legs[0].base === 30 ? ' disabled' : ''}>This end starts at a wall (wall-start junction, not offered for 30" panels)</label>` : ''}
      <div class="sec">Add a panel from this junction</div>
      <div class="muted">${E.HEIGHTS.includes(+$('#optHeight .on').dataset.h) ? `${$('#optHeight .on').dataset.h}" high, ${$('#optWidth').value === 'auto' ? '48"' : $('#optWidth').value + '"'} wide · change under "New panels" above the plan` : ''}</div>
      <div class="arrows" style="display:flex;flex-wrap:wrap;grid-template-columns:none">${allowed.length ? allowed.map(a => `<button data-ang="${a}" title="${a}°" style="width:48px"><span style="display:inline-block;transform:rotate(${-a}deg)">→</span></button>`).join('') : '<span class="muted">This junction is full.</span>'}</div>
      <div class="muted">Only directions that make a junction Answer offers are shown (90° family or 120° family, never mixed).</div>
      <div class="sec">Panels here</div>${legs.map(l => `<div class="kv"><span><span class="go" data-go="${l.panel.id}" style="cursor:pointer;text-decoration:underline">${pn(l.panel.id)}</span> · ${l.panel.width}"W × ${l.total}"H</span><b>${l.angle}°</b></div>`).join('') || '<div class="muted">none</div>'}
      <div class="sec">Parts at this junction</div>
      <div class="bomlist">${lines.map(l => `<div class="r"><span class="sn">${esc(l.style)}</span><span class="d">${esc(l.desc)}${l.spec ? ' · ' + esc(l.spec) : ''}${l.flags.map(f => `<div class="msg warn" style="margin:4px 0">${esc(f)}</div>`).join('')}${contentsHTML(l.contents)}${l.notes.map(f => `<div class="muted">${esc(f)}</div>`).join('')}</span><span class="q">${l.qty}</span></div>`).join('') || '<div class="muted">none</div>'}</div>
      ${legs.length === 0 ? '<div class="control" style="margin-top:12px"><button class="btn danger" id="nDel">Delete junction</button></div>' : ''}</div>`;
    r.innerHTML = linkPages(r.innerHTML);
    $('#xClose').onclick = () => { selNode = null; refresh(); };
    const w = $('#nWall'); if (w) w.onchange = e => mutate(() => n.wallStart = e.target.checked);
    $$('[data-ang]', r).forEach(b => b.onclick = () => guardedMutate(() => { const wv = $('#optWidth').value; const q = E.addPanel(P, n, +b.dataset.ang, wv === 'auto' ? 48 : +wv, +$('#optHeight .on').dataset.h); applyDefaults(q); sel = new Set([q.id]); selNode = null; }, 'Panel not added'));
    const d = $('#nDel'); if (d) d.onclick = () => mutate(() => { delete P.nodes[n.id]; selNode = null; });
    bindGo(r);
  }
  // ---------- worksurface inspector ----------
  const SUPPORT_LABEL = { auto: 'Automatic', cantilever: 'Cantilever', endpanel: 'End panel', leg: 'Post leg', csp: 'Center support panel', ssb: 'Side support bracket', shared: 'Shared with neighbor', pedestal: 'Pedestal' };
  function renderWorksurface(r, ws) {
    const lines = R.lines.filter(l => l.src === ws.id); const ek = endKeys(ws); const res = ws._resolved || {};
    const issues = [...R.errors.filter(e => e.panel === ws.id).map(e => ({ cls: 'err', ...e })), ...R.warnings.filter(w => w.panel === ws.id).map(w => ({ cls: 'warn', ...w }))];
    const edges = E.wsEdgesFor(P, ws); const lam = ws.material !== 'wood';
    const edgeOpts = lam ? [['3mm', 'Plastic 3 mm edge'], ['P', 'Plastic P-edge'], ['K', 'Plastic knife edge']] : [['SW', 'Wood square edge']];
    const sizes = ws.kind !== 'straight' ? cornerFits(ws) : []; const curSize = ws.kind !== 'straight' ? cornerSize(ws) : null;
    const widths = ws.kind === 'straight' ? (() => { const w = fitting(ws, E.wsWidths(P, ws), x => { ws.width = x; ws.off = snapWsOff(ws, ws.off).off; }, 'width:' + ws.id); if (!w.includes(ws.width)) w.push(ws.width); return w.sort((a, b) => a - b); })() : [];
    const supportSel = (k, label) => `<div class="control"><label>${label}</label><select data-sup="${k}">${Object.entries(SUPPORT_LABEL).filter(([v]) => !['shared', 'pedestal'].includes(v)).map(([v, l]) => `<option value="${v}"${(ws.supports[k] || 'auto') === v ? ' selected' : ''}>${l}${v === 'auto' && res[k] ? ' → ' + SUPPORT_LABEL[res[k]] : ''}</option>`).join('')}</select></div>`;
    r.innerHTML = `<div class="card"><div class="itemcard"><div class="head"><h2>${esc(E.wsName(ws))}</h2><button class="x" id="xClose">×</button></div><div class="muted">${ws.kind === 'straight' ? `${ws.width}"W × ${ws.depth}"D on ${pn(ws.panel)}, side ${ws.side === 0 ? 'A' : 'B'}` : `${ws.C}×${ws.D} at ${jn(ws.node)}`} · ${lines.length ? money(lines.reduce((a, l) => a + l.ext, 0)) + ' list' : ''}</div></div>
      ${issues.map(i => `<div class="msg ${i.cls}">${esc(i.msg)}</div>`).join('')}
      <div class="sec">Size</div>
      ${ws.kind === 'straight' ? `<div class="control"><label>Width</label><select id="wWidth">${widths.map(w => `<option value="${w}"${w === ws.width ? ' selected' : ''}>${w}"</option>`).join('')}</select></div>
      <div class="control"><label>Depth</label><div class="seg" id="wDepth">${seg(E.WS_DEPTHS, ws.depth, v => v + '"', 'd')}</div></div>
      <div class="control"><label>Position</label><div class="btngroup small"><button id="wLeft" title="Slide 6&quot; toward the left">◀ 6"</button><button id="wRight" title="Slide 6&quot; toward the right">6" ▶</button><button id="wFlip" title="Move to the other side of the panel">Other side</button></div><span class="muted">${ws.off.toFixed(1).replace(/\.0$/, '')}" from ${pn(ws.panel)}'s ${ws.side === 0 ? 'left' : 'right'} post · drag it on the plan, it snaps to seams and neighbors</span></div>` :
      `<div class="control"><label>Size</label><select id="wSize">${sizes.map((z, i) => `<option value="${i}"${sameSize(z, curSize) ? ' selected' : ''}>${sizeName(ws, z)}</option>`).join('')}</select></div>
      <div class="muted">C and A are the length and depth of the left arm (${pn(ws.legs[endKeys(ws).left === 'arm0' ? 0 : 1])}), D and B of the right arm (${pn(ws.legs[endKeys(ws).left === 'arm0' ? 1 : 0])}), sitting at the worksurface (p521-526). Only sizes that fit here are listed.</div>`}
      <div class="sec">Surface and edge</div>
      <div class="control"><label>Material</label><div class="seg" id="wMat"><button data-m="laminate" class="${lam ? 'on' : ''}">Laminate</button><button data-m="wood" class="${!lam ? 'on' : ''}">Wood veneer</button></div></div>
      <div class="control"><label>Edge</label><select id="wEdge">${edgeOpts.map(([v, l]) => `<option value="${v}"${(lam ? ws.edge : 'SW') === v ? ' selected' : ''}${edges.includes(v) ? '' : ' disabled'}>${l}${edges.includes(v) ? '' : ' (not offered at this size)'}</option>`).join('')}</select></div>
      ${ws.kind !== 'corner120' ? `<div class="control"><label>Construction</label><select id="wCon"><option value="cord-drop"${ws.construction === 'cord-drop' ? ' selected' : ''}>1/2" cord drop at the back (standard)</option><option value="full-depth"${ws.construction === 'full-depth' ? ' selected' : ''}>Full depth (laminate 3 mm or knife edge only)</option></select></div>` : ''}
      <div class="muted">${lam ? `Laminate ${esc(P.finishes.laminate.code)} ${esc(P.finishes.laminate.name)}, edge plastic ${esc(P.finishes.plasticColor)}` : `Wood ${esc(P.finishes.wood.code)} ${esc(P.finishes.wood.name)}`} · change under Finishes &amp; settings</div>
      ${lam ? `<label class="check"><input type="checkbox" id="wOpen"${ws.options.openLine ? ' checked' : ''}>Open Line laminate (+$65 plus the laminate)</label>` : `<label class="check"><input type="checkbox" id="wFull"${ws.options.fullFill ? ' checked' : ''}>Full-fill finish</label>`}
      <label class="check"><input type="checkbox" id="wScallop"${ws.options.omitScallop ? ' checked' : ''}>Omit the cable scallop on the back edge</label>
      <div class="sec">Supports</div>
      ${supportSel(ek.left, endLabel(ws, 'left'))}${supportSel(ek.right, endLabel(ws, 'right'))}
      ${ws.kind !== 'straight' ? '<div class="muted">The rear corner takes one side support bracket (p217, p545).</div>' : ''}
      <div class="muted">Automatic follows p207-217: cantilevers at free ends, one cantilever shared at a seam, a side support bracket where a return panel wraps the end, a fixed pedestal where one sits, and an end panel for the front edge of 30"D worksurfaces. Spans over 54" get a reinforcing channel.</div>
      <div class="sec">Pedestals</div>
      ${(ws.peds || []).map(d => `<div class="tile" data-ped="${d.id}" style="grid-template-columns:auto 1fr 1fr 1fr 28px"><span class="pos">${d.at === ek.left ? 'left' : d.at === ek.right ? 'right' : d.at}</span><select data-f="type"><option value="fixed"${d.type === 'fixed' ? ' selected' : ''}>Fixed 27"H</option><option value="mobile"${d.type === 'mobile' ? ' selected' : ''}>Mobile</option></select><select data-f="config">${(d.type === 'mobile' ? [['A', 'Box/box/file'], ['B', 'File/file'], ['C', 'Box/file 21"H']] : [['A', 'Box/box/file'], ['B', 'File/file']]).map(([c, l]) => `<option value="${c}"${d.config === c ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-f="front"><option value="F"${d.front === 'F' ? ' selected' : ''}>Flush steel</option><option value="P"${d.front === 'P' ? ' selected' : ''}>Proud steel</option><option value="W"${d.front === 'W' ? ' selected' : ''}>Proud wood</option></select><button class="x" data-f="del">×</button></div>
        ${d.front !== 'F' ? `<div class="control" style="margin-left:8px"><label>Pull</label><select data-pedpull="${d.id}">${['contemporary', 'handle', 'jazz', 'bar', ...(d.front === 'P' ? ['c:scape'] : [])].map(pl => `<option${(d.pull || 'contemporary') === pl ? ' selected' : ''}>${pl}</option>`).join('')}</select><select data-pedcolor="${d.id}">${E.pullColors(d.pull || 'contemporary').map(([c, l], i) => `<option value="${c}"${(E.pullColors(d.pull || 'contemporary').some(([x]) => x === d.pullColor) ? d.pullColor === c : i === 0) ? ' selected' : ''}>${c} ${l}</option>`).join('')}</select></div>` : ''}`).join('') || '<div class="muted">None. A fixed pedestal supports the worksurface end and replaces the cantilever there.</div>'}
      <div class="control"><div class="btngroup small"><button id="wPedL">+ Fixed BBF left</button><button id="wPedR">+ Fixed BBF right</button><button id="wPedM">+ Mobile</button></div></div>
      <div class="sec">Parts for this worksurface</div>
      <div class="bomlist">${lines.map(l => `<div class="r"><span class="sn">${esc(l.style)}</span><span class="d">${esc(l.desc)}${l.spec ? ' · ' + esc(l.spec) : ''}${l.flags.map(f => `<div class="msg warn" style="margin:4px 0">${esc(f)}</div>`).join('')}${contentsHTML(l.contents)}${l.notes.map(f => `<div class="muted">${esc(f)}</div>`).join('')}</span><span class="q">${l.qty}</span></div>`).join('') || '<div class="muted">none</div>'}</div>
      <div class="control" style="margin-top:12px"><button class="btn danger" id="wDel">Delete worksurface</button></div></div>`;
    r.innerHTML = linkPages(r.innerHTML);
    $('#xClose').onclick = () => { selWs = null; selPed = null; refresh(); };
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onchange = fn; };
    on('wWidth', e => { const w = +e.target.value; if (!tryWs(ws, () => { ws.width = w; ws.off = snapWsOff(ws, ws.off).off; }, `Now ${w}"W.`)) refresh(); });
    $$('#wDepth button').forEach(b => b.onclick = () => setStraightDepth(ws, +b.dataset.d));
    const slide = (dir) => mutate(() => { const run = E.runOf(P, ws.panel); const step = (ws.side === 0 ? 1 : -1) * dir * 6; const al = E.runEndAllow(P, run); ws.off = Math.max(-al.lo - run.panels.find(x => x.id === ws.panel).from, ws.off + step); ws.off = snapWsOff(ws, ws.off).off; });
    const bl = $('#wLeft'); if (bl) bl.onclick = () => slide(-1); const br = $('#wRight'); if (br) br.onclick = () => slide(1); const bf = $('#wFlip'); if (bf) bf.onclick = () => tryWs(ws, () => { ws.side = 1 - ws.side; }, 'Moved to the other side of the panel.');
    on('wSize', e => { const z = sizes[+e.target.value]; if (!tryWs(ws, () => setCornerSize(ws, z), `Now ${sizeName(ws, z)} (${z.style}).`)) refresh(); });
    $$('#wMat button').forEach(b => b.onclick = () => mutate(() => { ws.material = b.dataset.m; if (ws.material === 'wood') { ws.edge = 'SW'; ws.construction = 'cord-drop'; } else if (ws.edge === 'SW') ws.edge = '3mm'; }));
    on('wEdge', e => mutate(() => ws.edge = e.target.value));
    on('wCon', e => { if (!changeConstruction(ws, e.target.value)) refresh(); });
    on('wOpen', e => mutate(() => ws.options.openLine = e.target.checked)); on('wFull', e => mutate(() => ws.options.fullFill = e.target.checked)); on('wScallop', e => mutate(() => ws.options.omitScallop = e.target.checked));
    $$('[data-sup]', r).forEach(s => s.onchange = () => mutate(() => ws.supports[s.dataset.sup] = s.value));
    $$('[data-ped]', r).forEach(row => { const pd = () => ws.peds.find(x => x.id === row.dataset.ped); const d = pd(); $$('select', row).forEach(s => s.onchange = () => mutate(() => { const d = pd(); d[s.dataset.f] = s.value; if (d.type === 'fixed' && d.config === 'C') d.config = 'A'; })); $('[data-f="del"]', row).onclick = () => mutate(() => E.removePedestal(P, ws, d.id)); });
    $$('[data-pedpull]', r).forEach(s => s.onchange = () => mutate(() => { const d = ws.peds.find(x => x.id === s.dataset.pedpull); d.pull = s.value; const cols = E.pullColors(d.pull); if (!cols.some(([c]) => c === d.pullColor)) d.pullColor = cols[0][0]; })); // c:scape pulls are painted, the others plated (p274)
    $$('[data-pedcolor]', r).forEach(s => s.onchange = () => mutate(() => ws.peds.find(x => x.id === s.dataset.pedcolor).pullColor = s.value));
    $('#wPedL').onclick = () => addPed(ws, { at: ek.left, type: 'fixed', config: 'A' }); $('#wPedR').onclick = () => addPed(ws, { at: ek.right, type: 'fixed', config: 'A' });
    $('#wPedM').onclick = () => { const at = [ek.right, ek.left].find(k => !ws.peds.some(d => d.at === k)); if (!at) { toast('Both ends already have a pedestal. Delete one, or change it to mobile from its menu.'); return; } addPed(ws, { at, type: 'mobile', config: 'A' }); };
    $('#wDel').onclick = () => mutate(() => { E.removeWorksurface(P, ws.id); selWs = null; });
  }

  // ---------- finishes drawer ----------
  const PAINTHEX = { 4242: '#f1eee5', 7207: '#232323', 7225: '#c8bda6', 7230: '#6e6a63', 7236: '#b8bbbf', 7237: '#586069', 7238: '#8a8071', 7239: '#24282f', 7241: '#f6f6f4', 7243: '#d8d8d5', 7278: '#4a3c2f', 7360: '#8b8780', 4728: '#a9aaac', 4743: '#8e9090', 4744: '#d9d7d1', 4750: '#c9b99b', 4752: '#7d8389', 4788: '#b39c6b', 4798: '#b8babc', 4799: '#c4c5c5', 4803: '#2c2d2f', 7245: '#3d4044', 7246: '#272b34', 4140: '#f7f7f7', 4144: '#111' };
  function openFinishes() { renderFinishes(); $('#finishes').classList.add('on'); $('#scrim').classList.add('on'); }
  function closeFinishes() { $('#finishes').classList.remove('on'); $('#scrim').classList.remove('on'); }
  $('#bGuide').onclick = () => openGuide(1); $('#bCloseGuide').onclick = () => { $('#guide').classList.remove('on'); $('#guideFrame').src = 'about:blank'; }; $('#guideGo').onclick = () => openGuide(+$('#guidePage').value || 1); $('#guidePage').onkeydown = e => { if (e.key === 'Enter') openGuide(+$('#guidePage').value || 1); };
  $('#bFinishes').onclick = openFinishes; $('#bCloseFinishes').onclick = closeFinishes; $('#scrim').onclick = closeFinishes;
  function swatches(list, cur, attr) { return `<div class="swatches">${list.map(p => `<button class="sw${p.code === cur ? ' on' : ''}" data-${attr}="${p.code}"><div class="chip" style="background:${PAINTHEX[p.code] || '#ddd'}"></div><span class="grp">gr ${p.group}</span><div class="nm">${esc(p.name)}</div><div class="cd">${p.code}</div></button>`).join('')}</div>`; }
  let fabricQuery = '';
  function renderFinishes() {
    const F = P.finishes, thin = P.trim === 'thin';
    const trimPaints = E.paints('Panel trim components'); const steelPaints = E.paints('Steel skins and technology skins');
    const fabrics = E.fabrics().filter(f => f.code && f.group && f.group !== 'n/a' && (!fabricQuery || (f.code + ' ' + (f.collection || '') + ' ' + f.name).toLowerCase().includes(fabricQuery)));
    $('#finishBody').innerHTML = `
      <div class="sec">Trim paint (junction trim, caps, top caps, base trims)</div>
      <div class="muted">Colors the guide lists for Answer panel trim. Swatch colors are approximate. Price groups 2 and 3 add cost per part.</div>
      ${swatches(trimPaints, F.trimPaint.code, 'paint')}
      <label class="check" style="margin-top:10px"><input type="checkbox" id="fWoodTrim"${F.woodTrim ? ' checked' : ''}>${thin ? 'Wood veneer trims and junction caps instead of paint' : 'Wood veneer junction caps'}</label>
      ${!thin ? `<div class="control"><label>Oval trim face</label><select id="fOvalTrim"><option value="paint"${!F.ovalTrimFabric && !F.ovalWoodTrim ? ' selected' : ''}>Painted (standard)</option><option value="fabric"${F.ovalTrimFabric ? ' selected' : ''}>Fabric-wrapped</option><option value="wood"${F.ovalWoodTrim ? ' selected' : ''}>Wood (needs wood caps)</option></select></div><div class="control"><label>Plastic junction caps</label><select id="fOvalCap">${E.ovalPlastics().map(o => `<option value="${o.code}"${o.code === (F.ovalCap || {}).code ? ' selected' : ''}>${o.code} ${esc(o.name)}</option>`).join('')}</select></div><div class="control"><label>Change-of-height trim</label><select id="fOvalProfile"><option${P.options.ovalCohProfile === 'Slim Profile' ? ' selected' : ''}>Slim Profile</option><option${P.options.ovalCohProfile === 'Cable-Routing Capability' ? ' selected' : ''}>Cable-Routing Capability</option></select></div>` : ''}
      <div class="control"><label>Wood veneer</label><select id="fWood">${E.woods().map(w => `<option value="${w.code}"${w.code === F.wood.code ? ' selected' : ''}>${w.code} ${esc(w.name)} ${w.prefix ? esc(w.prefix) : ''}${w.group > 1 ? ' · premium group ' + w.group : ''}</option>`).join('')}</select></div>
      <div class="sec">Skins</div>
      <div class="control"><label>Default skin</label><select id="fSkinType">${SKIN_TYPES.filter(t => t !== 'slatwall' && t !== 'technology').map(t => `<option value="${t}"${F.skinType === t ? ' selected' : ''}>${SKIN_LABEL[t]}</option>`).join('')}</select></div>
      <div class="control"><label>Fabric</label><input type="text" id="fFabricQ" placeholder="Search by code or name" value="${esc(fabricQuery)}" style="flex:1"></div>
      <div class="muted">Selected: <b>${esc(F.fabric.code)} ${esc(F.fabric.name)}</b> · price group ${esc(F.fabric.group)}</div>
      <div class="fabriclist">${fabrics.map(f => `<div data-fab="${f.code}" class="${f.code === F.fabric.code ? 'on' : ''}"><span class="cd">${f.code}</span><span>${esc((f.collection ? f.collection + ' · ' : '') + f.name)}</span><span class="grp">group ${f.group}</span></div>`).join('') || '<div>No match</div>'}</div>
      <div class="control"><label>Fabric direction</label><div class="seg" id="fDir"><button data-d="horizontal" class="${F.fabricDirection === 'horizontal' ? 'on' : ''}">Horizontal (standard)</button><button data-d="vertical" class="${F.fabricDirection === 'vertical' ? 'on' : ''}">Vertical</button></div></div>
      <div class="sec">Steel skin paint</div>${swatches(steelPaints.length ? steelPaints : E.allPaints(), F.steelPaint.code, 'steel')}
      <div class="control" style="margin-top:10px"><label>Laminate</label><select id="fLam">${E.laminates().filter(l => l.code).map(l => `<option value="${l.code}"${l.code === F.laminate.code ? ' selected' : ''}>${l.code} ${esc(l.name)} · ${esc(l.family || '')}</option>`).join('')}</select></div>
      <div class="control"><label>Worksurface edge</label><select id="fEdge">${E.edges().map(e => `<option value="${e.code}"${e.code === (F.edge || {}).code ? ' selected' : ''}>${e.code} ${esc(e.name)}</option>`).join('')}</select></div>
      <div class="muted">Plastic front edge on laminate worksurfaces (p506, p711). The guide recommends an edge color for each laminate on p716-717, e.g. 6009 Arctic White with 2730 Arctic White.</div>
      <div class="sec">Electrical</div>
      <div class="control"><label>Wiring schematic</label><select id="pSchem"><option value="X"${P.power.schematic === 'X' ? ' selected' : ''}>4-circuit, 3+1</option><option value="Y"${P.power.schematic === 'Y' ? ' selected' : ''}>4-circuit, 2+2</option><option value="Z"${P.power.schematic === 'Z' ? ' selected' : ''}>3-circuit, separate neutrals</option></select></div>
      <div class="control"><label>Harness material</label><select id="pPvc"><option value="0"${!P.power.nonPvc ? ' selected' : ''}>PVC (standard)</option><option value="1"${P.power.nonPvc ? ' selected' : ''}>Non-PVC (LEED)</option></select></div>
      <div class="control"><label>Receptacles</label><select id="pAmps"><option value="15"${P.power.receptacleAmps === 15 ? ' selected' : ''}>15 A</option><option value="20"${P.power.receptacleAmps === 20 ? ' selected' : ''}>20 A</option></select><select id="pGround"><option${P.power.ground === 'System Ground' ? ' selected' : ''}>System Ground</option><option${P.power.ground === 'Isolated Ground' ? ' selected' : ''}>Isolated Ground</option></select></div>
      <div class="control"><label>Receptacle plastic</label><select id="fPlastic">${(E.product('wc-duplex-receptacle').options || []).filter(o => o.code.startsWith('color')).map(o => `<option value="${o.code.slice(5)}"${o.code.slice(5) === F.plasticColor ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
      <div class="sec">Ordering rules</div>
      <label class="check"><input type="checkbox" id="oPack"${P.options.usePanelPackages ? ' checked' : ''}>Use panel packages when a panel is two plain fabric skins (42–66" high)</label>
      <label class="check"><input type="checkbox" id="oCoh"${P.options.cohTopCapAuto !== false ? ' checked' : ''}>Add change-of-height top cap options automatically</label>
      <label class="check"><input type="checkbox" id="oGlide"${P.options.includeGlideCaps ? ' checked' : ''}>Add gripper glide caps (thin trim, packs of 10)</label>
      <div class="sec">SIF export</div>
      <div class="muted">Codes written to every SIF record. Match them to what your CAP or dealer system uses for Steelcase Answer.</div>
      <div class="fields2"><div class="field"><label>Manufacturer code (MC)</label><input type="text" id="sifMC" maxlength="5" value="${esc(P.job.sifMC || 'STEEL')}"></div><div class="field"><label>Catalog code (CT)</label><input type="text" id="sifCT" maxlength="12" value="${esc(P.job.sifCT || 'ANSWER')}"></div></div>
      <div class="muted" style="margin-top:12px">Prices are U.S. list from the February 2015 Answer specification guide (price list 180.F). Confirm current pricing with Steelcase.</div>`;
    const upd = (fn) => { mutate(fn); renderFinishes(); };
    $$('[data-paint]', $('#finishBody')).forEach(b => b.onclick = () => upd(() => { const p = E.allPaints().find(x => x.code === b.dataset.paint); P.finishes.trimPaint = { code: p.code, name: p.name, group: p.group || 1 }; }));
    $$('[data-steel]', $('#finishBody')).forEach(b => b.onclick = () => upd(() => { const p = E.allPaints().find(x => x.code === b.dataset.steel); P.finishes.steelPaint = { code: p.code, name: p.name, group: p.group || 1 }; }));
    $('#fWoodTrim').onchange = e => upd(() => P.finishes.woodTrim = e.target.checked);
    const ov = $('#fOvalTrim'); if (ov) ov.onchange = e => upd(() => { P.finishes.ovalTrimFabric = e.target.value === 'fabric'; P.finishes.ovalWoodTrim = e.target.value === 'wood'; if (e.target.value === 'wood') P.finishes.woodTrim = true; });
    const op = $('#fOvalProfile'); if (op) op.onchange = e => upd(() => P.options.ovalCohProfile = e.target.value);
    $('#fWood').onchange = e => upd(() => { const w = E.woods().find(x => x.code === e.target.value); P.finishes.wood = { code: w.code, name: w.name, cut: w.cut, group: w.group || 1 }; });
    $('#fSkinType').onchange = e => upd(() => P.finishes.skinType = e.target.value);
    $('#fFabricQ').oninput = e => { fabricQuery = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; renderFinishes(); const q = $('#fFabricQ'); q.focus(); q.setSelectionRange(pos, pos); };
    $$('[data-fab]', $('#finishBody')).forEach(d => d.onclick = () => upd(() => { const f = E.fabrics().find(x => x.code === d.dataset.fab); P.finishes.fabric = { code: f.code, name: (f.collection ? f.collection + ' ' : '') + f.name, group: f.group }; }));
    $$('#fDir button').forEach(b => b.onclick = () => upd(() => P.finishes.fabricDirection = b.dataset.d));
    $('#fEdge').onchange = e => upd(() => { const x = E.edges().find(y => y.code === e.target.value); P.finishes.edge = { code: x.code, name: x.name }; });
    { const oc = $('#fOvalCap'); if (oc) oc.onchange = e => upd(() => { const x = E.ovalPlastics().find(y => y.code === e.target.value); P.finishes.ovalCap = { code: x.code, name: x.name }; }); }
    $('#fLam').onchange = e => upd(() => { const l = E.laminates().find(x => x.code === e.target.value); P.finishes.laminate = { code: l.code, name: l.name }; });
    $('#pSchem').onchange = e => upd(() => P.power.schematic = e.target.value); $('#pPvc').onchange = e => upd(() => P.power.nonPvc = e.target.value === '1'); $('#pAmps').onchange = e => upd(() => P.power.receptacleAmps = +e.target.value); $('#pGround').onchange = e => upd(() => P.power.ground = e.target.value); $('#fPlastic').onchange = e => upd(() => P.finishes.plasticColor = e.target.value);
    $('#sifMC').onchange = e => mutate(() => P.job.sifMC = e.target.value.trim().toUpperCase().slice(0, 5)); $('#sifCT').onchange = e => mutate(() => P.job.sifCT = e.target.value.trim().toUpperCase());
    $('#oPack').onchange = e => upd(() => P.options.usePanelPackages = e.target.checked); $('#oCoh').onchange = e => upd(() => P.options.cohTopCapAuto = e.target.checked); $('#oGlide').onchange = e => upd(() => P.options.includeGlideCaps = e.target.checked);
  }

  // ---------- typicals ----------
  const TYPICALS = [
    { name: 'L workstation 6×6', ds: '66" spine with glass, 54" returns', build: () => { const T = E.newProject(P.trim); let n = E.addNode(T, 0, 0); const o = n; for (const w of [36, 36]) { const q = E.addPanel(T, n, 0, w, 66); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [0, 0], infeed: null }; if (T.trim === 'thin') q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; n = T.nodes[q.b]; } const r1 = E.addPanel(T, o, 270, 36, 54); E.addPanel(T, T.nodes[r1.b], 270, 36, 54); return T; } },
    { name: 'U workstation 6×8', ds: '66" back wall with glass, 54" sides', build: () => { const T = E.newProject(P.trim); const o = E.addNode(T, 0, 0); let n = o; for (const w of [48, 48]) { const q = E.addPanel(T, n, 0, w, 66); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [1, 1], infeed: null }; if (T.trim === 'thin') q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; n = T.nodes[q.b]; } for (const start of [o, n]) { let m = start; for (const w of [36, 36]) { const q = E.addPanel(T, m, 270, w, 54); m = T.nodes[q.b]; } } return T; } },
    { name: 'Spine with fins', ds: '78" spine, 54" fins both sides', build: () => { const T = E.newProject(P.trim); let n = E.addNode(T, 0, 0); const nodes = [n]; for (let i = 0; i < 3; i++) { const q = E.addPanel(T, n, 0, 60, 78); q.power = { kind: i % 2 ? 'passthrough' : 'powerkit', location: 'base', receptacles: [2, 2], usb: [0, 0], infeed: null }; q.sides = [[{ kind: 'skin', type: 'tackable acoustical', height: 48 }, { kind: 'skin', type: 'steel', height: 12 }, { kind: 'window', height: 12, pane: 'single' }], [{ kind: 'skin', type: 'tackable acoustical', height: 48 }, { kind: 'skin', type: 'steel', height: 12 }, { kind: 'window', height: 12, pane: 'single' }]]; n = T.nodes[q.b]; nodes.push(n); } for (const i of [1, 2]) { E.addPanel(T, nodes[i], 90, 72, 54); E.addPanel(T, nodes[i], 270, 72, 54); } return T; } },
    { name: 'Benching divider', ds: '42" run with 12" frosted frameless glass', build: () => { const T = E.newProject(P.trim); let n = E.addNode(T, 0, 0); for (const w of [60, 60, 60]) { const q = E.addPanel(T, n, 0, w, 42); if (T.trim === 'thin') q.glassScreen = { attach: 'recessed', height: 12, frosted: true, omitGlass: false }; else E.setStack(T, q, [12]); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [1, 1], infeed: null }; n = T.nodes[q.b]; } return T; } },
    { name: '120° pod', ds: 'Three 48" panels at a Y junction', build: () => { const T = E.newProject(P.trim); const c = E.addNode(T, 0, 0); for (const a of [90, 210, 330]) { const q = E.addPanel(T, c, a, 48, 48); E.addPanel(T, T.nodes[q.b], a + 60, 30, 48); } return T; } },
    { name: 'L workstation 6×6, furnished', ws: true, ds: '66" spine, 54" return, 42" corner worksurface on 42" panels, 30"W × 24"D runs, BBF pedestal', build: () => { const T = E.newProject(P.trim); let n = E.addNode(T, 0, 0); const o = n; const spine = []; for (const w of [42, 30]) { const q = E.addPanel(T, n, 0, w, 66); spine.push(q); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [0, 0], infeed: null }; if (T.trim === 'thin') q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; n = T.nodes[q.b]; } const r1 = E.addPanel(T, o, 270, 42, 54); const r2 = E.addPanel(T, T.nodes[r1.b], 270, 30, 54);
        E.newWorksurface(T, { kind: 'corner', node: o.id, legs: [r1.id, spine[0].id], C: 42, D: 42, depthA: 24, depthB: 24, supports: { arm0: 'auto', arm1: 'auto' } });
        const w1 = E.newWorksurface(T, { kind: 'straight', panel: spine[1].id, side: 0, off: 0, width: 30, depth: 24 }); E.addPedestal(T, w1, { at: 'hi', type: 'fixed', config: 'A' });
        E.newWorksurface(T, { kind: 'straight', panel: r2.id, side: 1, off: 0, width: 30, depth: 24 }); return T; } },
    { name: 'U workstation 8×8, furnished', ws: true, ds: '66" back wall, 54" sides, two 48" corners sharing the center seam, 48"W × 24"D side runs, BBF and FF pedestals', build: () => { const T = E.newProject(P.trim); const o = E.addNode(T, 0, 0); let n = o; const back = []; for (const w of [48, 48]) { const q = E.addPanel(T, n, 0, w, 66); back.push(q); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [1, 1], infeed: null }; if (T.trim === 'thin') q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; n = T.nodes[q.b]; } const sides = []; for (const start of [o, n]) { let m = start; const first = []; for (const w of [48, 48]) { const q = E.addPanel(T, m, 270, w, 54); first.push(q); m = T.nodes[q.b]; } sides.push(first); }
        E.newWorksurface(T, { kind: 'corner', node: o.id, legs: [sides[0][0].id, back[0].id], C: 48, D: 48, depthA: 24, depthB: 24, supports: { arm0: 'auto', arm1: 'auto' } });
        E.newWorksurface(T, { kind: 'corner', node: n.id, legs: [back[1].id, sides[1][0].id], C: 48, D: 48, depthA: 24, depthB: 24, supports: { arm0: 'auto', arm1: 'auto' } });
        const wl = E.newWorksurface(T, { kind: 'straight', panel: sides[0][1].id, side: 1, off: 0, width: 48, depth: 24 }); E.addPedestal(T, wl, { at: 'hi', type: 'fixed', config: 'A' });
        const wr = E.newWorksurface(T, { kind: 'straight', panel: sides[1][1].id, side: 0, off: 0, width: 48, depth: 24 }); E.addPedestal(T, wr, { at: 'hi', type: 'fixed', config: 'B' });
        return T; } },
    { name: '120° pod, furnished', ws: true, ds: 'Three 120° corner worksurfaces 48×48 on a Y junction of 48" panels with 30" panels in line, mobile pedestals', build: () => { const T = E.newProject(P.trim); const c = E.addNode(T, 0, 0); const first = []; for (const a of [90, 210, 330]) { const q = E.addPanel(T, c, a, 48, 48); first.push(q); E.addPanel(T, T.nodes[q.b], a, 30, 48); } for (let i = 0; i < 3; i++) { const w = E.newWorksurface(T, { kind: 'corner120', node: c.id, legs: [first[i].id, first[(i + 1) % 3].id], C: 48, D: 48, depthA: 24, depthB: 24, supports: { arm0: 'auto', arm1: 'auto' } }); E.addPedestal(T, w, { at: 'arm0', type: 'mobile', config: 'A' }); } return T; } },
    { name: 'Private office front', ds: '66" run with 12" frameless glass', build: () => { const T = E.newProject(P.trim); let n = E.addNode(T, 0, 0); for (const w of [48, 48, 36]) { const q = E.addPanel(T, n, 0, w, 66); if (T.trim === 'thin') q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; else E.setStack(T, q, [12]); n = T.nodes[q.b]; } return T; } },
  ];
  // every powered typical comes with its building power-in: a 6' base power infeed on the first powerkit of each circuit run
  // (p158, p480). The infeed takes one receptacle location, so a full powerkit gives up one USB or receptacle on side B for it.
  function withInfeeds(T) {
    for (const run of E.powerRuns(T)) {
      const ps = run.map(id => T.panels[id]); if (ps.some(q => q.power.infeed)) continue;
      const q = ps.find(x => x.power.kind === 'powerkit' && x.power.location === 'base' && !x.openBase); if (!q) continue;
      const per = E.powerBlocksPerSide(q.width); for (const sd of [0, 1]) { q.power.receptacles[sd] = Math.min(per, q.power.receptacles[sd] | 0); q.power.usb[sd] = Math.min(per - q.power.receptacles[sd], q.power.usb[sd] | 0); } // what the powerkit really holds
      const used = () => q.power.receptacles[0] + q.power.receptacles[1] + q.power.usb[0] + q.power.usb[1];
      if (used() + 1 > 2 * per) { if (q.power.usb[1]) q.power.usb[1]--; else if (q.power.receptacles[1]) q.power.receptacles[1]--; }
      q.power.infeed = { length: 6 };
    }
    return T;
  }
  for (const t of TYPICALS) { const b = t.build; t.build = () => withInfeeds(b()); }
  // the guide's own worked examples (thin trim build-your-own pages), placed as 36"W panels on one junction so the parts list can be compared line for line.
  // p35-p37 draw the options without heights; these heights reproduce the exact trims each option lists.
  const gx = (legs, stacks) => () => { const T = E.newProject('thin'); const c = E.addNode(T, 0, 0); for (const [a, h] of legs) { const q = E.addPanel(T, c, a, 36, h); if (stacks && stacks[a]) E.setStack(T, q, stacks[a]); } return T; };
  const X4 = (a, b, c, d) => gx([[0, a], [90, b], [180, c], [270, d]]);
  TYPICALS.push(...[
    ['p38 Example One', 'X change of height, four heights: A 66, B 54, C 42, D 30', X4(66, 54, 42, 30)],
    ['p38 Example Two', 'X change of height, three heights: A 54, B 54, C 42, D 30', X4(54, 54, 42, 30)],
    ['p38 Example Three', 'Y change of height: A 54, B 42, C 30', gx([[0, 54], [120, 42], [240, 30]])],
    ['p35 T Option 1', 'T change of height: 66/54 in line, 42 leg', gx([[0, 66], [90, 42], [180, 54]])],
    ['p35 T Option 2', 'T change of height: 66/42 in line, 54 leg', gx([[0, 66], [90, 54], [180, 42]])],
    ['p35 T Option 3', 'T change of height: 54/42 in line, 66 leg', gx([[0, 54], [90, 66], [180, 42]])],
    ['p35 Y Option 1', 'Y change of height: 66, 54, 42', gx([[0, 66], [120, 54], [240, 42]])],
    ['p36 X Option 1', 'X change of height: two 66 opposite, 54 and 42', X4(54, 66, 42, 66)],
    ['p36 X Option 2', 'X change of height: two 66 adjacent, 54 and 42', X4(42, 54, 66, 66)],
    ['p36 X Option 3', 'X change of height: 66, two 54 adjacent, 42', X4(42, 54, 54, 66)],
    ['p36 X Option 4', 'X change of height: 66, two 54 opposite, 42', X4(42, 54, 66, 54)],
    ['p36 X Option 5', 'X change of height: 66, 54, two 42 adjacent', X4(42, 42, 54, 66)],
    ['p36 X Option 6', 'X change of height: 66, 54, two 42 opposite', X4(42, 54, 42, 66)],
    ['p37 X Option 7', 'X change of height, four heights in turn: 30, 42, 54, 66', X4(30, 42, 54, 66)],
    ['p37 X Option 8', 'X change of height, four heights: 66 opposite 54, 42 opposite 30', X4(66, 42, 54, 30)],
    ['p41 Steps 5–6', 'In-line stacking: two 42" panels stacked 24" and 12"', gx([[180, 42], [0, 42]], { 180: [24], 0: [12] })],
    ['p41 Step 7, left', 'T 42: both in-line panels stacked 12"', gx([[0, 42], [90, 42], [180, 42]], { 0: [12], 180: [12] })],
    ['p41 Step 7, right', 'T 42: two adjacent panels stacked 12"', gx([[0, 42], [90, 42], [180, 42]], { 0: [12], 90: [12] })],
  ].map(([name, ds, build]) => ({ name, ds: ds + ` · thin trim · compare with the parts list on ${name.split(' ')[0]}`, build, guide: +name.slice(1).split(' ')[0] })));
  function renderTypicals(furnished) {
    const list = TYPICALS.map((t, i) => ({ t, i })).filter(x => !furnished || x.t.ws);
    const card = ({ t, i }) => `<div class="typ" data-t="${i}"><canvas></canvas><div class="nm">${esc(t.name)}</div><div class="ds">${esc(t.ds)}</div></div>`;
    $('#typicalGrid').innerHTML = list.filter(x => !x.t.guide).map(card).join('') + (list.some(x => x.t.guide) ? '<div class="typgroup">Guide worked examples — Build Your Own, thin trim (p35–p41)</div>' + list.filter(x => x.t.guide).map(card).join('') : '');
    $$('.typ').forEach((el) => { const i = +el.dataset.t; const T = TYPICALS[i].build(); const c = el.querySelector('canvas'); c.width = 300; c.height = 170; const cx = c.getContext('2d'); const ns = Object.values(T.nodes); const wsPts = Object.values(T.worksurfaces || {}).flatMap(w => { const g = E.wsGeometry(T, w); return g ? g.poly.map(q => ({ x: q[0], y: q[1] })) : []; }); const all = [...ns, ...wsPts]; const xs = all.map(n => n.x), ys = all.map(n => n.y); const mnx = Math.min(...xs) - 12, mxx = Math.max(...xs) + 12, mny = Math.min(...ys) - 12, mxy = Math.max(...ys) + 12; const s = Math.min(280 / (mxx - mnx), 150 / (mxy - mny)); const ox = 150 - (mnx + mxx) / 2 * s, oy = 85 + (mny + mxy) / 2 * s; for (const w of Object.values(T.worksurfaces || {})) { const g = E.wsGeometry(T, w); if (!g) continue; cx.beginPath(); g.poly.forEach((q, k) => k ? cx.lineTo(ox + q[0] * s, oy - q[1] * s) : cx.moveTo(ox + q[0] * s, oy - q[1] * s)); cx.closePath(); cx.fillStyle = WSFILL; cx.fill(); cx.strokeStyle = WSLINE; cx.lineWidth = 1; cx.stroke(); for (const d of w.peds || []) { const rr = pedRect(w, g, d); cx.beginPath(); rr.forEach((q, k) => k ? cx.lineTo(ox + q[0] * s, oy - q[1] * s) : cx.moveTo(ox + q[0] * s, oy - q[1] * s)); cx.closePath(); cx.fillStyle = '#dcd5c8'; cx.fill(); cx.stroke(); } } const tIn = (n) => { const J = E.junction(T, n); return ['inline', 'EOR', 'wall'].includes(J.type) ? JW / 2 : E.junctionReach(T.trim, J.type).in; }; for (const p of Object.values(T.panels)) { const a = T.nodes[p.a], b = T.nodes[p.b]; const an = Math.atan2(b.y - a.y, b.x - a.x), ia = tIn(a), ib = tIn(b); cx.lineWidth = Math.max(3, 3 * s); cx.strokeStyle = HCOL[p.height]; cx.lineCap = 'butt'; cx.beginPath(); cx.moveTo(ox + (a.x + Math.cos(an) * ia) * s, oy - (a.y + Math.sin(an) * ia) * s); cx.lineTo(ox + (b.x - Math.cos(an) * ib) * s, oy - (b.y - Math.sin(an) * ib) * s); cx.stroke(); cx.lineWidth = 1; cx.strokeStyle = '#424244'; cx.stroke(); } for (const n of Object.values(T.nodes)) { const hp = Math.max(2, JW / 2 * s); cx.fillStyle = '#d4d4d7'; cx.fillRect(ox + n.x * s - hp, oy - n.y * s - hp, 2 * hp, 2 * hp); cx.strokeStyle = '#424244'; cx.strokeRect(ox + n.x * s - hp, oy - n.y * s - hp, 2 * hp, 2 * hp); } el.onclick = () => { $('#typicals').classList.remove('on'); setTool('select'); if (placeAt) { const at = placeAt; placeAt = null; if (placeTypical(T, at)) toast(TYPICALS[i].name + ' placed' + (TYPICALS[i].guide ? (P.trim === 'thin' ? `. Compare its junction parts with p${TYPICALS[i].guide} (click the junction, or open the Specification).` : `. This example is from the thin trim pages; switch the job to thin trim to compare with p${TYPICALS[i].guide}.`) : '')); return; } placing = { T, ghost: null }; plan.className = 'place'; toast('Click on the plan to place ' + TYPICALS[i].name); }; });
  }
  $('#bTypicals').onclick = () => { placeAt = null; renderTypicals(); $('#typicals').classList.add('on'); }; $('#bCloseTypicals').onclick = () => $('#typicals').classList.remove('on');
  function placeTypical(T, at) {
    const ns = Object.values(T.nodes); const mnx = Math.min(...ns.map(n => n.x)), mxy = Math.max(...ns.map(n => n.y));
    const ok = guardedMutate(() => { const map = {}; const ox = snapW(at[0]) - mnx, oy = snapW(at[1]) - mxy; for (const n of ns) { const x = Math.round((n.x + ox) * 1000) / 1000, y = Math.round((n.y + oy) * 1000) / 1000; map[n.id] = (E.nodeAt(P, x, y, 1) || E.addNode(P, x, y)).id; } const ids = []; const pmap = {}; for (const p of Object.values(T.panels)) { const q = E.newPanel(P, map[p.a], map[p.b], p.width, p.height); copyPanelSettings(p, q); if (p.power && p.power.infeed) q.power.infeed = Object.assign({}, p.power.infeed); ids.push(q.id); pmap[p.id] = q.id; } for (const w of Object.values(T.worksurfaces || {})) { const spec = JSON.parse(JSON.stringify(w)); delete spec.id; delete spec._resolved; if (spec.panel) spec.panel = pmap[spec.panel]; if (spec.node) spec.node = map[spec.node]; if (spec.legs) spec.legs = spec.legs.map(x => pmap[x]); const nw = E.newWorksurface(P, spec); nw.peds = (w.peds || []).map(d => Object.assign({}, d, { id: 'D' + (P.seq++) })); } sel = new Set(ids); selNode = null; selWs = null; }, 'Typical not placed');
    if (ok) { placing = null; plan.className = ''; } else { placing = { T }; plan.className = 'place'; } // refused: pick another spot
    return ok;
  }

  // ---------- sourcing helpers ----------
  const SRC = { buy: 'Buy new', refurbish: 'Refurbish', stock: 'Stock' };
  function srcOf(l) { return E.sourcingOf(P, l); }
  function setSrc(l, v) { P.sourcing.byKey = P.sourcing.byKey || {}; P.sourcing.byKey[E.lineKey(l)] = v; }
  const CATS = ['Junction', 'Stacking', 'Trim', 'Panel', 'Frame', 'Skins', 'Glass', 'Power', 'Accessories', 'Worksurface', 'Supports', 'Storage'];
  const catOrder = (c) => { const i = CATS.indexOf(c); return i < 0 ? 99 : i; };
  let wsCache = null; const wsList = () => wsCache || (wsCache = E.workstations(P));
  function areaOf(src) { const c = E.workstationOf(P, src, wsList()); return c ? c.name : (src === 'manual' ? 'Manual add-ons' : 'Job-wide'); }
  function inComp(c, l) { if (P.worksurfaces && P.worksurfaces[l.src]) return c.ws.includes(l.src); return c.panels.some(p => p.id === l.src) || c.nodes.includes(l.src); }
  function jobMeta() { return `${esc(P.name)}${P.job.number ? ' · Job ' + esc(P.job.number) : ''}${P.job.customer ? ' · ' + esc(P.job.customer) : ''}${P.job.planner ? ' · ' + esc(P.job.planner) : ''} · ${P.trim === 'thin' ? 'Thin trim' : 'Oval trim'} · ${new Date().toLocaleDateString('en-US')}`; }

  // ---------- SPEC ----------
  function renderSpec() {
    const grp = $('#specGroup').value, filt = $('#specSource').value;
    P.sourcing.byCat = P.sourcing.byCat || {};
    $('#specMeta').innerHTML = jobMeta();
    $('#sourcing').innerHTML = `<b>Where parts come from:</b> ` + CATS.filter(c => R.lines.some(l => l.cat === c)).map(c => `<label>${c} <select data-cat="${c}" class="src ${P.sourcing.byCat[c] || 'buy'}"><option value="buy"${(P.sourcing.byCat[c] || 'buy') === 'buy' ? ' selected' : ''}>Buy new</option><option value="refurbish"${P.sourcing.byCat[c] === 'refurbish' ? ' selected' : ''}>Refurbish</option><option value="stock"${P.sourcing.byCat[c] === 'stock' ? ' selected' : ''}>Stock</option></select></label>`).join('') + `<span class="muted">Set a default per category, then override any line. Refurbish lines become shop work orders. Buy-new lines make the purchase order.</span>`;
    $$('#sourcing select').forEach(s => s.onchange = () => mutate(() => { P.sourcing.byCat[s.dataset.cat] = s.value; }));
    const lines = R.lines.filter(l => filt === 'all' || srcOf(l) === filt).map(l => Object.assign({ area: areaOf(l.src) }, l));
    const areaRank = new Map(wsList().map((c, i) => [c.name, i])); const ar = (a) => areaRank.has(a) ? areaRank.get(a) : 1e6; // workstations in plan order, job-wide parts last
    lines.sort((a, b) => grp === 'cat' ? (catOrder(a.cat) - catOrder(b.cat) || a.style.localeCompare(b.style)) : (ar(a.area) - ar(b.area) || a.area.localeCompare(b.area) || catOrder(a.cat) - catOrder(b.cat)));
    const bySrc = { buy: 0, refurbish: 0, stock: 0 }; for (const l of R.lines) bySrc[srcOf(l)] += l.ext;
    let html = `<div class="totals"><div>Buy new (purchase order)<b>${money(bySrc.buy)}</b></div><div>Refurbish (list value)<b>${money(bySrc.refurbish)}</b></div><div>From stock (list value)<b>${money(bySrc.stock)}</b></div><div>All parts, U.S. list<b>${money(R.totals.all)}</b></div><div>Canadian list ×1.09<b>${money(R.totals.canadian)}</b></div></div>`;
    if (R.errors.length || R.warnings.length) html += `<div class="msg warn"><b>${R.errors.length} error${R.errors.length === 1 ? '' : 's'}, ${R.warnings.length} warning${R.warnings.length === 1 ? '' : 's'}</b> on the plan. ${[...R.errors, ...R.warnings].slice(0, 6).map(e => esc((e.panel || e.node ? (e.panel || e.node) + ': ' : '') + e.msg)).join(' · ')}</div>`;
    html += `<table class="t spec"><thead><tr><th>Source</th><th class="n">Qty</th><th>Style number</th><th>Description</th><th>Specify (finish and options)</th><th class="n">Unit</th><th class="n">Ext</th><th>Where</th><th>Page</th></tr></thead><tbody>`;
    let cur = null, sub = 0; const flush = () => { if (cur !== null) html += `<tr class="tot"><td colspan="6" style="text-align:right">${esc(cur)} subtotal</td><td class="n">${money(sub)}</td><td colspan="2"></td></tr>`; sub = 0; };
    for (const l of lines) { const g = grp === 'cat' ? l.cat : l.area; if (g !== cur) { flush(); cur = g; html += `<tr class="grp"><td colspan="9">${esc(g)}</td></tr>`; } sub += l.ext; const s = srcOf(l); html += `<tr><td><select class="src ${s}" data-k="${esc(E.lineKey(l))}"><option value="buy"${s === 'buy' ? ' selected' : ''}>Buy new</option><option value="refurbish"${s === 'refurbish' ? ' selected' : ''}>Refurbish</option><option value="stock"${s === 'stock' ? ' selected' : ''}>Stock</option></select></td><td class="n">${l.qty}</td><td class="sn">${esc(l.style)}</td><td>${esc(l.desc)}${contentsHTML(l.contents)}${l.flags.map(f => `<span class="flag${/CORRECTED/.test(f) ? ' red' : ''}">⚠ ${esc(f)}</span>`).join('')}${l.notes.map(n => `<span class="note">${esc(n)}</span>`).join('')}</td><td>${esc(l.spec)}</td><td class="n">${money(l.unit)}</td><td class="n">${money(l.ext)}</td><td>${esc(grp === 'cat' ? l.area + ' · ' + where(l.src) : where(l.src))}</td><td>p${l.page}</td></tr>`; }
    flush(); html += `<tr class="tot"><td colspan="6" style="text-align:right">Total U.S. list${filt !== 'all' ? ' (' + SRC[filt] + ')' : ''}</td><td class="n">${money(lines.reduce((a, l) => a + l.ext, 0))}</td><td colspan="2"></td></tr><tr class="tot"><td colspan="6" style="text-align:right">Canadian list ×1.09${filt !== 'all' ? ' (' + SRC[filt] + ')' : ''}</td><td class="n">${money(E.cadTotal(lines))}</td><td colspan="2"></td></tr></tbody></table>`;
    $('#specBody').innerHTML = linkPages(html);
    $$('#specBody select.src').forEach(s => s.onchange = () => mutate(() => { P.sourcing.byKey = P.sourcing.byKey || {}; P.sourcing.byKey[s.dataset.k] = s.value; }));
  }
  function contentsHTML(c) { return c && c.length ? `<span class="contains">${c.map(x => `<span>${x.qty}× ${esc(x.item)}</span>`).join('')}</span>` : ''; }
  function where(src) { return P.panels[src] ? pn(src) : P.nodes[src] ? jn(src) : P.worksurfaces && P.worksurfaces[src] ? E.wsName(P.worksurfaces[src]) : src === 'manual' ? 'Manual add-on' : 'Job-wide'; }
  $('#specGroup').onchange = renderSpec; $('#specSource').onchange = renderSpec;
  $('#bSpecCsv').onclick = () => { const filt = $('#specSource').value; const lines = R.lines.filter(l => filt === 'all' || srcOf(l) === filt); if (!lines.length) { toast('Nothing to export for that source'); return; } const cols = [{ label: 'Source', get: l => SRC[srcOf(l)] }, { label: 'Qty', key: 'qty' }, { label: 'Style Number', key: 'style' }, { label: 'Description', key: 'desc' }, { label: 'Specify', key: 'spec' }, { label: 'Unit US List', key: 'unit' }, { label: 'Ext US List', key: 'ext' }, { label: 'Ext CA List', get: l => E.cadOf(l) }, { label: 'Workstation', get: l => areaOf(l.src) }, { label: 'Where', get: l => where(l.src) }, { label: 'Guide Page', key: 'page' }, { label: 'Category', key: 'cat' }, { label: 'Contains', get: l => (l.contents || []).map(x => x.qty + 'x ' + x.item).join(' | ') }, { label: 'Flags', get: l => l.flags.join(' | ') }, { label: 'Notes', get: l => l.notes.join(' | ') }]; download(fileBase() + '_specification' + (filt !== 'all' ? '_' + filt : '') + '.csv', E.toCSV(lines, cols), 'text/csv'); toast(`CSV: ${lines.length} lines${filt !== 'all' ? ' (' + SRC[filt] + ')' : ''}`); };
  $('#bSpecSif').onclick = () => {
    const filt = $('#specSource').value, grp = $('#specGroup').value;
    const lines = R.lines.filter(l => filt === 'all' || srcOf(l) === filt);
    if (!lines.length) { toast('Nothing to export for that source'); return; }
    const title = [P.name, P.job.number ? 'Job ' + P.job.number : '', P.job.customer, P.trim === 'thin' ? 'Answer Thin trim' : 'Answer Oval trim', filt !== 'all' ? SRC[filt] : 'All sources'].filter(Boolean).join(' - ');
    const out = E.toSIF(lines, { mc: P.job.sifMC || 'STEEL', ct: P.job.sifCT || 'ANSWER', title, sf: `Generic SIF;Answer Panel Planner build ${BUILD};Created ${new Date().toLocaleDateString('en-US')}`, tagOf: grp === 'area' ? (l => areaOf(l.src)) : (l => P.job.number || P.name) });
    download(fileBase() + (filt !== 'all' ? '_' + filt : '') + '.sif', out.text, 'text/plain');
    toast(`SIF: ${out.records} records, ${out.pieces} pieces${grp === 'area' ? ', tagged by workstation' : ''}${out.skipped.length ? ` · ${out.skipped.length} line${out.skipped.length === 1 ? '' : 's'} without a style number left out` : ''}`);
  };
  // collapsible editor column (remembered per browser)
  function setRc(collapsed) { const st = $('#st-plan'); st.classList.toggle('collapsed', collapsed); { const t = $('#rcToggle'); t.textContent = collapsed ? '«' : '»'; t.title = collapsed ? `Show the editor: ${rcWhat || 'job'} (Tab)` : 'Hide the editor (Tab)'; t.setAttribute('aria-label', collapsed ? 'Show the editor' : 'Hide the editor'); } try { localStorage.setItem('answer.rc', collapsed ? '1' : '0'); } catch (e) { } sizeCanvases(); drawElev(); }
  $('#rcToggle').onclick = () => setRc(!$('#st-plan').classList.contains('collapsed'));
  try { if (localStorage.getItem('answer.rc') === '1') setRc(true); } catch (e) { }
  $('#bDxf').onclick = () => { if (!Object.keys(P.panels).length) { toast('Nothing on the plan yet'); return; } download(fileBase() + '_CAP.dxf', E.toCapDXF(P, R, { build: BUILD }), 'application/dxf'); toast(`DXF for CAP downloaded (AutoCAD 2000): ${R.lines.reduce((a, l) => a + (l.style !== '—' ? l.qty : 0), 0)} parts as CAP symbols with their style numbers from the Specification; in AutoCAD run the CAP extract to list them.`); };
  $('#bDxfPlain').onclick = () => { if (!Object.keys(P.panels).length) { toast('Nothing on the plan yet'); return; } download(fileBase() + '_plan.dxf', E.toDXF(P, R, { build: BUILD }), 'application/dxf'); toast('Plain DXF downloaded: inches, layers A-PANEL-<height>, A-JUNCTION, A-WORKSURFACE, A-PEDESTAL, A-TEXT'); };
  $('#bSpecPrint').onclick = () => printHTML(`<div class="psheet"><h1>Specification</h1><div class="meta">${jobMeta()}</div>${$('#specBody').innerHTML.replace(/<select[^>]*class="src (\w+)"[^>]*>[\s\S]*?<\/select>/g, (m, s) => `<span class="tag ${s}">${SRC[s]}</span>`)}</div>`);
  function fileBase() { return (P.name || 'job').replace(/[^\w\-]+/g, '_'); }

  // ---------- SHOP ----------
  function shopJobs() {
    const jobs = { upholstery: [], paint: [], build: [], cuts: [], inspect: [] };
    const skinH = (l) => { const rows = E.rowsByStyle(l.style); const r = rows[0]; return r && r.attrs ? (r.attrs.height || (r.attrs.height === undefined && r.attrs.width && /package/i.test(l.desc) ? null : null)) : null; };
    for (const l of R.lines) {
      const s = srcOf(l); if (s !== 'refurbish') continue;
      const rows = E.rowsByStyle(l.style); const r = rows[0] || { attrs: {} };
      const isPackage = l.pid && /panel-package/.test(l.pid); const n0 = jobs.upholstery.length + jobs.paint.length;
      if (/fabric/i.test(l.spec) && (l.cat === 'Skins' || isPackage)) {
        const fabric = (l.spec.match(/fabric ([^;]+)/i) || [])[1] || P.finishes.fabric.code + ' ' + P.finishes.fabric.name;
        const dir = /vertical/i.test(l.spec) ? 'vertical' : 'horizontal';
        if (isPackage) { const h = r.attrs.height - 6; const sides = [1, 2]; for (const sd of sides) { const fb = (l.spec.match(new RegExp('side ' + sd + ' fabric ([^;(]+)')) || [])[1] || fabric; jobs.upholstery.push({ key: E.lineKey(l) + '|s' + sd, qty: l.qty, style: l.style + ' (skin)', size: `${r.attrs.width}"W × ${h}"H`, fabric: fb.trim(), dir, where: `${areaOf(l.src)} · ${where(l.src)} · side ${sd === 1 ? 'A' : 'B'}`, note: 'Skin from panel package' }); } }
        else jobs.upholstery.push({ key: E.lineKey(l), qty: l.qty, style: l.style, size: `${r.attrs.width}"W × ${r.attrs.height}"H${r.attrs.toFloor ? ' to floor' : ''}`, fabric: fabric.trim(), dir, where: `${areaOf(l.src)} · ${where(l.src)}${/side (\d)/.test(l.desc) ? ' · side ' + (l.desc.match(/side (\d)/)[1] === '1' ? 'A' : 'B') : ''}`, note: '' });
      }
      if (/paint \d{4}/i.test(l.spec)) {
        const paint = (l.spec.match(/paint (\d{4} [^;,(]+)/i) || [])[1] || '';
        const what = l.cat === 'Supports' ? (/bracket|channel/i.test(l.desc) ? 'nothing to paint (black only)' : 'support') : l.cat === 'Storage' ? (/filler/i.test(l.desc) ? 'filler' : 'pedestal case and drawer fronts') : l.cat === 'Junction' ? (/in-line/i.test(l.desc) ? 'nothing to paint (hidden junction)' : 'vertical trim and junction cap') : l.cat === 'Panel' ? (isPackage ? 'top cap and 2 base trims' : 'top cap and 2 base trims') : l.cat === 'Skins' ? (/window/i.test(l.desc) ? 'window frame' : 'steel skin face') : l.cat === 'Glass' ? 'top cap' : /cap/i.test(l.desc) ? 'junction cap' : 'trim';
        if (!/nothing/.test(what)) jobs.paint.push({ key: E.lineKey(l), qty: l.qty, style: l.style, what, paint: paint.trim(), where: `${areaOf(l.src)} · ${where(l.src)}${/side (\d)/.test(l.desc) ? ' · side ' + (l.desc.match(/side (\d)/)[1] === '1' ? 'A' : 'B') : ''}` });
      }
      // refurbished parts with nothing to re-cover or repaint still pass through the shop: inspect, clean, check hardware
      if (jobs.upholstery.length + jobs.paint.length === n0) jobs.inspect.push({ key: 'insp|' + E.lineKey(l), qty: l.qty, style: l.style, desc: l.desc.replace(/ — side \d.*$/, ''), spec: l.spec, where: `${areaOf(l.src)} · ${where(l.src)}` });
    }
    // junction build sheets: every junction with more than one line, or any BYO/omit-trim
    for (const n of Object.values(P.nodes)) {
      const ls = R.lines.filter(l => l.src === n.id); const J = R.nodes[n.id]; if (!ls.length) continue;
      const byo = ls.some(l => /post|BYO|omit trim|blocks/i.test(l.desc + l.spec));
      if (ls.length > 1 || byo) jobs.build.push({ key: 'build|' + n.id, node: n.id, title: `${jn(n.id)} · ${jShort(J)} · ${areaOf(n.id)}`, byo, lines: ls, panels: J.legs.map(l => `${pn(l.panel.id)} ${l.panel.width}"W × ${l.total}"H at ${l.angle}°`) });
      for (const l of ls) for (const nt of l.notes) if (/field cut/i.test(nt)) jobs.cuts.push({ key: 'cut|' + E.lineKey(l), style: l.style, qty: l.qty, note: nt, where: `${areaOf(n.id)} · ${jn(n.id)}` });
    }
    return jobs;
  }
  function chk(key, done) { return `<input type="checkbox" class="chk" data-done="${esc(key)}"${done[key] ? ' checked' : ''}>`; }
  function renderShop() {
    const J = shopJobs(); const done = P.shop.done = P.shop.done || {};
    let html = '';
    const sheet = (n) => `<div class="sheet${n ? '' : ' shopempty'}">`; const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    html += `${sheet(J.upholstery.length)}<h2>Upholstery · ${pl(J.upholstery.length, 'skin', 'skins')} to re-cover</h2><div class="meta jobmeta">${jobMeta()}</div>` + (J.upholstery.length ? `<table class="t"><thead><tr><th></th><th class="n">Qty</th><th>Part</th><th>Skin size</th><th>Fabric</th><th>Direction</th><th>For</th></tr></thead><tbody>${J.upholstery.map(j => `<tr class="${done[j.key] ? 'done' : ''}"><td class="nostrike">${chk(j.key, done)}</td><td class="n">${j.qty}</td><td class="sn">${esc(j.style)}${j.note ? `<span class="note">${esc(j.note)}</span>` : ''}</td><td>${esc(j.size)}</td><td>${esc(j.fabric)}</td><td>${j.dir}</td><td>${esc(j.where)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">No skins are marked Refurbish on the Specification.</div>') + '</div>';
    html += `${sheet(J.paint.length)}<h2>Paint · ${pl(J.paint.length, 'line', 'lines')}</h2>` + (J.paint.length ? `<table class="t"><thead><tr><th></th><th class="n">Qty</th><th>Part</th><th>What to paint</th><th>Color</th><th>For</th></tr></thead><tbody>${J.paint.map(j => `<tr class="${done[j.key] ? 'done' : ''}"><td class="nostrike">${chk(j.key, done)}</td><td class="n">${j.qty}</td><td class="sn">${esc(j.style)}</td><td>${esc(j.what)}</td><td>${esc(j.paint)}</td><td>${esc(j.where)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">No painted parts are marked Refurbish.</div>') + '</div>';
    html += `${sheet(J.inspect.length)}<h2>Inspect and clean · ${pl(J.inspect.length, 'line', 'lines')}</h2><div class="meta">Parts marked Refurbish that need no new fabric or paint: inspect, clean, and replace missing hardware before they are staged.</div>` + (J.inspect.length ? `<table class="t"><thead><tr><th></th><th class="n">Qty</th><th>Part</th><th>Description</th><th>Finish</th><th>For</th></tr></thead><tbody>${J.inspect.map(j => `<tr class="${done[j.key] ? 'done' : ''}"><td class="nostrike">${chk(j.key, done)}</td><td class="n">${j.qty}</td><td class="sn">${esc(j.style)}</td><td>${esc(j.desc)}</td><td>${esc(j.spec)}</td><td>${esc(j.where)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">Nothing else is marked Refurbish.</div>') + '</div>';
    html += `${sheet(J.build.length)}<h2>Junction build sheets · ${pl(J.build.length, 'junction', 'junctions')}</h2><div class="meta">Each junction that is more than a single boxed part. Build-your-own junctions list posts, blocks, light seals, trims, cap and aligners with their heights.</div>` + (J.build.map(b => `<h3 style="margin-top:14px">${chk(b.key, done)} ${esc(b.title)}${b.byo ? ' <span class="tag refurbish">build your own</span>' : ''}</h3><div class="muted">${b.panels.map(esc).join(' · ')}</div><table class="t"><thead><tr><th class="n">Qty</th><th>Part</th><th>Description</th><th>Finish / options</th><th>Notes</th></tr></thead><tbody>${b.lines.map(l => `<tr><td class="n">${l.qty}</td><td class="sn">${esc(l.style)}</td><td>${esc(l.desc)}</td><td>${esc(l.spec)}</td><td>${[...l.notes, ...l.flags].map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table>`).join('') || '<div class="muted">No junctions yet.</div>') + '</div>';
    html += `${sheet(J.cuts.length)}<h2>Field cuts · ${J.cuts.length}</h2>` + (J.cuts.length ? `<table class="t"><thead><tr><th></th><th class="n">Qty</th><th>Part</th><th>Cut</th><th>For</th></tr></thead><tbody>${J.cuts.map(j => `<tr class="${done[j.key] ? 'done' : ''}"><td class="nostrike">${chk(j.key, done)}</td><td class="n">${j.qty}</td><td class="sn">${esc(j.style)}</td><td>${esc(j.note)}</td><td>${esc(j.where)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">Nothing to cut.</div>') + '</div>';
    $('#shopBody').innerHTML = linkPages(html);
    $$('#shopBody [data-done]').forEach(c => c.onchange = () => { P.shop.done[c.dataset.done] = c.checked; try { localStorage.setItem('answer.planner', JSON.stringify(P)); } catch (e) { } renderShop(); });
  }
  $('#bShopCsv').onclick = () => { const J = shopJobs(); const rows = [...J.upholstery.map(j => ({ order: 'Upholstery', qty: j.qty, part: j.style, detail: j.size, finish: j.fabric + ' ' + j.dir, where: j.where })), ...J.paint.map(j => ({ order: 'Paint', qty: j.qty, part: j.style, detail: j.what, finish: j.paint, where: j.where })), ...J.build.flatMap(b => b.lines.map(l => ({ order: 'Junction build', qty: l.qty, part: l.style, detail: l.desc, finish: l.spec, where: b.title }))), ...J.cuts.map(j => ({ order: 'Field cut', qty: j.qty, part: j.style, detail: j.note, finish: '', where: j.where })), ...J.inspect.map(j => ({ order: 'Inspect and clean', qty: j.qty, part: j.style, detail: j.desc, finish: j.spec, where: j.where }))]; download(fileBase() + '_shop_work_orders.csv', E.toCSV(rows, [{ label: 'Work order', key: 'order' }, { label: 'Qty', key: 'qty' }, { label: 'Part', key: 'part' }, { label: 'Detail', key: 'detail' }, { label: 'Finish', key: 'finish' }, { label: 'For', key: 'where' }]), 'text/csv'); };
  // sections with nothing in them are left off the printout; the first printed section carries the job line
  $('#bShopPrint').onclick = () => { const d = document.createElement('div'); d.innerHTML = $('#shopBody').innerHTML; const all = $$('.sheet', d); const keep = all.filter(x => !x.classList.contains('shopempty')); all.filter(x => x.classList.contains('shopempty')).forEach(x => x.remove()); if (!keep.length) { toast('Nothing for the shop: no parts are marked Refurbish, no junctions to build and nothing to cut.'); return; } $$('.jobmeta', d).forEach(x => x.remove()); keep[0].insertAdjacentHTML('afterbegin', `<h1>Shop work orders</h1><div class="meta">${jobMeta()}</div>`); printHTML(d.innerHTML.replace(/<div class="sheet">/g, '<div class="psheet">').replace(/<input type="checkbox"[^>]*>/g, '<span class="box"></span>')); };

  // ---------- INSTALL ----------
  // lines that belong to no workstation (side support bracket pairs, tie plate packs, glide caps, manual add-ons) are staged and installed job-wide
  function jobWideLines() { const comps = E.workstations(P); return R.lines.filter(l => !comps.some(c => inComp(c, l))); }
  const binKey = (a) => a.style + '|' + a.spec; const binOf = (a) => { const b = P.pick.bins || {}; return b[binKey(a)] != null ? b[binKey(a)] : (b[a.style] || ''); }; // bins per style and finish; older jobs keyed by style only
  const allDone = (keys, done) => keys.length > 0 && keys.every(k => done[k]);
  function chkMany(keys, done) { return `<input type="checkbox" class="chk" data-done="${esc(keys.join(' '))}"${allDone(keys, done) ? ' checked' : ''}>`; }
  function renderInstall() {
    const done = P.pick.done = P.pick.done || {}; P.pick.bins = P.pick.bins || {};
    const agg = E.aggregate(R.lines, srcOf); const comps = E.workstations(P);
    let html = `<div class="sheet"><h2>Pick list · ${new Set(agg.map(a => a.style)).size} style numbers, ${agg.reduce((s, a) => s + a.qty, 0)} pieces</h2><div class="meta">${jobMeta()}</div><table class="t"><thead><tr><th></th><th class="n">Qty</th><th>Style number</th><th>Description</th><th>Specify</th><th>Source</th><th>Bin / location</th><th>Used at</th></tr></thead><tbody>`;
    let cur = null; for (const a of agg.slice().sort((x, y) => catOrder(x.cat) - catOrder(y.cat) || x.style.localeCompare(y.style) || x.spec.localeCompare(y.spec) || x.by.localeCompare(y.by))) { if (a.cat !== cur) { cur = a.cat; html += `<tr class="grp"><td colspan="8">${esc(cur)}</td></tr>`; } const ks = a.keys.map(k => 'pick|' + k); const s = a.by; html += `<tr class="${allDone(ks, done) ? 'done' : ''}"><td class="nostrike">${chkMany(ks, done)}</td><td class="n">${a.qty}</td><td class="sn">${esc(a.style)}</td><td>${esc(a.desc.replace(/ — side \d.*$/, '').replace(/\(\d+"→\d+"\)/, ''))}${contentsHTML(a.contents)}</td><td>${esc(a.spec)}</td><td><span class="tag ${s}">${SRC[s]}</span></td><td class="nostrike"><input type="text" class="bin" data-bin="${esc(binKey(a))}" value="${esc(binOf(a))}" placeholder="bin"></td><td>${a.src.map(where).join(', ')}</td></tr>`; }
    html += '</tbody></table></div>';
    // staging by workstation, then the job-wide parts, so the staged pieces add up to the pick list
    const jw = jobWideLines();
    const stage = (title, ls) => { const ag = E.aggregate(ls); return `<h3 style="margin-top:14px">${title} · ${ag.reduce((s, a) => s + a.qty, 0)} pieces</h3><table class="t"><thead><tr><th></th><th class="n">Qty</th><th>Style number</th><th>Description</th><th>Specify</th></tr></thead><tbody>${ag.map(a => { const ks = a.keys.map(k => 'stage|' + k); return `<tr class="${allDone(ks, done) ? 'done' : ''}"><td class="nostrike">${chkMany(ks, done)}</td><td class="n">${a.qty}</td><td class="sn">${esc(a.style)}</td><td>${esc(a.desc.replace(/ — side \d.*$/, ''))}${contentsHTML(a.contents)}</td><td>${esc(a.spec)}</td></tr>`; }).join('')}</tbody></table>`; };
    html += `<div class="sheet"><h2>Staging by workstation</h2>` + comps.map(c => stage(`${esc(c.name)} · ${c.panels.length} panels`, R.lines.filter(l => inComp(c, l)))).join('') + (jw.length ? stage('Job-wide · shared by every workstation', jw) : '') + (comps.length ? '' : '<div class="muted">Nothing on the plan yet.</div>') + '</div>';
    // installer sheets
    html += comps.map(c => installSheetHTML(c)).join('') + (jw.length ? jobWideSheetHTML(jw) : '');
    $('#installBody').innerHTML = linkPages(html);
    $$('#installBody [data-done]').forEach(x => x.onchange = () => { x.dataset.done.split(' ').forEach(k => P.pick.done[k] = x.checked); try { localStorage.setItem('answer.planner', JSON.stringify(P)); } catch (e) { } renderInstall(); });
    $$('#installBody [data-bin]').forEach(x => x.onchange = () => { P.pick.bins[x.dataset.bin] = x.value; try { localStorage.setItem('answer.planner', JSON.stringify(P)); } catch (e) { } });
    comps.forEach(c => drawInstallFigs(c));
  }
  function jobWideSheetHTML(ls) {
    return `<div class="sheet installsheet" id="inst-job"><h2>Installer sheet · Job-wide parts</h2><div class="meta">${jobMeta()} · parts ordered for the whole job, not one workstation. Hand them out as each workstation needs them.</div><table class="t"><thead><tr><th class="n">Qty</th><th>Style number</th><th>Description</th><th>Specify</th><th>Notes</th></tr></thead><tbody>${ls.map(l => `<tr><td class="n">${l.qty}</td><td class="sn">${esc(l.style)}</td><td>${esc(l.desc)}${contentsHTML(l.contents)}</td><td>${esc(l.spec)}</td><td>${l.notes.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function installSheetHTML(c) {
    const runs = runsOf(c);
    return `<div class="sheet installsheet" id="inst-${c.uid}"><h2>Installer sheet · ${esc(c.name)}</h2><div class="meta">${jobMeta()} · ${c.panels.length} panels, ${c.nodes.length} junctions${c.ws.length ? `, ${c.ws.length} worksurface${c.ws.length === 1 ? '' : 's'}` : ''}${c.figPanels.length > c.panels.length ? ` · the plan also shows ${c.figPanels.length - c.panels.length} panel${c.figPanels.length - c.panels.length === 1 ? '' : 's'} of the neighboring workstation that carry these worksurfaces` : ''}</div>
      <div class="figs"><div class="fig"><div class="figcap">Plan · from above · ${esc(c.name)}</div><canvas data-fig="plan"></canvas></div>${runs.map((r, i) => `<div class="fig"><div class="figcap">Run ${i + 1} · ${r.map(p => 'P' + p.id.slice(1)).join(' – ')} · ${E.ftin(sum(r.map(p => p.width)))} · side A</div><canvas data-fig="run" data-run="${i}" data-side="0"></canvas></div><div class="fig"><div class="figcap">Run ${i + 1} · side B</div><canvas data-fig="run" data-run="${i}" data-side="1"></canvas></div>`).join('')}</div>
      <h3>Junctions</h3><table class="t"><thead><tr><th>Junction</th><th>Type</th><th>Panels</th><th>Parts</th></tr></thead><tbody>${c.nodes.slice().sort((a, b) => +a.slice(1) - +b.slice(1)).map(nid => { const J = R.nodes[nid]; const ls = R.lines.filter(l => l.src === nid); return `<tr><td class="sn">${jn(nid).replace('Junction ', 'J')}</td><td>${esc(jShort(J))}${P.nodes[nid].wallStart ? ' · wall start' : ''}</td><td>${J.legs.map(l => `${pn(l.panel.id)} (${l.angle}°)`).join(', ')}</td><td>${ls.map(l => `${l.qty}× <b>${esc(l.style)}</b> ${esc(l.desc)}${contentsHTML(l.contents)}`).join('<br>')}</td></tr>`; }).join('')}</tbody></table>
      <h3>Panels</h3><table class="t"><thead><tr><th>Panel</th><th>Size</th><th>Between</th><th>Skins side A / side B</th><th>Parts</th></tr></thead><tbody>${c.panels.map(p => { const ls = R.lines.filter(l => l.src === p.id); const sk = (segs) => segs.map(s => `${s.height}" ${s.kind === 'window' ? 'window' : s.type}`).join(' + '); return `<tr><td class="sn">${pn(p.id)}</td><td>${p.width}"W × ${p.height}"H${p.stack.length ? ' + ' + p.stack.join('" + ') + '" stacked' : ''}</td><td>${jn(p.a).replace('Junction ', 'J')} – ${jn(p.b).replace('Junction ', 'J')}</td><td>${esc(sk(p.sides[0]))}<br>${esc(sk(p.sides[1]))}</td><td>${ls.map(l => `${l.qty}× <b>${esc(l.style)}</b> ${esc(l.desc)}${contentsHTML(l.contents)}`).join('<br>')}</td></tr>`; }).join('')}</tbody></table>
      ${c.ws.length ? `<h3>Worksurfaces and storage</h3><table class="t"><thead><tr><th>Worksurface</th><th>Where</th><th>Supports</th><th>Parts</th></tr></thead><tbody>${c.ws.map(id => P.worksurfaces[id]).filter(Boolean).map(w => { const ls = R.lines.filter(l => l.src === w.id); const res = w._resolved || {}; return `<tr><td class="sn">${esc(E.wsName(w))}</td><td>${w.kind === 'straight' ? `${w.width}"W × ${w.depth}"D on ${pn(w.panel)} side ${w.side === 0 ? 'A' : 'B'}, ${w.off}" from the ${w.side === 0 ? 'left' : 'right'} post` : `${w.C}×${w.D} at ${jn(w.node).replace('Junction ', 'J')} between ${pn(w.legs[0])} and ${pn(w.legs[1])}`}</td><td>${Object.entries(res).map(([k, v]) => `${E.endName(w, k)}: ${SUPPORT_LABEL[v] || v}`).join('<br>')}${w.kind !== 'straight' ? '<br>rear corner: side support bracket' : ''}</td><td>${ls.map(l => `${l.qty}× <b>${esc(l.style)}</b> ${esc(l.desc)}${contentsHTML(l.contents)}`).join('<br>')}</td></tr>`; }).join('')}</tbody></table>` : ''}
      <h3>Sequence</h3><ol class="steps"><li>Set junctions on the plan, starting from the wall or the longest run. Level with the glides (2 3/4" range).</li><li>Lock both horizontal bars into each pair of junctions: bottom bar in the lowest slot, top bar in the top slot unless a window or glass screen sits on top.</li><li>Install base trims, powerkits, harnesses and infeed. Route lay-in cables through the base or junction openings.</li><li>Hang skins on both sides, then stacking junctions, stacking bars and stacked skins.</li><li>Fit vertical and change-of-height trims, junction caps, aligners and light seals per the junction table.</li><li>Snap on top caps, then glass screens or top screens. Install receptacles and faceplates.</li><li>Hang cantilevers, side support brackets and end panels in the junction slots at 28 1/2" worksurface height (bend the alignment tab down for full-depth worksurfaces). Set fixed pedestals with their fillers, then land the worksurfaces, tie plates across each seam, and bolt down.</li></ol></div>`;
  }
  // in-line runs of a workstation's panels; a run shared with a neighboring workstation is cut to this workstation's panels
  function runsOf(c) { const mine = new Set(c.panels.map(p => p.id)); const seen = new Set(); const runs = []; for (const p of c.panels) { if (seen.has(p.id)) continue; const ch = chainOf(p.id); ch.forEach(x => seen.add(x.id)); let cur = []; for (const x of ch) { if (mine.has(x.id)) cur.push(x); else if (cur.length) { runs.push(cur); cur = []; } } if (cur.length) runs.push(cur); } return runs; }
  // installer figures: the same scene as the plan, drawn plain at full sheet width and 2x resolution so it prints crisp
  function sizeFig(cv, cssW, cssH) { const d = 2; cv.width = Math.round(cssW * d); cv.height = Math.round(cssH * d); cv.style.width = '100%'; cv.style.height = 'auto'; const cx = cv.getContext('2d'); cx.setTransform(d, 0, 0, d, 0, 0); return cx; }
  // plain plan figure fitted to one workstation (only) or the whole job: panels, posts, worksurfaces and pedestals with their labels, no grid or handles
  function drawPlanFig(pc, W0, only, maxH) {
    const ids = only ? (only.allNodes || only.nodes) : Object.keys(P.nodes); const wss = Object.values(P.worksurfaces || {}).filter(w => !only || (only.ws ? only.ws.includes(w.id) : only.panels.some(p => p.id === E.hostPanelOf(P, w.id))));
    const pts = [...ids.map(n => [P.nodes[n].x, P.nodes[n].y]), ...wss.flatMap(w => { const g = E.wsGeometry(P, w); return g ? [...g.poly, ...(w.peds || []).flatMap(d => E.pedRect(P, w, g, d))] : []; })];
    if (!pts.length) return null;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const mnx = Math.min(...xs) - 16, mxx = Math.max(...xs) + 16, mny = Math.min(...ys) - 14, mxy = Math.max(...ys) + 22 + (only ? 0 : 16);
    const px = only ? 0 : 90; // the whole-job figure is drawn small: keep room for the junction labels, which stay full size, at the edges
    const bw = mxx - mnx, bh = mxy - mny; let s = (W0 - 20 - 2 * px) / bw; const H0 = Math.min(maxH || 820, Math.max(320, bh * s + 40 + px)); s = Math.min(s, (H0 - 40 - px) / bh);
    const cx = sizeFig(pc, W0, H0); cx.clearRect(0, 0, W0, H0); cx.fillStyle = '#fff'; cx.fillRect(0, 0, W0, H0);
    const saved = view; view = { s, ox: W0 / 2 - (mnx + mxx) / 2 * s, oy: H0 / 2 + (mny + mxy) / 2 * s };
    try { drawScene(cx, true, only || null); } finally { view = saved; }
    // scale bar
    cx.strokeStyle = '#7a7a7d'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(14, H0 - 14); cx.lineTo(14 + 48 * s, H0 - 14); cx.stroke(); cx.fillStyle = '#5d5d60'; cx.font = '12px Barlow, sans-serif'; cx.textAlign = 'left'; cx.fillText("4'-0\"", 14, H0 - 19);
    return { s, H0 };
  }
  function drawInstallFigs(c) {
    const sheet = $('#inst-' + c.uid); if (!sheet) return; const W0 = Math.max(600, sheet.clientWidth - 40);
    drawPlanFig(sheet.querySelector('[data-fig="plan"]'), W0, c);
    const runs = runsOf(c);
    sheet.querySelectorAll('[data-fig="run"]').forEach(cv => { const r = runs[+cv.dataset.run]; const totalW = sum(r.map(p => E.panelSpan(P, p))) + E.CORNER_POST; const maxH = Math.max(...r.map(p => E.panelTotalHeight(p) + 18), ...r.flatMap(p => [p.a, p.b]).map(n => postH(n) + 6)); let es = (W0 - 60) / totalW; const EH = Math.min(520, Math.max(220, maxH * es + 100)); es = Math.min(es, (EH - 100) / maxH); const ecx = sizeFig(cv, W0, EH); renderElevation(cv, r, +cv.dataset.side, W0, EH, { junctionLabels: true, fixedScale: es }); });
  }
  $('#bPickCsv').onclick = () => { const agg = E.aggregate(R.lines, srcOf).sort((x, y) => catOrder(x.cat) - catOrder(y.cat) || x.style.localeCompare(y.style) || x.spec.localeCompare(y.spec)); download(fileBase() + '_pick_list.csv', E.toCSV(agg, [{ label: 'Qty', key: 'qty' }, { label: 'Style Number', key: 'style' }, { label: 'Description', get: a => a.desc.replace(/ — side \d.*$/, '') }, { label: 'Specify', key: 'spec' }, { label: 'Source', get: a => SRC[a.by] }, { label: 'Contains', get: a => (a.contents || []).map(x => x.qty + 'x ' + x.item).join(' | ') }, { label: 'Bin', get: a => binOf(a) }, { label: 'Used At', get: a => a.src.map(where).join(', ') }, { label: 'Category', key: 'cat' }, { label: 'Guide Page', key: 'page' }]), 'text/csv'); };
  // the pick list prints what is on screen now: typed bins (even before they re-render) and ticked boxes
  $('#bPickPrint').onclick = () => { const sh = $('#installBody .sheet'); if (!sh) return; const cl = sh.cloneNode(true); const live = $$('input', sh); $$('input', cl).forEach((x, i) => { const v = live[i]; const sp = document.createElement('span'); if (v.type === 'checkbox') { sp.className = 'box'; sp.textContent = v.checked ? '✓' : ''; } else sp.textContent = v.value; x.replaceWith(sp); }); printHTML('<div class="psheet">' + cl.innerHTML + '</div>'); };
  $('#bInstallPrint').onclick = () => { const sheets = $$('#installBody .installsheet'); printHTML(sheets.map(sh => { const clone = sh.cloneNode(true); clone.querySelectorAll('canvas').forEach((cv, i) => { const img = document.createElement('img'); img.src = sh.querySelectorAll('canvas')[i].toDataURL(); img.style.width = '100%'; img.style.border = '1px solid #ccc'; cv.replaceWith(img); }); return `<div class="psheet installsheet">${clone.innerHTML}</div>`; }).join('')); }; // keeps .installsheet so the print rules keep each figure and its caption on one page
  let printClear = null; // a print started right after another must not be emptied by the first one's clean-up
  function printHTML(html) { const pa = $('#printArea'); clearTimeout(printClear); pa.innerHTML = html; setTimeout(() => { window.print(); clearTimeout(printClear); printClear = setTimeout(() => pa.innerHTML = '', 500); }, 150); }
  // plan printout: the whole job fitted and drawn plain like the installer figure, then a job summary (counts, sourcing and totals, workstations, issues)
  function planPrintHTML() {
    const cv = document.createElement('canvas'); const fig = drawPlanFig(cv, 1000, null, 1300); const comps = E.workstations(P); const wss = Object.values(P.worksurfaces || {});
    const bySrc = { buy: 0, refurbish: 0, stock: 0 }; for (const l of R.lines) bySrc[srcOf(l)] += l.ext;
    const rows = comps.map(c => { const ls = R.lines.filter(l => inComp(c, l)); return `<tr><td>${esc(c.name)}</td><td class="n">${c.panels.length}</td><td class="n">${c.nodes.length}</td><td class="n">${c.ws.length}</td><td class="n">${ls.reduce((a, l) => a + l.qty, 0)}</td><td class="n">${money(ls.reduce((a, l) => a + l.ext, 0))}</td></tr>`; }).join('');
    const jw = jobWideLines(); const iss = [...R.errors.map(e => ['Error', e]), ...R.warnings.map(e => ['Warning', e])];
    return `<div class="psheet"><h1>Plan · ${esc(P.name)}</h1><div class="meta">${jobMeta()}</div>${fig ? `<img src="${cv.toDataURL()}" style="width:100%;border:1px solid #ccc">` : '<div class="muted">Nothing on the plan yet.</div>'}` + linkPages(`
      <h2>Summary</h2><div class="totals"><div>Workstations<b>${comps.length}</b></div><div>Panels<b>${Object.keys(P.panels).length}</b></div><div>Junctions<b>${Object.values(R.nodes).filter(J => J.legs && J.legs.length).length}</b></div><div>Worksurfaces<b>${wss.length}</b></div><div>Pedestals<b>${wss.reduce((a, w) => a + (w.peds || []).length, 0)}</b></div></div>
      <div class="totals"><div>Buy new (purchase order)<b>${money(bySrc.buy)}</b></div><div>Refurbish (list value)<b>${money(bySrc.refurbish)}</b></div><div>From stock (list value)<b>${money(bySrc.stock)}</b></div><div>All parts, U.S. list<b>${money(R.totals.all)}</b></div><div>Canadian list ×1.09<b>${money(R.totals.canadian)}</b></div></div>
      <table class="t"><thead><tr><th>Workstation</th><th class="n">Panels</th><th class="n">Junctions</th><th class="n">Worksurfaces</th><th class="n">Pieces</th><th class="n">U.S. list</th></tr></thead><tbody>${rows}${jw.length ? `<tr><td>Job-wide parts</td><td></td><td></td><td></td><td class="n">${jw.reduce((a, l) => a + l.qty, 0)}</td><td class="n">${money(jw.reduce((a, l) => a + l.ext, 0))}</td></tr>` : ''}</tbody></table>
      <h2>Issues · ${R.errors.length} error${R.errors.length === 1 ? '' : 's'}, ${R.warnings.length} warning${R.warnings.length === 1 ? '' : 's'}</h2>${iss.length ? `<ul>${iss.map(([k, e]) => `<li><b>${k}</b> ${esc((e.panel || e.node ? (e.panel || e.node) + ': ' : '') + e.msg)}</li>`).join('')}</ul>` : '<div class="muted">None.</div>'}</div>`);
  }
  $('#bPrint').onclick = () => { if (stage === 'plan') printHTML(planPrintHTML()); else if (stage === 'spec') $('#bSpecPrint').click(); else if (stage === 'shop') $('#bShopPrint').click(); else $('#bInstallPrint').click(); };

  // ---------- header / stages ----------
  $$('#tabs button').forEach(b => b.onclick = () => showStage(b.dataset.stage));
  function showStage(s) { stage = s; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.stage === s)); $$('.stage').forEach(x => x.classList.toggle('on', x.id === 'st-' + s)); if (s === 'plan') { sizeCanvases(); } refresh(); }
  $$('#trimSwitch button').forEach(b => b.onclick = () => {
    if (P.trim === b.dataset.trim) return;
    const ps = Object.values(P.panels); const toOval = b.dataset.trim === 'oval'; const cnt = (f) => ps.filter(f).length; const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const lost = toOval ? [[cnt(p => p.glassScreen), 'frameless glass screen'], [cnt(p => p.topCap && p.topCap.omit), 'omitted top cap']] : [[cnt(p => p.topScreen), 'translucent top screen']];
    const said = lost.filter(([n]) => n).map(([n, w]) => pl(n, w));
    mutate(() => { P.trim = b.dataset.trim; });
    toast(`Job switched to ${P.trim} trim. Every junction and package was regenerated.` + (said.length ? ` ${said.join(' and ')} ${sum(lost.map(([n]) => n)) === 1 ? 'is' : 'are'} not offered in ${P.trim} trim: kept aside and restored if you switch back to ${toOval ? 'thin' : 'oval'}.` : ''));
  });
  $('#jobName').onchange = e => mutate(() => P.name = e.target.value);
  $('#bNew').onclick = () => { if (!confirm('Start a new job? This replaces the job on screen. Save it first if you need a file; Undo brings it back while this page stays open.')) return; snapshot(); P = migrate(E.newProject(P.trim)); sel = new Set(); selNode = null; fit(); refresh(); };
  $('#bSave').onclick = () => { P.build = BUILD; P.saved = new Date().toISOString(); download(fileBase() + '.answer', JSON.stringify(P, null, 1), 'application/json'); toast('Job file downloaded'); };
  $('#bOpen').onclick = () => $('#fileIn').click();
  $('#fileIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const o = JSON.parse(rd.result); if (o.app !== 'ANSWER') throw new Error('not an Answer job file'); snapshot(); P = migrate(o); sel = new Set(); selNode = null; fit(); refresh(); toast('Opened ' + f.name); } catch (err) { alert('Could not open: ' + err.message); } }; rd.readAsText(f); e.target.value = ''; };
  $('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
  $('#bDelete').onclick = () => { if (selPed && selWs) { mutate(() => { E.removePedestal(P, P.worksurfaces[selWs], selPed); selPed = null; }); return; } if (selWs) { mutate(() => { E.removeWorksurface(P, selWs); selWs = null; }); return; } if (sel.size) mutate(() => { [...sel].forEach(id => E.removePanel(P, id)); sel = new Set(); }); else if (selNode && !(R.nodes[selNode].legs || []).length) mutate(() => { delete P.nodes[selNode]; selNode = null; }); else if (selNode) toast(`${jn(selNode)} still has panels. Right-click it and choose "Delete junction and its panels", or select a panel and delete that.`); else toast('Select a panel, junction or worksurface first.'); };
  $('#optHeight').innerHTML = seg(E.HEIGHTS, 54, v => v + '"', 'h'); $$('#optHeight button').forEach(b => b.onclick = () => { $$('#optHeight button').forEach(x => x.classList.toggle('on', x === b)); if (selNode) renderRight(); });
  window.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; } if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') {
      closeMenu(); draw = null; placing = null; placeAt = null;
      if (swing) { swing.free.x = swing.orig.x; swing.free.y = swing.orig.y; swing = null; } dragMove = null; dragWs = null; pan = null; // cancel a drag in progress
      setTool('select'); $('#typicals').classList.remove('on'); $('#guide').classList.remove('on'); closeFinishes(); drawPlan(); return;
    }
    // plan shortcuts work on the Plan stage only, and not while a dialog or the Finishes drawer is open
    if (stage !== 'plan' || mod || e.altKey || $('#finishes').classList.contains('on') || $$('.modal.on').length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#bDelete').click(); }
    if (e.key === 'Tab') { e.preventDefault(); $('#rcToggle').click(); }
    if (k === 'v') setTool('select'); if (k === 'd') setTool('draw'); if (k === 'w') setTool('ws');
  });
  window.addEventListener('resize', sizeCanvases);

  window.answerDebug = { addStraightWs: (...a) => addStraightWs(...a), hit: (x, y) => hit(x, y), view, P: () => P, refresh: () => refresh(), elevHits: () => elevHits, elevInfo: () => elevInfo, drag: () => dragWs && { off: dragWs.off, off0: dragWs.off0, t0: dragWs.t0, label: dragWs.label } };
  // ---------- boot ----------
  try { const saved = localStorage.getItem('answer.planner'); if (saved) P = migrate(JSON.parse(saved)); } catch (e) { }
  R = E.generate(P); sizeCanvases(); fit(); refresh();
})();
