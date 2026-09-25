// Drawn dimensions against the Answer guide (Feb 2015): end-of-run post and trim, elevation length by the footprint rules,
// actual panel heights, glass and top screen sizes, corner posts, change-of-height trim width.
// Run from the repo root: NODE_PATH=$(npm root -g) node test/dims.js
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info !== undefined ? ' — ' + info : '')); if (!ok) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 0.6);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('answer.rc', '0'); }); await pg.reload(); await pg.waitForTimeout(300);
  // build a job, reload, select a panel so its run shows in the elevation
  const load = async (build, trim, pick) => {
    await pg.evaluate(([src, trim]) => { const E = window.ANSWER; const T = E.newProject(trim); (new Function('E', 'T', src))(E, T); localStorage.setItem('answer.planner', JSON.stringify(T)); }, [build.toString().replace(/^[^{]*{|}$/g, ''), trim]);
    await pg.reload(); await pg.waitForTimeout(300); await pg.click('#zFit'); await pg.waitForTimeout(100);
    const bb = await pg.locator('#plan').boundingBox(); const pt = await pg.evaluate((pick) => { const P = window.answerDebug.P(), v = window.answerDebug.view; const p = Object.values(P.panels)[pick || 0]; const a = P.nodes[p.a], c = P.nodes[p.b]; return [v.ox + (a.x + c.x) / 2 * v.s, v.oy - (a.y + c.y) / 2 * v.s]; }, pick);
    await pg.mouse.click(bb.x + pt[0], bb.y + pt[1]); await pg.waitForTimeout(250);
    return pg.evaluate(() => ({ info: window.answerDebug.elevInfo(), hits: window.answerDebug.elevHits() }));
  };
  // 1 × 48" × 54" thin, end of run both ends
  { const { info, hits } = await load((E, T) => { const n = E.addNode(T, 0, 0); E.addPanel(T, n, 0, 48, 54); }, 'thin');
    const s = info.s, y0 = info.y0;
    ck('1×48 thin: elevation length 4\'-0" nominal · 4\'-1" overall (1/2" end-of-run trim each end, p20)', /^4'-0" nominal · 4'-1" overall/.test(info.label) && near(info.totalW, 49, 1e-6), info.label);
    const posts = hits.filter(h => h.kind === 'post').sort((p, q) => p.x - q.x);
    ck('end-of-run trims just outside the nodes, 1/2" wide (p20)', posts.length === 2 && near(posts[0].x + 2, info.X0 - 0.5 * s) && near(posts[0].x + posts[0].w - 2, info.X0 + 0.75 * s) && near(posts[1].x + 2, info.X0 + 47.25 * s) && near(posts[1].x + posts[1].w - 2, info.X0 + 48.5 * s), JSON.stringify([posts.map(p => [p.x, p.w]), info.X0, s]));
    const cap = hits.find(h => h.kind === 'topcap'); ck('54" thin panel drawn 54 1/4" to the top of the cap (p16), cap 5/8"', near(cap.y + 3, y0 - 54.25 * s) && near(cap.h - 3, 0.625 * s), JSON.stringify([cap, y0, s]));
    const tiles = hits.filter(h => h.kind === 'tile'); ck('skins fill from the 3 3/4" base trim to the cap underside', near(Math.max(...tiles.map(t => t.y + t.h)), y0 - 3.75 * s) && near(Math.min(...tiles.map(t => t.y)), y0 - (54.25 - 0.625) * s), JSON.stringify(tiles)); }
  // 48 + 48 with glass (recessed 12 on the first, clip on the second), in-line same height
  { const { info, hits } = await load((E, T) => { const n = E.addNode(T, 0, 0); const a = E.addPanel(T, n, 0, 48, 54); const c = E.addPanel(T, T.nodes[a.b], 0, 48, 54); a.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; c.glassScreen = { attach: 'clip', height: 12, frosted: false, omitGlass: false }; }, 'thin');
    const s = info.s, g = hits.filter(h => h.kind === 'glass').sort((p, q) => p.x - q.x);
    ck('recessed 12" glass kit drawn 15 1/2" of glass high, 47 7/8" wide (2022 p64: kits 6/12/18/24 carry 9 5/16, 15 1/2, 21 11/16, 27 7/8)', near(g[0].h, 15.5 * s) && near(g[0].w, 47.875 * s), JSON.stringify([g[0], s]));
    ck('clip glass drawn 11 3/4" high, 47 3/4" wide (p68)', near(g[1].h, 11.75 * s) && near(g[1].w, 47.75 * s), JSON.stringify([g[1], s]));
    ck('glass sits on the cap (54 1/4")', near(g[0].y + g[0].h, info.y0 - 54.25 * s), JSON.stringify([g[0], info.y0])); }
  // in-line change of height, glass on the lower panel: glass stops 1/2" from the junction center (47 7/16", p64)
  { const { info, hits } = await load((E, T) => { const n = E.addNode(T, 0, 0); const a = E.addPanel(T, n, 0, 48, 54); E.addPanel(T, T.nodes[a.b], 0, 48, 66); a.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; }, 'thin');
    const s = info.s, g = hits.find(h => h.kind === 'glass'); ck('glass next to change-of-height trim is 47 7/16" (p64)', near(g.w, 47.4375 * s), JSON.stringify([g, s]));
    const post = hits.filter(h => h.kind === 'post').sort((p, q) => p.x - q.x)[1]; ck('change-of-height trim rises to 66 19/32" (p16, p24)', near(post.y, info.y0 - 66.59375 * s), JSON.stringify([post, info.y0, s])); }
  // L corner: the corner post is 3" wide in the elevation
  { const { info, hits } = await load((E, T) => { const n = E.addNode(T, 0, 0); const a = E.addPanel(T, n, 0, 48, 54); E.addPanel(T, n, 270, 48, 54); }, 'thin', 0);
    const s = info.s, posts = hits.filter(h => h.kind === 'post'); const spans = (p, k) => near(p.x + 2, info.nodeX[k] - (k ? 2.25 : 1.5) * s, 1) && near(p.x + p.w - 2, info.nodeX[k] + (k ? 1.5 : 2.25) * s, 1); const corner = posts.find(p => spans(p, 0) || spans(p, 1)); // the block and posts around the corner node
    // corner geometry (p21, p30): the junction block reaches 1 1/2" beyond the node and the corner face, where the skins stop, is 1 1/2" block + 3/4" post
    // = 2 1/4" toward the panel, so the corner junction shows 3 3/4" wide; the panel's module starts 1 1/2" out, so the run is 1 1/2" + 1 1/2" + 48" + 1/2"
    ck('corner junction 3 3/4" wide in the elevation: 1 1/2" block beyond the node + 2 1/4" to the corner face (p20, p21, p30)', corner && near(corner.w - 4, 3.75 * s), JSON.stringify([posts, info.nodeX, s]));
    ck('corner node to the far end node is 48" + 1 1/2" corner allowance (p21, p30)', near(info.nodeX[1] - info.nodeX[0], 49.5 * s, 1e-6), JSON.stringify(info.nodeX));
    ck('L of 48s: elevation length 4\'-0" nominal · 4\'-3 1/2" overall (1 1/2" block + 1 1/2" corner allowance + 1/2" trim)', /^4'-0" nominal · 4'-3 1\/2" overall/.test(info.label), info.label); }
  // oval: end trim 1", 54" panel 54 1/8", top screen 45 1/2"
  { const { info, hits } = await load((E, T) => { const n = E.addNode(T, 0, 0); const a = E.addPanel(T, n, 0, 48, 54); a.topScreen = true; }, 'oval');
    const s = info.s; ck('1×48 oval: 4\'-2" overall (1" end-of-run trim each end, p92)', /4'-2" overall/.test(info.label), info.label);
    const g = hits.find(h => h.kind === 'glass'); ck('oval top screen 45 1/2" × 12" (p111)', g && near(g.w, 45.5 * s) && near(g.h, 12 * s), JSON.stringify([g, s]));
    const cap = hits.find(h => h.kind === 'topcap'); ck('54" oval panel drawn 54 1/8" (p90)', near(cap.y + 3, info.y0 - 54.125 * s), JSON.stringify([cap, info.y0, s])); }
  // plan: the end-of-run trim is drawn just outside the node, the skin runs to the node
  { await load((E, T) => { const n = E.addNode(T, 0, 0); E.addPanel(T, n, 0, 48, 54); }, 'thin');
    const px = await pg.evaluate(() => { const v = window.answerDebug.view; v.s = 8; v.ox = 300; v.oy = 300; return true; }); await pg.click('#zIn'); await pg.waitForTimeout(150);
    const cols = await pg.evaluate(() => { const v = window.answerDebug.view, c = document.getElementById('plan'), k = c.width / c.clientWidth, cx = c.getContext('2d'); const at = (x) => Array.from(cx.getImageData(Math.round((v.ox + x * v.s) * k), Math.round(v.oy * k), 1, 1).data).slice(0, 3).join(','); return { trim: at(-0.25), skin: at(0.4), out: at(-1.0), trimR: at(48.25), outR: at(49) }; });
    const TRIM = '35,35,35'; // the job's trim paint, 7207 Black (#232323): caps and trims are drawn in the trim finish
    ck('plan: end-of-run trim 0..1/2" outside the node, skin inside, nothing beyond', cols.trim === TRIM && cols.trimR === TRIM && cols.skin !== TRIM && cols.out !== TRIM && cols.outR !== TRIM, JSON.stringify(cols)); }
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
})();
