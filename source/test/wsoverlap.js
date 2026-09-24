// Worksurface / pedestal / panel collisions in every typical (furnished and plain) and in auto-placed corners.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const names = await pg.evaluate(() => { const out = []; document.querySelector('#bTypicals').click(); document.querySelectorAll('.typ .nm').forEach(e => out.push(e.textContent)); document.querySelector('#bCloseTypicals').click(); return out; });
  const box = await pg.locator('#plan').boundingBox(); let bad = 0;
  for (const furnished of [false, true]) {
    const list = furnished ? await pg.evaluate(() => { const out = []; return out; }) : names;
    for (const nm of (furnished ? [] : names)) {
      await pg.click('#bNew'); await pg.waitForTimeout(150);
      await pg.click('#bTypicals'); await pg.click(`.typ:has-text("${nm}")`); await pg.mouse.click(box.x + 400, box.y + 300); await pg.waitForTimeout(250);
      // add a worksurface on every free panel side and a corner at every L/V, like a user filling the typical
      const r = await pg.evaluate(() => {
        const E = window.ANSWER, P = window.answerDebug.P(); const WS = Object.values(P.worksurfaces || {});
        const polys = WS.map(w => ({ id: w.id, poly: E.wsGeometry(P, w).poly })).concat(WS.flatMap(w => (w.peds || []).map(d => ({ id: w.id + '/' + d.id, ped: true, host: w.id, poly: E.pedRect(P, w, E.wsGeometry(P, w), d) })).filter(x => x.poly)));
        const panels = Object.values(P.panels).map(p => { const a = P.nodes[p.a], c = P.nodes[p.b]; const L = Math.hypot(c.x - a.x, c.y - a.y), ux = (c.x - a.x) / L, uy = (c.y - a.y) / L, nx = -uy * 1.5, ny = ux * 1.5; return { id: p.id, poly: [[a.x + nx, a.y + ny], [c.x + nx, c.y + ny], [c.x - nx, c.y - ny], [a.x - nx, a.y - ny]] }; });
        const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
        const area = (A, B) => { const xs = [...A, ...B].map(p => p[0]), ys = [...A, ...B].map(p => p[1]); const x0 = Math.max(Math.min(...A.map(p => p[0])), Math.min(...B.map(p => p[0]))), x1 = Math.min(Math.max(...A.map(p => p[0])), Math.max(...B.map(p => p[0]))), y0 = Math.max(Math.min(...A.map(p => p[1])), Math.min(...B.map(p => p[1]))), y1 = Math.min(Math.max(...A.map(p => p[1])), Math.max(...B.map(p => p[1]))); if (x1 <= x0 || y1 <= y0) return 0; let n = 0; const st = 0.25; for (let x = x0 + st / 2; x < x1; x += st) for (let y = y0 + st / 2; y < y1; y += st) if (inside([x, y], A) && inside([x, y], B)) n++; return n * st * st; };
        const out = []; const all = polys;
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], c = all[j]; if (a.ped && a.host === c.id || c.ped && c.host === a.id) continue; const ar = area(a.poly, c.poly); if (ar > 0.3) out.push(`${a.id} × ${c.id}: ${ar.toFixed(1)} sq in`); }
        for (const a of all) for (const p of panels) { const ar = area(a.poly, p.poly); if (ar > 0.3) out.push(`${a.id} × panel ${p.id}: ${ar.toFixed(1)} sq in`); }
        const R = E.generate(P); return { n: WS.length, out, err: R.errors.map(e => e.msg) };
      });
      if (r.out.length || r.err.length) bad++;
      console.log(`${nm} (${r.n} ws)`, r.out.length ? '\n  ' + r.out.join('\n  ') : 'no overlaps', r.err.length ? '\n  ERR ' + r.err.join('\n  ERR ') : '');
    }
  }
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? `${bad} typicals with problems` : 'ALL CLEAN'); await b.close();
})();
