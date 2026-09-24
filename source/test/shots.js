// Close-up screenshots of the plan and installer figures for a visual label check.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(500);
  const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.click(box.x + 300, box.y + 300, { button: 'right' }); await pg.click('.ctxmenu .it:has-text("Add workstation here")'); await pg.click('.typ:has-text("L workstation 6×6, furnished")'); await pg.waitForTimeout(300);
  await pg.click('#bTypicals'); await pg.click('.typ:has-text("120° pod")'); await pg.mouse.click(box.x + box.width - 160, box.y + box.height - 140); await pg.waitForTimeout(300);
  await pg.click('#zFit'); await pg.mouse.move(box.x + 5, box.y + 5); await pg.waitForTimeout(300);
  await pg.locator('#planwrap').screenshot({ path: 'test/overlap/z_plan.png' });
  for (let i = 0; i < 3; i++) await pg.click('#zIn'); await pg.waitForTimeout(200); await pg.locator('#planwrap').screenshot({ path: 'test/overlap/z_plan_zoom.png' });
  await pg.click('[data-stage="install"]'); await pg.waitForTimeout(400);
  const figs = pg.locator('#installBody canvas'); const n = await figs.count(); console.log('install canvases', n);
  for (let i = 0; i < Math.min(n, 4); i++) await figs.nth(i).screenshot({ path: `test/overlap/z_inst${i}.png` });
  await b.close();
})();
