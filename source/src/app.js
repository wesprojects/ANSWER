/* ANSWER configurator UI */
(function () {
  'use strict';
  const E = window.ANSWER;
  const CAT = JSON.parse(document.getElementById('catalogData').textContent);
  E.init(CAT);
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  let P = E.newProject('thin');
  let sel = { kind: null, id: null }; // {kind:'panel'|'node', id}
  let result = null;
  let elevSide = 0;
  let history = [], future = [];
  const GRID = 6;

  // ---------- persistence ----------
  function snapshot() { history.push(JSON.stringify(P)); if (history.length > 100) history.shift(); future = []; }
  function undo() { if (!history.length) return; future.push(JSON.stringify(P)); P = JSON.parse(history.pop()); afterModelChange(); }
  function redo() { if (!future.length) return; history.push(JSON.stringify(P)); P = JSON.parse(future.pop()); afterModelChange(); }
  function autosave() { try { localStorage.setItem('answer.project', JSON.stringify(P)); } catch (e) { } }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2600); }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

  // ---------- model change ----------
  function afterModelChange(keepSel) {
    if (!keepSel) { if (sel.kind === 'panel' && !P.panels[sel.id]) sel = { kind: null }; if (sel.kind === 'node' && !P.nodes[sel.id]) sel = { kind: null }; }
    P.name = $('#projName').value = P.name || 'Untitled';
    $$('#trimSeg button').forEach(b => b.classList.toggle('on', b.dataset.trim === P.trim));
    document.body.classList.toggle('oval', P.trim === 'oval');
    result = E.generate(P);
    autosave();
    (function () { const W = plan.clientWidth, H = plan.clientHeight; if (!W) return; for (const n of Object.values(P.nodes)) { const [x, y] = toScreen(n.x, n.y); if (x < 20 || y < 20 || x > W - 20 || y > H - 20) { fitView(); break; } } })();
    drawPlan(); drawElev(); renderSide(); renderLists(); renderBOM(); renderPull(); renderIssues(); renderPowerSummary(); syncFinishUI();
    $('#issueCount').textContent = (result.errors.length + result.warnings.length) ? `(${result.errors.length + result.warnings.length})` : '';
    $('#stageInfo').textContent = `${Object.keys(P.panels).length} panels · ${Object.keys(P.nodes).length} junctions · list ${money(result.totals.all)} U.S.`;
  }
  function mutate(fn, keepSel) { snapshot(); fn(); afterModelChange(keepSel); }

  // ---------- plan canvas ----------
  const plan = $('#plan'), pctx = plan.getContext('2d');
  let view = { scale: 4, ox: 0, oy: 0, drag: null };
  function fitView() {
    const ns = Object.values(P.nodes);
    const W = plan.clientWidth, H = plan.clientHeight;
    if (!ns.length) { view.scale = 4; view.ox = W / 2; view.oy = H / 2; return; }
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    const minx = Math.min(...xs) - 24, maxx = Math.max(...xs) + 24, miny = Math.min(...ys) - 24, maxy = Math.max(...ys) + 24;
    view.scale = Math.max(0.4, Math.min(8, Math.min(W / (maxx - minx), H / (maxy - miny))));
    view.ox = W / 2 - (minx + maxx) / 2 * view.scale; view.oy = H / 2 + (miny + maxy) / 2 * view.scale;
  }
  const toScreen = (x, y) => [view.ox + x * view.scale, view.oy - y * view.scale];
  const toWorld = (sx, sy) => [(sx - view.ox) / view.scale, (view.oy - sy) / view.scale];
  function resizeCanvases() {
    for (const c of [plan, $('#elev')]) { const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr); c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
    drawPlan(); drawElev();
  }
  const HCOLOR = { 30: '#5ecf8d', 42: '#78aaff', 48: '#9bd0ff', 54: '#f5a524', 66: '#ff9f6b', 78: '#ff6b6b' };
  function drawPlan() {
    const W = plan.clientWidth, H = plan.clientHeight; if (!W) return;
    pctx.clearRect(0, 0, W, H);
    // grid
    const step = GRID * view.scale; const big = 48 * view.scale;
    pctx.strokeStyle = '#151922'; pctx.lineWidth = 1;
    if (step > 5) { pctx.beginPath(); for (let x = ((view.ox % step) + step) % step; x < W; x += step) { pctx.moveTo(x, 0); pctx.lineTo(x, H); } for (let y = ((view.oy % step) + step) % step; y < H; y += step) { pctx.moveTo(0, y); pctx.lineTo(W, y); } pctx.stroke(); }
    pctx.strokeStyle = '#1f2633'; pctx.beginPath(); for (let x = ((view.ox % big) + big) % big; x < W; x += big) { pctx.moveTo(x, 0); pctx.lineTo(x, H); } for (let y = ((view.oy % big) + big) % big; y < H; y += big) { pctx.moveTo(0, y); pctx.lineTo(W, y); } pctx.stroke();
    // origin
    const [ox, oy] = toScreen(0, 0); pctx.strokeStyle = '#2a3242'; pctx.beginPath(); pctx.moveTo(ox - 8, oy); pctx.lineTo(ox + 8, oy); pctx.moveTo(ox, oy - 8); pctx.lineTo(ox, oy + 8); pctx.stroke();
    // panels
    for (const p of Object.values(P.panels)) {
      const a = P.nodes[p.a], b = P.nodes[p.b]; if (!a || !b) continue;
      const [x1, y1] = toScreen(a.x, a.y), [x2, y2] = toScreen(b.x, b.y);
      const on = sel.kind === 'panel' && sel.id === p.id;
      pctx.lineWidth = Math.max(4, 3 * view.scale) + (on ? 3 : 0); pctx.lineCap = 'butt';
      pctx.strokeStyle = on ? '#f5a524' : (HCOLOR[p.height] || '#78aaff');
      pctx.beginPath(); pctx.moveTo(x1, y1); pctx.lineTo(x2, y2); pctx.stroke();
      if (p.stack.length) { pctx.setLineDash([4, 3]); pctx.lineWidth = 1.5; pctx.strokeStyle = '#e7ecf5'; pctx.beginPath(); pctx.moveTo(x1, y1); pctx.lineTo(x2, y2); pctx.stroke(); pctx.setLineDash([]); }
      // label
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const ang = Math.atan2(y2 - y1, x2 - x1);
      pctx.save(); pctx.translate(mx, my); pctx.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang); pctx.fillStyle = on ? '#f5a524' : '#e7ecf5'; pctx.font = '10px DM Mono, monospace'; pctx.textAlign = 'center';
      const lbl = `${p.label ? p.label + ' ' : ''}${p.width}W × ${p.height}${p.stack.length ? '+' + p.stack.join('+') : ''}H`;
      pctx.fillText(lbl, 0, -Math.max(4, 3 * view.scale) / 2 - 4);
      const sub = [p.power.kind !== 'none' ? (p.power.kind === 'powerkit' ? 'PWR' : 'PASS-THRU') : '', p.glassScreen ? 'GLASS' : '', p.window ? '' : '', p.sides[0].some(s => s.kind === 'window') ? 'WIN' : ''].filter(Boolean).join(' ');
      if (sub) { pctx.fillStyle = '#7d8798'; pctx.font = '9px DM Mono, monospace'; pctx.fillText(sub, 0, Math.max(4, 3 * view.scale) / 2 + 11); }
      pctx.restore();
    }
    // nodes
    for (const n of Object.values(P.nodes)) {
      const J = result ? result.nodes[n.id] : null; const [x, y] = toScreen(n.x, n.y);
      const on = sel.kind === 'node' && sel.id === n.id;
      pctx.beginPath(); pctx.arc(x, y, on ? 8 : 6, 0, Math.PI * 2);
      pctx.fillStyle = J && J.type === 'unsupported' ? '#ff6b6b' : on ? '#f5a524' : '#151922'; pctx.fill();
      pctx.lineWidth = 1.5; pctx.strokeStyle = on ? '#f5a524' : '#e7ecf5'; pctx.stroke();
      if (J && J.type && J.type !== 'none') { pctx.fillStyle = '#7d8798'; pctx.font = '9px DM Mono, monospace'; pctx.textAlign = 'left'; pctx.fillText(jtLabel(J), x + 9, y - 6); }
    }
    // hud
    $('#hud').textContent = `scale 1" = ${view.scale.toFixed(2)}px   grid ${GRID}"\n${P.trim.toUpperCase()} TRIM   ${sel.kind ? sel.kind + ' ' + sel.id : 'nothing selected'}\nclick empty: start run · click panel/junction: select · drag: pan · wheel: zoom`;
    $('#legend').innerHTML = Object.entries(HCOLOR).map(([h, c]) => `<span class="swatch" style="background:${c}"></span>${h}"H`).join(' &nbsp; ') + '<br>dashed = stacked · EOR end-of-run · WS wall-start';
  }
  function jtLabel(J) { const m = { inline: 'IN-LINE', L: 'L', T: 'T', X: 'X', V: 'V 120°', Y: 'Y 120°', EOR: 'EOR', wall: 'WS', unsupported: '!!' }; const hs = J.legs ? [...new Set(J.legs.map(l => l.total))].sort((a, b) => a - b).join('/') : ''; return `${m[J.type] || J.type} ${hs}`; }
  function hitTest(sx, sy) {
    let best = null, bd = 12;
    for (const n of Object.values(P.nodes)) { const [x, y] = toScreen(n.x, n.y); const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = { kind: 'node', id: n.id }; } }
    if (best) return best;
    bd = 8;
    for (const p of Object.values(P.panels)) {
      const a = P.nodes[p.a], b = P.nodes[p.b]; const [x1, y1] = toScreen(a.x, a.y), [x2, y2] = toScreen(b.x, b.y);
      const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2; let t = ((sx - x1) * (x2 - x1) + (sy - y1) * (y2 - y1)) / L2; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(sx - (x1 + t * (x2 - x1)), sy - (y1 + t * (y2 - y1))); if (d < bd) { bd = d; best = { kind: 'panel', id: p.id }; }
    }
    return best;
  }
  plan.addEventListener('mousedown', e => { view.drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy, moved: false }; });
  window.addEventListener('mousemove', e => { if (!view.drag) return; const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y; if (Math.hypot(dx, dy) > 3) view.drag.moved = true; if (view.drag.moved) { view.ox = view.drag.ox + dx; view.oy = view.drag.oy + dy; drawPlan(); } });
  window.addEventListener('mouseup', e => {
    if (!view.drag) return; const d = view.drag; view.drag = null; if (d.moved) return;
    const r = plan.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) return;
    const h = hitTest(sx, sy);
    if (h) { sel = h; afterModelChange(true); return; }
    // start a new run at a grid point
    const [wx, wy] = toWorld(sx, sy); const gx = Math.round(wx / GRID) * GRID, gy = Math.round(wy / GRID) * GRID;
    mutate(() => { const n = E.addNode(P, gx, gy); sel = { kind: 'node', id: n.id }; }, true);
    toast('Junction placed. Add a panel from the right pane.');
  });
  plan.addEventListener('wheel', e => { e.preventDefault(); const r = plan.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const [wx, wy] = toWorld(sx, sy); view.scale = Math.max(0.3, Math.min(12, view.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); view.ox = sx - wx * view.scale; view.oy = sy + wy * view.scale; drawPlan(); }, { passive: false });

  // ---------- elevation ----------
  const elev = $('#elev'), ectx = elev.getContext('2d');
  const SKINFILL = { 'tackable acoustical': '#3b4a66', 'performance tackable acoustical': '#3f5470', steel: '#5a6270', laminate: '#7a6a4f', wood: '#8a5a2b', markerboard: '#dfe6f0', slatwall: '#4d5563', technology: '#2f3b52', window: '#9fd3ff' };
  function drawElev() {
    const W = elev.clientWidth, H = elev.clientHeight; if (!W) return; ectx.clearRect(0, 0, W, H);
    const p = sel.kind === 'panel' ? P.panels[sel.id] : null;
    $('#elevTitle').textContent = p ? `ELEVATION — ${p.id} ${p.width}"W × ${p.height}"H${p.stack.length ? ' + ' + p.stack.join('+') + '" stacked' : ''} — side ${elevSide + 1}` : 'ELEVATION — select a panel';
    if (!p) return;
    const totalH = E.panelTotalHeight(p); const pad = 34;
    const extra = (p.glassScreen && P.trim === 'thin') ? (p.glassScreen.attach === 'clip' ? 12 : p.glassScreen.height) : (p.topScreen && P.trim === 'oval') ? 12 : 0;
    const s = Math.min((W - 2 * pad - 160) / p.width, (H - 2 * pad) / (totalH + extra + 2));
    const x0 = (W - p.width * s) / 2, y0 = H - pad;
    const rect = (x, yb, w, h, fill, stroke) => { ectx.fillStyle = fill; ectx.fillRect(x, yb - h * s, w * s, h * s); if (stroke) { ectx.strokeStyle = stroke; ectx.lineWidth = 1; ectx.strokeRect(x, yb - h * s, w * s, h * s); } };
    // base trim 3.75" (p50) or open base
    let y = y0;
    const openish = p.openBase || p.skinsToFloor;
    rect(x0, y, p.width, 3.75, p.openBase ? '#0d0f13' : '#2a3242', '#3a4252');
    ectx.fillStyle = '#7d8798'; ectx.font = '9px DM Mono, monospace'; ectx.textAlign = 'left'; ectx.fillText(p.openBase ? 'open base' : p.skinsToFloor ? 'skins to floor' : `base trim ${p.baseTrim}`, x0 + 4, y - 3.75 * s / 2 + 3);
    // skins
    const drawSegs = (segs, yb, label) => {
      let yy = yb;
      for (const seg of segs) {
        const t = seg.kind === 'window' ? 'window' : seg.type;
        rect(x0, yy, p.width, seg.height, SKINFILL[t] || '#3b4a66', '#0d0f13');
        ectx.fillStyle = t === 'markerboard' || t === 'window' ? '#0d0f13' : '#e7ecf5'; ectx.font = '9px DM Mono, monospace'; ectx.textAlign = 'center';
        ectx.fillText(`${seg.height}" ${t}${seg.kind === 'window' ? (seg.pane === 'double' ? ' double' : seg.frosted ? ' frosted' : '') : ''}`, x0 + p.width * s / 2, yy - seg.height * s / 2 + 3);
        yy -= seg.height * s;
      }
      return yy;
    };
    y = y0 - (p.skinsToFloor ? 0 : 3.75 * s);
    const skinTop = drawSegs(p.sides[elevSide], p.skinsToFloor ? y0 : y, 'base');
    // top cap region: total base height top
    const baseTopY = y0 - p.height * s;
    rect(x0, baseTopY + 1.2 * s, p.width, 1.2, p.topCap.omit || p.glassScreen ? '#0d0f13' : (p.topCap.wood ? '#8a5a2b' : '#2a3242'), '#3a4252');
    // stackers
    let yb = baseTopY;
    p.stack.forEach((st, i) => { const segs = p.stackSides[i] ? p.stackSides[i][elevSide] : []; drawSegs(segs, yb, 'tier'); yb -= st * s; rect(x0, yb + 1.2 * s, p.width, 1.2, '#2a3242', '#3a4252'); });
    // glass screen
    if (p.glassScreen && P.trim === 'thin') { const gh = p.glassScreen.attach === 'clip' ? 12 : p.glassScreen.height; rect(x0 + 1 * s, yb, p.width - 2, gh, p.glassScreen.frosted ? 'rgba(200,230,255,.55)' : 'rgba(159,211,255,.35)', '#9fd3ff'); }
    if (p.topScreen && P.trim === 'oval') rect(x0 + 1.25 * s, yb, p.width - 2.5, 12, 'rgba(220,220,220,.35)', '#ccc');
    // junction trims at each end
    for (const [nid, side] of [[p.a, -1], [p.b, 1]]) {
      const J = result && result.nodes[nid]; if (!J) continue;
      const xx = side < 0 ? x0 - 3 * s : x0 + p.width * s; const hh = Math.max(...(J.legs || [{ total: p.height }]).map(l => l.total));
      ectx.fillStyle = '#1b2130'; ectx.fillRect(xx, y0 - hh * s, 3 * s, hh * s); ectx.strokeStyle = '#7d8798'; ectx.strokeRect(xx, y0 - hh * s, 3 * s, hh * s);
      ectx.save(); ectx.translate(xx + 1.5 * s, y0 - hh * s / 2); ectx.rotate(-Math.PI / 2); ectx.fillStyle = '#7d8798'; ectx.font = '9px DM Mono, monospace'; ectx.textAlign = 'center'; ectx.fillText(jtLabel(J), 0, 3); ectx.restore();
    }
    // dimensions
    ectx.fillStyle = '#7d8798'; ectx.font = '9px DM Mono, monospace'; ectx.textAlign = 'center';
    ectx.fillText(`${p.width}"W (bars ${P.trim === 'thin' ? E.ACTUAL.thinBarWidth[p.width] : E.ACTUAL.ovalBarWidth[p.width]})`, x0 + p.width * s / 2, y0 + 14);
    ectx.textAlign = 'left'; ectx.fillText(`${totalH}"H total`, x0 + p.width * s + 3 * s + 6, y0 - totalH * s + 8);
    ectx.fillText(`${p.height}"H base (${P.trim === 'thin' ? E.ACTUAL.panelHeight[p.height] : E.ACTUAL.ovalPanelHeight[p.height]})`, x0 + p.width * s + 3 * s + 6, baseTopY + 8 + (p.stack.length ? 12 : 0));
  }
  $$('#elevSide button').forEach(b => b.addEventListener('click', () => { elevSide = +b.dataset.side; $$('#elevSide button').forEach(x => x.classList.toggle('on', x === b)); drawElev(); }));

  // ---------- side pane ----------
  const optList = (vals, cur, fmt) => vals.map(v => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${fmt ? fmt(v) : v}</option>`).join('');
  const SKIN_TYPES = ['tackable acoustical', 'performance tackable acoustical', 'steel', 'laminate', 'wood', 'markerboard', 'slatwall', 'technology'];
  function renderSide() {
    const side = $('#side');
    if (sel.kind === 'panel' && P.panels[sel.id]) return renderPanelPane(side, P.panels[sel.id]);
    if (sel.kind === 'node' && P.nodes[sel.id]) return renderNodePane(side, P.nodes[sel.id]);
    side.innerHTML = `<h3>ANSWER PANEL CONFIGURATOR</h3><div class="note">${P.trim === 'thin' ? 'THIN TRIM' : 'OVAL TRIM'} project. Click an empty spot on the plan to place the first junction, then add panels from it. Select any panel or junction to edit it. The BOM tab lists every part with its style number, finish specification, list price and guide page.</div>
    <h3>PROJECT</h3><div class="kv">Panels <b>${Object.keys(P.panels).length}</b> · Junctions <b>${Object.keys(P.nodes).length}</b><br>U.S. list <b>${money(result.totals.all)}</b> · Canadian (×1.09) <b>${money(result.totals.canadian)}</b></div>
    ${Object.entries(result.totals.byCat).map(([c, v]) => `<div class="kv">${esc(c)} <b>${money(v)}</b></div>`).join('')}
    <h3>DEMOS</h3><div class="note">Use the DEMOS menu in the header for sample layouts, including the guide's own Build Your Own practice examples (p38).</div>`;
  }
  function panelSegsHTML(segs, key) {
    return segs.map((seg, i) => `<div class="segrow" data-key="${key}" data-i="${i}">
      <span class="k">${i + 1}</span>
      <select data-f="type">${seg.kind === 'window' ? '' : optList(SKIN_TYPES, seg.type)}<option value="window"${seg.kind === 'window' ? ' selected' : ''}>glass window</option></select>
      <select data-f="height">${optList(seg.kind === 'window' ? [12, 18, 24] : E.SKIN_HEIGHTS, seg.height, v => v + '"')}</select>
      ${seg.kind === 'window' ? `<select data-f="pane"><option value="single"${seg.pane !== 'double' ? ' selected' : ''}>single clear</option><option value="frosted"${seg.frosted ? ' selected' : ''}>single frosted</option><option value="double"${seg.pane === 'double' ? ' selected' : ''}>double frosted</option></select>` :
        seg.type === 'steel' ? `<select data-f="finish"><option value=""${!seg.finish ? ' selected' : ''}>smooth</option><option value="perforated"${seg.finish === 'perforated' ? ' selected' : ''}>perforated</option><option value="ribbed"${seg.finish === 'ribbed' ? ' selected' : ''}>ribbed</option></select>` :
        seg.type === 'technology' ? `<select data-f="cutouts"><option${(seg.cutouts || 'All') === 'All' ? ' selected' : ''}>All</option><option${seg.cutouts === 'Right' ? ' selected' : ''}>Right</option><option${seg.cutouts === 'Left' ? ' selected' : ''}>Left</option></select>` :
        (seg.type === 'tackable acoustical' || seg.type === 'performance tackable acoustical') ? `<input type="text" data-f="fabric" list="fabricList" placeholder="default fabric" value="${seg.fabric ? esc(seg.fabric.code) : ''}" title="Fabric override for this skin (code)">` : '<span></span>'}
      <button class="btn sm" data-f="del" title="remove">×</button></div>`).join('');
  }
  function renderPanelPane(side, p) {
    const J = (nid) => result.nodes[nid];
    const skinH = p.height - 6;
    const tot = (segs) => segs.reduce((a, s) => a + s.height, 0);
    const lines = result.lines.filter(l => l.src === p.id);
    const thin = P.trim === 'thin';
    side.innerHTML = `
      <div class="big">${p.id} — PANEL</div>
      <div class="row"><label>Label</label><input type="text" id="pLabel" value="${esc(p.label)}" placeholder="optional, e.g. A"></div>
      <div class="row"><label>Width</label><select id="pW">${optList(E.WIDTHS, p.width, v => v + '"')}</select><label style="min-width:0">Height</label><select id="pH">${optList(E.HEIGHTS, p.height, v => v + '"')}</select></div>
      <div class="kv">Ends: <b>${p.a}</b> ${jtLabel(J(p.a))} · <b>${p.b}</b> ${jtLabel(J(p.b))} · actual ${thin ? E.ACTUAL.panelHeight[p.height] : E.ACTUAL.ovalPanelHeight[p.height]} high</div>
      <h3>STACKING (MAX 36", TWO STACKERS, 90" TOTAL)</h3>
      <div class="row"><label>Stackers</label><select id="pStack">${optList(['', '12', '18', '24', '12,12', '18,18', '24,12', '12,24'], p.stack.join(','), v => v ? v.replace(',', '" + ') + '"' : 'none')}</select><span class="kv">total ${E.panelTotalHeight(p)}"</span></div>
      <h3>SKINS — SIDE 1 <span class="kv">(total ${tot(p.sides[0])}" of ${skinH}")</span></h3>
      <div id="segs0">${panelSegsHTML(p.sides[0], 's0')}</div>
      <div class="row"><button class="btn sm" data-add="s0">+ SEGMENT</button><button class="btn sm" data-preset="s0:mono">MONOLITHIC</button><button class="btn sm" data-preset="s0:split">24 + REST</button><button class="btn sm" data-preset="s0:win">WINDOW TOP</button></div>
      <h3>SKINS — SIDE 2 <span class="kv">(total ${tot(p.sides[1])}" of ${skinH}")</span></h3>
      <div id="segs1">${panelSegsHTML(p.sides[1], 's1')}</div>
      <div class="row"><button class="btn sm" data-add="s1">+ SEGMENT</button><button class="btn sm" data-preset="s1:copy">COPY SIDE 1</button><button class="btn sm" data-preset="s1:mono">MONOLITHIC</button></div>
      ${p.stack.map((st, i) => `<h3>STACKER ${i + 1} SKINS (${st}"H)</h3><div class="kv">Side 1</div><div>${panelSegsHTML(p.stackSides[i][0], 'k' + i + '0')}</div><div class="kv">Side 2</div><div>${panelSegsHTML(p.stackSides[i][1], 'k' + i + '1')}</div><div class="row"><button class="btn sm" data-add="k${i}0">+ SIDE 1</button><button class="btn sm" data-add="k${i}1">+ SIDE 2</button><button class="btn sm" data-preset="k${i}:win">WINDOW</button></div>`).join('')}
      <h3>TOP CAP AND BASE</h3>
      <div class="row"><label>Top cap</label><select id="pTopCap"><option value="paint"${!p.topCap.wood && !p.topCap.omit ? ' selected' : ''}>painted (trim color)</option><option value="wood"${p.topCap.wood ? ' selected' : ''}>wood veneer</option>${thin ? `<option value="omit"${p.topCap.omit ? ' selected' : ''}>omit (spanning cap / glass)</option>` : ''}</select></div>
      <div class="row"><label>Base trim</label><select id="pBase"><option value="knockouts"${p.baseTrim === 'knockouts' ? ' selected' : ''}>knockouts both sides (std)</option><option value="knockoutsOneSidePlainOneSide"${p.baseTrim === 'knockoutsOneSidePlainOneSide' ? ' selected' : ''}>knockouts one side, plain one side</option><option value="plainBothSides"${p.baseTrim === 'plainBothSides' ? ' selected' : ''}>plain both sides</option><option value="hardwire"${p.baseTrim === 'hardwire' ? ' selected' : ''}>hardwire base trims</option></select></div>
      <div class="row"><input type="checkbox" id="pOpen"${p.openBase ? ' checked' : ''}><label style="min-width:0">Open base trim</label> <input type="checkbox" id="pFloor"${p.skinsToFloor ? ' checked' : ''}><label style="min-width:0">Skins to the floor (F)</label></div>
      <div class="row"><input type="checkbox" id="pTray"${p.cableTray ? ' checked' : ''}><label style="min-width:0">Cable tray</label> <input type="checkbox" id="pBTray"${p.baseCableTray ? ' checked' : ''}><label style="min-width:0">Base cable tray</label></div>
      <h3>POWER</h3>
      <div class="row"><label>Power</label><select id="pPower"><option value="none"${p.power.kind === 'none' ? ' selected' : ''}>none</option><option value="powerkit"${p.power.kind === 'powerkit' ? ' selected' : ''}>powerkit${p.width < 24 ? ' (not on 18"W)' : ''}</option><option value="passthrough"${p.power.kind === 'passthrough' ? ' selected' : ''}>pass-through</option></select>
        <select id="pPowerLoc"${p.power.kind !== 'powerkit' ? ' disabled' : ''}><option value="base"${p.power.location === 'base' ? ' selected' : ''}>base</option><option value="worksurface"${p.power.location === 'worksurface' ? ' selected' : ''}>worksurface height</option></select></div>
      ${p.power.kind === 'powerkit' ? `<div class="row"><label>Duplex s1/s2</label><input type="number" id="pR0" min="0" max="4" value="${p.power.receptacles[0]}"><input type="number" id="pR1" min="0" max="4" value="${p.power.receptacles[1]}"></div>
      <div class="row"><label>USB s1/s2</label><input type="number" id="pU0" min="0" max="4" value="${p.power.usb[0]}"><input type="number" id="pU1" min="0" max="4" value="${p.power.usb[1]}"></div>
      <div class="row"><label>Infeed</label><select id="pInfeed"><option value=""${!p.power.infeed ? ' selected' : ''}>none</option><option value="6"${p.power.infeed && p.power.infeed.length === 6 ? ' selected' : ''}>base power infeed 6'</option><option value="12"${p.power.infeed && p.power.infeed.length === 12 ? ' selected' : ''}>base power infeed 12'</option></select></div>` : ''}
      <h3>${thin ? 'FRAMELESS GLASS SCREEN' : 'PANEL TOP SCREEN'}</h3>
      ${thin ? `<div class="row"><label>Glass</label><select id="pGlass"><option value=""${!p.glassScreen ? ' selected' : ''}>none</option><option value="r6"${p.glassScreen && p.glassScreen.attach === 'recessed' && p.glassScreen.height === 6 ? ' selected' : ''}>recessed 6"H</option><option value="r12"${p.glassScreen && p.glassScreen.attach === 'recessed' && p.glassScreen.height === 12 ? ' selected' : ''}>recessed 12"H</option><option value="r18"${p.glassScreen && p.glassScreen.attach === 'recessed' && p.glassScreen.height === 18 ? ' selected' : ''}>recessed 18"H</option><option value="c12"${p.glassScreen && p.glassScreen.attach === 'clip' ? ' selected' : ''}>clip 12"H</option></select>
        ${p.glassScreen ? `<input type="checkbox" id="pFrost"${p.glassScreen.frosted ? ' checked' : ''}><label style="min-width:0">frosted</label><input type="checkbox" id="pOmitGlass"${p.glassScreen.omitGlass ? ' checked' : ''}><label style="min-width:0">omit glass</label>` : ''}</div>` :
        `<div class="row"><input type="checkbox" id="pTopScreen"${p.topScreen ? ' checked' : ''}><label style="min-width:0">12"H translucent panel top screen (30–48"W, painted top cap)</label></div>`}
      <h3>PARTS FOR THIS PANEL <span class="kv">${money(lines.reduce((a, l) => a + l.ext, 0))}</span></h3>
      <div class="list" style="max-height:none">${lines.map(l => `<div class="item" title="${esc(l.spec)}"><span>${l.qty}× <b style="color:var(--blue)">${esc(l.style)}</b> ${esc(l.desc)}</span><span class="k">${money(l.ext)} p${l.page}</span></div>`).join('') || '<div class="item">none</div>'}</div>
      <h3>ACTIONS</h3>
      <div class="row"><button class="btn" id="pDup">DUPLICATE IN-LINE</button><button class="btn danger" id="pDel">DELETE PANEL</button></div>`;
    // wire
    $('#pLabel').onchange = e => mutate(() => p.label = e.target.value.trim(), true);
    $('#pW').onchange = e => mutate(() => { const w = +e.target.value; const a = P.nodes[p.a], b = P.nodes[p.b]; const ang = Math.atan2(b.y - a.y, b.x - a.x); const others = Object.values(P.panels).filter(q => q !== p && (q.a === p.b || q.b === p.b)); if (others.length) { toast('End junction is shared. Width change moves the far junction and everything attached moves with it.'); shiftSubtree(p.b, p.a, Math.cos(ang) * (w - p.width), Math.sin(ang) * (w - p.width)); } else { b.x = a.x + Math.cos(ang) * w; b.y = a.y + Math.sin(ang) * w; } p.width = w; }, true);
    $('#pH').onchange = e => mutate(() => E.setHeight(P, p, +e.target.value), true);
    $('#pStack').onchange = e => mutate(() => E.setStack(P, p, e.target.value ? e.target.value.split(',').map(Number) : []), true);
    $('#pTopCap').onchange = e => mutate(() => { p.topCap.wood = e.target.value === 'wood'; p.topCap.omit = e.target.value === 'omit'; }, true);
    $('#pBase').onchange = e => mutate(() => p.baseTrim = e.target.value, true);
    $('#pOpen').onchange = e => mutate(() => p.openBase = e.target.checked, true);
    $('#pFloor').onchange = e => mutate(() => p.skinsToFloor = e.target.checked, true);
    $('#pTray').onchange = e => mutate(() => p.cableTray = e.target.checked, true);
    $('#pBTray').onchange = e => mutate(() => p.baseCableTray = e.target.checked, true);
    $('#pPower').onchange = e => mutate(() => { p.power.kind = e.target.value; if (p.power.kind === 'powerkit' && !p.power.receptacles.some(x => x)) p.power.receptacles = [1, 1]; }, true);
    $('#pPowerLoc').onchange = e => mutate(() => p.power.location = e.target.value, true);
    for (const [id, f] of [['pR0', v => p.power.receptacles[0] = v], ['pR1', v => p.power.receptacles[1] = v], ['pU0', v => p.power.usb[0] = v], ['pU1', v => p.power.usb[1] = v]]) { const el = $('#' + id); if (el) el.onchange = e => mutate(() => f(Math.max(0, +e.target.value | 0)), true); }
    const inf = $('#pInfeed'); if (inf) inf.onchange = e => mutate(() => p.power.infeed = e.target.value ? { length: +e.target.value } : null, true);
    const g = $('#pGlass'); if (g) g.onchange = e => mutate(() => { const v = e.target.value; p.glassScreen = v ? { attach: v[0] === 'c' ? 'clip' : 'recessed', height: +v.slice(1), frosted: false, omitGlass: false } : null; }, true);
    const fr = $('#pFrost'); if (fr) fr.onchange = e => mutate(() => p.glassScreen.frosted = e.target.checked, true);
    const og = $('#pOmitGlass'); if (og) og.onchange = e => mutate(() => p.glassScreen.omitGlass = e.target.checked, true);
    const ts = $('#pTopScreen'); if (ts) ts.onchange = e => mutate(() => p.topScreen = e.target.checked, true);
    $('#pDel').onclick = () => mutate(() => { E.removePanel(P, p.id); sel = { kind: null }; });
    $('#pDup').onclick = () => mutate(() => { const a = P.nodes[p.a], b = P.nodes[p.b]; const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; const q = E.addPanel(P, b, ang, p.width, p.height); const keep = q.id; Object.assign(q, JSON.parse(JSON.stringify(p)), { id: keep, a: q.a, b: q.b, label: '' }); sel = { kind: 'panel', id: keep }; }, true);
    // segments
    const segsOf = (key) => key === 's0' ? p.sides[0] : key === 's1' ? p.sides[1] : p.stackSides[+key[1]][+key[2]];
    side.querySelectorAll('.segrow').forEach(row => {
      const segs = segsOf(row.dataset.key), i = +row.dataset.i, seg = segs[i];
      row.querySelectorAll('[data-f]').forEach(el => {
        const f = el.dataset.f;
        if (f === 'del') el.onclick = () => mutate(() => { segs.splice(i, 1); }, true);
        else el.onchange = () => mutate(() => {
          const v = el.value;
          if (f === 'type') { if (v === 'window') { seg.kind = 'window'; delete seg.type; seg.pane = 'single'; if (![12, 18, 24].includes(seg.height)) seg.height = 12; } else { seg.kind = 'skin'; seg.type = v; delete seg.pane; delete seg.frosted; } }
          else if (f === 'height') seg.height = +v;
          else if (f === 'pane') { seg.pane = v === 'double' ? 'double' : 'single'; seg.frosted = v === 'frosted'; }
          else if (f === 'finish') seg.finish = v || undefined;
          else if (f === 'cutouts') seg.cutouts = v;
          else if (f === 'fabric') { const fb = findFabric(v); if (fb) seg.fabric = fb; else delete seg.fabric; }
        }, true);
      });
    });
    side.querySelectorAll('[data-add]').forEach(b => b.onclick = () => mutate(() => { const key = b.dataset.add; const segs = segsOf(key); const target = key[0] === 's' ? skinH : p.stack[+key[1]]; const rem = target - segs.reduce((a, s) => a + s.height, 0); const h = E.SKIN_HEIGHTS.filter(x => x <= Math.max(rem, 12)).pop() || 12; segs.push({ kind: 'skin', type: P.finishes.skinType, height: h }); }, true));
    side.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => mutate(() => {
      const [key, what] = b.dataset.preset.split(':');
      if (key[0] === 'k') { const i = +key[1]; const st = p.stack[i]; if (what === 'win') p.stackSides[i] = [[{ kind: 'window', height: st, pane: 'single' }], [{ kind: 'window', height: st, pane: 'single' }]]; return; }
      const si = +key[1]; const mono = () => [{ kind: 'skin', type: P.finishes.skinType, height: skinH }];
      if (what === 'mono') p.sides[si] = mono();
      if (what === 'copy') p.sides[1] = JSON.parse(JSON.stringify(p.sides[0]));
      if (what === 'split') p.sides[si] = skinH > 24 ? [{ kind: 'skin', type: P.finishes.skinType, height: 24 }, { kind: 'skin', type: P.finishes.skinType, height: skinH - 24 }] : mono();
      if (what === 'win') { const wh = skinH >= 36 ? 12 : 12; p.sides[si] = [{ kind: 'skin', type: P.finishes.skinType, height: skinH - wh }, { kind: 'window', height: wh, pane: 'single' }]; if (si === 0) p.sides[1] = JSON.parse(JSON.stringify(p.sides[0])); }
    }, true));
  }
  function shiftSubtree(startNode, exceptNode, dx, dy) {
    // move node and all connected nodes except across exceptNode
    const seen = new Set([exceptNode]); const stack = [startNode];
    while (stack.length) { const nid = stack.pop(); if (seen.has(nid)) continue; seen.add(nid); const n = P.nodes[nid]; n.x += dx; n.y += dy; for (const q of Object.values(P.panels)) { if (q.a === nid && !seen.has(q.b)) stack.push(q.b); if (q.b === nid && !seen.has(q.a)) stack.push(q.a); } }
  }
  function renderNodePane(side, n) {
    const J = result.nodes[n.id]; const lines = result.lines.filter(l => l.src === n.id);
    const legs = J.legs || [];
    side.innerHTML = `
      <div class="big">${n.id} — JUNCTION ${J.type && J.type !== 'none' ? jtLabel(J) : '(empty)'}</div>
      <div class="kv">at (${n.x}", ${n.y}") · ${legs.length} panel(s)${J.reason ? `<div class="err">${esc(J.reason)}</div>` : ''}</div>
      ${legs.length === 1 ? `<div class="row"><input type="checkbox" id="nWall"${n.wallStart ? ' checked' : ''}><label style="min-width:0">Wall-start junction (secures to wall, no trim; not at 30"H)</label></div>` : ''}
      <h3>ADD PANEL FROM HERE</h3>
      <div class="row"><label>Width</label><select id="nW">${optList(E.WIDTHS, $('#defW').value, v => v + '"')}</select><label style="min-width:0">Height</label><select id="nH">${optList(E.HEIGHTS, $('#defH').value, v => v + '"')}</select></div>
      <div class="kv">Direction (90° family: E N W S · 120° family: 60° steps)</div>
      <div class="compass">${[0, 90, 180, 270, 60, 120, 240, 300, 30, 150, 210, 330].map(a => `<button class="btn" data-ang="${a}" ${legs.some(l => l.angle === a) ? 'disabled' : ''}>${a}°${{ 0: ' E', 90: ' N', 180: ' W', 270: ' S' }[a] || ''}</button>`).join('')}</div>
      <h3>PANELS AT THIS JUNCTION</h3>
      <div class="list">${legs.map(l => `<div class="item" data-sel="${l.panel.id}"><span>${l.panel.id} ${l.panel.label ? '(' + esc(l.panel.label) + ')' : ''} at ${l.angle}° — ${l.panel.width}"W × ${l.total}"H</span><span class="k">slot ${l.slot ?? '-'}</span></div>`).join('') || '<div class="item">none</div>'}</div>
      <h3>JUNCTION PARTS <span class="kv">${money(lines.reduce((a, l) => a + l.ext, 0))}</span></h3>
      <div class="list" style="max-height:none">${lines.map(l => `<div class="item" title="${esc(l.spec)}"><span>${l.qty}× <b style="color:var(--blue)">${esc(l.style)}</b> ${esc(l.desc)}${l.flags.map(f => `<br><span style="color:#ffd08a">⚠ ${esc(f)}</span>`).join('')}${l.notes.map(f => `<br><span class="kv">${esc(f)}</span>`).join('')}</span><span class="k">${money(l.ext)} p${l.page}</span></div>`).join('') || '<div class="item">none</div>'}</div>
      <h3>ACTIONS</h3><div class="row">${legs.length === 0 ? '<button class="btn danger" id="nDel">DELETE JUNCTION</button>' : ''}</div>`;
    const w = $('#nWall'); if (w) w.onchange = e => mutate(() => n.wallStart = e.target.checked, true);
    side.querySelectorAll('[data-ang]').forEach(b => b.onclick = () => mutate(() => { const q = E.addPanel(P, n, +b.dataset.ang, +$('#nW').value, +$('#nH').value); sel = { kind: 'node', id: q.b }; }, true));
    side.querySelectorAll('[data-sel]').forEach(el => el.onclick = () => { sel = { kind: 'panel', id: el.dataset.sel }; afterModelChange(true); });
    const d = $('#nDel'); if (d) d.onclick = () => mutate(() => { delete P.nodes[n.id]; sel = { kind: null }; });
  }

  // ---------- lists ----------
  function renderLists() {
    $('#panelList').innerHTML = Object.values(P.panels).map(p => `<div class="item${sel.kind === 'panel' && sel.id === p.id ? ' on' : ''}" data-p="${p.id}"><span>${p.id} ${p.label ? '(' + esc(p.label) + ')' : ''} ${p.width}"W × ${p.height}${p.stack.length ? '+' + p.stack.join('+') : ''}"H</span><span class="k">${p.power.kind !== 'none' ? 'PWR ' : ''}${money(result.lines.filter(l => l.src === p.id).reduce((a, l) => a + l.ext, 0))}</span></div>`).join('') || '<div class="item">no panels yet</div>';
    $('#nodeList').innerHTML = Object.values(P.nodes).map(n => { const J = result.nodes[n.id]; return `<div class="item${sel.kind === 'node' && sel.id === n.id ? ' on' : ''}" data-n="${n.id}"><span>${n.id} ${jtLabel(J)}</span><span class="k">${money(result.lines.filter(l => l.src === n.id).reduce((a, l) => a + l.ext, 0))}</span></div>`; }).join('') || '<div class="item">none</div>';
    $$('#panelList [data-p]').forEach(el => el.onclick = () => { sel = { kind: 'panel', id: el.dataset.p }; afterModelChange(true); });
    $$('#nodeList [data-n]').forEach(el => el.onclick = () => { sel = { kind: 'node', id: el.dataset.n }; afterModelChange(true); });
  }

  // ---------- BOM ----------
  const CATS = ['Junction', 'Stacking', 'Trim', 'Panel', 'Frame', 'Skins', 'Glass', 'Power', 'Accessories'];
  function catOrder(c) { const i = CATS.indexOf(c); return i < 0 ? 99 : i; }
  function renderBOM() {
    const lines = result.lines.slice().sort((a, b) => catOrder(a.cat) - catOrder(b.cat) || a.src.localeCompare(b.src, undefined, { numeric: true }) || a.style.localeCompare(b.style));
    $('#bomTop').innerHTML = `<span class="pill">Project <b>${esc(P.name)}</b></span><span class="pill">${P.trim.toUpperCase()} TRIM</span><span class="pill">${lines.length} lines</span><span class="pill">U.S. list <b>${money(result.totals.all)}</b></span><span class="pill">Canadian ×1.09 <b>${money(result.totals.canadian)}</b></span><span class="pill">${result.errors.length} errors · ${result.warnings.length} warnings</span><span class="pill">${new Date().toLocaleDateString('en-US')}</span><span class="pill">Steelcase Answer spec guide Feb 2015 pricing</span>`;
    let html = '<table class="bom"><thead><tr><th class="n">QTY</th><th>STYLE NUMBER</th><th>DESCRIPTION</th><th>SPECIFY (FINISH / OPTIONS)</th><th class="n">UNIT</th><th class="n">EXT</th><th>PAGE</th><th>WHERE</th></tr></thead><tbody>';
    let cur = null, sub = 0;
    const flush = () => { if (cur !== null) html += `<tr class="sub"><td colspan="5" style="text-align:right">${esc(cur)} subtotal</td><td class="n">${money(sub)}</td><td></td><td></td></tr>`; sub = 0; };
    for (const l of lines) {
      if (l.cat !== cur) { flush(); cur = l.cat; html += `<tr class="cat"><td colspan="8">${esc(cur.toUpperCase())}</td></tr>`; }
      sub += l.ext;
      html += `<tr><td class="n">${l.qty}</td><td class="style">${esc(l.style)}</td><td>${esc(l.desc)}${l.flags.map(f => `<span class="flag${/CORRECTED/.test(f) ? ' red' : ''}">⚠ ${esc(f)}</span>`).join('')}${l.notes.map(f => `<span class="nt">${esc(f)}</span>`).join('')}</td><td>${esc(l.spec)}</td><td class="n">${money(l.unit)}</td><td class="n">${money(l.ext)}</td><td>${l.page ? 'p' + l.page : ''}</td><td>${esc(l.src)}</td></tr>`;
    }
    flush();
    html += `<tr class="tot"><td colspan="5" style="text-align:right">TOTAL U.S. LIST</td><td class="n">${money(result.totals.all)}</td><td colspan="2">Canadian list ${money(result.totals.canadian)}</td></tr></tbody></table>`;
    $('#bomWrap').innerHTML = html;
  }
  function renderPull() {
    const agg = E.aggregate(result.lines);
    $('#pullTop').innerHTML = `<span class="pill">Order pull — identical style + specification merged</span><span class="pill">${agg.length} SKUs</span><span class="pill">${agg.reduce((a, x) => a + x.qty, 0)} pieces</span><span class="pill">U.S. list <b>${money(result.totals.all)}</b></span>`;
    let html = '<table class="bom"><thead><tr><th class="n">QTY</th><th>STYLE NUMBER</th><th>DESCRIPTION</th><th>SPECIFY</th><th class="n">UNIT</th><th class="n">EXT</th><th>PAGE</th><th>USED AT</th></tr></thead><tbody>';
    let cur = null;
    for (const a of agg.slice().sort((x, y) => catOrder(x.cat) - catOrder(y.cat) || x.style.localeCompare(y.style))) {
      if (a.cat !== cur) { cur = a.cat; html += `<tr class="cat"><td colspan="8">${esc(cur.toUpperCase())}</td></tr>`; }
      html += `<tr><td class="n"><b>${a.qty}</b></td><td class="style">${esc(a.style)}</td><td>${esc(a.desc.replace(/ — side \d.*$/, '').replace(/\(\d+"→\d+"\)/, ''))}${a.flags.map(f => `<span class="flag">⚠ ${esc(f)}</span>`).join('')}</td><td>${esc(a.spec)}</td><td class="n">${money(a.unit)}</td><td class="n">${money(a.ext)}</td><td>p${a.page}</td><td class="kv">${a.src.join(', ')}</td></tr>`;
    }
    html += `<tr class="tot"><td colspan="5" style="text-align:right">TOTAL U.S. LIST</td><td class="n">${money(result.totals.all)}</td><td colspan="2"></td></tr></tbody></table>`;
    $('#pullWrap').innerHTML = html;
  }
  function renderIssues() {
    const w = $('#issuesWrap');
    const flagged = result.lines.filter(l => l.flags.length);
    w.innerHTML = `<h3>ERRORS (${result.errors.length})</h3>${result.errors.map(e => `<div class="err"><b>${esc(e.panel || e.node)}</b> — ${esc(e.msg)}</div>`).join('') || '<div class="note">none</div>'}
      <h3>WARNINGS (${result.warnings.length})</h3>${result.warnings.map(e => `<div class="warn"><b>${esc(e.panel || e.node)}</b> — ${esc(e.msg)}</div>`).join('') || '<div class="note">none</div>'}
      <h3>FLAGGED LINES (${flagged.length})</h3>${flagged.map(l => `<div class="warn"><b>${esc(l.src)}</b> ${esc(l.style)} ${esc(l.desc)}<br>${l.flags.map(esc).join('<br>')}</div>`).join('') || '<div class="note">none</div>'}
      <h3>FOOTPRINT</h3><div class="note">${result.footprint.map(f => `${f.panel}: ${f.nominal}" nominal → ${E.inch(f.actual)} ${f.notes.length ? '(' + f.notes.join(', ') + ')' : ''}`).join('<br>') || 'no panels'}<br><br>Junction depth ${E.ACTUAL.depth}. Leveling glide range ${E.ACTUAL.glideRange}. In-line junctions add nothing to the run length.</div>`;
    w.querySelectorAll('.err b, .warn b').forEach(b => { b.style.cursor = 'pointer'; b.onclick = () => { const id = b.textContent.split(',')[0]; sel = P.panels[id] ? { kind: 'panel', id } : P.nodes[id] ? { kind: 'node', id } : sel; showView('vPlan'); afterModelChange(true); }; });
  }
  function renderPowerSummary() {
    const kits = Object.values(P.panels).filter(p => p.power.kind === 'powerkit'), pts = Object.values(P.panels).filter(p => p.power.kind === 'passthrough');
    const rec = result.lines.filter(l => l.pid === 'wc-duplex-receptacle' || l.pid === 'wc-usb-receptacle').reduce((a, l) => a + l.qty, 0);
    const infeeds = Object.values(P.panels).filter(p => p.power.infeed).length;
    const cap = P.power.schematic === 'Z' ? 30 : 40;
    $('#powerSummary').innerHTML = `Powerkits <b>${kits.length}</b> · pass-through <b>${pts.length}</b> · receptacles <b>${rec}</b> · infeeds <b>${infeeds}</b><br>NEC guide: max ${cap} receptacles per power-in for this schematic → ${infeeds ? `${Math.ceil(rec / cap)} infeed(s) needed, ${infeeds} placed` : rec ? `<span style="color:#ffd08a">${Math.ceil(rec / cap)} infeed(s) needed, none placed</span>` : 'no receptacles'}`;
  }

  // ---------- catalog browser ----------
  function renderCatalog() {
    const q = $('#catQ').value.trim().toLowerCase(), tf = $('#catTrim').value;
    const out = [];
    for (const p of E.products()) {
      if (tf && p.trim !== tf && !(tf === 'oval' && p.trim === 'square-oval')) continue;
      const hay = (p.name + ' ' + p.category + ' ' + p.id + ' p' + p.pages.join(' p')).toLowerCase();
      let rows = p.rows;
      if (q) { if (!hay.includes(q)) { rows = p.rows.filter(r => r.style.toLowerCase().includes(q)); if (!rows.length) continue; } }
      out.push({ p, rows });
      if (out.length >= 40) break;
    }
    $('#catCount').textContent = `${out.length} product group(s)${out.length >= 40 ? ' (first 40)' : ''}`;
    $('#catResults').innerHTML = out.map(({ p, rows }) => `<div class="cat-prod"><h4>${esc(p.name)}</h4><div class="meta">${esc(p.trim)} · ${esc(p.category)} · p${p.pages.join(', ')}${p.detailsPages && p.detailsPages.length ? ' · details p' + p.detailsPages.join(', ') : ''}</div>
      ${p.standardIncludes && p.standardIncludes.length ? `<div class="meta">Includes: ${p.standardIncludes.map(esc).join('; ')}</div>` : ''}
      ${(p.options || []).length ? `<div>${p.options.map(o => `<span class="chip" title="${esc(o.spec || '')}">${esc(o.name)} ${typeof o.price === 'number' ? (o.price ? (o.price > 0 ? '+' : '–') + '$' + Math.abs(o.price) : 'n/c') : o.priceBy ? Object.entries(o.priceBy).map(([k, v]) => k + ' ' + (v == null ? 'n.a.' : (v >= 0 ? '+' : '–') + '$' + Math.abs(v))).join(' / ') : (o.priceNote || '')}</span>`).join('')}</div>` : ''}
      ${(p.tips || []).length ? `<details><summary class="meta">tips (${p.tips.length})</summary>${p.tips.map(t => `<div class="meta">• ${esc(t)}</div>`).join('')}</details>` : ''}
      <div class="cat-rows"><table>${rows.slice(0, 200).map(r => `<tr><td class="s">${esc(r.style)}${r.correction ? ' <span style="color:var(--red)" title="' + esc(r.correction) + '">✎</span>' : ''}</td><td>${esc(r.group || '')}</td><td>${esc(Object.entries(r.attrs || {}).filter(([k]) => !['configuration', 'page', 'wiringSchematic'].includes(k)).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join('+') : v}`).join(' · '))}</td><td class="n">${r.price != null ? '$' + r.price : ''}</td><td><button class="btn sm" data-addstyle="${esc(r.style)}" title="add to BOM as a manual line">+</button></td></tr>`).join('')}</table></div></div>`).join('');
    $$('#catResults [data-addstyle]').forEach(b => b.onclick = () => { const style = b.dataset.addstyle; const spec = prompt(`Add ${style} to the BOM.\nSpecify finish / options text (optional):`, ''); if (spec === null) return; const qty = +prompt('Quantity:', '1') || 1; mutate(() => { P.manual.push({ style, qty, spec }); }, true); toast(`${qty}× ${style} added as a manual line`); });
  }
  $('#catQ').oninput = renderCatalog; $('#catTrim').onchange = renderCatalog;

  // ---------- finishes ----------
  function findFabric(v) { v = (v || '').trim().toLowerCase(); if (!v) return null; const code = v.split(' ')[0]; return E.fabrics().find(f => f.code && f.code.toLowerCase() === code) || E.fabrics().find(f => (f.code + ' ' + f.name).toLowerCase().includes(v)) || null; }
  function paintOpts(list, cur) { return list.map(p => `<option value="${p.code}"${p.code === cur ? ' selected' : ''}>${p.code} ${esc(p.name)} — group ${p.group}${p.type ? ' ' + esc(p.type) : ''}</option>`).join(''); }
  function buildFinishUI() {
    const trimPaints = E.paints('Panel trim components'), steelPaints = E.paints('Steel skins and technology skins');
    $('#fTrimPaint').innerHTML = paintOpts(trimPaints, P.finishes.trimPaint.code);
    $('#fSteelPaint').innerHTML = paintOpts(steelPaints.length ? steelPaints : E.allPaints(), P.finishes.steelPaint.code);
    $('#fWood').innerHTML = E.woods().map(w => `<option value="${w.code}"${w.code === P.finishes.wood.code ? ' selected' : ''}>${w.code} ${esc(w.name)} ${w.prefix ? esc(w.prefix) : ''}${w.group && w.group > 1 ? ' — premium group ' + w.group : ''}</option>`).join('');
    $('#fLaminate').innerHTML = E.laminates().filter(l => l.code).map(l => `<option value="${l.code}"${l.code === P.finishes.laminate.code ? ' selected' : ''}>${l.code} ${esc(l.name)} — ${esc(l.family || '')}</option>`).join('');
    $('#fabricList').innerHTML = E.fabrics().filter(f => f.code && f.group && f.group !== 'n/a').map(f => `<option value="${f.code}">${f.code} ${esc(f.collection || '')} ${esc(f.name)} — group ${f.group}</option>`).join('');
    const plastics = (E.product('wc-duplex-receptacle').options || []).filter(o => o.code.startsWith('color'));
    $('#fPlastic').innerHTML = plastics.map(o => `<option value="${o.code.slice(5)}"${o.code.slice(5) === P.finishes.plasticColor ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
    $('#defW').innerHTML = optList(E.WIDTHS, 48, v => v + '"'); $('#defH').innerHTML = optList(E.HEIGHTS, 54, v => v + '"');
    const upd = (fn) => mutate(fn, true);
    $('#fTrimPaint').onchange = e => upd(() => { const p = E.allPaints().find(x => x.code === e.target.value); P.finishes.trimPaint = { code: p.code, name: p.name, group: p.group || 1 }; });
    $('#fSteelPaint').onchange = e => upd(() => { const p = E.allPaints().find(x => x.code === e.target.value); P.finishes.steelPaint = { code: p.code, name: p.name, group: p.group || 1 }; });
    $('#fWood').onchange = e => upd(() => { const w = E.woods().find(x => x.code === e.target.value); P.finishes.wood = { code: w.code, name: w.name, cut: w.cut, group: w.group || 1 }; });
    $('#fLaminate').onchange = e => upd(() => { const l = E.laminates().find(x => x.code === e.target.value); P.finishes.laminate = { code: l.code, name: l.name }; });
    $('#fWoodTrim').onchange = e => upd(() => P.finishes.woodTrim = e.target.checked);
    $('#fOvalTrim').onchange = e => upd(() => { P.finishes.ovalTrimFabric = e.target.value === 'fabric'; P.finishes.ovalWoodTrim = e.target.value === 'wood'; if (e.target.value === 'wood') P.finishes.woodTrim = true; });
    $('#fSkinType').onchange = e => upd(() => P.finishes.skinType = e.target.value);
    $('#fFabric').onchange = e => { const f = findFabric(e.target.value); if (!f) { toast('Fabric not found in the guide list'); return; } upd(() => P.finishes.fabric = { code: f.code, name: (f.collection ? f.collection + ' ' : '') + f.name, group: f.group }); };
    $('#fFabricDir').onchange = e => upd(() => P.finishes.fabricDirection = e.target.value);
    $('#fPlastic').onchange = e => upd(() => P.finishes.plasticColor = e.target.value);
    $('#pSchem').onchange = e => upd(() => P.power.schematic = e.target.value);
    $('#pPvc').onchange = e => upd(() => P.power.nonPvc = e.target.value === '1');
    $('#pAmps').onchange = e => upd(() => P.power.receptacleAmps = +e.target.value);
    $('#pGround').onchange = e => upd(() => P.power.ground = e.target.value);
    $('#oPackages').onchange = e => upd(() => P.options.usePanelPackages = e.target.checked);
    $('#oCohCap').onchange = e => upd(() => P.options.cohTopCapAuto = e.target.checked);
    $('#oGlide').onchange = e => upd(() => P.options.includeGlideCaps = e.target.checked);
    $('#oOvalProfile').onchange = e => upd(() => P.options.ovalCohProfile = e.target.value);
    const s = CAT.surface;
    $('#dataStats').innerHTML = `${E.products().length} product groups · ${E.products().reduce((a, p) => a + p.rows.length, 0)} style numbers<br>${s.paints.length} paints · ${s.fabrics.length} fabrics · ${s.woodVeneers.length} veneers · ${s.laminates.length} laminates<br>Source: ${esc(CAT.source)}`;
    $('#inconsistencies').innerHTML = `• p400 Square V/Y junctions, wood cap 48" V row is printed TS742SVPJW (same as the 42" row). Corrected to TS748SVPJW and flagged on the BOM.<br>• p401 Oval V/Y junctions, plastic cap 48" V row is printed TS742VPJ. Corrected to TS748VPJ and flagged on the BOM.<br>• p487 Series 9000 grommet color 6612 Grey V2 carries an unreadable symbol. Offered, marked verify.<br>• p38 Practice Example Two lists a 66" inside corner light seal for a 54" tallest junction. The configurator follows the p34 rule (seal height = tallest junction, field cut for shorter) and uses 54" — pending review.`;
  }
  function syncFinishUI() {
    const F = P.finishes;
    $('#fTrimPaint').value = F.trimPaint.code; $('#fSteelPaint').value = F.steelPaint.code; $('#fWood').value = F.wood.code; $('#fLaminate').value = F.laminate.code;
    $('#fWoodTrim').checked = !!F.woodTrim; $('#fSkinType').value = F.skinType; $('#fFabric').value = F.fabric.code; $('#fFabricDir').value = F.fabricDirection; $('#fPlastic').value = F.plasticColor;
    $('#fOvalTrim').value = F.ovalTrimFabric ? 'fabric' : F.ovalWoodTrim ? 'wood' : 'paint';
    $('#fabricInfo').textContent = `${F.fabric.code} ${F.fabric.name} — fabric price group ${F.fabric.group}`;
    $('#woodTrimHint').textContent = P.trim === 'thin' ? 'wood vertical trims, change-of-height trims and junction caps (W suffix)' : 'wood junction caps (W suffix); wood trim face optional below';
    $('#rowOvalTrim').classList.toggle('hidden', P.trim !== 'oval'); $('#rowOvalProfile').classList.toggle('hidden', P.trim !== 'oval');
    $('#pSchem').value = P.power.schematic; $('#pPvc').value = P.power.nonPvc ? '1' : '0'; $('#pAmps').value = String(P.power.receptacleAmps || 15); $('#pGround').value = P.power.ground || 'System Ground';
    $('#oPackages').checked = P.options.usePanelPackages; $('#oCohCap').checked = P.options.cohTopCapAuto !== false; $('#oGlide').checked = !!P.options.includeGlideCaps; $('#oOvalProfile').value = P.options.ovalCohProfile || 'Slim Profile';
  }

  // ---------- views, rail, header ----------
  function showView(id) { $$('#stagebar .tab').forEach(t => t.classList.toggle('on', t.dataset.view === id)); $$('.view').forEach(v => v.classList.toggle('on', v.id === id)); if (id === 'vPlan') resizeCanvases(); }
  $$('#stagebar .tab').forEach(t => t.onclick = () => showView(t.dataset.view));
  let openFly = null;
  $$('nav.rail button[data-fly]').forEach(b => b.onclick = () => { const id = b.dataset.fly; const same = openFly === id; $$('.flyout').forEach(f => f.classList.remove('open')); $$('nav.rail button').forEach(x => x.classList.remove('on')); openFly = null; if (!same) { $('#' + id).classList.add('open'); b.classList.add('on'); openFly = id; if (id === 'fCatalog') renderCatalog(); } });
  $$('#trimSeg button').forEach(b => b.onclick = () => { if (P.trim === b.dataset.trim) return; mutate(() => { P.trim = b.dataset.trim; }); toast(`Project switched to ${P.trim.toUpperCase()} trim. All junctions, trims and packages regenerated.`); });
  $('#bNew').onclick = () => { if (!confirm('Start a new project? Unsaved work is kept in this browser until you start another.')) return; mutate(() => { P = E.newProject(P.trim); sel = { kind: null }; }); fitView(); afterModelChange(); };
  $('#bSave').onclick = () => { P.name = $('#projName').value; P.build = BUILD; P.saved = new Date().toISOString(); download((P.name || 'answer').replace(/[^\w\-]+/g, '_') + '.answer', JSON.stringify(P, null, 1), 'application/json'); };
  $('#bLoad').onclick = () => $('#fileIn').click();
  $('#fileIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const obj = JSON.parse(r.result); if (obj.app !== 'ANSWER') throw new Error('not an ANSWER file'); snapshot(); P = migrate(obj); sel = { kind: null }; fitView(); afterModelChange(); toast('Loaded ' + f.name); } catch (err) { alert('Could not load: ' + err.message); } }; r.readAsText(f); e.target.value = ''; };
  function migrate(obj) { const base = E.newProject(obj.trim || 'thin'); const P2 = Object.assign(base, obj); P2.finishes = Object.assign(base.finishes, obj.finishes || {}); P2.power = Object.assign(base.power, obj.power || {}); P2.options = Object.assign(base.options, obj.options || {}); P2.manual = obj.manual || []; for (const p of Object.values(P2.panels)) { p.stackSides = p.stackSides || []; p.power = Object.assign({ kind: 'none', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null }, p.power || {}); p.topCap = p.topCap || { wood: false, omit: false }; } return P2; }
  $('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
  $('#bPrint').onclick = () => { if (!$('#vBom').classList.contains('on') && !$('#vPull').classList.contains('on')) showView('vBom'); setTimeout(() => window.print(), 100); };
  $('#bCsv').onclick = () => { const cols = [{ label: 'Qty', key: 'qty' }, { label: 'Style Number', key: 'style' }, { label: 'Description', key: 'desc' }, { label: 'Specify', key: 'spec' }, { label: 'Unit US List', key: 'unit' }, { label: 'Ext US List', key: 'ext' }, { label: 'Guide Page', key: 'page' }, { label: 'Category', key: 'cat' }, { label: 'Where', key: 'src' }, { label: 'Flags', get: l => l.flags.join(' | ') }, { label: 'Notes', get: l => l.notes.join(' | ') }]; download((P.name || 'answer') + '_BOM.csv', E.toCSV(result.lines, cols), 'text/csv'); };
  $('#bCsvPull').onclick = () => { const cols = [{ label: 'Qty', key: 'qty' }, { label: 'Style Number', key: 'style' }, { label: 'Description', get: a => a.desc.replace(/ — side \d.*$/, '') }, { label: 'Specify', key: 'spec' }, { label: 'Unit US List', key: 'unit' }, { label: 'Ext US List', key: 'ext' }, { label: 'Guide Page', key: 'page' }, { label: 'Category', key: 'cat' }, { label: 'Used At', get: a => a.src.join(' ') }, { label: 'Flags', get: a => a.flags.join(' | ') }]; download((P.name || 'answer') + '_ORDER_PULL.csv', E.toCSV(E.aggregate(result.lines), cols), 'text/csv'); };
  $('#projName').onchange = e => mutate(() => P.name = e.target.value, true);
  $('#bStartOrigin').onclick = () => mutate(() => { let n = E.nodeAt(P, 0, 0, 1); if (!n) n = E.addNode(P, 0, 0); sel = { kind: 'node', id: n.id }; }, true);
  $('#bFit').onclick = () => { fitView(); drawPlan(); };
  $('#bQuickRun').onclick = () => { if (sel.kind !== 'node') { toast('Select a junction first'); return; } const ws = $('#runWidths').value.split(',').map(s => +s.trim()).filter(w => E.WIDTHS.includes(w)); if (!ws.length) { toast('Enter widths like 48,48,36'); return; } const dir = +$('#runDir').value; mutate(() => { let n = P.nodes[sel.id]; for (const w of ws) { const q = E.addPanel(P, n, dir, w, +$('#defH').value); n = P.nodes[q.b]; } sel = { kind: 'node', id: n.id }; }, true); fitView(); drawPlan(); };
  // split drag
  (function () { const sp = $('#split'); let drag = null; sp.onmousedown = e => { drag = { x: e.clientX, w: $('#side').getBoundingClientRect().width }; e.preventDefault(); }; window.addEventListener('mousemove', e => { if (!drag) return; const w = Math.max(300, Math.min(700, drag.w - (e.clientX - drag.x))); document.documentElement.style.setProperty('--paneW', w + 'px'); resizeCanvases(); }); window.addEventListener('mouseup', () => drag = null); })();
  window.addEventListener('resize', resizeCanvases);
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); } if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); } if (e.key === 'Delete' && sel.kind === 'panel' && document.activeElement.tagName !== 'INPUT') mutate(() => { E.removePanel(P, sel.id); sel = { kind: null }; }); });

  // ---------- demos ----------
  const DEMOS = {
    'L workstation — 66" spine, 54" returns (Thin)': () => {
      const P2 = E.newProject('thin'); const o = E.addNode(P2, 0, 0);
      let n = o; for (const w of [48, 48]) { const q = E.addPanel(P2, n, 0, w, 66); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [0, 0], infeed: n === o ? { length: 6 } : null }; n = P2.nodes[q.b]; }
      E.addPanel(P2, o, 270, 30, 54); const r = E.addPanel(P2, n, 270, 30, 54); r.sides = [[{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 12, pane: 'single' }], [{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 12, pane: 'single' }]];
      return P2;
    },
    'Spine and fins — 78" spine, 54" fins at T junctions (Thin)': () => {
      const P2 = E.newProject('thin'); let n = E.addNode(P2, 0, 0); const nodes = [n];
      for (let i = 0; i < 4; i++) { const q = E.addPanel(P2, n, 0, 48, 78); q.power = { kind: i % 2 ? 'passthrough' : 'powerkit', location: 'base', receptacles: [2, 2], usb: [1, 1], infeed: i === 0 ? { length: 12 } : null }; q.sides = [[{ kind: 'skin', type: 'tackable acoustical', height: 48 }, { kind: 'skin', type: 'steel', height: 12 }, { kind: 'window', height: 12, pane: 'single' }], [{ kind: 'skin', type: 'tackable acoustical', height: 48 }, { kind: 'skin', type: 'steel', height: 12 }, { kind: 'window', height: 12, pane: 'single' }]]; n = P2.nodes[q.b]; nodes.push(n); }
      for (const i of [1, 2, 3]) { E.addPanel(P2, nodes[i], 90, 60, 54); E.addPanel(P2, nodes[i], 270, 60, 54); }
      return P2;
    },
    'Stacked 66" + 24" with frameless glass (Thin)': () => {
      const P2 = E.newProject('thin'); let n = E.addNode(P2, 0, 0);
      for (const w of [48, 48]) { const q = E.addPanel(P2, n, 0, w, 66); E.setStack(P2, q, [24]); q.stackSides[0] = [[{ kind: 'skin', type: 'steel', height: 24 }], [{ kind: 'skin', type: 'steel', height: 24 }]]; q.glassScreen = { attach: 'recessed', height: 12, frosted: true, omitGlass: false }; n = P2.nodes[q.b]; }
      const r = E.addPanel(P2, n, 270, 36, 66); r.stack = [];
      return P2;
    },
    '120° pod — three 42" panels at a Y junction (Thin)': () => {
      const P2 = E.newProject('thin'); const c = E.addNode(P2, 0, 0);
      for (const a of [90, 210, 330]) { const q = E.addPanel(P2, c, a, 48, 42); E.addPanel(P2, P2.nodes[q.b], a + 60, 30, 42); }
      return P2;
    },
    'Guide practice examples p38 — BYO junctions (Thin)': () => {
      const P2 = E.newProject('thin');
      const c1 = E.addNode(P2, 0, 0); for (const [a, h] of [[0, 66], [90, 54], [180, 42], [270, 30]]) { const q = E.addPanel(P2, c1, a, 36, h); q.label = 'Ex1 ' + { 0: 'A', 90: 'B', 180: 'C', 270: 'D' }[a]; }
      const c2 = E.addNode(P2, 120, 0); for (const [a, h] of [[0, 54], [90, 54], [180, 42], [270, 30]]) { const q = E.addPanel(P2, c2, a, 36, h); q.label = 'Ex2 ' + { 0: 'A', 90: 'B', 180: 'C', 270: 'D' }[a]; }
      const c3 = E.addNode(P2, 240, 0); for (const [a, h] of [[90, 54], [210, 42], [330, 30]]) { const q = E.addPanel(P2, c3, a, 36, h); q.label = 'Ex3 ' + { 90: 'A', 210: 'B', 330: 'C' }[a]; }
      return P2;
    },
    'Oval — 66" spine with 54" returns, stacked ends': () => {
      const P2 = E.newProject('oval'); const o = E.addNode(P2, 0, 0); let n = o;
      for (const w of [48, 48, 48]) { const q = E.addPanel(P2, n, 0, w, 66); q.power = { kind: 'powerkit', location: 'base', receptacles: [2, 2], usb: [0, 0], infeed: n === o ? { length: 6 } : null }; n = P2.nodes[q.b]; }
      const r1 = E.addPanel(P2, o, 270, 36, 54); E.setStack(P2, r1, [12]); const r2 = E.addPanel(P2, n, 270, 36, 54); E.setStack(P2, r2, [12]); r2.topScreen = false;
      return P2;
    },
  };
  const ds = $('#demoSel'); for (const k in DEMOS) { const o = document.createElement('option'); o.value = k; o.textContent = k; ds.appendChild(o); }
  ds.onchange = () => { const k = ds.value; ds.value = ''; if (!k) return; snapshot(); P = DEMOS[k](); P.name = k; sel = { kind: null }; afterModelChange(); fitView(); afterModelChange(); showView('vPlan'); };

  // ---------- boot ----------
  buildFinishUI();
  try { const saved = localStorage.getItem('answer.project'); if (saved) { P = migrate(JSON.parse(saved)); } } catch (e) { }
  result = E.generate(P);
  resizeCanvases(); fitView(); afterModelChange();
})();
