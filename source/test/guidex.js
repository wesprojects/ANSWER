// Every guide worked-example preset places cleanly from the Typicals dialog: no page errors, no rule errors, one junction with parts.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  await pg.click('#bTypicals'); const names = await pg.$$eval('.typ', els => els.map(e => e.querySelector('.nm').textContent)); const guide = names.filter(n => /^p\d+ /.test(n));
  console.log('group header:', await pg.textContent('.typgroup')); await pg.click('#bCloseTypicals');
  const box = await pg.locator('#plan').boundingBox(); let bad = 0;
  for (const nm of guide) {
    await pg.click('#bNew'); await pg.waitForTimeout(80); await pg.click('#bTypicals'); await pg.click(`.typ:has(.nm:text-is("${nm}"))`); await pg.mouse.click(box.x + 400, box.y + 260); await pg.waitForTimeout(150);
    const r = await pg.evaluate(() => { const P = window.answerDebug.P(), R = window.ANSWER.generate(P); const c = Object.values(R.nodes).find(n => n.legs && n.legs.length > 1); const ln = R.lines.filter(l => c && l.src === Object.keys(R.nodes).find(k => R.nodes[k] === c)); return { panels: Object.keys(P.panels).length, err: R.errors.map(e => e.msg), parts: ln.map(l => (l.qty > 1 ? l.qty + '×' : '') + l.style).join(' ') }; });
    const tst = await pg.textContent('#toast');
    if (r.err.length || !r.parts) bad++; console.log(`${nm}: ${r.panels} panels · ${r.parts}${r.err.length ? '\n  ERR ' + r.err.join(' | ') : ''}`);
  }
  await pg.click('#bTypicals'); await pg.locator('#typicals .modalbox').screenshot({ path: 'test/overlap/typicals_dialog.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? bad + ' PROBLEMS' : `ALL ${guide.length} GUIDE EXAMPLES CLEAN`); await b.close();
})();
