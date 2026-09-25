// June 2022 guide in the interface: the 36"H panel height (p16), the 24"H glass kit (p398), the Universal/Sarto top cap screen (p70-73, p402-403)
// and the back painted glass skin type (p500-502) are offered in the panel editor and reach the specification; guide links open the 2022 book.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } }); pg.on('dialog', d => d.accept()); const errs = []; pg.on('pageerror', e => errs.push(e.message)); let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); if (!ok) fails++; };
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  await pg.click('[data-tool="draw"]'); const box = await pg.locator('#plan').boundingBox(); await pg.mouse.move(box.x + 300, box.y + 250); await pg.mouse.down(); await pg.mouse.move(box.x + 520, box.y + 250, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(250);
  // select the first panel through the model and re-render the editor
  const pid = await pg.evaluate(() => Object.keys(window.answerDebug.P().panels)[0]);
  await pg.click('[data-tool="select"]').catch(() => {});
  const hitAt = await pg.evaluate((id) => { const P = window.answerDebug.P(), p = P.panels[id], a = P.nodes[p.a], c = P.nodes[p.b], v = window.answerDebug.view; const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2; return v.toScreen ? v.toScreen(mx, my) : null; }, pid);
  if (hitAt) await pg.mouse.click(box.x + hitAt[0], box.y + hitAt[1]); else await pg.mouse.click(box.x + 410, box.y + 250);
  await pg.waitForTimeout(250);
  const heights = await pg.$$eval('#pH button', bs => bs.map(x => +x.dataset.h));
  ck('panel editor offers the 36"H thin-trim height (2022 p16)', heights.includes(36) && heights.length === 7, JSON.stringify(heights));
  await pg.click('#pH button[data-h="36"]'); await pg.waitForTimeout(200);
  const glassOpts = await pg.$$eval('#pGlass option', os => os.map(o => o.value));
  ck('frameless glass offers the 24"H recessed kit (2022 p398)', glassOpts.includes('r24'), JSON.stringify(glassOpts));
  const tcs = await pg.$$eval('#pTcs option', os => os.map(o => o.value));
  ck('top cap screen selector offers Universal and Sarto at 13 1/2" and 19 1/2" (2022 p402-403)', tcs.join() === ',universal:13.5,universal:19.5,sarto:13.5,sarto:19.5', JSON.stringify(tcs));
  await pg.selectOption('#pTcs', 'sarto:13.5'); await pg.waitForTimeout(250);
  const st = await pg.evaluate((id) => { const p = window.answerDebug.P().panels[id]; return { h: p.height, w: p.width, tcs: p.topCapScreen, glass: p.glassScreen }; }, pid);
  ck('choosing a Sarto 13 1/2" screen sets it on the panel and leaves no glass screen', st.tcs && st.tcs.kind === 'sarto' && st.tcs.height === 13.5 && !st.glass && st.h === 36, JSON.stringify(st));
  const hits = await pg.evaluate(() => (window.answerDebug.elevHits() || []).filter(h => h.kind === 'topcapscreen').length);
  ck('the elevation draws the top cap screen above the cap', hits >= 1, String(hits));
  const types = await pg.evaluate(() => [...document.querySelectorAll('select')].flatMap(s => [...s.options].map(o => o.value)).filter(v => /back painted glass/.test(v)).length);
  ck('back painted glass is offered as a skin type (2022 p500)', types >= 1, String(types));
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(400);
  const spec = await pg.textContent('#specBody');
  const style = `TS713${st.w}TSSC`;
  ck(`the specification lists the Sarto screen ${style} and 36"H end-of-run junctions TS736TEPJ (2022 p355, p402)`, spec.includes(style) && spec.includes('TS736TEPJ'), spec.slice(0, 200));
  const link = await pg.evaluate(() => { const a = document.querySelector('#specBody a.pg'); return a ? a.getAttribute('href') : null; });
  ck('guide page links open the June 2022 book', !!link && /^answer-2022-[12]\.pdf#page=\d+/.test(link), link);
  const price = await pg.textContent('#specBody').then(t => /June 2022/.test(t) || true);
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); await b.close(); })();
