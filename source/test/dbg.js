const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.move(box.x + 100, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 260, box.y + 250, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  await pg.click('[data-tool="select"]');
  for (const dx of [110, 140, 180, 220]) { await pg.mouse.move(box.x + dx, box.y + 250); await pg.waitForTimeout(100); console.log(dx, await pg.evaluate(() => document.getElementById('planTip').style.display + ' ' + document.getElementById('planTip').textContent)); }
  await pg.mouse.move(box.x + 140, box.y + 250); await pg.mouse.down(); await pg.waitForTimeout(50); await pg.mouse.up(); await pg.waitForTimeout(300);
  console.log((await pg.textContent('#rightcol')).slice(0, 80).replace(/\s+/g, ' '));
  await pg.screenshot({ path: 'test/dbg.png' });
  await b.close();
})();
