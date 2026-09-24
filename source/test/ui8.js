const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('#bTypicals'); await pg.waitForTimeout(200); await pg.click('.typ:nth-child(2)'); const box = await pg.locator('#plan').boundingBox(); await pg.mouse.move(box.x + 150, box.y + 150); await pg.mouse.click(box.x + 150, box.y + 150); await pg.waitForTimeout(300);
  await pg.click('#zFit'); await pg.waitForTimeout(200); await pg.click('#zIn'); await pg.waitForTimeout(200);
  await pg.mouse.click(box.x + box.width / 2 + 60, box.y + 40); await pg.waitForTimeout(300);
  await pg.screenshot({ path: 'test/p_posts.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
