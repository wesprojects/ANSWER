// Places four typicals side by side through the interface and checks the job ends with four workstations and no issues.
// Spine with fins (78" panels: seismic review, p148) and Benching divider (15' run with no return, p150) carry guide warnings by design, so they are left out here.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(500);
  const box = await pg.locator('#plan').boundingBox();
  // L 6×6, U 6×8, 120° pod, L 6×6 furnished: one per quarter of the plan, each clicked at its top-left so none overlap
  const picks = [0, 1, 4, 5];
  for (let k = 0; k < picks.length; k++) { await pg.click('#bTypicals'); await pg.waitForTimeout(200); await pg.click(`.typ:nth-child(${picks[k] + 1})`); await pg.waitForTimeout(150); const x = box.x + 40 + (k % 2) * box.width / 2, y = box.y + 40 + Math.floor(k / 2) * box.height / 2; await pg.mouse.move(x, y); await pg.mouse.click(x, y); await pg.waitForTimeout(250); }
  await pg.click('#zFit'); await pg.waitForTimeout(200);
  const info = await pg.textContent('#planInfo'); console.log(info);
  const issues = await pg.evaluate(() => [...document.querySelectorAll('#rightcol .msg.err, #rightcol .msg.warn')].map(e => e.textContent));
  console.log('issues:', JSON.stringify(issues));
  await pg.screenshot({ path: 'test/p_all_typicals.png' });
  let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' — ' + info)); if (!ok) fails++; };
  ck('four typicals placed, four workstations', /^4 workstations/.test(info), info);
  ck('no issues', !issues.length, JSON.stringify(issues));
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
