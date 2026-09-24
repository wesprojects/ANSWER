const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts|net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(500);
  await pg.screenshot({ path: 'test/p_empty.png' });
  // draw a run: select draw tool, drag
  await pg.click('[data-tool="draw"]');
  const box = await pg.locator('#plan').boundingBox();
  const x0 = box.x + 120, y0 = box.y + 300;
  await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x0 + 200, y0 + 2, { steps: 8 }); await pg.mouse.move(x0 + 300, y0 + 3, { steps: 8 }); await pg.screenshot({ path: 'test/p_drawing.png' }); await pg.mouse.up(); await pg.waitForTimeout(300);
  console.log('after run:', await pg.textContent('#planInfo'));
  // second run down from the start (corner)
  await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x0 + 2, y0 + 120, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  console.log('after corner:', await pg.textContent('#planInfo'));
  await pg.click('[data-tool="select"]');
  // click a panel
  await pg.mouse.click(x0 + 60, y0); await pg.waitForTimeout(300);
  await pg.screenshot({ path: 'test/p_panel.png', fullPage: true });
  // set stack 12 & powerkit
  await pg.click('#pStack [data-st="12"]'); await pg.waitForTimeout(200);
  await pg.click('#pPower [data-pw="powerkit"]'); await pg.waitForTimeout(200);
  console.log('panel edited:', await pg.textContent('#planInfo'));
  // add typical
  await pg.click('#bTypicals'); await pg.waitForTimeout(300); await pg.screenshot({ path: 'test/p_typicals.png' });
  await pg.click('.typ:nth-child(2)'); await pg.waitForTimeout(200); await pg.mouse.move(x0 + 500, y0 + 100); await pg.mouse.click(x0 + 500, y0 + 100); await pg.waitForTimeout(300);
  await pg.click('#zFit'); await pg.waitForTimeout(200);
  console.log('after typical:', await pg.textContent('#planInfo'));
  await pg.mouse.click(box.x + box.width - 40, box.y + 40); await pg.waitForTimeout(200); // deselect
  await pg.screenshot({ path: 'test/p_plan.png' });
  // spec
  await pg.click('#tabs [data-stage="spec"]'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'test/p_spec.png' });
  // mark skins refurbish
  await pg.selectOption('#sourcing select[data-cat="Skins"]', 'refurbish'); await pg.selectOption('#sourcing select[data-cat="Panel"]', 'refurbish'); await pg.selectOption('#sourcing select[data-cat="Junction"]', 'refurbish'); await pg.waitForTimeout(300);
  await pg.click('#tabs [data-stage="shop"]'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'test/p_shop.png', fullPage: false });
  await pg.click('#tabs [data-stage="install"]'); await pg.waitForTimeout(600); await pg.screenshot({ path: 'test/p_install.png' });
  const h = await pg.evaluate(() => document.querySelector('#installBody').scrollHeight); console.log('install height', h);
  await pg.evaluate(() => window.scrollTo(0, 1800)); await pg.waitForTimeout(200); await pg.screenshot({ path: 'test/p_install2.png' });
  // finishes
  await pg.click('#tabs [data-stage="plan"]'); await pg.click('#bFinishes'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'test/p_finishes.png' });
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await b.close();
})();
