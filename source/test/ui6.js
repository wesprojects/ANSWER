const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.move(box.x + 100, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 260, box.y + 250, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  await pg.click('[data-tool="select"]'); await pg.mouse.click(box.x + 140, box.y + 250); await pg.waitForTimeout(300);
  await pg.click('#pH [data-h="66"]'); await pg.waitForTimeout(200);
  // add tiles repeatedly
  for (let i = 0; i < 5; i++) { await pg.click('[data-add="s0"]'); await pg.waitForTimeout(200); }
  const tiles = await pg.$$eval('.tile[data-key="s0"]', t => t.map(x => x.querySelector('[data-f="height"]').value + ' ' + x.querySelector('[data-f="type"]').value));
  console.log('side A tiles (top->bottom):', tiles);
  // set top tile to window
  const top = (await pg.$$('.tile[data-key="s0"]'))[0]; await (await top.$('select[data-f="type"]')).selectOption('window'); await pg.waitForTimeout(300);
  const tilesB = await pg.$$eval('.tile[data-key="s1"]', t => t.map(x => x.querySelector('[data-f="height"]').value + ' ' + x.querySelector('[data-f="type"]').value));
  console.log('side B after window:', tilesB);
  // set second tile steel perforated
  const rows = await pg.$$('.tile[data-key="s0"]'); await (await rows[1].$('select[data-f="type"]')).selectOption('steel'); await pg.waitForTimeout(200);
  const rows2 = await pg.$$('.tile[data-key="s0"]'); await (await rows2[1].$('select[data-f="finish"]')).selectOption('perforated'); await pg.waitForTimeout(200);
  const issues = await pg.evaluate(() => [...document.querySelectorAll('#rightcol .msg')].map(e => e.textContent));
  console.log('issues:', JSON.stringify(issues));
  const parts = await pg.$$eval('.partcard .sn', e => e.map(x => x.textContent)); console.log('parts:', parts.join(', '));
  await pg.screenshot({ path: 'test/p_tiles.png', fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
