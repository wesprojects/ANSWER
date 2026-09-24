const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.move(box.x + 100, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 260, box.y + 250, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  console.log(await pg.evaluate(() => { const d = window.answerDebug; return JSON.stringify({ view: d.view, nodes: d.P().nodes, h: d.hit(140, 250), h2: d.hit(180, 250) }); }));
  await b.close();
})();
