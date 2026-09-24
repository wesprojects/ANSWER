const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message)); pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text()); });
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.move(box.x + 100, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 260, box.y + 250, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  await pg.click('[data-tool="select"]'); await pg.mouse.click(box.x + 140, box.y + 258); await pg.waitForTimeout(300);
  await pg.click('#pH [data-h="66"]'); await pg.waitForTimeout(200);
  await pg.click('[data-add="s0"]'); await pg.waitForTimeout(200);
  let top = (await pg.$$('.tile[data-key="s0"]'))[0]; await (await top.$('select[data-f="type"]')).selectOption('window'); await pg.waitForTimeout(300);
  console.log(await pg.evaluate(() => JSON.stringify(window.answerDebug.P().panels)));
  await b.close();
})();
