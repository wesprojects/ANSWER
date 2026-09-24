const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('#bTypicals'); await pg.waitForTimeout(200); await pg.click('.typ:nth-child(4)'); const box = await pg.locator('#plan').boundingBox(); await pg.mouse.move(box.x + 150, box.y + 200); await pg.mouse.click(box.x + 150, box.y + 200); await pg.waitForTimeout(300);
  console.log('page links in inspector:', await pg.$$eval('#rightcol a.pg', a => a.map(x => x.textContent).slice(0, 5)));
  await pg.click('#rightcol a.pg'); await pg.waitForTimeout(300);
  console.log('guide modal open:', await pg.evaluate(() => document.getElementById('guide').classList.contains('on') + ' ' + document.getElementById('guideFrame').src));
  await pg.click('#bCloseGuide');
  await pg.click('#tabs [data-stage="spec"]'); await pg.waitForTimeout(400);
  console.log('spec contents blocks:', await pg.$$eval('#specBody .contains', c => c.length), 'page links:', await pg.$$eval('#specBody a.pg', c => c.length));
  await pg.screenshot({ path: 'test/p_spec_contents.png' });
  await pg.click('#tabs [data-stage="install"]'); await pg.waitForTimeout(500); console.log('pick contents:', await pg.$$eval('#installBody .contains', c => c.length));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
