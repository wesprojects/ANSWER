// the Export DXF for CAP button downloads an AutoCAD 2000 file with CAP symbols; the lines-only button still gives the R12 file
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } }); pg.on('dialog', d => d.accept()); const errs = []; pg.on('pageerror', e => errs.push(e.message)); let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); if (!ok) fails++; };
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox(); await pg.mouse.move(box.x + 300, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 520, box.y + 250, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(250);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#bDxf')]); const path = await dl.path(); const txt = fs.readFileSync(path, 'utf8');
  ck('CAP DXF downloads as AutoCAD 2000 with CAP symbol blocks', /_CAP\.dxf$/.test(dl.suggestedFilename()) && /\$ACADVER\n1\nAC1015/.test(txt) && /\nCAPPN\n/.test(txt) && /P_TS7/.test(txt), dl.suggestedFilename());
  const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.click('#bDxfPlain')]); const t2 = fs.readFileSync(await dl2.path(), 'utf8');
  ck('lines-only DXF is still the R12 file', /_plan\.dxf$/.test(dl2.suggestedFilename()) && /AC1009/.test(t2));
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); await b.close(); })();
