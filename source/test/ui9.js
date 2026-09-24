const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  // draw a 2-panel run east
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox();
  const y = box.y + 400; await pg.mouse.move(box.x + 200, y); await pg.mouse.down(); await pg.mouse.move(box.x + 488, y, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  await pg.click('[data-tool="select"]');
  const st = () => pg.evaluate(() => { const P = window.answerDebug.P(); return Object.values(P.nodes).map(n => `${n.id}(${n.x},${n.y})`).join(' ') + ' | ' + Object.values(P.panels).map(p => p.id + (p.glassScreen ? '+glass' : '')).join(' '); });
  console.log('before:', await st());
  // grab the east panel near its free end (x ~ 470) and swing it down (mouse to south)
  await pg.mouse.move(box.x + 470, y + 8); await pg.mouse.down(); await pg.mouse.move(box.x + 350, y + 80, { steps: 5 }); await pg.mouse.move(box.x + 345, y + 150, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  console.log('after swing:', await st());
  const types = await pg.evaluate(() => Object.values(window.answerDebug.P().nodes).map(n => n.id).join(','));
  await pg.screenshot({ path: 'test/p_swing.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
