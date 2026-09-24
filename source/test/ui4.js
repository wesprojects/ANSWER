const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(600);
  await pg.click('#bTypicals'); await pg.waitForTimeout(300); await pg.click('.typ:nth-child(3)'); await pg.waitForTimeout(200); const box = await pg.locator('#plan').boundingBox(); await pg.mouse.move(box.x+200, box.y+200); await pg.mouse.click(box.x+200, box.y+200); await pg.waitForTimeout(300); await pg.click('#zFit'); await pg.screenshot({ path: 'test/p_spine.png' });
  await pg.click('#tabs [data-stage="install"]'); await pg.waitForTimeout(600);
  const el = await pg.$('.installsheet'); await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(200);
  await pg.screenshot({ path: 'test/p_installsheet.png' });
  await pg.click('#tabs [data-stage="plan"]'); await pg.waitForTimeout(300); await pg.click('#bFinishes'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'test/p_finishes.png' });
  await b.close();
})();
