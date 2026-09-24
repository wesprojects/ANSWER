// SIF export: place a typical, set MC/CT in settings, export from the Specification stage and check the download.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.waitForTimeout(500);
  await pg.click('#bTypicals'); await pg.click('.typ[data-t="0"]'); const box = await pg.locator('#plan').boundingBox();
  await pg.mouse.click(box.x + 400, box.y + 400); await pg.waitForTimeout(300);
  // settings: MC / CT
  await pg.click('#bFinishes'); await pg.fill('#sifMC', 'stee'); await pg.press('#sifMC', 'Tab'); await pg.fill('#sifCT', 'ans'); await pg.press('#sifCT', 'Tab'); await pg.click('#bCloseFinishes');
  await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(300);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSpecSif')]);
  const path = await dl.path(); const text = require('fs').readFileSync(path, 'utf8');
  const recs = (text.match(/^PN=/gm) || []).length;
  console.log('file:', dl.suggestedFilename(), 'records:', recs, 'bytes:', text.length);
  console.log('MC ok:', /\r\nMC=STEE\r\n/.test(text), 'CT ok:', /\r\nCT=ANS\r\n/.test(text), 'ascii:', !/[^\x00-\x7f]/.test(text), 'CRLF only:', !/[^\r]\n/.test(text));
  console.log(text.split('\r\n').slice(0, 14).join('\n'));
  // by workstation tags
  await pg.selectOption('#specGroup', 'area'); const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSpecSif')]);
  const t2 = require('fs').readFileSync(await dl2.path(), 'utf8'); console.log('tags:', [...new Set(t2.match(/^TG=.*$/gm))].join(' | '));
  console.log(await pg.textContent('#toast'));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
