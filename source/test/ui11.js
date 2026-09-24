// Workstations: furnished typical, right-click menus, add worksurface / corner / pedestal, drag along the run, elevation.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const box = await pg.locator('#plan').boundingBox();
  // right-click empty plan -> Add workstation here
  await pg.mouse.click(box.x + 300, box.y + 300, { button: 'right' }); await pg.waitForTimeout(200);
  console.log('empty menu:', await pg.$$eval('.ctxmenu .it', els => els.map(e => e.textContent.trim()).join(' | ')));
  await pg.click('.ctxmenu .it:has-text("Add workstation here")'); await pg.waitForTimeout(300);
  console.log('typicals shown:', await pg.$$eval('.typ .nm', els => els.map(e => e.textContent).join(' | ')));
  await pg.click('.typ:has-text("L workstation 6×6, furnished")'); await pg.waitForTimeout(500);
  const st = () => pg.evaluate(() => { const P = window.answerDebug.P(); return { panels: Object.keys(P.panels).length, ws: Object.values(P.worksurfaces).map(w => `${w.id}:${w.kind}:${w.width || w.C}:${w.peds.length}`).join(' ') }; });
  console.log('after L:', JSON.stringify(await st()));
  await pg.click('#zFit'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'test/p_ws1.png' });
  const info = await pg.textContent('#planInfo'); console.log('info:', info);
  // spec lines for workstation
  const lines = await pg.evaluate(() => { const P = window.answerDebug.P(); const R = window.ANSWER.generate(P); return R.lines.filter(l => ['Worksurface', 'Supports', 'Storage'].includes(l.cat)).map(l => `${l.qty}x ${l.style} ${l.desc.slice(0, 50)}`).join('\n') + '\nERR ' + JSON.stringify(R.errors) + '\nWARN ' + R.warnings.map(w => w.msg).join(' | '); });
  console.log(lines);
  // right-click the second spine panel (east half) on the south side -> add 24"D worksurface
  const pos = await pg.evaluate(() => { const P = window.answerDebug.P(); const v = window.answerDebug.view; const ps = Object.values(P.panels).filter(p => p.height === 66); const p = ps[1]; const a = P.nodes[p.a], bb = P.nodes[p.b]; const mx = (a.x + bb.x) / 2, my = (a.y + bb.y) / 2 + 3; return [v.ox + mx * v.s, v.oy - my * v.s]; });
  await pg.mouse.click(box.x + pos[0], box.y + pos[1], { button: 'right' }); await pg.waitForTimeout(200);
  console.log('panel menu:', await pg.$$eval('.ctxmenu > .it, .ctxmenu > .head', els => els.map(e => e.firstChild.textContent.trim()).join(' | ')));
  await pg.hover('.ctxmenu > .it:has-text("Add worksurface")'); await pg.waitForTimeout(150); await pg.click('.ctxmenu .sub .it:has-text("24\\"D worksurface")'); await pg.waitForTimeout(400);
  console.log('after add ws:', JSON.stringify(await st()));
  console.log('toast:', await pg.textContent('#toast'));
  // right-click the new worksurface -> add fixed pedestal right end
  const wsPos = await pg.evaluate(() => { const P = window.answerDebug.P(); const v = window.answerDebug.view; const w = Object.values(P.worksurfaces).slice(-1)[0]; const g = window.ANSWER.wsGeometry(P, w); const cx = g.poly[0][0] * .75 + g.poly[2][0] * .25, cy = g.poly[0][1] * .75 + g.poly[2][1] * .25; return [v.ox + cx * v.s, v.oy - cy * v.s, w.id]; });
  await pg.mouse.click(box.x + wsPos[0], box.y + wsPos[1], { button: 'right' }); await pg.waitForTimeout(200);
  console.log('ws menu:', await pg.$$eval('.ctxmenu > .it, .ctxmenu > .head', els => els.map(e => e.firstChild.textContent.trim()).join(' | ')));
  await pg.hover('.ctxmenu > .it:has-text("Add pedestal")'); await pg.waitForTimeout(150); await pg.hover('.ctxmenu .sub > .it:has-text("Fixed pedestal, file/file")'); await pg.waitForTimeout(150); await pg.click('.ctxmenu .sub > .it:has-text("Fixed pedestal, file/file") > .sub > .it:has-text("Right end")'); await pg.waitForTimeout(400);
  console.log('after ped:', JSON.stringify(await st()));
  // drag the worksurface 12" east along the run
  const before = await pg.evaluate((id) => window.answerDebug.P().worksurfaces[id].off, wsPos[2]);
  await pg.mouse.move(box.x + wsPos[0], box.y + wsPos[1]); await pg.mouse.down(); await pg.mouse.move(box.x + wsPos[0] - 30, box.y + wsPos[1], { steps: 4 }); await pg.mouse.move(box.x + wsPos[0] - 60, box.y + wsPos[1], { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  const after = await pg.evaluate((id) => window.answerDebug.P().worksurfaces[id].off, wsPos[2]);
  console.log('drag off:', before, '->', after);
  console.log('inspector:', (await pg.textContent('#rightcol')).replace(/\s+/g, ' ').slice(0, 300));
  await pg.screenshot({ path: 'test/p_ws2.png' });
  // corner via node menu on the 120 pod
  await pg.click('#zOut'); await pg.click('#zOut'); await pg.click('#zOut'); await pg.waitForTimeout(100); await pg.mouse.click(box.x + box.width - 80, box.y + box.height - 80, { button: 'right' }); await pg.click('.ctxmenu .it:has-text("Add workstation here")'); await pg.click('.typ:has-text("120° pod")'); await pg.waitForTimeout(400);
  console.log('after pod:', JSON.stringify(await st()));
  await pg.click('#zFit'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'test/p_ws3.png' });
  // spec tab
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: 'test/p_ws_spec.png', fullPage: false });
  const specText = await pg.textContent('#specBody'); console.log('spec has Worksurface group:', /Worksurface/.test(specText), 'Supports:', /Supports/.test(specText), 'Storage:', /Storage/.test(specText));
  const R2 = await pg.evaluate(() => { const R = window.ANSWER.generate(window.answerDebug.P()); return { err: R.errors, warn: R.warnings.map(w => w.msg) }; }); console.log('final issues:', JSON.stringify(R2));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
