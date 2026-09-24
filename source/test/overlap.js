// Text overlap sweep: every stage, inspector, modal, menu and print view at several window sizes.
// Reports DOM text boxes that overlap each other or a control, text clipped by its box, and canvas labels that collide.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'test/overlap';
fs.mkdirSync(OUT, { recursive: true });

const SCAN = (scope) => {
  const root = scope ? document.querySelector(scope) : document.body;
  const vis = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const boxes = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim()) continue; const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(el.tagName) || el.closest('#toast') || !vis(el)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1 && q.left < innerWidth - 1 && q.right > 1) boxes.push({ el, t: n.data.trim().slice(0, 40), x: q.left, y: q.top, w: q.width, h: q.height });
  }
  const ctrls = [...root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,canvas,textarea')].filter(vis).map(el => { const q = el.getBoundingClientRect(); return { el, x: q.left, y: q.top, w: q.width, h: q.height }; }).filter(c => c.w > 2 && c.h > 2);
  const ix = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 2 && h > 3 ? [w, h] : null; };
  const name = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.'); const p = el.closest('[id]'); if (p && p !== el) s = '#' + p.id + ' ' + s; return s; };
  const topAt = (a, b) => { const x = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, y = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2; return document.elementFromPoint(x, y); };
  const issues = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.el === b.el) continue; const o = ix(a, b); if (!o) continue;
    // both must be on top at that point (one covering the other in a stacking layer is not a visible overlap)
    const t = topAt(a, b); if (!t || !(a.el.contains(t) || t.contains(a.el) || b.el.contains(t) || t.contains(b.el))) continue;
    issues.push(`TEXT×TEXT "${a.t}" [${name(a.el)}] overlaps "${b.t}" [${name(b.el)}] by ${o[0].toFixed(0)}×${o[1].toFixed(0)}`);
  }
  for (const a of boxes) for (const c of ctrls) { if (c.el.contains(a.el) || a.el.contains(c.el)) continue; const o = ix(a, c); if (!o) continue; const t = topAt(a, c); if (!t || !(a.el.contains(t) || t === a.el)) continue; if (c.el.tagName === 'CANVAS') { const cs = getComputedStyle(a.el); if (a.el.closest('.planhint,.tip,.empty,.legend,#rcPill,.ctxmenu')) continue; } issues.push(`TEXT×CTRL "${a.t}" [${name(a.el)}] over ${name(c.el)} by ${o[0].toFixed(0)}×${o[1].toFixed(0)}`); }
  // clipped text: the text runs past a box that hides overflow
  for (const a of boxes) {
    for (let e = a.el; e && e !== root.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e); if (!/hidden|clip|auto|scroll/.test(cs.overflowX + cs.overflowY)) continue;
      const q = e.getBoundingClientRect(); if (/auto|scroll/.test(cs.overflowX + cs.overflowY) && e.scrollHeight > e.clientHeight + 2) break; // scrollable container, fine
      if (a.x + a.w > q.right + 1.5 || a.x < q.left - 1.5 || a.y + a.h > q.bottom + 2 || a.y < q.top - 2) { issues.push(`CLIPPED "${a.t}" [${name(a.el)}] cut by ${name(e)}`); } break;
    }
    if (a.x + a.w > innerWidth + 1) issues.push(`OFFSCREEN "${a.t}" [${name(a.el)}] right edge ${Math.round(a.x + a.w)} > ${innerWidth}`);
  }
  // ellipsis / clipped buttons & controls
  for (const el of root.querySelectorAll('button,.btn,label,th,td,.sec,.info,select')) { if (!vis(el)) continue; const cs = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX)) issues.push(`TRUNC [${name(el)}] "${(el.textContent || '').trim().slice(0, 40)}"`); }
  // canvas labels
  for (const cv of root.querySelectorAll('canvas')) { const L = (cv.__labels || []); if (!vis(cv)) continue; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const o = ix(L[i], L[j]); if (o && L[i].t !== L[j].t) issues.push(`CANVAS ${name(cv)} "${L[i].t}" overlaps "${L[j].t}" by ${o[0].toFixed(0)}×${o[1].toFixed(0)}`); } }
  return [...new Set(issues)];
};

// record every canvas fillText box (CSS px, relative to viewport at scan time via canvas offset)
const HOOK = () => {
  const P = CanvasRenderingContext2D.prototype; const ft = P.fillText, cr = P.clearRect, fr = P.fillRect;
  P.fillText = function (t, x, y, mw) {
    const cv = this.canvas; if (!cv.__labels) cv.__labels = [];
    const m = this.measureText(t); const T = this.getTransform(); const dpr = cv.width / (cv.clientWidth || cv.width);
    let w = m.width, h = (m.actualBoundingBoxAscent || 8) + (m.actualBoundingBoxDescent || 2);
    let x0 = this.textAlign === 'center' ? x - w / 2 : (this.textAlign === 'right' || this.textAlign === 'end') ? x - w : x;
    let y0 = y - (m.actualBoundingBoxAscent || 8);
    if (this.textBaseline === 'middle') y0 = y - h / 2; else if (this.textBaseline === 'top' || this.textBaseline === 'hanging') y0 = y;
    const pts = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].map(([px, py]) => [T.a * px + T.c * py + T.e, T.b * px + T.d * py + T.f]);
    const xs = pts.map(p => p[0] / dpr), ys = pts.map(p => p[1] / dpr); const r = cv.getBoundingClientRect();
    cv.__labels.push({ t: String(t).slice(0, 30), x: r.left + Math.min(...xs), y: r.top + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    return ft.apply(this, arguments);
  };
  const reset = function (x, y, w, h) { const cv = this.canvas; const T = this.getTransform(); if (x <= 0 && y <= 0 && w * T.a >= cv.width - 1 && h * T.d >= cv.height - 1) cv.__labels = []; };
  P.clearRect = function () { reset.apply(this, arguments); return cr.apply(this, arguments); };
  P.fillRect = function () { reset.apply(this, arguments); return fr.apply(this, arguments); };
  const sz = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get() { return sz.get.call(this); }, set(v) { this.__labels = []; sz.set.call(this, v); } });
  window.print = () => { };
};

(async () => {
  const sizes = (process.env.SIZES || '1500x1000,1280x800,1920x1080,1100x800').split(',').map(s => s.split('x').map(Number));
  const b = await chromium.launch();
  const report = {};
  for (const [W, H] of sizes) {
    const pg = await b.newPage({ viewport: { width: W, height: H } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await pg.addInitScript(HOOK);
    await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(500);
    const tag = `${W}x${H}`; const shot = async (n) => pg.screenshot({ path: `${OUT}/${tag}_${n}.png` });
    const scan = async (n, scope) => { await pg.waitForTimeout(150); const r = await pg.evaluate(SCAN, scope || null); report[`${tag} ${n}`] = r; await shot(n); };
    const box = await pg.locator('#plan').boundingBox();
    await scan('plan-empty');
    await pg.mouse.click(box.x + 300, box.y + 300, { button: 'right' }); await scan('menu-empty', '.ctxmenu');
    await pg.click('.ctxmenu .it:has-text("Add workstation here")'); await scan('typicals-ws', '#typicals');
    await pg.click('.typ:has-text("L workstation 6×6, furnished")'); await pg.waitForTimeout(400);
    await pg.click('#bTypicals'); await scan('typicals', '#typicals');
    await pg.click('.typ:has-text("120° pod")'); await pg.mouse.click(box.x + box.width - 160, box.y + box.height - 140); await pg.waitForTimeout(300);
    await pg.click('#zFit'); await scan('plan-full');
    const scr = (fn, arg) => pg.evaluate(fn, arg);
    // select a panel
    const pp = await scr(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const p = Object.values(P.panels)[1]; const a = P.nodes[p.a], c = P.nodes[p.b]; return [v.ox + (a.x + c.x) / 2 * v.s, v.oy - (a.y + c.y) / 2 * v.s]; });
    await pg.mouse.click(box.x + pp[0], box.y + pp[1]); await scan('panel-selected');
    await pg.mouse.click(box.x + pp[0], box.y + pp[1], { button: 'right' }); await scan('menu-panel', '.ctxmenu'); await pg.keyboard.press('Escape');
    const np = await scr(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const n = Object.values(P.nodes).find(n => Object.values(P.panels).filter(p => p.a === n.id || p.b === n.id).length >= 2) || Object.values(P.nodes)[0]; return [v.ox + n.x * v.s, v.oy - n.y * v.s]; });
    await pg.mouse.click(box.x + np[0], box.y + np[1]); await scan('junction-selected');
    await pg.mouse.click(box.x + np[0], box.y + np[1], { button: 'right' }); await scan('menu-junction', '.ctxmenu'); await pg.keyboard.press('Escape');
    const wp = await scr(() => { const P = window.answerDebug.P(), v = window.answerDebug.view; const w = Object.values(P.worksurfaces)[0]; const g = window.ANSWER.wsGeometry(P, w); const cx = g.poly.reduce((s, q) => s + q[0], 0) / g.poly.length, cy = g.poly.reduce((s, q) => s + q[1], 0) / g.poly.length; return [v.ox + cx * v.s, v.oy - cy * v.s]; });
    await pg.mouse.click(box.x + wp[0], box.y + wp[1]); await scan('ws-selected');
    await pg.mouse.click(box.x + wp[0], box.y + wp[1], { button: 'right' }); await scan('menu-ws', '.ctxmenu'); await pg.keyboard.press('Escape');
    await pg.click('#rcToggle'); await pg.waitForTimeout(200); await scan('editor-hidden'); await pg.click('#rcToggle');
    await pg.keyboard.press('Escape'); await pg.mouse.click(box.x + 20, box.y + 20); await scan('job-inspector');
    await pg.click('[data-trim="oval"]'); await pg.waitForTimeout(300); await pg.mouse.click(box.x + pp[0], box.y + pp[1]); await scan('oval-panel'); await pg.click('[data-trim="thin"]');
    await pg.click('#bFinishes'); await scan('finishes', '#finishes'); await pg.click('#bCloseFinishes');
    for (const st of ['spec', 'shop', 'install']) { await pg.click(`[data-stage="${st}"]`); await pg.waitForTimeout(300); await scan(st); }
    await pg.click('[data-stage="spec"]'); await pg.selectOption('#specGroup', 'area'); await scan('spec-by-ws');
    // print views
    await pg.emulateMedia({ media: 'print' });
    for (const [st, btn] of [['spec', '#bSpecPrint'], ['shop', '#bShopPrint'], ['install', '#bPickPrint'], ['install', '#bInstallPrint'], ['plan', '#bPrint']]) {
      await pg.emulateMedia({ media: 'screen' }); await pg.click(`[data-stage="${st}"]`); await pg.click(btn); await pg.waitForTimeout(250); await pg.emulateMedia({ media: 'print' }); await scan('print' + btn, '#printArea');
    }
    await pg.emulateMedia({ media: 'screen' });
    await pg.click('[data-stage="plan"]'); await pg.click('#bGuide'); await scan('guide', '#guide');
    if (errs.length) report[`${tag} errors`] = errs;
    await pg.close();
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  let n = 0; for (const [k, v] of Object.entries(report)) { if (!v.length) continue; console.log(`\n## ${k} (${v.length})`); v.slice(0, 40).forEach(x => console.log('  ' + x)); n += v.length; }
  console.log('\nTOTAL', n); await b.close();
})();
