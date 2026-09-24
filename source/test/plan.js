// Plan stage regressions: drawing, the end handle, moving, widths, multi-select, keys, trim switching, elevation, menus, zoom.
// Run from the repo root: NODE_PATH=$(npm root -g) node test/plan.js
const { chromium } = require('playwright');
let fails = 0;
const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' — ' + info : '')); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function open(w = 1280, h = 800) {
    const pg = await b.newPage({ viewport: { width: w, height: h } });
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('dialog', d => d.accept());
    await pg.goto('file://' + process.cwd() + '/dist/index.html'); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('answer.rc', '0'); }); await pg.reload(); await pg.waitForTimeout(300);
    const box = await pg.locator('#plan').boundingBox();
    const S = async (x, y) => { const v = await pg.evaluate(() => ({ ...window.answerDebug.view })); return [box.x + v.ox + x * v.s, box.y + v.oy - y * v.s]; };
    const drag = async (x0, y0, x1, y1, shift) => { const a = await S(x0, y0), c = await S(x1, y1); if (shift) await pg.keyboard.down('Shift'); await pg.mouse.move(...a); await pg.mouse.down(); await pg.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await pg.mouse.move(...c, { steps: 5 }); await pg.mouse.up(); if (shift) await pg.keyboard.up('Shift'); await pg.waitForTimeout(120); };
    const click = async (x, y) => { await pg.mouse.click(...(await S(x, y))); await pg.waitForTimeout(120); };
    const panels = () => pg.evaluate(() => { const P = window.answerDebug.P(); return Object.values(P.panels).map(p => { const a = P.nodes[p.a], c = P.nodes[p.b]; return { id: p.id, w: p.width, h: p.height, x1: a.x, y1: a.y, x2: c.x, y2: c.y, stack: p.stack.join('+'), glass: !!p.glassScreen, pw: p.power, s0: p.sides[0].map(x => (x.kind === 'window' ? 'win' : x.type) + x.height).join('/'), s1: p.sides[1].map(x => (x.kind === 'window' ? 'win' : x.type) + x.height).join('/'), omit: p.topCap.omit }; }); });
    const toastText = () => pg.evaluate(() => getComputedStyle(document.querySelector('#toast')).display === 'block' ? document.querySelector('#toast').textContent : '');
    const tool = () => pg.evaluate(() => document.querySelector('#toolgroup .on').textContent);
    const errors = () => pg.evaluate(() => window.ANSWER.generate(window.answerDebug.P()).errors.map(e => e.msg));
    const width = async (v) => { await pg.selectOption('#optWidth', v); };
    const start = async () => { await width('48'); await pg.keyboard.press('d'); await drag(0, 48, 96, 48); await pg.keyboard.press('v'); };
    return { pg, box, S, drag, click, panels, toastText, tool, errors, width, start };
  }

  // #1/#2 crossing, touching mid-panel and drawing over a panel are refused; nothing changes
  { const { pg, drag, panels, toastText, start, errors } = await open(); await start();
    await pg.keyboard.press('d'); await drag(72, 78, 72, 18); let ps = await panels(); ck('draw across a panel is refused', ps.length === 2 && /cross with no junction/.test(await toastText()), await toastText());
    await pg.keyboard.press('d'); await drag(24, 96, 24, 48); ps = await panels(); ck('draw ending mid-panel is refused', ps.length === 2 && /ends against the middle/.test(await toastText()), await toastText());
    await pg.keyboard.press('d'); await drag(96, 48, 48, 48); ps = await panels(); ck('draw back over an existing panel is refused', ps.length === 2 && /on top of/.test(await toastText()), await toastText());
    await pg.keyboard.press('d'); await drag(24, 120, 24, 72); await pg.keyboard.press('v'); ps = await panels(); ck('free run drawn clear of the first', ps.length === 3);
    await drag(24, 100, 24, 76); ps = await panels(); const moved = ps.find(p => p.x1 === 24); ck('moving a run so it ends mid-panel is refused', moved && Math.max(moved.y1, moved.y2) === 120 && /ends against the middle/.test(await toastText()), JSON.stringify(moved));
    ck('no conflict errors left on the plan', (await errors()).length === 0, (await errors()).join());
    await pg.close(); }

  // #3 end handle: click adds one straight on, drag turns a corner (and Draw run stays on)
  { const { pg, drag, panels, tool, start, S } = await open(); await start(); await pg.click('#zFit'); await pg.waitForTimeout(100);
    const hx = await pg.evaluate(() => { const P = window.answerDebug.P(); const v = window.answerDebug.view; for (let x = 96; x < 130; x += .5) { const h = window.answerDebug.hit(v.ox + x * v.s, v.oy - 48 * v.s); if (h && h.kind === 'handle') return x; } return null; });
    ck('end handle found', hx !== null);
    await pg.mouse.click(...(await S(hx, 48))); await pg.waitForTimeout(120); let ps = await panels(); ck('click on ⊕ adds one panel straight on', ps.length === 3 && ps.some(p => p.x1 === 96 && p.x2 === 144 && p.y2 === 48), JSON.stringify(ps.map(p => [p.x1, p.x2, p.y2])));
    await pg.click('#bUndo'); await pg.waitForTimeout(100);
    // corner geometry (p15, p24): the end becomes an L, so the 48" panel it ends now reaches 48" + 1 1/2" to it (the corner moves 1 1/2" out, the first
    // junctions stay put) and the new 48" leg runs 48" + 1 1/2" from it
    await drag(hx, 48, 96, 0); ps = await panels(); ck('drag from ⊕ turns an L corner', ps.length === 3 && ps.some(p => p.x1 === 97.5 && p.x2 === 97.5 && p.y1 === 48 && p.y2 === -1.5), JSON.stringify(ps.map(p => [p.x1, p.y1, p.x2, p.y2])));
    const J = await pg.evaluate(() => { const P = window.answerDebug.P(); const R = window.ANSWER.generate(P); return Object.values(R.nodes).map(j => j.type).join(); }); ck('corner is an L junction', /L/.test(J), J);
    await pg.click('#bUndo'); await pg.keyboard.press('d'); await drag(hx, 48, 96, 0); ck('drag from ⊕ in Draw run keeps Draw run on', (await tool()) === 'Draw run' && (await panels()).length === 3);
    await pg.close(); }

  // #4 Draw run: pressing on a panel selects it, never drags the workstation
  { const { pg, drag, panels, tool, start } = await open(); await start(); const before = JSON.stringify(await panels());
    await pg.keyboard.press('d'); await drag(24, 48, 24, 0); ck('Draw run press-and-drag on a panel does not move it', JSON.stringify(await panels()) === before && (await tool()) === 'Select');
    await pg.close(); }

  // #5 width of a panel that closes a loop is refused; geometry stays square
  { const { pg, drag, click, panels, toastText, width } = await open(); await width('48');
    for (const [a, c] of [[[0, 48], [48, 48]], [[48, 48], [48, 96]], [[48, 96], [0, 96]], [[0, 96], [0, 48]]]) { await pg.keyboard.press('d'); await drag(...a, ...c); }
    await pg.keyboard.press('v'); await click(24, 48); await pg.click('#pW button[data-w="60"]'); await pg.waitForTimeout(120);
    // corner geometry (p15, p24): all four junctions are L corners, so each 48" side runs 48" + 1 1/2" + 1 1/2" = 51" node to node
    const ps = await panels(); ck('loop panel width change refused', ps.length === 4 && ps.every(p => p.w === 48 && Math.abs(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) - 51) < .01) && /closes a loop/.test(await toastText()), await toastText());
    await pg.close(); }

  // #6 "same tiles on this face" follows the viewed face on panels drawn the other way
  { const { pg, drag, click, panels, width } = await open(1920, 1080); await width('48');
    await pg.keyboard.press('d'); await drag(48, 48, 96, 48); await pg.keyboard.press('d'); await drag(48, 48, 0, 48); await pg.keyboard.press('v'); await click(72, 48);
    await pg.locator('#elev').scrollIntoViewIfNeeded(); const eb = await pg.locator('#elev').boundingBox();
    const hits = await pg.evaluate(() => window.answerDebug.elevHits().filter(h => h.kind === 'tile').map(h => ({ pid: h.pid, face: h.face, x: h.x + h.w / 2, y: h.y + h.h / 2 })));
    const h3 = hits.find(h => h.pid === 'P3'), h5 = hits.find(h => h.pid === 'P5');
    await pg.mouse.click(eb.x + h3.x, eb.y + h3.y, { button: 'right' }); await pg.hover('.ctxmenu > .it:has-text("Material")'); await pg.click('.ctxmenu .sub .it:has-text("Steel")'); await pg.waitForTimeout(120);
    await pg.mouse.click(eb.x + h3.x, eb.y + h3.y, { button: 'right' }); await pg.click('.ctxmenu .it:has-text("Same tiles on this face")'); await pg.waitForTimeout(120);
    const ps = await panels(); const p5 = ps.find(p => p.id === 'P5'); const shown = h5.face === 0 ? p5.s0 : p5.s1;
    ck('same tiles land on the face shown in the elevation', /steel/.test(shown) && !/steel/.test(h5.face === 0 ? p5.s1 : p5.s0), JSON.stringify([h5.face, p5.s0, p5.s1]));
    await pg.close(); }

  // #7 Delete/Backspace on other stages does not touch the plan; D does not change the tool there
  { const { pg, click, panels, start, tool } = await open(); await start(); await click(24, 48); await pg.click('[data-stage="spec"]'); await pg.waitForTimeout(200);
    await pg.keyboard.press('Backspace'); await pg.keyboard.press('Delete'); await pg.keyboard.press('d'); await pg.click('[data-stage="plan"]'); await pg.waitForTimeout(150);
    ck('Delete on the Specification tab keeps the plan', (await panels()).length === 2 && (await tool()) === 'Select');
    await click(24, 48); await pg.keyboard.press('Delete'); await pg.waitForTimeout(100); ck('Delete on the plan still deletes the selection', (await panels()).length === 1);
    await pg.close(); }

  // #8 trim switch keeps thin-only settings and says what does not carry over
  { const { pg, click, panels, start, toastText } = await open(); await start(); await click(24, 48); await pg.click('#pTop button[data-tc="omit"]'); await pg.waitForTimeout(100);
    await pg.click('#trimSwitch [data-trim=oval]'); await pg.waitForTimeout(150); const t = await toastText(); const inOval = await panels();
    ck('switch to oval tells what is kept aside', /2 frameless glass screens and 1 omitted top cap/.test(t), t);
    ck('Glass on top control hidden in oval', !(await pg.isVisible('#optGlass')));
    await pg.click('#trimSwitch [data-trim=thin]'); await pg.waitForTimeout(150); const back = await panels();
    ck('back to thin restores glass and the omitted cap', inOval.every(p => !p.glass && !p.omit) && back.every(p => p.glass) && back.find(p => p.id === 'P3').omit, JSON.stringify(back.map(p => [p.glass, p.omit])));
    await pg.close(); }

  // #9 multi-select: every editor control reaches every selected panel
  { const { pg, drag, click, panels, width } = await open(1920, 1080); await width('48'); await pg.keyboard.press('d'); await drag(0, 48, 144, 48); await pg.keyboard.press('v');
    await click(24, 48); await pg.keyboard.down('Shift'); await click(72, 48); await click(120, 48); await pg.keyboard.up('Shift');
    await pg.click('#pPower button[data-pw="powerkit"]'); await pg.waitForTimeout(100); await pg.click('.stepper[data-st="r0"] button:last-child'); await pg.waitForTimeout(100);
    await pg.selectOption('#pInfeed', '6'); await pg.waitForTimeout(100); await pg.check('#pFrost'); await pg.waitForTimeout(100); await pg.click('#rightcol button[data-preset="s0:two"]'); await pg.waitForTimeout(100);
    await pg.click('#pW button[data-w="36"]'); await pg.waitForTimeout(150);
    const ps = await panels(); ck('outlets, tiles and width reach all three selected panels; the infeed goes on one panel only (one power-in per circuit run)', ps.every(p => p.pw.kind === 'powerkit' && p.pw.receptacles[0] === 2 && p.w === 36 && /steel24/.test(p.s0)) && ps.filter(p => p.pw.infeed).length === 1, JSON.stringify(ps.map(p => [p.w, p.pw.receptacles, p.s0])));
    const frost = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).every(p => p.glassScreen && p.glassScreen.frosted)); ck('frosted glass reaches all selected panels', frost);
    const [sx, sy] = await (async () => { const v = await pg.evaluate(() => ({ ...window.answerDebug.view })); const box = await pg.locator('#plan').boundingBox(); const P1 = await pg.evaluate(() => { const P = window.answerDebug.P(); const p = Object.values(P.panels)[0]; const a = P.nodes[p.a], b = P.nodes[p.b]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; }); return [box.x + v.ox + P1[0] * v.s, box.y + v.oy - P1[1] * v.s]; })();
    await pg.mouse.click(sx, sy, { button: 'right' }); await pg.hover('.ctxmenu > .it:has-text("Power")'); await pg.click('.ctxmenu .sub .it:has-text("Pass-through")'); await pg.waitForTimeout(120);
    ck('right-click Power reaches the whole selection', (await panels()).every(p => p.pw.kind === 'passthrough'));
    await pg.close(); }

  // minor: skins to the floor keep tile tops under the top cap; window on top tells that glass came off; height change keeps the stacker that fits
  { const { pg, drag, click, panels, width, toastText } = await open(1920, 1080); await width('48'); await pg.keyboard.press('d'); await drag(0, 48, 96, 48); await pg.keyboard.press('v');
    await click(72, 48); await pg.check('#pFloor'); await pg.waitForTimeout(120);
    const fl = await pg.evaluate(() => Object.values(window.answerDebug.P().panels).map(p => p.id + ':' + p.skinsToFloor).join()); ck('skins to the floor set on the selected panel', fl === 'P3:false,P5:true', fl);
    await pg.locator('#elev').scrollIntoViewIfNeeded();
    const tops = await pg.evaluate(() => { const hs = window.answerDebug.elevHits(); const t = (pid) => hs.filter(h => h.kind === 'tile' && h.pid === pid); const lab = hs.find(h => h.kind === 'label'); return { a: Math.min(...t('P3').map(h => h.y)), b: Math.min(...t('P5').map(h => h.y)), bBottom: Math.max(...t('P5').map(h => h.y + h.h)), aBottom: Math.max(...t('P3').map(h => h.y + h.h)), floor: lab.y - 2 }; });
    ck('skins to the floor: same tile top, bottom skin reaches the floor', Math.abs(tops.a - tops.b) < 0.5 && Math.abs(tops.bBottom - tops.floor) < 0.5 && tops.aBottom < tops.floor - 1, JSON.stringify(tops));
    await pg.evaluate(() => window.scrollTo(0, 0)); await click(24, 48); await pg.click('#rightcol button[data-preset="s0:win"]'); await pg.waitForTimeout(120);
    ck('window on top removes the glass and says so', !(await panels()).find(p => p.id === 'P3').glass && /cannot sit over a window/.test(await toastText()), await toastText());
    await pg.click('#pStack button[data-st="24,12"]'); await pg.waitForTimeout(80); await pg.click('#pH button[data-h="78"]'); await pg.waitForTimeout(120);
    ck('54+24+12 raised to 78 keeps 12" and says so', (await panels()).find(p => p.id === 'P3').stack === '12' && /stack is now 12"/.test(await toastText()), await toastText());
    await pg.close(); }

  // minor: zoom buttons keep the view centre and stay within limits; 18" option; Delete on a junction explains; Escape cancels a move; Tab with Finishes open
  { const { pg, drag, click, panels, start, toastText, S, box, width } = await open(); await start(); await pg.click('#zFit'); await pg.waitForTimeout(100);
    const c0 = await S(48, 48); for (let i = 0; i < 3; i++) await pg.click('#zIn'); const c1 = await S(48, 48); ck('+ zooms about the view centre', Math.hypot(c0[0] - c1[0], c0[1] - c1[1]) < 1, JSON.stringify([c0, c1]));
    for (let i = 0; i < 30; i++) await pg.click('#zIn'); const hi = await pg.evaluate(() => window.answerDebug.view.s); for (let i = 0; i < 40; i++) await pg.click('#zOut'); const lo = await pg.evaluate(() => window.answerDebug.view.s);
    ck('zoom buttons clamp like the wheel', hi <= 14 && lo >= 0.05, hi + ' ' + lo); await pg.click('#zFit'); await pg.waitForTimeout(100);
    ck('18" panels offered for drawing', await pg.$('#optWidth option[value="18"]') !== null);
    await click(48, 48); await pg.keyboard.press('Delete'); await pg.waitForTimeout(80); ck('Delete on a junction with panels explains', (await panels()).length === 2 && /still has panels/.test(await toastText()), await toastText());
    const a = await S(24, 48), c = await S(24, 100); await pg.mouse.move(...a); await pg.mouse.down(); await pg.mouse.move(...c, { steps: 5 }); await pg.keyboard.press('Escape'); await pg.mouse.up(); await pg.waitForTimeout(100);
    ck('Escape cancels a run move', (await panels()).every(p => p.y1 === 48 && p.y2 === 48));
    await pg.click('#bFinishes'); await pg.waitForTimeout(200); await pg.keyboard.press('Tab'); await pg.keyboard.press('d'); const col = await pg.evaluate(() => document.querySelector('#st-plan').classList.contains('collapsed'));
    await pg.keyboard.press('Escape'); ck('Tab and D do nothing to the plan while Finishes is open', !col && (await pg.evaluate(() => document.querySelector('#toolgroup .on').textContent)) === 'Select');
    await pg.close(); }

  // minor: right-click submenus stay on screen; hint clear of the scale bar; Side A/B on one line (1280 x 800)
  { const { pg, drag, S, width } = await open(); await width('48'); await pg.keyboard.press('d'); await drag(0, 0, 144, 0); await pg.keyboard.press('v');
    const [sx, sy] = await S(72, 0); await pg.mouse.click(sx, sy, { button: 'right' }); await pg.waitForTimeout(120); await pg.hover('.ctxmenu > .it:has-text("Width")'); await pg.waitForTimeout(120);
    const r = await pg.evaluate(() => { const it = [...document.querySelectorAll('.ctxmenu > .it')].find(e => e.textContent.includes('Width')); const rr = it.querySelector('.sub').getBoundingClientRect(); return [rr.top, rr.bottom, window.innerHeight]; });
    ck('Width submenu fits in the window', r[1] <= r[2] && r[0] >= 0, JSON.stringify(r)); await pg.keyboard.press('Escape');
    const gap = await pg.evaluate(() => { const w = document.querySelector('#planwrap').getBoundingClientRect(), h = document.querySelector('.planhint').getBoundingClientRect(); return h.left - w.left; }); ck('plan hint clear of the scale bar', gap >= 140, gap);
    const bh = await pg.evaluate(() => document.querySelector('#elevSide button').getBoundingClientRect().height); ck('Side A / Side B buttons on one line', bh < 40, bh);
    await pg.close(); }

  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  await b.close();
  console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
