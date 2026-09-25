// Engine tests against the spec guide's worked examples (p45) and rule checks.
const E = require('../src/engine.js');
const cat = require('../src/catalog.json');
E.init(cat);
let fails = 0;
function expect(name, lines, expected) {
  // expected: {style: qty}
  const got = {};
  for (const l of lines) if (l.style !== '—') got[l.style] = (got[l.style] || 0) + l.qty;
  let ok = true; const msgs = [];
  for (const s in expected) if (got[s] !== expected[s]) { ok = false; msgs.push(`  expected ${s} x${expected[s]}, got ${got[s] || 0}`); }
  for (const s in got) if (!(s in expected)) { ok = false; msgs.push(`  unexpected ${s} x${got[s]}`); }
  console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) { fails++; msgs.forEach(m => console.log(m)); }
}
function nodeLines(P, res, nid) { return res.lines.filter(l => l.src === nid); }
function star(P, heights) { // heights by angle {0:66,90:54,...}; returns center node id
  const c = E.addNode(P, 0, 0);
  for (const ang in heights) { const p = E.addPanel(P, c, +ang, 48, heights[ang]); p.label = 'leg' + ang; }
  return c.id;
}

// Package parts (aligners TS7CJCA10/TS7LTA4/TS7120VA4, light seals TS7..ICLS) are listed at each junction as the PIECES that junction needs
// and ordered once for the job as packages (rollupPackages, p387-388). The guide examples print one light-seal package per junction; the
// junction lines now count seals (2 for a T, 4 for an X, p41 Step 4), so those expectations read 2 or 4. Aligner counts were already pieces.
// Example One (p45): X, four heights. A 66 and B 54 adjacent, C 42 opposite A, D 30 opposite B.
{
  const P = E.newProject('thin'); const c = star(P, { 0: 66, 90: 54, 180: 42, 270: 30 });
  const res = E.generate(P);
  expect('p45 Example One — X 4 heights BYO', nodeLines(P, res, c), { TS766JP: 1, TS754JP: 1, TS742JP: 1, TS730JP: 1, TS790JB4: 1, TS766ICLS: 4, TS712TICHT: 1, TS712TCLCHT: 1, TS712TCTCHT: 1, TS790COHJC: 1, TS7LTA4: 1, TS7CJCA10: 1 });
}
// Example Two (p45): X 54,54,42,30 (A,B tallest adjacent)
{
  const P = E.newProject('thin'); const c = star(P, { 0: 54, 90: 54, 180: 42, 270: 30 });
  const res = E.generate(P);
  expect('p45 Example Two — X 3 heights BYO', nodeLines(P, res, c), { TS754JP: 2, TS742JP: 1, TS730JP: 1, TS790JB4: 1, TS766ICLS: 4, TS712TCLCHT: 1, TS712TCTCHT: 1, TS790JC: 1, TS7LTA4: 1, TS7CJCA10: 2 });
  console.log('  light seal 66" as printed in the guide example (never below 66", never below the tallest junction)');
}
// Example Three (p45): Y 54/42/30
{
  const P = E.newProject('thin'); const c = star(P, { 0: 54, 120: 42, 240: 30 });
  const res = E.generate(P);
  expect('p45 Example Three — Y 3 heights BYO', nodeLines(P, res, c), { TS754JP: 1, TS742JP: 1, TS730JP: 1, TS7120JB3: 1, TS712T120CHT: 1, TS712TVCHT: 1, TS7120JC: 1, TS7120VA4: 1 });
}
// p42 T Option 1: A 78, C 66 (spine), B 30 perpendicular -> EOR 12 (78-66), T CoH 36 (66-30), T vertical 30, COHJC, aligner
{
  const P = E.newProject('thin'); const c = star(P, { 0: 78, 180: 66, 90: 30 });
  const res = E.generate(P);
  expect('p42 T Option 1 — 3 heights', nodeLines(P, res, c), { TS778JP: 1, TS766JP: 1, TS730JP: 1, TS790JB3: 1, TS778ICLS: 2, TS712TICHT: 1, TS736TCTCHT: 1, TS766TTVT: 1, TS790COHJC: 1, TS7CJCA10: 1 });
}
// p42 T Option 2: A 66 tall, B (perp) 54, C 30 -> EOR 12, L CoH 24, T vertical 30, COHJC, L-to-T aligner
{
  const P = E.newProject('thin'); const c = star(P, { 0: 66, 90: 54, 180: 30 });
  const res = E.generate(P);
  expect('p42 T Option 2 — 3 heights', nodeLines(P, res, c), { TS766JP: 1, TS754JP: 1, TS730JP: 1, TS790JB3: 1, TS766ICLS: 2, TS712TICHT: 1, TS724TCLCHT: 1, TS730TTVT: 1, TS790COHJC: 1, TS7LTA4: 1, TS7CJCA10: 1 });
}
// p44 X Option 8: A 66 > C 54 > B 42, D 30 -> EOR 12 (A-C), T CoH 12 (C-B), T CoH 24 (C-D), COHJC, aligner x1, blocks 4
{
  const P = E.newProject('thin'); const c = star(P, { 0: 66, 180: 54, 90: 42, 270: 30 });
  const res = E.generate(P);
  expect('p44 X Option 8 — 4 heights', nodeLines(P, res, c), { TS766JP: 1, TS754JP: 1, TS742JP: 1, TS730JP: 1, TS790JB4: 1, TS766ICLS: 4, TS712TICHT: 1, TS712TCTCHT: 1, TS724TCTCHT: 1, TS790COHJC: 1, TS7CJCA10: 1 });
}
// Same-height L 54 -> TS754TLPJ only
{
  const P = E.newProject('thin'); const c = star(P, { 0: 54, 90: 54 });
  const res = E.generate(P);
  expect('same-height L 54', nodeLines(P, res, c), { TS754TLPJ: 1 });
}
// Two-height L 42/66 -> TS746TCLJ
{
  const P = E.newProject('thin'); const c = star(P, { 0: 42, 90: 66 });
  const res = E.generate(P);
  expect('L change-of-height 42/66 pre-configured', nodeLines(P, res, c), { TS746TCLJ: 1 });
}
// In-line change-of-height 42/66 -> TS746TCIJ + stacking horizontal frame package of the taller panel
{
  const P = E.newProject('thin'); const c = star(P, { 0: 42, 180: 66 });
  const res = E.generate(P);
  expect('in-line change-of-height 42/66', nodeLines(P, res, c), { TS746TCIJ: 1, TS748HFS: 1 });
}
// T change-of-height, perpendicular tall (B tall): spine 42/42, leg 66 -> TS7464TCTJ (42,66,42)
{
  const P = E.newProject('thin'); const c = star(P, { 0: 42, 180: 42, 90: 66 });
  const res = E.generate(P);
  expect('T CoH B tall 42/66/42', nodeLines(P, res, c), { TS7464TCTJ: 1 });
}
// T CoH spine tall: A,C 66, leg 42 -> TS7646TCTJ
{
  const P = E.newProject('thin'); const c = star(P, { 0: 66, 180: 66, 90: 42 });
  const res = E.generate(P);
  expect('T CoH A and C tall 66/42/66', nodeLines(P, res, c), { TS7646TCTJ: 1 });
}
// X CoH two opposite tall: 42 & 42 opposite, 30 & 30 -> TS73434TCXJ
{
  const P = E.newProject('thin'); const c = star(P, { 0: 30, 90: 42, 180: 30, 270: 42 });
  const res = E.generate(P);
  expect('X CoH B and D tall', nodeLines(P, res, c), { TS73434TCXJ: 1 });
}
// Stacking: L 54 with 12" stackers on both legs -> L junction omit trim + 12 L stacking junction + L vertical trim 66 + 90 cap + aligners 2 + light seal
{
  const P = E.newProject('thin'); const c = star(P, { 0: 54, 90: 54 });
  for (const p of Object.values(P.panels)) E.setStack(P, p, [12]);
  const res = E.generate(P);
  expect('L 54 + 12 stack both legs', nodeLines(P, res, c), { TS754TLPJ: 1, TS712TLPJS: 1, TS766TLVT: 1, TS790JC: 1, TS7CJCA10: 2, TS766ICLS: 1 });
  const j = nodeLines(P, res, c).find(l => l.style === 'TS754TLPJ'); if (!/omit trim/.test(j.spec)) { console.log('FAIL omit trim adder missing'); fails++; } else console.log('  omit trim applied: ' + j.spec + ' unit $' + j.unit);
}
// Stacking one leg only on in-line 42/42: 24 stacker on leg A -> in-line junction + 24 EOR stacking junction + EOR CoH trim 24 (vertical from 42 to 66)
{
  const P = E.newProject('thin'); const c = star(P, { 0: 42, 180: 42 });
  const pa = Object.values(P.panels)[0]; E.setStack(P, pa, [24]);
  const res = E.generate(P);
  expect('in-line 42 + 24 stacker one side', nodeLines(P, res, c), { TS742TIPJ: 1, TS724TEPJS: 1, TS724TICHT: 1 });
}
// Panel BOM: 48x54 thin, defaults -> panel package TS75448TTF; check price with paint group 1 and fabric group 1
{
  const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 48, 54);
  const res = E.generate(P);
  const pl = res.lines.filter(l => l.src === p.id);
  expect('48x54 panel package', pl, { TS75448TTF: 1 });
  console.log('  ' + pl[0].desc + ' | ' + pl[0].spec + ' | $' + pl[0].unit);
  // end-of-run junctions both ends
  expect('EOR both ends', res.lines.filter(l => l.cat === 'Junction'), { TS754TEPJ: 2 });
  console.log('  footprint', JSON.stringify(res.footprint));
}
// Panel with segmented skins + window and open base -> frame package + skins, F suffix rule not applicable with open base? (skins to the floor)
{
  const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 36, 66);
  p.sides = [[{ kind: 'skin', type: 'tackable acoustical', height: 24 }, { kind: 'skin', type: 'steel', height: 12 }, { kind: 'window', height: 24 }], [{ kind: 'skin', type: 'tackable acoustical', height: 24 }, { kind: 'skin', type: 'steel', height: 12 }, { kind: 'window', height: 24 }]];
  p.skinsToFloor = true; p.power = { kind: 'powerkit', location: 'base', receptacles: [2, 1], usb: [0, 0], infeed: { length: 6 } };
  const res = E.generate(P);
  const pl = res.lines.filter(l => l.src === p.id);
  expect('36x66 buildup with window, skins to floor, power', pl, { TS736THF: 1, TS72436TKF: 2, TS71236HS: 2, TS72436SPW: 1, TS7PK36X: 1, TS71SSX: 1, TS72SSX: 1, TS73SSX: 1, TS76BPX: 1, TS7UFPLATE: 3 }); // faceplates: receptacles cut through skins to the floor (p124, p193)
  for (const l of pl) console.log('   ', l.qty, l.style, l.desc, '|', l.spec, '| $' + l.unit, l.flags.join(' ') , l.notes.join(' '));
  console.log('  warnings:', JSON.stringify(res.warnings));
}
// Oval: L 42/66 -> 66 L junction (plastic cap) + 24" standard CoH trim slim corner; lower panel gets shortened top cap one end
{
  const P = E.newProject('oval'); const c = star(P, { 0: 42, 90: 66 });
  const res = E.generate(P);
  expect('oval L CoH 42/66', nodeLines(P, res, c), { TS766LPJ: 1, TS724CHS: 1 });
  const low = Object.values(P.panels).find(p => p.height === 42);
  const pl = res.lines.filter(l => l.src === low.id); console.log('  lower panel:', pl.map(l => l.style + ' | ' + l.spec).join(' || '));
  if (!/shortened/.test(pl[0].spec)) { console.log('FAIL shortened top cap missing'); fails++; }
}
// Oval same-height T 54 + stack 12 all -> T junction + T stacking junction (trim included)
{
  const P = E.newProject('oval'); const c = star(P, { 0: 54, 180: 54, 90: 54 });
  for (const p of Object.values(P.panels)) E.setStack(P, p, [12]);
  const res = E.generate(P);
  expect('oval T 54 + 12 stack', nodeLines(P, res, c), { TS754TPJ: 1, TS712TPJS: 1 });
}
// validation: 78 + 24 stack -> error (>90); 3 stackers -> error
{
  const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 48, 78); E.setStack(P, p, [24]);
  const res = E.generate(P); const ok = p.stack.length === 0 && res.errors.length === 0; console.log((ok ? 'PASS ' : 'FAIL ') + 'height limit prevented (78 + 24 stack rejected): stack=' + JSON.stringify(p.stack)); if (!ok) fails++;
  // 78" panel default skins must be valid (no 72" skin exists)
  const P3 = E.newProject('thin'); const a3 = E.addNode(P3, 0, 0); const p3 = E.addPanel(P3, a3, 0, 48, 78); const r3 = E.generate(P3);
  const skins = r3.lines.filter(l => l.cat === 'Skins'); const ok3 = skins.length === 4 && r3.warnings.filter(w => !/seismic/.test(w.msg)).length === 0 && skins.every(l => l.style !== '—');
  console.log((ok3 ? 'PASS ' : 'FAIL ') + '78" panel default skins: ' + skins.map(l => l.style).join(',') + ' warnings=' + JSON.stringify(r3.warnings)); if (!ok3) fails++;
  // steel default skin on 66 panel -> 60 not valid for steel -> 36+24
  const P4 = E.newProject('thin'); P4.finishes.skinType = 'steel'; const a4 = E.addNode(P4, 0, 0); const p4 = E.addPanel(P4, a4, 0, 48, 66); const r4 = E.generate(P4);
  const ok4 = r4.warnings.length === 0 && r4.lines.filter(l => l.cat === 'Skins').every(l => l.style.includes('HS'));
  console.log((ok4 ? 'PASS ' : 'FAIL ') + 'steel 66 panel skins: ' + r4.lines.filter(l => l.cat === 'Skins').map(l => l.style).join(',')); if (!ok4) fails++;
  // allowed angles at an L node: only 180 and 270 remain (X/T completions)
  const P5 = E.newProject('thin'); const c5 = E.addNode(P5, 0, 0); E.addPanel(P5, c5, 0, 48, 54); E.addPanel(P5, c5, 90, 48, 54);
  const ang = E.allowedAngles(P5, c5); console.log((JSON.stringify(ang) === '[180,270]' ? 'PASS ' : 'FAIL ') + 'allowed angles at L: ' + JSON.stringify(ang)); if (JSON.stringify(ang) !== '[180,270]') fails++;
  const P6 = E.newProject('thin'); const c6 = E.addNode(P6, 0, 0); E.addPanel(P6, c6, 90, 48, 54); const ang6 = E.allowedAngles(P6, c6); console.log('  allowed at EOR: ' + JSON.stringify(ang6));
}
// ---------- power and stability regressions (p124, p184, 2015 p163-166, p393, p407, p505, p529, p148-151, 2015 p1) ----------
{
  const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' ' + info : '')); if (!ok) fails++; };
  const one = (W, H, power, extra, proj) => { const P = E.newProject('thin'); Object.assign(P.power, proj || {}); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, W, H); Object.assign(p, extra || {}); p.power = Object.assign({ kind: 'powerkit', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null }, power); return { P, p, res: E.generate(P) }; };
  const has = (res, re) => res.warnings.some(w => re.test(w.msg));
  const styles = (res) => res.lines.map(l => l.style);
  // #1 infeed occupies one receptacle location (p184, p529)
  let t = one(24, 54, { receptacles: [1, 1], infeed: { length: 6 } }); check('#1 24"W kit 1+1 + infeed -> location warning', has(t.res, /infeed occupies one receptacle location/));
  t = one(48, 54, { receptacles: [2, 1], infeed: { length: 6 } }); check('#1 48"W kit 2+1 + infeed -> no warning', !has(t.res, /infeed occupies/));
  // #2 base infeed needs a base-location modular powerkit behind base trim (p184)
  t = one(48, 54, { location: 'worksurface', receptacles: [1, 0], infeed: { length: 6 } }); check('#2 worksurface kit + infeed -> not ordered, warned', !styles(t.res).includes('TS76BPX') && has(t.res, /infeed not ordered/));
  t = one(48, 54, { kind: 'passthrough', infeed: { length: 6 } }); check('#2 pass-through + infeed -> warned', !styles(t.res).includes('TS76BPX') && has(t.res, /pass-through/));
  t = one(48, 54, { receptacles: [1, 0], infeed: { length: 12 } }, { openBase: true }); check('#2 open base + infeed -> not ordered', !styles(t.res).includes('TS712BPX') && has(t.res, /infeed not ordered/));
  // #3 faceplates for receptacles in field-cut fabric skins (p124, p193, p526)
  t = one(48, 54, { location: 'worksurface', receptacles: [2, 1], usb: [0, 1] });
  expect('#3 worksurface receptacles -> faceplates', t.res.lines.filter(l => l.cat === 'Power'), { TS71SSX: 1, TS72SSX: 1, TS73SSX: 1, TS74USBX: 1, TS7UFPLATE: 4 });
  t = one(48, 54, { receptacles: [2, 2] }); check('#3 base receptacles in knockouts -> no faceplate', !styles(t.res).includes('TS7UFPLATE'));
  // #4 no opening for receptacles (p58, p59, p126, p189)
  t = one(48, 54, { receptacles: [2, 2] }, { openBase: true }); check('#4 open base + base powerkit -> warning', has(t.res, /Open base trims do not accommodate power/));
  t = one(48, 54, { receptacles: [1, 0] }, { baseTrim: 'plainBothSides' }); check('#4 plain base trim + base receptacles -> warning', has(t.res, /plain base trim/));
  t = one(48, 54, { receptacles: [1, 1] }, { baseTrim: 'knockoutsOneSidePlainOneSide' }); check('#4 one plain side + receptacles both sides -> warning', has(t.res, /one base trim is plain/));
  t = one(48, 54, { location: 'worksurface', receptacles: [1, 1] }, { sides: [[{ kind: 'skin', type: 'steel', height: 48 }], [{ kind: 'skin', type: 'tackable acoustical', height: 48 }]] });
  check('#4 steel skin at worksurface power -> warning side 1 only, faceplate side 2', has(t.res, /Side A: receptacles cannot be accessed through a steel skin/) && !has(t.res, /Side B: receptacles cannot/) && t.res.lines.filter(l => l.style === 'TS7UFPLATE').reduce((a, l) => a + l.qty, 0) === 1);
  // #5 hardwire: frame package with omitted trims + hardwire base trims + hardwired powerkit, no modular power (p192, p393, p531)
  t = one(48, 54, { receptacles: [1, 1], infeed: { length: 6 } }, { baseTrim: 'hardwire' });
  expect('#5 hardwire base trim + power -> hardwired powerkit', t.res.lines.filter(l => ['Panel', 'Power'].includes(l.cat)), { TS748THF: 1, TS748BTH: 2, TS7CPK48: 1 });
  // #6 non-PVC power is not a panel-package option (p407) -> frame package + non-PVC kit
  t = one(48, 54, { receptacles: [1, 0] }, null, { nonPvc: true }); check('#6 non-PVC powerkit on package-eligible panel', styles(t.res).includes('TS7PK48XN') && !styles(t.res).includes('TS75448TTF'), styles(t.res).filter(s => /^TS7(PK|54)/.test(s)).join(','));
  t = one(48, 54, { kind: 'passthrough' }, null, { nonPvc: true }); check('#6 non-PVC pass-through', styles(t.res).includes('TS7PT48XN'));
  // #7 extra-length harness: pass-through at a different height, open-base bottom kit at a corner (p190)
  const pair = (angle, pa, pb, xa, xb) => { const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 48, 54); const q = E.addPanel(P, P.nodes[p.b], angle, 48, 54); Object.assign(p, xa || {}); Object.assign(q, xb || {}); p.power = Object.assign({ kind: 'powerkit', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null }, pa); q.power = Object.assign({ kind: 'powerkit', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null }, pb); return E.generate(P).lines.filter(l => l.pid === 'wc-modular-harness').length; };
  check('#7 worksurface kit + base pass-through in-line -> 1 harness', pair(0, { location: 'worksurface' }, { kind: 'passthrough' }) === 1);
  check('#7 open-base bottom kit at an L -> 1 harness', pair(90, {}, {}, { openBase: true }) === 1);
  check('#7 open-base bottom kit in-line -> no harness', pair(0, {}, {}, { openBase: true }) === 0);
  check('#7 same height base kits at an L -> no harness', pair(90, {}, {}) === 0);
  // #8 technology skins resolve from UI cutout values; receptacles required in every power block location (p189, p505)
  const tech = (rec) => one(48, 54, { location: 'worksurface', receptacles: rec }, { sides: [[{ kind: 'skin', type: 'tackable acoustical', height: 18 }, { kind: 'skin', type: 'technology', height: 6, cutouts: 'All' }, { kind: 'skin', type: 'tackable acoustical', height: 24 }], [{ kind: 'skin', type: 'tackable acoustical', height: 48 }]] }).res;
  let tr = tech([2, 0]); let tl = tr.lines.find(l => l.pid === 'sh-steel-technology-skins');
  check('#8 technology skin 48x6 All cutouts resolves', tl && tl.style === 'TS7648TSS' && !tl.flags.some(f => /Technology skins require/.test(f)), tl ? tl.style : JSON.stringify(tr.warnings));
  tr = tech([1, 0]); tl = tr.lines.find(l => l.pid === 'sh-steel-technology-skins'); check('#8 technology skin with an empty power block -> flagged', tl && tl.flags.some(f => /Technology skins require/.test(f)));
  // #9 return narrower than 30" does not anchor a run over 8' (p150)
  const run = (widths, left, right, extra) => { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const s = n; const nodes = []; for (const w of widths) { const p = E.addPanel(P, n, 0, w, 54); n = P.nodes[p.b]; nodes.push(n); } if (left) E.addPanel(P, s, 90, left, 54); if (right) E.addPanel(P, n, 90, right, 54); if (extra) extra(P, nodes); return E.generate(P).warnings.filter(w => /\(p15[01]\)/.test(w.msg)); };
  check('#9 16\' run with 24"W returns -> warning', run([48, 48, 48, 48], 24, 24).length === 1);
  check('#9 16\' run with 30"W returns -> ok', run([48, 48, 48, 48], 30, 30).length === 0);
  // #10 over 18': 48"W perpendicular every 12', measured through T junctions (p151)
  check('#10 20\' spine, 48"W fin at 4\' leaves a 16\' span -> warning', run([48, 48, 48, 48, 48], 30, 30, (P, ns) => E.addPanel(P, ns[0], 90, 48, 54)).some(w => /longest span without one is 16.0'/.test(w.msg)));
  check('#10 24\' spine, 48"W fin at 12\' -> ok', run([72, 72, 72, 72], 30, 30, (P, ns) => E.addPanel(P, ns[1], 90, 48, 54)).length === 0);
  check('#10 24\' spine, 24"W fin at 12\' -> warning', run([72, 72, 72, 72], 30, 30, (P, ns) => E.addPanel(P, ns[1], 90, 24, 54)).some(w => /48"W perpendicular/.test(w.msg)));
  // #11 both ends of a run over 8' are anchored; a free end within 8' of a return is fine (p150 figures)
  check('#11 16\' run, return at one end only -> warning', run([48, 48, 48, 48], 30, 0).some(w => /one end is free/.test(w.msg)));
  check('#11 8\' fin off a 30"W return -> ok', run([48, 48], 30, 0).length === 0);
  check('#11 16\' run, free end 8\' from a mid-run 30"W fin -> ok', run([48, 48, 48, 48], 30, 0, (P, ns) => E.addPanel(P, ns[1], 90, 30, 54)).length === 0);
  // #12 Canadian list: each base price and option x1.09 rounded, then added (2015 p1)
  { const P = E.newProject('thin'); P.manual = [{ style: 'TS7UFPLATE', qty: 1 }, { style: 'TS7UFPLATE', qty: 1 }, { style: 'TS7UFPLATE', qty: 1 }]; const r = E.generate(P); check('#12 Canadian 3 x $5 faceplates = $15', r.totals.all === 15 && r.totals.canadian === 15, JSON.stringify(r.totals)); }
  { const P = E.newProject('thin'); P.finishes.trimPaint = { code: '7209', name: 'Custom', group: 2 }; P.finishes.fabric = { code: '5F02', name: 'Group 2 fabric', group: 2 }; const a = E.addNode(P, 0, 0); E.addPanel(P, a, 0, 36, 54); const r = E.generate(P); const pk = r.lines.find(l => l.pid === 'thin-panel-package');
    const byHand = r.lines.reduce((s, l) => s + (l === pk ? 0 : l.qty * Math.round(l.unit * 1.09)), 0) + Math.round((pk.unit - pk.optPrices.reduce((x, y) => x + y, 0)) * 1.09) + pk.optPrices.reduce((x, o) => x + Math.round(o * 1.09), 0);
    check('#12 Canadian rounds the package base and each option separately', pk.optPrices.length > 0 && r.totals.canadian === byHand && byHand !== Math.round(r.totals.all * 1.09), `${r.totals.canadian} (total x1.09 would be ${Math.round(r.totals.all * 1.09)}; options ${JSON.stringify(pk.optPrices)})`); }
  // power-in capacity (p172)
  { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); for (let i = 0; i < 6; i++) { const p = E.addPanel(P, n, 0, 72, 54); n = P.nodes[p.b]; p.power = { kind: 'powerkit', location: 'base', receptacles: [4, 4], usb: [0, 0], infeed: i === 0 ? { length: 6 } : null }; } const r = E.generate(P); check('power-in: 48 receptacles on one 4-circuit infeed -> warning', r.warnings.some(w => /48 receptacles on one power-in.*\(p172\)\. Split it into 2 circuit runs/.test(w.msg))); }
}
// SIF export: header, one record per style+finish set, ON/OD pairs from the Specify text, CRLF, no non-ASCII
{
  const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const p1 = E.addPanel(P, c, 0, 48, 66); E.addPanel(P, c, 90, 48, 54);
  p1.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false };
  const res = E.generate(P);
  const out = E.toSIF(res.lines, { mc: 'STEEL', ct: 'ANSWER', title: 'Test job', tagOf: () => 'WS 1' });
  const t = out.text; const recs = (t.match(/^PN=/gm) || []).length;
  const ok = t.startsWith('SF=') && /\r\nST=Test job\r\n/.test(t) && recs === out.records && recs > 5 && /\r\nMC=STEEL\r\n/.test(t) && /\r\nCT=ANSWER\r\n/.test(t)
    && /\r\nON=7207\r\nOD=Paint Black/.test(t) && /\r\nTG=WS 1\r\n/.test(t) && !/[^\x00-\x7f]/.test(t) && t.endsWith('\r\n') && !/[^\r]\n/.test(t)
    && (t.match(/^PL=\d+\.\d\d$/gm) || []).length === recs && (t.match(/^QT=\d+$/gm) || []).length === recs;
  console.log((ok ? 'PASS ' : 'FAIL ') + `SIF export: ${out.records} records, ${out.pieces} pieces, ${t.split('\r\n').length} lines`); if (!ok) { fails++; console.log(t.slice(0, 600)); }
  const opts = E.specOptions('paint 7207 Black; side 1 fabric B902 Soft White (group 1); paint group 1 (+$12); wood top cap 3062 Graphite Walnut (+$50)');
  const ok2 = JSON.stringify(opts) === JSON.stringify([{ on: '7207', od: 'Paint Black' }, { on: 'B902', od: 'Side 1 fabric Soft White (group 1)' }, { on: '3062', od: 'Wood top cap Graphite Walnut' }]);
  console.log((ok2 ? 'PASS ' : 'FAIL ') + 'SIF option pairs: ' + JSON.stringify(opts)); if (!ok2) fails++;
}
// ---- thin junction audit regressions ----
function check(name, ok, info) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ': ' + info : '')); if (!ok) fails++; }
// p33/p375: one stacking junction per stacker; the 36" end-of-run stacker is never an end-of-run stacking junction
{
  const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 48, 42); E.setStack(P, p, [24, 12]);
  const nl = nodeLines(P, E.generate(P), a.id);
  expect('EOR 42 + 24/12 stackers -> 24" + 12" EOR stacking junctions (p375)', nl, { TS742TEPJ: 1, TS724TEPJS: 1, TS712TEPJS: 1, TS778TEVT: 1 });
  check('stacking band labels follow each stacker', nl.some(l => l.style === 'TS712TEPJS' && /66"→78"/.test(l.desc)));
  const P2 = E.newProject('thin'); const a2 = E.addNode(P2, 0, 0); const p2 = E.addPanel(P2, a2, 0, 48, 42); E.setStack(P2, p2, [18, 18]);
  expect('EOR 42 + 18/18 stackers -> two 18" EOR stacking junctions', nodeLines(P2, E.generate(P2), a2.id), { TS742TEPJ: 1, TS718TEPJS: 2, TS778TEVT: 1 });
  const P3 = E.newProject('thin'); const c3 = star(P3, { 0: 42, 90: 42 }); for (const q of Object.values(P3.panels)) E.setStack(P3, q, [18, 18]);
  expect('L 42 + 18/18 both legs -> two 18" L stacking junctions', nodeLines(P3, E.generate(P3), c3), { TS742TLPJ: 1, TS718TLPJS: 2, TS778TLVT: 1, TS790JC: 1, TS7CJCA10: 2, TS778ICLS: 1 });
}
// p49 Step 7: spine stackers over a thin T base = one EOR stacking junction per panel + junction blocks (p50 Step 9); L pair shares an L
{
  const P = E.newProject('thin'); const c = star(P, { 0: 42, 180: 42, 90: 42 }); for (const q of Object.values(P.panels)) if (q.label !== 'leg90') E.setStack(P, q, [12]);
  expect('p49 Step 7 left — T 42, spine stacked 12', nodeLines(P, E.generate(P), c), { TS742TTPJ: 1, TS712TEPJS: 2, TS754TTVT: 1, TS712TCTCHT: 1, TS790JC: 1, TS7CJCA10: 2, TS766ICLS: 2, TS790JB3: 1 });
  const P2 = E.newProject('thin'); const c2 = star(P2, { 0: 42, 90: 42, 180: 42 }); for (const q of Object.values(P2.panels)) if (q.label !== 'leg180') E.setStack(P2, q, [12]);
  expect('p49 Step 7 right — T 42, adjacent pair stacked 12', nodeLines(P2, E.generate(P2), c2), { TS742TTPJ: 1, TS712TLPJS: 1, TS742TTVT: 1, TS712TCLCHT: 1, TS790JC: 1, TS7CJCA10: 2, TS7LTA4: 1, TS766ICLS: 2 });
  const P3 = E.newProject('thin'); const c3 = star(P3, { 0: 42, 180: 42 }); for (const q of Object.values(P3.panels)) E.setStack(P3, q, [12]);
  expect('in-line base, both stacked 12 -> in-line stacking junction', nodeLines(P3, E.generate(P3), c3), { TS742TIPJ: 1, TS712IPJS: 1 });
}
// p357/p25: build-your-own in-line change-of-height needs the stacking horizontal frame package
{
  const P = E.newProject('thin'); const c = star(P, { 0: 30, 180: 78 }); const nl = nodeLines(P, E.generate(P), c);
  expect('BYO in-line 30/78 includes stacking horizontal frame package', nl, { TS730TIPJ: 1, TS736TEPJS: 1, TS712TEPJS: 1, TS748HFS: 1, TS736TICHT: 1, TS712TICHT: 1 });
  const s36 = nl.find(l => l.style === 'TS736TEPJS'); check('stacking row note not duplicated', s36 && s36.notes.filter(n => /36" stacker/.test(n)).length === 1);
}
// p360: T change-of-height is handed only when A and C differ
{
  const handed = (h) => { const P = E.newProject('thin'); const c = star(P, h); return nodeLines(P, E.generate(P), c).filter(l => /TCTJ$/.test(l.style)).map(l => l.style + (l.notes.some(n => /handed/.test(n)) ? ' handed' : '')).join(); };
  const b = handed({ 0: 42, 180: 42, 90: 66 }), ac = handed({ 0: 66, 180: 66, 90: 42 }), ct = handed({ 0: 42, 90: 42, 180: 66 }), ab = handed({ 0: 66, 90: 66, 180: 42 });
  check('T CoH handed note only on C tall / A and B tall', b === 'TS7464TCTJ' && ac === 'TS7646TCTJ' && ct === 'TS7446TCTJ handed' && ab === 'TS7664TCTJ handed', [b, ac, ct, ab].join(' | '));
}
// p20: no 30" wall-start junction -> flagged line, never an undefined style
{
  const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); a.wallStart = true; E.addPanel(P, a, 0, 48, 30);
  const res = E.generate(P); const nl = nodeLines(P, res, a.id);
  check('wall-start 30" is TS730WPJ in the 2022 guide (2022 p372) with the 2022 p20 note as a flag, no warning', nl.length === 1 && nl[0].style === 'TS730WPJ' && nl[0].flags.length === 1 && /2022 p20/.test(nl[0].flags[0]) && !res.warnings.some(w => /Wall-start/.test(w.msg)), nl.map(l => l.style + ' ' + l.flags.join('/')).join());
}
// p25/p357: in-line change-of-height to a panel stacked to 90" uses the 54/90, 66/90, 78/90 rows
{
  const run = (lo, hiBase, st) => { const P = E.newProject('thin'); const c = star(P, { 0: lo, 180: hiBase }); E.setStack(P, Object.values(P.panels).find(q => q.label === 'leg180'), st); return nodeLines(P, E.generate(P), c); };
  // The p357 tip's stacking horizontal frame package is the taller panel's own stacking-tier package here (p50 Step 8: stacking junctions on
  // both sides of a panel share one), so the junction no longer adds a second one; the panel's tier line carries it.
  expect('in-line 54 | 78+12 -> TS759TCIJ', run(54, 78, [12]), { TS759TCIJ: 1 });
  expect('in-line 66 | 66+24 -> TS769TCIJ', run(66, 66, [24]), { TS769TCIJ: 1 });
  expect('in-line 78 | 78+12 -> TS779TCIJ', run(78, 78, [12]), { TS779TCIJ: 1 });
  expect('in-line 54 | 54+24/12 -> TS759TCIJ', run(54, 54, [24, 12]), { TS759TCIJ: 1 });
}
// p35/p387: light seals top out at 78"; a taller junction is flagged
{
  const P = E.newProject('thin'); const c = star(P, { 0: 78, 90: 78 }); for (const q of Object.values(P.panels)) E.setStack(P, q, [12]);
  const s = nodeLines(P, E.generate(P), c).find(l => l.style === 'TS778ICLS'); check('light seal shorter than 90" junction flagged', !!s && s.flags.some(f => /12" shorter than the 90"/.test(f)));
  const P2 = E.newProject('thin'); const c2 = star(P2, { 0: 66, 90: 66 }); for (const q of Object.values(P2.panels)) E.setStack(P2, q, [12]);
  const s2 = nodeLines(P2, E.generate(P2), c2).find(l => l.style === 'TS778ICLS'); check('78" seal on 78" junction not flagged', !!s2 && !s2.flags.length);
}
// p387: junction block packages of 3/4/5 mixed for the cheapest exact count (6 = 3+3, not 2 x 5)
{
  const P = E.newProject('thin'); const c = star(P, { 0: 78, 90: 78, 180: 54, 270: 66 }); E.setStack(P, Object.values(P.panels).find(q => q.label === 'leg270'), [12]);
  const bl = nodeLines(P, E.generate(P), c).filter(l => /JB\d$/.test(l.style));
  check('6 blocks -> 2 x TS790JB3', bl.length === 1 && bl[0].style === 'TS790JB3' && bl[0].qty === 2, bl.map(l => l.qty + 'x' + l.style).join());
}
// ---- oval change-of-height trims, stacking trim finishes, skins/windows/glass rule checks (audit fixes) ----
{
  const TA = 'tackable acoustical';
  const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ': ' + info : '')); if (!ok) fails++; };
  const ovalStar = (heights, stacks, opt) => { const P = E.newProject('oval'); if (opt) opt(P); const c = star(P, heights); const ps = Object.values(P.panels); (stacks || []).forEach((s, i) => { if (s) E.setStack(P, ps[i], s); }); return { P, c, res: E.generate(P) }; };
  const trims = (r) => nodeLines(r.P, r.res, r.c).filter(l => l.cat === 'Trim');
  // 2015 p81: 36"H standard CoH is the tallest; above it use stacking CoH trim
  expect('oval L 30/78 CoH: standard 36 + stacking 12 (2015 p81)', trims(ovalStar({ 0: 30, 90: 78 })), { TS736CHS: 1, TS712CHST: 1 });
  // 2015 p81: more than one stacked panel -> standard on the first tier, stacking on the second
  expect('oval in-line 42 / 42+12+12 CoH: standard 12 + stacking 12 (2015 p81)', trims(ovalStar({ 0: 42, 180: 42 }, [null, [12, 12]])), { TS712CHS: 1, TS712CHST: 1 });
  expect('oval in-line 42 / 42+24 CoH: one standard 24 (2015 p81)', trims(ovalStar({ 0: 42, 180: 42 }, [null, [24]])), { TS724CHS: 1 });
  expect('oval L 42 / 54+24 CoH: one standard 36 (2015 p81)', trims(ovalStar({ 0: 42, 90: 54 }, [null, [24]])), { TS736CHS: 1 });
  // p454: wood stacking CoH trim is its own style; fabric is an option on steel trim
  const wood = (P) => { P.finishes.woodTrim = true; P.finishes.ovalWoodTrim = true; }, fab = (P) => { P.finishes.ovalTrimFabric = true; };
  expect('oval L 30/78 wood trim: TS736CHSW + TS712CHSTW (p453-454)', trims(ovalStar({ 0: 30, 90: 78 }, null, wood)), { TS736CHSW: 1, TS712CHSTW: 1 });
  { const st = trims(ovalStar({ 0: 30, 90: 78 }, null, fab)).find(l => l.style === 'TS712CHST'); check('oval stacking CoH fabric trim option (2022 2022 p454: $87 + $73 fabric)', st && /fabric trim/.test(st.spec) && st.unit === 87 + 73, st && st.spec + ' $' + st.unit); }
  // p376: stacking L/T junction trim in wood is the ...PJSW style; fabric +$80 on steel trim
  { const r = ovalStar({ 0: 54, 90: 54 }, [[12], [12]], wood); const sj = nodeLines(r.P, r.res, r.c).filter(l => l.cat === 'Stacking'); check('oval wood trim: stacking L junction is TS712LPJSW (2022 2022 p442: $675)', sj.length === 1 && sj[0].style === 'TS712LPJSW' && sj[0].unit === 675, sj.map(l => l.style + ' $' + l.unit).join(',')); }
  { const r = ovalStar({ 0: 54, 90: 54 }, [[12], [12]], fab); const sj = nodeLines(r.P, r.res, r.c).filter(l => l.cat === 'Stacking'); check('oval fabric trim: stacking L junction +$114 fabric (2022 2022 p442: $476 + $114)', sj.length === 1 && sj[0].style === 'TS712LPJS' && sj[0].unit === 476 + 114 && /fabric trim/.test(sj[0].spec), sj.map(l => l.style + ' $' + l.unit + ' ' + l.spec).join(',')); }
  // single-panel helper
  const one = (trim, h, setup, w) => { const P = E.newProject(trim); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, w || 48, h); setup(p, P, a); const res = E.generate(P); return { P, p, res, pl: res.lines.filter(l => l.src === p.id), wm: res.warnings.filter(x => x.panel === p.id).map(x => x.msg) }; };
  // 2015 p117: technology covers, one per cutout opening (cutouts given as the planner's UI values)
  const tech = (cut, w) => one('thin', 42, p => { p.power.kind = 'powerkit'; p.sides = [[{ kind: 'skin', type: 'steel', height: 24 }, { kind: 'skin', type: 'technology', height: 12, cutouts: cut }], [{ kind: 'skin', type: TA, height: 36 }]]; }, w).pl.filter(l => l.style === 'TS7TSCOVER').reduce((a, l) => a + l.qty, 0);
  check('technology covers: 48"W All = 2, Right = 1, None = 0; 72"W All = 4; 24"W All = 1 (2015 p117)', tech('All') === 2 && tech('Right') === 1 && tech('None') === 0 && tech('All', 72) === 4 && tech('All', 24) === 1, [tech('All'), tech('Right'), tech('None'), tech('All', 72), tech('All', 24)].join('/'));
  // p472: 48"H and 60"H to-the-floor fabric skins are vertical only
  { const r = one('thin', 66, p => { p.skinsToFloor = true; }); const f = r.pl.filter(l => /TKF$/.test(l.style)); check('60"H to-the-floor fabric skins get vertical application (p472)', f.length === 2 && f.every(l => /vertical application/.test(l.spec)), f.map(l => l.spec).join(' | ')); }
  // p140 / p18: window placement and pairing
  const win = (h) => ({ kind: 'window', height: h, pane: 'single' }), sk = (h) => ({ kind: 'skin', type: TA, height: h });
  { const r = one('thin', 54, p => { p.sides = [[win(24), sk(24)], [win(24), sk(24)]]; }); check('window at the base of a panel warns (p140)', r.wm.some(m => /base of a panel/.test(m)), r.wm.join(' | ')); }
  { const r = one('thin', 66, p => { p.sides = [[sk(24), win(12), sk(24)], [sk(24), win(12), sk(24)]]; }); check('window below the top of a base panel warns (p59, p140)', r.wm.some(m => /top position only/.test(m)), r.wm.join(' | ')); }
  { const r = one('thin', 66, p => { p.sides = [[sk(36), win(24)], [sk(60)]]; }); check('window on one side only warns (p18)', r.wm.some(m => /no matching window/.test(m)), r.wm.join(' | ')); }
  { const r = one('thin', 66, p => { p.sides = [[sk(36), win(24)], [sk(24), sk(12), win(24)]]; }); const n = r.pl.filter(l => /SPW$/.test(l.style)).length; check('window counted once when sides are segmented differently', n === 1 && !r.wm.some(m => /no matching/.test(m)), n + ' windows'); }
  { const r = one('thin', 48, (p, P) => { p.sides = [[sk(18), win(24)], [sk(18), win(24)]]; E.setStack(P, p, [12, 12]); p.stackSides = [0, 1].map(() => [[win(12)], [win(12)]]); });
    check('3 stacked windows and windows on a 24" top window warn (p140)', r.wm.some(m => /No more than two/.test(m)) && r.wm.some(m => /24"H glass window in the top/.test(m)), r.wm.join(' | '));
    check('both stack tiers windows: one stacking frame package kept (p63, 2015 p119)', r.pl.filter(l => /HFS$/.test(l.style)).length === 1, r.pl.filter(l => /HFS$/.test(l.style)).map(l => l.style).join(',')); }
  // p131: slatwall not in the bottom 12"; brace package only when asked for
  { const r = one('thin', 42, p => { p.sides[0] = [{ kind: 'skin', type: 'slatwall', height: 12 }, sk(24)]; }); check('slatwall at the bottom warns, no brace by default (p131)', r.wm.some(m => /bottom 12/.test(m)) && !r.pl.some(l => /SBP$/.test(l.style)), r.wm.join(' | ')); }
  { const r = one('thin', 42, p => { p.sides[0] = [sk(24), { kind: 'skin', type: 'slatwall', height: 12, brace: true }]; }); check('slatwall with brace flag orders the brace package (p131)', r.pl.some(l => l.style === 'TS71248SBP') && !r.wm.some(m => /bottom 12/.test(m)), r.pl.map(l => l.style).join(',')); }
  // p65 / p399: recessed glass top cap connector
  { const P = E.newProject('thin'); star(P, { 0: 54, 90: 54 }); for (const q of Object.values(P.panels)) q.glassScreen = { attach: 'recessed', height: 12 }; const res = E.generate(P); check('no recessed top cap connector at a same-height corner (p65)', !res.lines.some(l => l.style === 'TS7TFGRC')); }
  { const P = E.newProject('thin'); star(P, { 0: 54, 90: 66 }); const low = Object.values(P.panels).find(q => q.height === 54); low.glassScreen = { attach: 'recessed', height: 12 }; const res = E.generate(P); check('recessed top cap connector at a corner with a taller leg (p65)', res.lines.filter(l => l.style === 'TS7TFGRC').reduce((a, l) => a + l.qty, 0) === 1); }
  { const P = E.newProject('thin'); star(P, { 0: 54, 180: 66 }); const low = Object.values(P.panels).find(q => q.height === 54); low.glassScreen = { attach: 'recessed', height: 12 }; const res = E.generate(P); check('recessed top cap connector at in-line change-of-height, glass on the lower panel (p399)', res.lines.filter(l => l.style === 'TS7TFGRC').reduce((a, l) => a + l.qty, 0) === 1); }
  { const r = one('thin', 54, (p, P, a) => { a.wallStart = true; p.glassScreen = { attach: 'recessed', height: 12 }; }); check('recessed top cap connector at a wall start (p65)', r.pl.filter(l => l.style === 'TS7TFGRC').reduce((x, l) => x + l.qty, 0) === 1); }
  // p486/487/488/490: laminate and wood skins need the trim paint color
  { const r = one('thin', 42, p => { p.sides = [[{ kind: 'skin', type: 'laminate', height: 36 }], [{ kind: 'skin', type: 'wood', height: 36 }]]; }); const ls = r.pl.filter(l => /LS$|WS$/.test(l.style)); check('laminate and wood skins specify trim paint (p486, p488)', ls.length === 2 && ls.every(l => /trim paint 7207/.test(l.spec)), ls.map(l => l.style + ' ' + l.spec).join(' | ')); }
}
// ---- oval stacking junctions: same type as the base junction (p93), start at the shared tallest junction (2015 p81, p100), one per stacker tier ----
{
  const ov = (heights, stacks, opt) => { const P = E.newProject('oval'); if (opt) opt(P); const c = star(P, heights); const ps = Object.values(P.panels); (stacks || []).forEach((s, i) => { if (s) E.setStack(P, ps[i], s); }); const res = E.generate(P); return nodeLines(P, res, c).filter(l => l.cat === 'Junction' || l.cat === 'Stacking' || l.cat === 'Trim'); };
  expect('oval in-line 42 / 42+24: in-line stacking junction + standard CoH, no EOR stacker (p93, 2015 p81)', ov({ 0: 42, 180: 42 }, [null, [24]]), { TS742IPJ: 1, TS724IPJS: 1, TS724CHS: 1 });
  expect('oval L 42 / 54+24: L stacking junction from 54" + standard CoH 36 (p93, 2015 p81)', ov({ 0: 42, 90: 54 }, [null, [24]]), { TS754LPJ: 1, TS724LPJS: 1, TS736CHS: 1 });
  // one change-of-height trim run per exposed face (p95): legs 0 and 270 expose 42"→66" (standard 12 on the first stacked tier + stacking 12
  // on the second, 2015 p81), leg 90 exposes 54"→66" (standard 12). Earlier the band model counted one trim per height band, not per face.
  expect('oval X 42 / 42+12 / 42+24 / 42: X stacking junctions only (p93), CoH trim per exposed face (p95)', ov({ 0: 42, 90: 42, 180: 42, 270: 42 }, [null, [12], [24], null]), { TS742XPJ: 1, TS712XPJS: 2, TS712CHS: 3, TS712CHST: 2 });
  expect('oval in-line 66 / 42+24: no stacking junction below the shared 66" junction (2015 p81, p100)', ov({ 0: 66, 180: 42 }, [null, [24]]), { TS766IPJ: 1 });
  expect('oval in-line 54 / 42+24: in-line stacker 54"→66" only + 12 CoH (2015 p81)', ov({ 0: 54, 180: 42 }, [null, [24]]), { TS754IPJ: 1, TS712IPJS: 1, TS712CHS: 1 });
  { const P = E.newProject('oval'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 48, 42); E.setStack(P, p, [24, 12]); const res = E.generate(P);
    expect('oval end-of-run 42+[24,12]: TS724EPJS + TS712EPJS (p100, p443)', res.lines.filter(l => l.src === a.id), { TS742EPJ: 1, TS724EPJS: 1, TS712EPJS: 1 }); }
  expect('oval in-line both [18,18]: two 18" in-line stackers (p100, p375)', ov({ 0: 42, 180: 42 }, [[18, 18], [18, 18]]), { TS742IPJ: 1, TS718IPJS: 2 });
  expect('oval wood trim L 54 +12: wood base + TS712LPJSW (p433, p376)', ov({ 0: 54, 90: 54 }, [[12], [12]], P => { P.finishes.woodTrim = true; P.finishes.ovalWoodTrim = true; }), { TS754LPJW: 1, TS712LPJSW: 1 });
  { const ls = ov({ 0: 54, 120: 54 }, [[12], null], P => { P.finishes.ovalTrimFabric = true; }); const v = ls.find(l => l.style === 'TS712VPJS');
    const ok = v && v.unit === 630 + 114 && /fabric trim/.test(v.spec) && ls.some(l => l.style === 'TS712CHS');
    console.log((ok ? 'PASS ' : 'FAIL ') + 'oval fabric trim V 54 / 54+12: V stacking junction +$114 fabric (2022 2022 p444: $630), CoH on the unstacked face (2022 p408): ' + ls.map(l => l.style + ' $' + l.unit).join(', ')); if (!ok) fails++; }
}
// ---------- workstations: supports (p223/224/225/227/234/235/236/237), worksurfaces (p506-526), pedestals (p651/652/653/655/656) ----------
{
  const wsLines = (res) => res.lines.filter(l => /^W\d/.test(l.src) || (l.src === 'project' && l.pid === 'uw-side-support-brackets'));
  const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!ok) fails++; };
  const run = (widths, h) => { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const ps = []; for (const w of widths) { const q = E.addPanel(P, n, 0, w, h || 54); ps.push(q); n = P.nodes[q.b]; } return { P, ps }; };
  const L2 = (w0, w90) => { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, w0, 54); const b = E.addPanel(P, c, 90, w90, 54); return { P, c, a, b }; }; // legs east + north: east is the user's left
  const wsErr = (res) => res.errors.filter(e => /^W/.test(e.panel));
  // 1. 18"D corners: nominal 18 (not 19), BOM finds the style, P and SW edges offered (p563)
  { const z = E.cornerSizes('corner', 'cord-drop').find(z => z.style === 'UCC114242'); const { P, c, a, b } = L2(42, 42); const w = E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: z.C, D: z.D, depthA: z.depthA, depthB: z.depthB }); const res = E.generate(P);
    expect('18"D corner from the size list -> UCC114242 (p563)', wsLines(res), { UCC114242: 1, UCANT: 2, USSBR: 1 }); check('18"D corner nominal depth and edges (p563)', z.depthA === 18 && JSON.stringify(E.wsEdgesFor(P, w)) === '["3mm","P","SW"]', `depth ${z.depthA}, edges ${E.wsEdgesFor(P, w)}`); }
  // 2. extended corner arms over 54" take a reinforcing channel (p567 tip, p224, p589)
  { const { P, c, a, b } = L2(60, 42); E.newWorksurface(P, { kind: 'extcorner', node: c.id, legs: [a.id, b.id], C: 60, D: 42, depthA: 24, depthB: 24, hand: 'L' }); expect('extended corner 60×42 -> TS7WKSPT for the 60" arm', wsLines(E.generate(P)), { UEC2202L: 1, TS7WKSPT: 1, UCANT: 2, USSBR: 1 }); }
  { const { P, c, a, b } = L2(72, 48); E.newWorksurface(P, { kind: 'extcorner', node: c.id, legs: [a.id, b.id], C: 72, D: 48, depthA: 24, depthB: 24, hand: 'L' }); expect('extended corner 72×48 -> TS7WKSPT72 for the 72" arm', wsLines(E.generate(P)), { UEC2228L: 1, TS7WKSPT72: 1, UCANT: 2, USSBR: 1 }); }
  // 3. a fixed pedestal under a 30"D corner arm is 30"D (p651, p315)
  { const { P, c, a, b } = L2(48, 48); const w = E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 48, D: 48, depthA: 30, depthB: 30 }); E.addPedestal(P, w, { at: 'arm0', type: 'fixed' }); expect('30"D corner + fixed pedestal -> RPF3027AF with its filler (p315, p652)', wsLines(E.generate(P)), { UCC334848: 1, UCANT: 1, RPF3027AF: 1, RPXFTAKFP: 1, USSBR: 1 }); }
  // 4. a seam where the lower worksurface ends on a pedestal: the next worksurface carries its own cantilever (p237)
  { const { P, ps } = run([48, 48]); const w1 = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); const w2 = E.newWorksurface(P, { panel: ps[1].id, width: 48, depth: 24 }); E.addPedestal(P, w1, { at: 'hi', type: 'fixed' }); const res = E.generate(P);
    expect('seam with a pedestal on one side -> 3 cantilevers', wsLines(res), { US2448: 2, UCANT: 3, RPF2427AF: 1, RPXFTAKFP: 1 }); check('  seam end not left "shared" with a pedestal', w2._resolved.lo === 'cantilever', JSON.stringify(w2._resolved)); }
  // 5. two 30"D in line: end panels go on the free ends, the seam keeps one shared cantilever (p223, p237)
  { const { P, ps } = run([48, 48]); const w1 = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 30 }); const w2 = E.newWorksurface(P, { panel: ps[1].id, width: 48, depth: 30 }); const res = E.generate(P);
    expect('two 48×30 in line -> 2 end panels at the free ends, 1 seam cantilever', wsLines(res), { US3048: 2, UCANT: 1, UEP30: 2 }); check('  end panels at the free ends', w1._resolved.lo === 'endpanel' && w1._resolved.hi === 'cantilever' && w2._resolved.lo === 'shared' && w2._resolved.hi === 'endpanel', JSON.stringify([w1._resolved, w2._resolved])); }
  // 6. two corners meeting at one junction share one cantilever (p237, p588 tips)
  { const P = E.newProject('thin'); const c1 = E.addNode(P, 0, 0); const a = E.addPanel(P, c1, 0, 42, 54); const b = E.addPanel(P, P.nodes[a.b], 0, 42, 54); const c2 = P.nodes[b.b]; const r1 = E.addPanel(P, c1, 270, 42, 54); const r2 = E.addPanel(P, c2, 270, 42, 54);
    E.newWorksurface(P, { kind: 'corner', node: c1.id, legs: [r1.id, a.id], C: 42, D: 42 }); E.newWorksurface(P, { kind: 'corner', node: c2.id, legs: [b.id, r2.id], C: 42, D: 42 }); const res = E.generate(P);
    expect('two corners at one seam -> 3 cantilevers, not 4', wsLines(res), { UCC224242: 2, UCANT: 3, USSBR: 1 }); check('  no worksurface errors', wsErr(res).length === 0, JSON.stringify(wsErr(res))); }
  // 7. extended corner hand follows the plan: C and A are the user's left arm (p567)
  { const { P, c, a, b } = L2(60, 42); const w = E.newWorksurface(P, { kind: 'extcorner', node: c.id, legs: [b.id, a.id], C: 42, D: 60, depthA: 24, depthB: 24, hand: 'R' });
    check('extended corner legs given right-first are normalized (long arm on the left = left-hand)', w.legs[0] === a.id && w.C === 60 && w.hand === 'L' && wsLines(E.generate(P)).some(l => l.style === 'UEC2202L'), JSON.stringify([w.C, w.D, w.hand]));
    w.legs = [w.legs[1], w.legs[0]]; const st = wsLines(E.generate(P)).find(l => l.cat === 'Worksurface').style; check('legs swapped after placing: long arm now on the right -> right-hand style', st === 'UEC2220R', st); }
  // 8. on-module supports sit on panel junctions (p236); corner arms 1/2" less than the panel width (p225)
  { const { P, c, a, b } = L2(36, 36); E.addPanel(P, P.nodes[a.b], 0, 36, 54); E.addPanel(P, P.nodes[b.b], 90, 36, 54); E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 42, D: 42 }); const res = E.generate(P);
    check('42" corner on 36" panels -> support-off-junction error', wsErr(res).filter(e => /from the nearest panel junction/.test(e.msg)).length === 2, JSON.stringify(wsErr(res).map(e => e.msg.slice(0, 80)))); }
  { const { P, ps } = run([48, 48]); E.newWorksurface(P, { panel: ps[0].id, off: 12, width: 48, depth: 24 }); const res = E.generate(P); check('straight worksurface slid 12" off the seams -> error', wsErr(res).filter(e => /junction/.test(e.msg)).length === 2); }
  { const src = require('fs').readFileSync(__dirname + '/../src/planner.js', 'utf8'); const s = src.indexOf('const TYPICALS = ['); const e = src.indexOf('\n  ];', s); const P = E.newProject('thin'); const TYPICALS = eval('(' + src.slice(s + 'const TYPICALS = '.length, e + 4) + ')');
    for (const t of TYPICALS.filter(t => t.ws)) { const res = E.generate(t.build()); check(`typical "${t.name}" places with no errors or worksurface warnings`, res.errors.length === 0 && res.warnings.filter(w => /^W/.test(w.panel)).length === 0, JSON.stringify(res.errors.concat(res.warnings.filter(w => /^W/.test(w.panel))))); } }
  // 9. long worksurfaces: a cantilever at the junction under them keeps supports within 54" (p224, p237)
  { const { P, ps } = run([42, 42]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 84, depth: 24 }); const res = E.generate(P); expect('84"W on 42+42 -> cantilever at the 42" junction, no channel', wsLines(res), { US2484: 1, UCANT: 3 }); check('  no span error', wsErr(res).length === 0 && JSON.stringify(w._mid) === '[42]', JSON.stringify(wsErr(res))); }
  { const { P, ps } = run([72]); E.newWorksurface(P, { panel: ps[0].id, width: 72, depth: 24 }); expect('72"W on one 72" panel -> TS7WKSPT72 (p224)', wsLines(E.generate(P)), { US2472: 1, UCANT: 2, TS7WKSPT72: 1 }); }
  // 10-11. pulls are priced per pull; c:scape is proud steel only (p651, p655)
  { const { P, ps } = run([48]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); E.addPedestal(P, w, { at: 'hi', type: 'fixed', config: 'A', front: 'P', pull: 'jazz' }); E.addPedestal(P, w, { at: 'lo', type: 'mobile', config: 'B', front: 'W', pull: 'c:scape' }); const res = E.generate(P);
    const bbf = res.lines.find(l => l.style === 'RPF2427AP'); check('jazz pulls on a box/box/file: +$26 × 3 (2022 2022 p651: proud steel front $1000)', bbf && bbf.unit === 1000 + 78, bbf && '$' + bbf.unit);
    check('c:scape on a proud wood front -> error (p655)', wsErr(res).some(e => /c:scape/.test(e.msg))); }
  // 12. no 18"D end panel (p590)
  { const { P, ps } = run([48]); E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 18, supports: { lo: 'endpanel', hi: 'auto' } }); const res = E.generate(P); check('18"D worksurface with an end panel -> error, no UEP24', !res.lines.some(l => l.style === 'UEP24') && wsErr(res).some(e => /no 18"D end panel/.test(e.msg))); }
  // edge not offered: no invented style number (p539 N.A.)
  { const { P, ps } = run([66]); E.newWorksurface(P, { panel: ps[0].id, width: 66, depth: 18, edge: 'P' }); const res = E.generate(P); const l = res.lines.find(l => l.cat === 'Worksurface'); check('P-edge on US1866 (N.A.) -> US1866 listed + error', l.style === 'US1866' && wsErr(res).some(e => /not offered/.test(e.msg)), l.style); }
}
// SIF export: header, one record per style+finish set, ON/OD pairs from the Specify text, CRLF, no non-ASCII
{
  const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const p1 = E.addPanel(P, c, 0, 48, 66); E.addPanel(P, c, 90, 48, 54);
  p1.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false };
  const res = E.generate(P);
  const out = E.toSIF(res.lines, { mc: 'STEEL', ct: 'ANSWER', title: 'Test job', tagOf: () => 'WS 1' });
  const t = out.text; const recs = (t.match(/^PN=/gm) || []).length;
  const ok = t.startsWith('SF=') && /\r\nST=Test job\r\n/.test(t) && recs === out.records && recs > 5 && /\r\nMC=STEEL\r\n/.test(t) && /\r\nCT=ANSWER\r\n/.test(t)
    && /\r\nON=7207\r\nOD=Paint Black/.test(t) && /\r\nTG=WS 1\r\n/.test(t) && !/[^\x00-\x7f]/.test(t) && t.endsWith('\r\n') && !/[^\r]\n/.test(t)
    && (t.match(/^PL=\d+\.\d\d$/gm) || []).length === recs && (t.match(/^QT=\d+$/gm) || []).length === recs;
  console.log((ok ? 'PASS ' : 'FAIL ') + `SIF export: ${out.records} records, ${out.pieces} pieces, ${t.split('\r\n').length} lines`); if (!ok) { fails++; console.log(t.slice(0, 600)); }
  const opts = E.specOptions('paint 7207 Black; side 1 fabric B902 Soft White (group 1); paint group 1 (+$12); wood top cap 3062 Graphite Walnut (+$50)');
  const ok2 = JSON.stringify(opts) === JSON.stringify([{ on: '7207', od: 'Paint Black' }, { on: 'B902', od: 'Side 1 fabric Soft White (group 1)' }, { on: '3062', od: 'Wood top cap Graphite Walnut' }]);
  console.log((ok2 ? 'PASS ' : 'FAIL ') + 'SIF option pairs: ' + JSON.stringify(opts)); if (!ok2) fails++;
}
// ---- worksurface floor space: worksurfaces butt at the junctions, nothing overlaps (p225) ----
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!ok) fails++; };
  const L = () => { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 42, 66); const a2 = E.addPanel(P, P.nodes[a.b], 0, 30, 66); const b = E.addPanel(P, c, 270, 42, 54); const b2 = E.addPanel(P, P.nodes[b.b], 270, 30, 54); return { P, c, a, a2, b, b2 }; };
  { const { P, c, a, a2, b } = L(); const k = E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 42, D: 42, depthA: 24, depthB: 24 }); const g = E.wsGeometry(P, k); const endAlong = g.arms.map(x => Math.round(Math.hypot(x.end[0], x.end[1]) * 100) / 100);
    const run = E.runOf(P, a2.id); const side = E.sideNormal(P, a2, 0)[1] < 0 ? 0 : 1; E.newWorksurface(P, { kind: 'straight', panel: a2.id, side, off: 0, width: 30, depth: 24 });
    // corner geometry (p21, p30, p225, p563): the 42" junction is 42" + 1 1/2" corner allowance from the corner node; the 41 1/2" cord-drop arm back edge
    // starts 2" out (panel face + 1/2" cord drop), so it ends on that junction: 2" + 41 1/2" = 43 1/2", 2" off the centerline
    ck('42×42 corner arms end on the 42" junction, butted to the next worksurface', g.arms.every(x => Math.abs(Math.abs(x.base[0]) + Math.abs(x.base[1]) - 43.5) < 0.01 && Math.abs(Math.abs(x.end[0]) + Math.abs(x.end[1]) - 2 - 43.5) < 0.01), JSON.stringify(endAlong));
    ck('corner + straight on the next panel: no overlap', E.wsCollisions(P).length === 0, JSON.stringify(E.wsCollisions(P))); }
  { const { P, a, b } = L(); const sA = E.sideNormal(P, a, 0)[1] < 0 ? 0 : 1, sB = E.sideNormal(P, b, 0)[0] > 0 ? 0 : 1;
    // off -1.5: both start at the corner node, 1 1/2" short of the module line where a straight wrapped by the return fits (corner geometry, p21, p30)
    E.newWorksurface(P, { kind: 'straight', panel: a.id, side: sA, off: -1.5, width: 42, depth: 24 }); E.newWorksurface(P, { kind: 'straight', panel: b.id, side: sB, off: -1.5, width: 42, depth: 24 });
    const m = E.wsCollisions(P); ck('two straights in the inside of an L -> overlap and wrapped-panel errors', m.some(x => /overlaps/.test(x.msg)) && m.some(x => /runs into panel/.test(x.msg)), m.map(x => x.msg.slice(0, 50)).join(' | '));
    ck('collisions reach generate() errors', E.generate(P).errors.some(e => /overlaps|runs into panel/.test(e.msg))); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); E.newWorksurface(P, { kind: 'straight', panel: a.id, side: 0, off: 0, width: 48, depth: 24 }); E.newWorksurface(P, { kind: 'straight', panel: a.id, side: 0, off: 0, width: 48, depth: 24 });
    ck('duplicate worksurface on the same panel side -> overlap', E.wsCollisions(P).some(x => /overlaps/.test(x.msg))); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); E.newWorksurface(P, { kind: 'straight', panel: a.id, side: 0, off: 0, width: 48, depth: 24 }); E.newWorksurface(P, { kind: 'straight', panel: a.id, side: 1, off: 0, width: 48, depth: 24 });
    ck('worksurfaces back to back on both sides of a panel: no overlap', E.wsCollisions(P).length === 0); }
}
// ---- tie plates at butted worksurface seams (p237, p589) ----
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!ok) fails++; };
  const two = () => { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); const b = E.addPanel(P, P.nodes[a.b], 0, 48, 54); const A = E.newWorksurface(P, { kind: 'straight', panel: a.id, side: 0, off: 0, width: 48, depth: 24 }); const B = E.newWorksurface(P, { kind: 'straight', panel: b.id, side: 0, off: 0, width: 48, depth: 24 }); return { P, A, B }; };
  { const { P, A } = two(); const R = E.generate(P); const tp = R.lines.filter(l => l.pid === 'uw-tie-plates'); const ca = R.lines.find(l => l.pid === 'uw-cantilever');
    ck('two butted straights: one seam, tie plate from the cantilevers, no extra package', tp.length === 0 && /1 worksurface seam/.test(ca.notes.join(' ')) && A._tie.length === 1 && E.wsCollisions(P).length === 0, ca.notes.join(' | ').slice(0, 120)); }
  { const { P, A, B } = two(); for (const w of [A, B]) { E.addPedestal(P, w, { at: 'lo', type: 'fixed', config: 'A' }); E.addPedestal(P, w, { at: 'hi', type: 'fixed', config: 'A' }); } const R = E.generate(P); const tp = R.lines.filter(l => l.pid === 'uw-tie-plates');
    ck('seam over pedestals, no cantilevers: TS7TIEPLATE package ordered (p589)', tp.length === 1 && tp[0].style === 'TS7TIEPLATE' && tp[0].qty === 1, tp.map(l => l.qty + 'x' + l.style + ' ' + l.desc).join()); }
}
// ---- p42-p44 build-your-own options: the heights used by the planner's guide-example presets reproduce each option's printed trim list ----
{
  const fam = (lines) => { const f = {}; for (const l of lines) { const m = l.style.match(/(TICHT|TCTCHT|TCLCHT|TTVT|COHJC|LTA4|CJCA10|120VA4|T120CHT|TVCHT)$/) || (l.style === 'TS790JC' ? [0, 'JC'] : l.style === 'TS7120JC' ? [0, 'JC120'] : null); if (m) f[m[1]] = (f[m[1]] || 0) + l.qty; } return JSON.stringify(Object.keys(f).sort().map(k => [k, f[k]])); };
  const W = (o) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const cases = [
    ['p42 T Option 1', [[0, 66], [90, 42], [180, 54]], { TICHT: 1, TCTCHT: 1, TTVT: 1, COHJC: 1, CJCA10: 1 }],
    ['p42 T Option 2', [[0, 66], [90, 54], [180, 42]], { TICHT: 1, TCLCHT: 1, TTVT: 1, COHJC: 1, LTA4: 1, CJCA10: 1 }],
    ['p42 T Option 3', [[0, 54], [90, 66], [180, 42]], { TICHT: 1, TCLCHT: 1, TTVT: 1, COHJC: 1, LTA4: 1, CJCA10: 1 }],
    ['p42 Y Option 1', [[0, 66], [120, 54], [240, 42]], { T120CHT: 1, TVCHT: 1, JC120: 1, '120VA4': 1 }],
    ['p43 X Option 1', [[0, 54], [90, 66], [180, 42], [270, 66]], { TCTCHT: 2, JC: 1, CJCA10: 2 }],
    ['p43 X Option 2', [[0, 42], [90, 54], [180, 66], [270, 66]], { TCLCHT: 1, TCTCHT: 1, JC: 1, CJCA10: 2, LTA4: 1 }],
    ['p43 X Option 3', [[0, 42], [90, 54], [180, 54], [270, 66]], { TICHT: 1, TCTCHT: 1, COHJC: 1, CJCA10: 2 }],
    ['p43 X Option 4', [[0, 42], [90, 54], [180, 66], [270, 54]], { TICHT: 1, TCTCHT: 1, COHJC: 1, CJCA10: 2 }],
    ['p43 X Option 5', [[0, 42], [90, 42], [180, 54], [270, 66]], { TICHT: 1, TCLCHT: 1, COHJC: 1, CJCA10: 1 }],
    ['p43 X Option 6', [[0, 42], [90, 54], [180, 42], [270, 66]], { TICHT: 1, TCTCHT: 2, COHJC: 1, CJCA10: 1 }],
    ['p44 X Option 7', [[0, 30], [90, 42], [180, 54], [270, 66]], { TICHT: 1, TCLCHT: 1, TCTCHT: 1, COHJC: 1, CJCA10: 1, LTA4: 1 }],
    ['p44 X Option 8', [[0, 66], [90, 42], [180, 54], [270, 30]], { TICHT: 1, TCTCHT: 2, COHJC: 1, CJCA10: 1 }],
  ];
  for (const [name, legs, want] of cases) { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); for (const [a, h] of legs) E.addPanel(P, c, a, 36, h); const R = E.generate(P); const got = fam(R.lines.filter(l => l.src === c.id)); const ok = got === W(want) && !R.errors.length; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' trims as printed' + (ok ? '' : ' — got ' + got)); if (!ok) fails++; }
}
// ---- dealer spec review regressions (items 1-8) ----
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!ok) fails++; };
  const sty = (ls) => ls.map(l => (l.qty !== 1 ? l.qty + '×' : '') + l.style).join(' ');
  const cnt = (ls, st) => ls.filter(l => l.style === st).reduce((a, l) => a + l.qty, 0);
  // #1 exact splits: fewest pieces, then largest first; only an impossible span is flagged, nothing picked is dropped
  ck('#1 splitSpan 42 trims -> 30+12, 30 stack -> 18+12, 6 is the 6"H stacker (2022 p32), 3 impossible', JSON.stringify(E.splitSpan(42, E.COH_TRIM_HEIGHTS).parts) === '[30,12]' && JSON.stringify(E.stackSplit(30).parts) === '[18,12]' && JSON.stringify(E.stackSplit(6).parts) === '[6]' && E.stackSplit(3).flag && E.stackSplit(18).parts.length === 1 && !E.stackSplit(42).flag && JSON.stringify(E.stackSplit(42).parts) === '[24,18]');
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); E.addPanel(P, c, 0, 48, 48); E.setStack(P, E.addPanel(P, c, 90, 48, 66), [24]); const R = E.generate(P); const nl = nodeLines(P, R, c.id);
    ck('#1 thin L 48 | 66+24: 42" end-of-run CoH as 30+12 trims (p51, p383), no placeholder', cnt(nl, 'TS730TICHT') === 1 && cnt(nl, 'TS712TICHT') === 1 && !nl.some(l => l.style === '—') && !R.errors.length, sty(nl)); }
  { const P = E.newProject('oval'); const c = E.addNode(P, 0, 0); E.addPanel(P, c, 0, 48, 48); E.setStack(P, E.addPanel(P, c, 90, 48, 66), [24]); const R = E.generate(P); const nl = nodeLines(P, R, c.id);
    ck('#1 oval L 48 | 66+24: standard 30 + stacking 12 (2015 p81, p453-454)', cnt(nl, 'TS730CHS') === 1 && cnt(nl, 'TS712CHST') === 1 && !nl.some(l => l.style === '—'), sty(nl)); }
  { const P = E.newProject('thin'); const c = star(P, { 0: 48, 180: 78 }); const R = E.generate(P); const nl = nodeLines(P, R, c);
    ck('#1 BYO in-line 48/78: TS748TIPJ + 18" and 12" end-of-run stackers (p49 Step 6, p375)', cnt(nl, 'TS748TIPJ') === 1 && cnt(nl, 'TS718TEPJS') === 1 && cnt(nl, 'TS712TEPJS') === 1 && cnt(nl, 'TS730TICHT') === 1 && !R.errors.length, sty(nl)); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); E.setStack(P, E.addPanel(P, c, 0, 48, 42), [24]); E.addPanel(P, c, 90, 48, 54); const R = E.generate(P); const nl = nodeLines(P, R, c.id);
    ck('#1 thin L 42+24 beside 54: one 24" stacking junction (p49 Step 7, per stacked panel), not 12+12 cut at the neighbor top', cnt(nl, 'TS724TEPJS') === 1 && !cnt(nl, 'TS712TEPJS') && !nl.some(l => l.style === '—') && !R.errors.length, sty(nl)); }
  // #2 oval: one change-of-height trim per exposed face (p95)
  { const ov = (h, st) => { const P = E.newProject('oval'); const c = star(P, h); if (st) for (const [a, s] of Object.entries(st)) E.setStack(P, Object.values(P.panels).find(q => q.label === 'leg' + a), s); const R = E.generate(P); return nodeLines(P, R, c); };
    let nl = ov({ 0: 66, 90: 42, 270: 42 }); ck('#2 oval T 66 / 42 / 42: two faces -> 2 × TS724CHS', cnt(nl, 'TS724CHS') === 2, sty(nl));
    nl = ov({ 0: 66, 90: 42, 180: 42, 270: 42 }); ck('#2 oval X 66 / 42 / 42 / 42: three faces -> 3 × TS724CHS', cnt(nl, 'TS724CHS') === 3, sty(nl));
    nl = ov({ 0: 42, 90: 42, 270: 42 }, { 0: [24] }); ck('#2 oval T 42, spine stacked 24: T stacking junction + 2 × TS724CHS (fin faces)', cnt(nl, 'TS724TPJS') === 1 && cnt(nl, 'TS724CHS') === 2, sty(nl));
    nl = ov({ 0: 66, 180: 66, 90: 42 }); ck('#2 oval T spine 66 / leg 42: only the leg face (T face is the junction trim) -> 1 × TS724CHS', cnt(nl, 'TS724CHS') === 1, sty(nl)); }
  // #3 package parts: pieces at the junctions ($0, not ordered), one job line of packages
  { const P = E.newProject('thin'); const sp = []; let n = E.addNode(P, 0, 0); for (let i = 0; i < 3; i++) { const p = E.addPanel(P, n, 0, 48, 42); E.setStack(P, p, [24]); sp.push(p); n = P.nodes[p.b]; }
    for (const q of sp.slice(1)) { const a = P.nodes[q.a]; E.addPanel(P, a, 90, 48, 42); E.addPanel(P, a, 270, 48, 42); }
    const R = E.generate(P); const pieces = R.lines.filter(l => l.style === 'TS7CJCA10' && l.piece), pack = R.lines.filter(l => l.style === 'TS7CJCA10' && !l.piece);
    const agg = E.aggregate(R.lines).filter(a => a.style === 'TS7CJCA10'); const sif = E.toSIF(R.lines); const qt = (sif.text.match(/PN=TS7CJCA10\r\nMC=\w+\r\nCT=\w+\r\nPD=[^\r]*\r\nQT=(\d+)/) || [])[1];
    ck('#3 aligners: pieces per junction at $0, one TS7CJCA10 package ($102, 2022 2022 p388) ordered for the job', pieces.length >= 2 && pieces.every(l => l.ext === 0) && pack.length === 1 && pack[0].qty === 1 && pack[0].ext === 102 && pack[0].src === 'project', `${pieces.map(l => l.src + ':' + l.qty).join(',')} / ${pack.map(l => l.qty + '@' + l.unit).join()}`);
    ck('#3 pick list and SIF order the package once', agg.length === 1 && agg[0].qty === 1 && qt === '1', `agg ${agg.map(a => a.qty)} SIF QT ${qt}`);
    const seals = R.lines.filter(l => /ICLS$/.test(l.style)); const sp_ = seals.filter(l => l.piece).reduce((a, l) => a + l.qty, 0), pk = seals.filter(l => !l.piece);
    ck('#3 light seals: pieces summed, ceil(pieces / 4) packages', pk.length === 1 && pk[0].qty === Math.ceil(sp_ / 4), `${sp_} seals -> ${pk.map(l => l.qty)}`);
    ck('#3 totals count the package price only', R.totals.all === R.lines.reduce((a, l) => a + l.ext, 0) && R.lines.filter(l => l.piece).every(l => l.ext === 0)); }
  // #4 72"W+ single-pane window over a fabric or steel skin: two T521328SR clips (2015 p119, p510)
  { const win = (W, pane) => { const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, W, 66); p.sides = [0, 1].map(() => [{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 24, pane }]); return E.generate(P).lines.filter(l => l.style === 'T521328SR'); };
    const c72 = win(72), c48 = win(48), c72d = win(72, 'double');
    ck('#4 72"W window over fabric: 2 × T521328SR; none at 48"W or double-pane', c72.length === 1 && c72[0].qty === 2 && !c48.length && !c72d.length); }
  // #5 stacking horizontal frame package with an in-line change-of-height: shared, not one per junction (p357 tip, p50 Step 8)
  { const run = (hs, stacks) => { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const ps = hs.map(h => { const p = E.addPanel(P, n, 0, 48, h); n = P.nodes[p.b]; return p; }); (stacks || []).forEach((s, i) => s && E.setStack(P, ps[i], s)); return E.generate(P).lines.filter(l => l.style === 'TS748HFS').reduce((a, l) => a + l.qty, 0); };
    ck('#5 54 | 78+12 | 54 (TS759TCIJ both ends): 1 HFS (the tier one)', run([54, 78, 54], [null, [12], null]) === 1);
    ck('#5 42 | 66 | 42 (TS746TCIJ both ends): 1 HFS shared', run([42, 66, 42]) === 1);
    ck('#5 42 | 66 (one TS746TCIJ): 1 HFS', run([42, 66]) === 1); }
  // #6 technology skin must face the powerkit (2015 p117, p189)
  { const tech = (below) => { const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const p = E.addPanel(P, a, 0, 48, 48); p.sides[0] = [{ kind: 'skin', type: 'tackable acoustical', height: below }, { kind: 'skin', type: 'technology', height: 6, cutouts: 'All' }, { kind: 'skin', type: 'tackable acoustical', height: 36 - below }]; p.power = { kind: 'powerkit', location: 'worksurface', receptacles: [2, 0], usb: [0, 0], infeed: null }; const R = E.generate(P); return { w: R.warnings.some(x => /not in front of the powerkit/.test(x.msg)), fp: R.lines.filter(l => l.style === 'TS7UFPLATE').length }; };
    const off = tech(18), on = tech(24);
    ck('#6 technology skin at 22"-28" with a worksurface powerkit: warned; at 28"-34": no warning, no faceplates', off.w && !on.w && on.fp === 0); }
  // #7 impossible change-of-height -> errors
  { const P = E.newProject('thin'); star(P, { 0: 48, 180: 54 }); const R = E.generate(P);
    ck('#7 in-line 48/54 (6"): the 2022 guide has the junction (TS785TCIJ, 2022 p357): no error, no placeholder', !R.errors.length && R.lines.some(l => l.style === 'TS785TCIJ') && !R.lines.some(l => l.style === '—' && l.qty > 0), R.errors.map(e => e.msg).join(' | ').slice(0, 140) + ' ' + R.lines.map(l => l.style).join());
    const P2 = E.newProject('thin'); star(P2, { 0: 48, 90: 54, 180: 30 }); const R2 = E.generate(P2);
    ck('#7 T 48/54/30 BYO: the 6" change-of-height is trimmed with the 2022 6"H trim (2022 p383-384), no error', !R2.errors.some(e => /cannot be trimmed/.test(e.msg)) && R2.lines.some(l => /^TS76T(I|CL|CT)CHT$/.test(l.style)), R2.errors.map(e => e.msg).join(' | ').slice(0, 140) + ' ' + R2.lines.map(l => l.style).join()); }
  // #8 wall-start anchor named in the stability warning (p161)
  { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); n.wallStart = true; for (let i = 0; i < 4; i++) { const p = E.addPanel(P, n, 0, 48, 54); n = P.nodes[p.b]; } const R = E.generate(P);
    ck('#8 wall-started 16\' run: free end measured from the wall-start junction', R.warnings.some(w => /nearest anchor \(the wall-start junction/.test(w.msg)), R.warnings.map(w => w.msg).join(' | ').slice(0, 160)); }
}
// ---- outputs regressions: SIF code-less options, stable line keys, oval cap colors, worksurface edge, CAD per line, aggregate by source ----
{
  const say = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' — ' + info)); if (!ok) fails++; };
  const P = E.newProject('oval'); const c = E.addNode(P, 0, 0); for (const a of [90, 210, 330]) { const q = E.addPanel(P, c, a, 48, 48); q.power = { kind: 'powerkit', location: 'base', receptacles: [1, 1], usb: [0, 0], infeed: null }; }
  let R = E.generate(P); const sif = E.toSIF(R.lines, { mc: 'STEEL', ct: 'ANSWER' }).text;
  const pk = R.lines.find(l => /one powerkit/.test(l.spec));
  say('SIF: code-less options as AN/AD (powerkit on an oval panel package)', pk && /\r\nAN=OPTION\r\nAD=One powerkit, 4-circuit 3\+1 \(\+\$\d+\)\r\n/.test(sif) && !/[^\x00-\x7f]/.test(sif), sif.slice(0, 300));
  say('specNotes keeps only the parts without a finish number', JSON.stringify(E.specNotes('paint 7207 Black; paint group 2 (+$11); omit top cap; side 1 fabric 5F01 Buzz2 (group 1); vertical application')) === JSON.stringify(['Paint group 2 (+$11)', 'Omit top cap', 'Vertical application']), JSON.stringify(E.specNotes('paint 7207 Black; paint group 2 (+$11); omit top cap')));
  const Y = R.lines.find(l => l.src === c.id);
  say('p437: oval Y junction specifies the plastic cap color', /^plastic junction cap 6000 Black$/.test(Y.spec), Y.spec);
  const eor = R.lines.find(l => /End-of-run base junction/.test(l.desc));
  say('p433/p435: oval end-of-run specifies trim paint and cap color', /^paint 7207 Black; paint group 1; plastic junction cap 6000 Black$/.test(eor.spec), eor.spec);
  const k0 = R.lines.map(E.lineKey).join(); P.finishes.woodTrim = true; P.finishes.trimPaint = { code: '4728', name: 'Nickel Metallic', group: 2 }; P.finishes.fabric = { code: '5664', name: 'Mink', group: 2 };
  R = E.generate(P); const Yw = R.lines.find(l => l.src === c.id);
  say('line keys survive finish, wood-cap style and fabric changes', R.lines.map(E.lineKey).join() === k0 && new Set(R.lines.map(E.lineKey)).size === R.lines.length);
  say('p437: wood cap Y junction specifies the wood', Yw.style === 'TS748YPJW' && /^wood junction cap 3062 Graphite Walnut$/.test(Yw.spec), Yw.style + ' ' + Yw.spec);
  const ag = E.aggregate(R.lines, l => l.src === eor.src ? 'stock' : 'buy'); const eg = ag.filter(a => a.style === R.lines.find(l => l.src === eor.src && /End-of-run/.test(l.desc)).style);
  say('aggregate splits a style by source and keeps line keys', eg.length === 2 && eg.every(a => a.keys.length === a.qty), JSON.stringify(eg.map(a => [a.by, a.qty])));
  say('Canadian list per line adds up to the job total (2015 p1)', R.lines.reduce((a, l) => a + E.cadOf(l), 0) === R.totals.canadian && E.cadTotal(R.lines) === R.totals.canadian);
  const T = E.newProject('thin'); const n = E.addNode(T, 0, 0); const q = E.addPanel(T, n, 0, 48, 66); E.newWorksurface(T, { kind: 'straight', panel: q.id, side: 0, off: 0, width: 48, depth: 24 }); T.finishes.plasticColor = '6B03';
  const ws = E.generate(T).lines.find(l => l.cat === 'Worksurface');
  say('p734: worksurface edge is its own setting (6009 with 2730), not the receptacle color', /edge plastic 6009 Arctic White/.test(ws.spec) && E.edges().some(e => e.code === '6655') && E.ovalPlastics().some(o => o.code === '6694'), ws.spec);
}
// ---- plan geometry: panels may only meet at junctions (p20-21); stacking trims to what fits; trim switches keep settings ----
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!ok) fails++; };
  const run = (P, x, y, ang, ws) => { let n = E.nodeAt(P, x, y, 1) || E.addNode(P, x, y); const out = []; for (const w of ws) { const q = E.addPanel(P, n, ang, w, 54); out.push(q); n = P.nodes[q.b]; } return out; };
  const errs = (P) => E.generate(P).errors.map(e => e.msg);
  { const P = E.newProject('thin'); run(P, 0, 0, 0, [48, 48]); run(P, 72, 30, 270, [48]); const c = E.panelConflicts(P); ck('run crossing a panel with no junction -> error', c.length === 1 && c[0].kind === 'cross' && errs(P).some(m => /cross with no junction/.test(m)), c.map(x => x.kind).join()); }
  { const P = E.newProject('thin'); run(P, 0, 0, 0, [48, 48]); run(P, 24, 48, 270, [48]); const c = E.panelConflicts(P); ck('run ending mid-panel with no junction -> error', c.length === 1 && c[0].kind === 'tee' && /ends against the middle of Panel 3/.test(c[0].msg), c.map(x => x.msg).join()); }
  { const P = E.newProject('thin'); const [a, b] = run(P, 0, 0, 0, [48, 48]); E.newPanel(P, b.b, b.a, 48, 54); const c = E.panelConflicts(P); ck('duplicate panel between the same junctions -> overlap error', c.some(x => x.kind === 'overlap') && errs(P).some(m => /drawn on top of/.test(m))); }
  { const P = E.newProject('thin'); const [a] = run(P, 0, 0, 0, [48, 48]); E.addPanel(P, P.nodes[a.a], 0, 24, 54); const c = E.panelConflicts(P); ck('panel drawn back over its neighbour from a shared junction -> overlap error', c.some(x => x.kind === 'overlap')); }
  { const P = E.newProject('thin'); run(P, 0, 0, 0, [48]); run(P, 49.5, 0, 0, [48]); const c = E.panelConflicts(P); ck('end posts 1.5" apart -> collide', c.length === 1 && c[0].kind === 'close', c.map(x => x.kind).join()); }
  { const P = E.newProject('thin'); run(P, 0, 0, 0, [48, 48]); run(P, 0, 3, 0, [48, 48]); const c = E.panelConflicts(P); ck('parallel runs 3" apart (back to back) -> no conflict', c.length === 0, c.map(x => x.msg).join()); }
  // corner geometry: the X's 24" leg ends 24" + 1 1/2" corner allowance out (p21, p30, E.CORNER_ALLOW), so the return starts at 25.5
  { const P = E.newProject('thin'); const c0 = E.addNode(P, 0, 0); for (const a of [0, 90, 180, 270]) E.addPanel(P, c0, a, 24, 54); run(P, 25.5, 0, 90, [24]); const c = E.panelConflicts(P); ck('X junction plus a return off one end -> no conflict', c.length === 0, c.map(x => x.msg).join()); }
  { const P = E.newProject('thin'); const c0 = E.addNode(P, 0, 0); for (const a of [0, 120, 240]) E.addPanel(P, c0, a, 24, 54); ck('Y junction of 24" panels -> no conflict', E.panelConflicts(P).length === 0); }
  // setStack keeps the largest part of the stack that fits under 90" (p33)
  { const P = E.newProject('thin'); const p = run(P, 0, 0, 0, [48])[0]; E.setStack(P, p, [24, 12]); E.setHeight(P, p, 78); ck('54+24+12 raised to 78 keeps the 12" stacker', p.stack.join() === '12' && p.stackSides.length === 1, JSON.stringify(p.stack)); }
  { const P = E.newProject('thin'); const p = run(P, 0, 0, 0, [48])[0]; E.setStack(P, p, [12, 24]); p.stackSides[1][0][0].type = 'steel'; E.setHeight(P, p, 66); ck('54+12+24 raised to 66 keeps the 24" stacker and its tiles', p.stack.join() === '24' && p.stackSides[0][0][0].type === 'steel', JSON.stringify(p.stack)); }
  // switching trim keeps thin-only / oval-only settings aside and restores them
  { const P = E.newProject('thin'); const p = run(P, 0, 0, 0, [48])[0]; p.glassScreen = { attach: 'recessed', height: 12, frosted: true, omitGlass: false }; p.topCap.omit = true; P.trim = 'oval'; E.generate(P); const inOval = !p.glassScreen && !p.topCap.omit; P.trim = 'thin'; E.generate(P);
    ck('thin -> oval -> thin keeps frameless glass and omitted top cap', inOval && p.glassScreen && p.glassScreen.frosted && p.topCap.omit, JSON.stringify([p.glassScreen, p.topCap])); }
  { const P = E.newProject('oval'); const p = run(P, 0, 0, 0, [48])[0]; p.topScreen = true; P.trim = 'thin'; E.generate(P); const t = !p.topScreen; P.trim = 'oval'; E.generate(P); ck('oval -> thin -> oval keeps the translucent top screen', t && p.topScreen); }
  { const P = E.newProject('thin'); const p = run(P, 0, 0, 0, [48])[0]; p.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; p.sides[0] = [{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 12, pane: 'single' }]; p.sides[1] = JSON.parse(JSON.stringify(p.sides[0])); const R = E.generate(P);
    ck('window in the top position removes the glass screen with a notice (p65)', !p.glassScreen && R.notices.some(m => /cannot sit over a window/.test(m)), R.notices.join()); }
}
// ---- workstation QA round 2 (items 1-19): seams, wraps, fits, geometry, pedestals, pulls ----
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info && !ok ? ' — ' + info : '')); if (!ok) fails++; };
  const run = (widths, h) => { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const ps = []; for (const w of widths) { const q = E.addPanel(P, n, 0, w, h || 54); ps.push(q); n = P.nodes[q.b]; } return { P, ps }; };
  const sideToward = (P, p, v) => { const n = E.sideNormal(P, p, 0); return n[0] * v[0] + n[1] * v[1] > 0 ? 0 : 1; };
  const styles = (R, src) => R.lines.filter(l => !src || l.src === src).map(l => l.style);
  const errsOf = (R, id) => R.errors.filter(e => e.panel === id).map(e => e.msg);
  // U back wall: 96" between 36" returns. A 48" wrapped at the left leaves no room for a 48" on the right; a 42" butted 3" away is not a seam (p225, p236)
  const U = () => { const P = E.newProject('thin'); const a = E.addNode(P, 0, 0); const b1 = E.addPanel(P, a, 0, 48, 66); const b2 = E.addPanel(P, P.nodes[b1.b], 0, 48, 66); const l1 = E.addPanel(P, a, 270, 36, 54); const r1 = E.addPanel(P, P.nodes[b2.b], 270, 36, 54); return { P, b1, b2, l1, r1 }; };
  { const { P, b1, b2 } = U(); const s = sideToward(P, b1, [0, -1]); const A = E.newWorksurface(P, { panel: b1.id, side: s, off: 1.5, width: 48, depth: 24 }); const B = E.newWorksurface(P, { panel: b2.id, side: s, off: 4.5, width: 42, depth: 24 }); const R = E.generate(P);
    ck('#1 3" gap between worksurfaces is not a seam: no shared support, no tie plate', A._seams.length === 0 && B._seams.length === 0 && B._resolved.lo === 'cantilever' && A._tie.length === 0, JSON.stringify([A._seams, B._resolved]));
    ck('#1 the loose end 4.5" off the junction is an error', errsOf(R, B.id).some(m => /4.5" from the nearest panel junction/.test(m)), JSON.stringify(errsOf(R, B.id)));
    ck('#1 the wrapped 48" at the post face is on its junctions (≤1.6")', errsOf(R, A.id).length === 0 && Object.values(A._supportAt).every(x => !x.junction || x.d <= 1.6), JSON.stringify([errsOf(R, A.id), A._supportAt])); }
  { const { P, ps } = run([48, 48]); const A = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); const B = E.newWorksurface(P, { panel: ps[1].id, off: 1, width: 42, depth: 24 }); E.generate(P);
    ck('#1 ends 1" apart: no seam (butt means ≤0.6")', A._seams.length === 0 && B._resolved.lo === 'cantilever'); }
  // #3 two 15"W pedestals under a 24"W worksurface overlap
  { const { P, ps } = run([24]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 24, depth: 24 }); E.addPedestal(P, w, { at: 'lo' }); E.addPedestal(P, w, { at: 'hi' }); const R = E.generate(P);
    ck('#3 two pedestals under a 24"W worksurface -> overlap error', errsOf(R, w.id).some(m => /two pedestals under .* overlap/.test(m))); }
  { const { P, ps } = run([36]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 36, depth: 24 }); E.addPedestal(P, w, { at: 'lo' }); E.addPedestal(P, w, { at: 'hi', type: 'mobile' }); ck('#3 two pedestals under a 36"W worksurface fit', !E.generate(P).errors.some(e => /overlap/.test(e.msg))); }
  // #4 side support bracket only on a return panel that matches the worksurface depth (p236)
  // off 0: the panel's module starts 1 1/2" out from the L node (corner geometry, p21, p30), at the return panel's face; this was off 1.5 when modules started on the node
  const Lw = (ret) => { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 66); const r = E.addPanel(P, c, 270, ret, 54); const w = E.newWorksurface(P, { panel: a.id, side: sideToward(P, a, [0, -1]), off: 0, width: 48, depth: 24 }); return { P, w }; };
  { const { P, w } = Lw(36); const R = E.generate(P); ck('#4 24"D end wrapped by a 36"W return -> cantilever, no side support bracket', w._resolved.lo === 'cantilever' && !styles(R).includes('USSBR') && !R.errors.length, JSON.stringify([w._resolved, R.errors])); }
  { const { P, w } = Lw(24); const R = E.generate(P); ck('#4 24"D end wrapped by a 24"W return -> side support bracket', w._resolved.lo === 'ssb' && styles(R).includes('USSBR'), JSON.stringify(w._resolved)); }
  { const { P, w } = Lw(36); w.supports.lo = 'ssb'; const R = E.generate(P); ck('#4 forced side support bracket on a 36"W return -> kept, with a warning', w._resolved.lo === 'ssb' && R.warnings.some(x => x.panel === w.id && /matches the 24"D/.test(x.msg))); }
  // #6 extended corner: straight front on the long arm's extra length, cove only at the corner (p567)
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 60, 54); const b = E.addPanel(P, c, 90, 42, 54); const w = E.newWorksurface(P, { kind: 'extcorner', node: c.id, legs: [a.id, b.id], C: 60, D: 42, depthA: 24, depthB: 24 }); const g = E.wsGeometry(P, w);
    const arm = g.arms.find(x => x.len === 60); const onFront = (t) => { const q = [arm.end[0] - arm.dir[0] * t, arm.end[1] - arm.dir[1] * t]; const f = [q[0] + arm.n[0] * arm.depth, q[1] + arm.n[1] * arm.depth]; return g.poly.some(pt => Math.hypot(pt[0] - f[0], pt[1] - f[1]) < 0.01) || g.outline.some(pt => Math.hypot(pt[0] - f[0], pt[1] - f[1]) < 0.01); };
    const S = g.outline[g.curveAt]; const along = (S[0] - g.o[0]) * arm.dir[0] + (S[1] - g.o[1]) * arm.dir[1];
    // the short arm's actual back edge is 41 1/2" (catalog widthC, cord drop, p567), measured from the rear corner; it was 42" - 2" when arms ended on the nominal width
    ck('#6 extended corner 60×42: straight front on the long arm up to 41 1/2" from the rear corner, then the cove', g.outline.length === 6 && Math.abs(along - 41.5) < 0.01 && onFront(0), JSON.stringify([g.outline.length, along]));
    const dxf = E.toDXF(P, E.generate(P)); ck('#6 DXF draws the cove as one arc (one bulge) on the extended corner outline', (dxf.match(/\r\n42\r\n-?[\d.]+\r\n0\r\n(VERTEX|SEQEND)/g) || []).length === 1); }
  // #7 c:scape pulls are painted 4140/4144/4799 (p316)
  { const { P, ps } = run([48]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); E.addPedestal(P, w, { at: 'hi', front: 'P', pull: 'c:scape', pullColor: '9201' }); const R = E.generate(P); const l = R.lines.find(x => /^RPF/.test(x.style));
    ck('#7 c:scape pull color: paint 4140, not metal 9201', /pull paint 4140 Arctic White Gloss/.test(l.spec) && !/pull metal/.test(l.spec), l.spec);
    w.peds[0].pull = 'bar'; w.peds[0].pullColor = '9211'; const l2 = E.generate(P).lines.find(x => /^RPF/.test(x.style)); ck('#7 bar pull keeps its metal color', /pull metal 9211 Nickel/.test(l2.spec), l2.spec); }
  // #9 36"D (35 1/2") straights are freestanding only (p539 tip): a panel-mounted one is an error, and the planner does not offer the depth on panels
  { const { P, ps } = run([72]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 72, depth: 36 }); const R = E.generate(P);
    ck('#9 panel-mounted 72×36 -> still listed as US3672, error: freestanding only (p539)', styles(R, w.id).includes('US3672') && errsOf(R, w.id).some(m => /freestanding/.test(m.msg || m)), JSON.stringify([styles(R, w.id), R.errors])); }
  ck('#9 36"D is not offered on panels', !E.WS_DEPTHS.includes(36));
  // #10 center support panel at a free end (p237)
  { const { P, ps } = run([48]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24, supports: { lo: 'auto', hi: 'csp' } }); ck('#10 center support panel at a free end -> error', errsOf(E.generate(P), w.id).some(m => /cannot substitute for an end panel/.test(m))); }
  { const { P, ps } = run([48]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 30, supports: { lo: 'csp', hi: 'csp' } }); const R = E.generate(P); ck('#10 30"D on center support panels: floor-support warning does not claim seams', R.warnings.some(x => x.panel === w.id && /no floor support/.test(x.msg)) && !R.warnings.some(x => /both ends at seams/.test(x.msg))); }
  { const { P, ps } = run([48, 48]); const A = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24, supports: { lo: 'auto', hi: 'csp' } }); const B = E.newWorksurface(P, { panel: ps[1].id, width: 48, depth: 24, supports: { lo: 'csp', hi: 'auto' } }); const R = E.generate(P);
    ck('#10 center support panel set on both sides of a seam: one ordered, noted', styles(R).filter(x => x === 'UCSP').length === 1 && R.lines.some(l => l.notes.some(n => /one support per seam/.test(n)))); }
  // #11 P-edge is 3/8" deeper (p223)
  { const { P, ps } = run([48]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24, edge: 'P' }); ck('#11 P-edge 24"D plans 23 7/8" deep', Math.abs(E.wsGeometry(P, w).depth - 23.875) < 1e-9); }
  // #12 L of two straight worksurfaces (p225 tip, p223): the return butts the front edge; full depth for even gaps
  // off 0 (was 1.5): the modules of panels at the L node start 1 1/2" out from it, at the return panel's face (corner geometry, p21, p30)
  const LL = (con, edge) => { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a1 = E.addPanel(P, c, 0, 48, 66); E.addPanel(P, P.nodes[a1.b], 0, 48, 66); const r1 = E.addPanel(P, c, 270, 24, 54); const r2 = E.addPanel(P, P.nodes[r1.b], 270, 30, 54);
    const A = E.newWorksurface(P, { panel: a1.id, side: sideToward(P, a1, [0, -1]), off: 0, width: 48, depth: 24, construction: con, edge: edge || '3mm' }); const B = E.newWorksurface(P, { panel: r2.id, side: sideToward(P, r2, [1, 0]), off: 0, width: 30, depth: 24, construction: con }); return { P, A, B }; };
  { const { P, A, B } = LL('full-depth'); const R = E.generate(P); const ca = R.lines.find(l => l.pid === 'uw-cantilever' && l.src === B.id);
    ck('#12 full-depth L of two straights: no errors, the return is tied at the front edge, A wrapped by the 24"W return takes a side support bracket', !R.errors.length && A._lret && A._lret.includes(B.id) && B._tie.length === 1 && A._resolved.lo === 'ssb' && B._resolved.lo === 'cantilever' && !R.warnings.some(w => /uneven/.test(w.msg)), JSON.stringify([R.errors, A._resolved, B._resolved, R.warnings.map(w => w.msg)]));
    ck('#12 the L joint counts toward tie plates', R.lines.some(l => l.notes.some(n => /L\)/.test(n)))); }
  { const { P } = LL('cord-drop'); const R = E.generate(P); ck('#12 cord-drop L -> uneven-gap warning (p225 tip)', R.warnings.some(w => /uneven gaps/.test(w.msg)) && !R.errors.length, JSON.stringify(R.errors)); }
  { const { P } = LL('cord-drop', 'P'); const R = E.generate(P); ck('#11 P-edge in an L -> valley warning and interference (p225)', R.warnings.some(w => /valley/.test(w.msg)) && R.errors.some(e => /overlaps/.test(e.msg))); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); const a2 = E.addPanel(P, P.nodes[a.b], 0, 48, 54); const b = E.addPanel(P, c, 90, 48, 54); E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 48, D: 48, construction: 'full-depth' }); E.newWorksurface(P, { panel: a2.id, side: sideToward(P, a2, [0, 1]), width: 48, depth: 24 }); const R = E.generate(P);
    ck('#12 full-depth corner butted to a cord-drop straight -> uneven-gap warning', R.warnings.some(w => /one is full depth and the other has the 1\/2" cord drop/.test(w.msg)) && !R.errors.length, JSON.stringify(R.errors)); }
  // #13 a 30"D straight beside a corner arm still needs front-edge floor support (p223)
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); const a2 = E.addPanel(P, P.nodes[a.b], 0, 48, 54); const b = E.addPanel(P, c, 90, 48, 54); E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 48, D: 48, depthA: 30, depthB: 30 }); const w = E.newWorksurface(P, { panel: a2.id, side: sideToward(P, a2, [0, 1]), width: 48, depth: 30 }); const R = E.generate(P);
    ck('#13 30"D straight next to a corner arm -> end panel at its free end', styles(R, w.id).includes('UEP30'), JSON.stringify(w._resolved)); }
  // #14 a junction more than 54" from the end still takes a cantilever (p224)
  { const { P, ps } = run([72, 24]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 96, depth: 24 }); const R = E.generate(P); const ca = R.lines.find(l => l.src === w.id && l.pid === 'uw-cantilever');
    ck('#14 96" on 72+24: cantilever at the 72" junction, span 72", no ">72" error, one warning', ca.qty === 3 && !errsOf(R, w.id).length && R.warnings.filter(x => x.panel === w.id).length === 1, JSON.stringify([ca.qty, R.errors, R.warnings])); }
  // #15 a junction under a long extended-corner arm takes a cantilever before a channel (p224)
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 36, 54); E.addPanel(P, P.nodes[a.b], 0, 36, 54); const b = E.addPanel(P, c, 90, 48, 54); const w = E.newWorksurface(P, { kind: 'extcorner', node: c.id, legs: [a.id, b.id], C: 72, D: 48, depthA: 24, depthB: 24 }); const R = E.generate(P);
    ck('#15 72" arm over 36+36: cantilever at the 36" junction, no channel', !styles(R, w.id).includes('TS7WKSPT72') && R.lines.find(l => l.src === w.id && l.pid === 'uw-cantilever').qty === 3 && !R.errors.length, JSON.stringify([styles(R, w.id), R.errors])); }
  // #17 package contents follow the line
  { const { P, ps } = run([48]); const w = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); E.addPedestal(P, w, { at: 'hi', config: 'B' }); const R = E.generate(P); const ws = R.lines.find(l => l.src === w.id && l.cat === 'Worksurface'); const ped = R.lines.find(l => /^RPF/.test(l.style));
    ck('#17 laminate worksurface contents: no wood lines; FF flush pedestal: integral pulls, no pencil tray', !ws.contents.some(c => /Wood|Wire manager|if selected/.test(c.item)) && ws.contents.some(c => /3 mm edge/.test(c.item)) && !ped.contents.some(c => /pencil tray|Pulls: metal/.test(c.item)) && ped.contents.some(c => /Integral pulls/.test(c.item)), JSON.stringify([ws.contents, ped.contents])); }
  // #18 the 1/2" cord-drop gap is behind the worksurface (p224); fronts line up with full-depth worksurfaces
  { const { P, ps } = run([48, 48]); const a = E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); const b = E.newWorksurface(P, { panel: ps[1].id, width: 48, depth: 24, construction: 'full-depth' }); const ga = E.wsGeometry(P, a), gb = E.wsGeometry(P, b); const y = (pt) => Math.abs(pt[1]);
    E.addPedestal(P, a, { at: 'lo', front: 'P' }); E.addPedestal(P, b, { at: 'hi', front: 'F' }); const ra = E.pedRect(P, a, ga, a.peds[0]), rb = E.pedRect(P, b, gb, b.peds[0]);
    ck('#18 cord-drop back edge 1/2" off the panel face, front edges line up at 24" from the face', Math.abs(y(ga.lo) - 2) < 1e-9 && Math.abs(y(gb.lo) - 1.5) < 1e-9 && Math.abs(y(ga.front[0]) - 25.5) < 1e-9 && Math.abs(y(gb.front[0]) - 25.5) < 1e-9);
    ck('#18 pedestals: proud front flush with the worksurface front, 1/2" filler behind; flush front 1 3/8" filler behind', Math.abs(y(ra[2]) - 25.5) < 1e-9 && Math.abs(y(ra[0]) - 2) < 1e-9 && Math.abs(y(rb[0]) - (1.5 + 1.375)) < 1e-9, JSON.stringify([ra, rb])); }
  // #19 wording: one tie plate ships; corner ends are the left and right arm
  { const { P, ps } = run([48, 48]); E.newWorksurface(P, { panel: ps[0].id, width: 48, depth: 24 }); const b = E.newWorksurface(P, { panel: ps[1].id, width: 48, depth: 24 }); E.addPedestal(P, b, { at: 'hi' }); E.addPedestal(P, P.worksurfaces[Object.keys(P.worksurfaces)[0]], { at: 'lo' }); const R = E.generate(P);
    ck('#19 "the 1 tie plate that ships"', R.lines.some(l => l.notes.some(n => /the 1 tie plate that ships/.test(n))), JSON.stringify(R.lines.map(l => l.notes))); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); const b = E.addPanel(P, c, 90, 48, 54); const w = E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 48, D: 48 }); E.addPedestal(P, w, { at: 'arm0' }); const R = E.generate(P);
    ck('#19 corner pedestal named by arm: "left arm end"', R.lines.some(l => /— left arm end$/.test(l.desc))); }
}
// final QA round: workstations in a pod, power runs, collision wording, oval wood trim spec, side A/B wording
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info && !ok ? ' — ' + info : '')); if (!ok) fails++; };
  // a 4-pack of 6×8 L's: 66" spine of 4×48, 42" fins of 48+24 both sides at x = 0, 96, 192, a 48×48 corner in each station
  const pod = () => {
    const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const J = [n]; const spine = [];
    for (let i = 0; i < 4; i++) { const q = E.addPanel(P, n, 0, 48, 66); spine.push(q); n = P.nodes[q.b]; J.push(n); }
    const fins = {}; for (const i of [0, 2, 4]) for (const a of [90, 270]) { const f1 = E.addPanel(P, J[i], a, 48, 42); const f2 = E.addPanel(P, P.nodes[f1.b], a, 24, 42); fins[i + ':' + a] = [f1, f2]; }
    const cs = [E.newWorksurface(P, { kind: 'corner', node: J[0].id, legs: [spine[0].id, fins['0:90'][0].id], C: 48, D: 48 }), E.newWorksurface(P, { kind: 'corner', node: J[0].id, legs: [fins['0:270'][0].id, spine[0].id], C: 48, D: 48 }),
      E.newWorksurface(P, { kind: 'corner', node: J[2].id, legs: [spine[2].id, fins['2:90'][0].id], C: 48, D: 48 }), E.newWorksurface(P, { kind: 'corner', node: J[2].id, legs: [fins['2:270'][0].id, spine[2].id], C: 48, D: 48 })];
    return { P, spine, fins, cs, J };
  };
  { const { P, cs } = pod(); const R = E.generate(P);
    ck('final: 4-pack test geometry is clean (no collisions)', !E.wsCollisions(P).length && !R.errors.length, JSON.stringify([E.wsCollisions(P), R.errors]));
    ck('final: with no assignment the pod is one workstation (connected panels)', E.workstations(P).length === 1 && E.workstations(P)[0].name === 'Workstation 1');
    const names = E.splitStations(P, E.components(P)[0].key, 'Workstation 1');
    const W = E.workstations(P); ck('final: split pod -> 4 stations, one corner each', names && names.length === 4 && W.length === 4 && W.every(g => g.ws.length === 1), JSON.stringify(W.map(g => [g.name, g.panels.map(p => p.id), g.ws])));
    const R2 = E.generate(P); const all = R2.lines.reduce((a, l) => a + l.qty, 0); const byW = W.reduce((a, g) => a + R2.lines.filter(l => E.workstationOf(P, l.src, W) === g).reduce((b, l) => b + l.qty, 0), 0); const jw = R2.lines.filter(l => !E.workstationOf(P, l.src, W)).reduce((a, l) => a + l.qty, 0);
    ck('final: every piece lands in exactly one station or job-wide (junctions owned once)', byW + jw === all && W.flatMap(g => g.nodes).length === new Set(W.flatMap(g => g.nodes)).size && W.flatMap(g => g.nodes).length === Object.keys(P.nodes).length, `${byW}+${jw} vs ${all}`);
    ck('final: a shared spine panel carries both stations\' corners; the far corner is assigned by its own station', cs.every(w => W.some(g => g.ws.includes(w.id))) && new Set(cs.map(w => W.find(g => g.ws.includes(w.id)).name)).size === 4);
    ck('final: split names stay unique', new Set(W.map(g => g.name)).size === 4); }
  { const { P, spine } = pod(); spine[0].station = 'Front'; spine[1].station = 'Front'; const W = E.workstations(P);
    ck('final: panels named "Front" become their own workstation, their worksurfaces follow them', W.length === 2 && W.find(g => g.name === 'Front').panels.length === 2 && W.find(g => g.name === 'Front').ws.every(id => ['P3', 'P5'].includes(E.hostPanelOf(P, id))) && W.find(g => g.name === 'Front').ws.length === 1 && W.find(g => g.name !== 'Front').ws.length === 3, JSON.stringify(W.map(g => [g.name, g.panels.length, g.ws]))); }
  { const { P } = pod(); P.areas = { [E.components(P)[0].key]: 'Pod A' }; ck('final: a renamed connected workstation keeps its name', E.workstations(P)[0].name === 'Pod A'); }
  // collisions: another run on a worksurface vs a corner that does not fit its own run
  { const { P, cs } = pod(); const a = E.addNode(P, 10, 30); E.addPanel(P, a, 0, 24, 42); const m = E.wsCollisions(P);
    ck('final: a panel of another run on a corner worksurface is named as such', m.some(x => /of another run stands on Corner worksurface/.test(x.msg)) && !m.some(x => /use a corner worksurface/.test(x.msg)), JSON.stringify(m)); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 36, 54); const b = E.addPanel(P, c, 90, 36, 54); E.addPanel(P, P.nodes[a.b], 90, 24, 54); const w = E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 48, D: 48 }); const m = E.wsCollisions(P);
    ck('final: a corner too big for its own run says pick a smaller size', m.some(x => /runs into panel .*Pick a smaller size/.test(x.msg)), JSON.stringify(m)); }
  // power: per circuit run
  const prun = (kinds, infeeds) => { const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const ps = []; kinds.forEach((k, i) => { const q = E.addPanel(P, n, 0, 48, 54); n = P.nodes[q.b]; q.power = { kind: k, location: 'base', receptacles: k === 'powerkit' ? [1, 1] : [0, 0], usb: [0, 0], infeed: infeeds.includes(i) ? { length: 6 } : null }; ps.push(q); }); return { P, ps, R: E.generate(P) }; };
  { const { R } = prun(['powerkit', 'powerkit'], []); ck('final: powered run with receptacles and no power-in -> warning', R.warnings.some(w => /4 receptacles and no power-in/.test(w.msg)), JSON.stringify(R.warnings)); }
  { const { R } = prun(['powerkit', 'passthrough', 'powerkit'], [0]); ck('final: one infeed feeds the run through a pass-through -> no power warning', !R.warnings.some(w => /power-in/.test(w.msg)), JSON.stringify(R.warnings)); }
  { const { R } = prun(['powerkit', 'powerkit', 'powerkit'], [0, 2]); ck('final: two infeeds on one connected run -> warning', R.warnings.some(w => /2 power-ins on one connected circuit run/.test(w.msg)), JSON.stringify(R.warnings)); }
  { const { R } = prun(['powerkit', 'none', 'powerkit'], [0, 2]); ck('final: two runs split by an unpowered panel, one infeed each -> no warning', !R.warnings.some(w => /power-in/.test(w.msg)) && E.powerRuns(prun(['powerkit', 'none', 'powerkit'], []).P).length === 2, JSON.stringify(R.warnings)); }
  // oval wood trim: the trim is wood, so no trim paint on those lines (p435)
  { const P = E.newProject('oval'); P.finishes.woodTrim = true; P.finishes.ovalWoodTrim = true; const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 66); E.addPanel(P, P.nodes[a.b], 90, 48, 54); const R = E.generate(P);
    const eor = R.lines.filter(l => /EPJW|LPJW/.test(l.style)); const cht = R.lines.filter(l => /CHSW/.test(l.style));
    ck('final: oval wood-trim junctions and change-of-height trims list wood, not trim paint', eor.length && eor.every(l => /wood trim/.test(l.spec) && !/paint 7207/.test(l.spec)) && cht.every(l => !/paint 7207/.test(l.spec)), JSON.stringify(R.lines.filter(l => l.cat === 'Junction' || l.cat === 'Trim').map(l => l.style + ' | ' + l.spec))); }
  // window on one side only -> the warning names side A/B
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const p = E.addPanel(P, c, 0, 48, 54); p.sides[0] = [{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 12, pane: 'single' }]; const R = E.generate(P);
    ck('final: one-sided window warning says side A / side B', R.warnings.some(w => /side A: 12"H window .* no matching window on side B/.test(w.msg)) && !R.warnings.some(w => /side [12]\b/.test(w.msg)), JSON.stringify(R.warnings.map(w => w.msg))); }
}
// ---- physical dimensions used by the drawings (dimension audit, Feb 2015 guide) ----
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info && !ok ? ' — ' + info : '')); if (!ok) fails++; };
  const eq = (a, b) => Math.abs(a - b) < 1e-6;
  const r = E.junctionReach('thin', 'EOR'); ck('dims: thin end-of-run post 3/4" inside the module, trim node..+1/2" (p20, p45)', eq(r.post[0], -0.75) && eq(r.post[1], 0) && eq(r.trim[0], 0) && eq(r.trim[1], 0.5));
  ck('dims: oval end-of-run trim +1" (p92)', eq(E.junctionReach('oval', 'EOR').trim[1], 1));
  // corner geometry (p21, p30): the 3" corner block reaches 1 1/2" beyond the node and the corner face is 1 1/2" block + 3/4" post = 2 1/4" toward the panel
  ck('dims: in-line junction 1 1/2" centered (p30), corner block 3" (p20) and corner face 2 1/4" (p21, p30)', eq(E.junctionReach('thin', 'inline').post[1] - E.junctionReach('thin', 'inline').post[0], 1.5) && eq(E.junctionReach('thin', 'L').out, 1.5) && eq(E.junctionReach('thin', 'L').in, 2.25) && eq(E.junctionReach('thin', 'L').ca, 1.5));
  ck('dims: thin wall-start face 3/16" beyond the node (p21)', eq(E.junctionReach('thin', 'wall').out, 0.1875) && eq(E.junctionReach('thin', 'wall').post[1], 0.1875));
  ck('dims: actual heights 54 -> 54 1/4" thin, 54 1/8" oval, 30 -> 29 1/2" (p16, p90)', eq(E.actualBaseHeight('thin', 54), 54.25) && eq(E.actualBaseHeight('oval', 54), 54.125) && eq(E.actualBaseHeight('thin', 30), 29.5));
  ck('dims: thin cap 5/8" = panel 54 1/4" - end-of-run trim 53 5/8" (p16, p37)', eq(E.actualBaseHeight('thin', 54) - E.CAP_FACE.thin, 53.625) && eq(E.actualBaseHeight('thin', 42) - E.CAP_FACE.thin, 41.25));
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const p = E.addPanel(P, c, 0, 54, 54); E.setStack(P, p, [12]); ck('dims: 54 + 12 stacker drawn 54 1/4 + 12 3/8 (p16, p32)', eq(E.actualTop('thin', p), 66.625), E.actualTop('thin', p)); }
  ck('dims: recessed glass by kit 6/12/18/24 = 9 5/16 / 15 1/2 / 21 11/16 / 27 7/8, clip 11 3/4 (2022 p64, p79)', eq(E.glassHeight({ attach: 'recessed', height: 6 }), 9.3125) && eq(E.glassHeight({ attach: 'recessed', height: 12 }), 15.5) && eq(E.glassHeight({ attach: 'recessed', height: 18 }), 21.6875) && eq(E.glassHeight({ attach: 'recessed', height: 24 }), 27.875) && eq(E.glassHeight({ attach: 'clip', height: 12 }), 11.75));
  // 2022 additions: the 36"H thin-trim panel (p22, post 34 5/8" p25), the 6"H stacker (p39, p41 rules), the 6"H change-of-height trim (p30)
  ck('2022: 36"H panel is a thin-trim height at 35 11/16" with a 34 5/8" post; not offered on square or oval trim', E.heightsFor('thin').includes(36) && !E.heightsFor('oval').includes(36) && !E.heightsFor('square').includes(36) && eq(E.actualBaseHeight('thin', 36), 35.6875) && E.ACTUAL.junctionHeight[36] === '34 5/8"');
  ck('2022: 6"H stacker is 6 3/16" and offered alone only; 6"H change-of-height trim exists', eq(E.STACK_ACTUAL[6], 6.1875) && E.stackOptions(42).some(st => st.length === 1 && st[0] === 6) && !E.stackOptions(42).some(st => st.length === 2 && st.includes(6)) && E.COH_TRIM_HEIGHTS_THIN.includes(6) && !E.COH_TRIM_HEIGHTS.includes(6));
  { const T = E.newProject('thin'); const n = E.addNode(T, 0, 0); const q = E.addPanel(T, n, 0, 36, 36); const R = E.generate(T);
    const j = R.lines.filter(l => /^TS736T[A-Z]*J$/.test(l.style) || /^TS736TE/.test(l.style)); ck('2022: a 36"W x 36"H thin panel specifies with 36"H end-of-run junctions (TS736TEPJ, p364) and no errors', !R.errors.length && R.lines.some(l => l.style === 'TS736TEPJ'), JSON.stringify([R.errors, R.lines.map(l => l.style)]));
    const q2 = E.addPanel(T, T.nodes[q.b], 0, 36, 42); E.setStack(T, q2, [6]); const R2 = E.generate(T); ck('2022: a 6"H stacker on a 42" panel specifies a 6"H stacking end-of-run junction (TS76TEPJS, p388) with no stacking frame package (p41) and a 6"H change-of-height trim at the in-line change of height', R2.lines.some(l => l.style === 'TS76TEPJS') && !R2.lines.some(l => /HFS$/.test(l.style) && l.qty && /6"/.test(l.desc || '') && false), JSON.stringify(R2.lines.map(l => l.style + 'x' + l.qty)));
    q2.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; const R3 = E.generate(T); ck('2022: frameless glass on a 6"H stacker is refused (p41)', R3.errors.some(e => /6"H stacking junction/.test(e.msg)), JSON.stringify(R3.errors)); q2.glassScreen = null;
    const T2 = E.newProject('oval'); const m = E.addNode(T2, 0, 0); E.addPanel(T2, m, 0, 36, 36); ck('2022: 36"H on oval trim is refused', E.generate(T2).errors.some(e => /36"H is a thin-trim height/.test(e.msg))); }
  // 2022 additions: Universal and Sarto screens with the thin trim top cap (p402-403, rules p70-73) and back painted glass skins (p500-502)
  { const T = E.newProject('thin'); const n = E.addNode(T, 0, 0); const q = E.addPanel(T, n, 0, 48, 42); q.topCapScreen = { kind: 'universal', height: 13.5 }; const R = E.generate(T);
    const sc = R.lines.find(l => l.style === 'TS71348TUSC'); const fr = R.lines.find(l => /omit top cap/.test(l.spec));
    ck('2022: a 48"W 42"H thin panel with a 13 1/2" Universal screen specifies TS71348TUSC at $777 and omits the frame package top cap (p402, p70)', !R.errors.length && sc && sc.unit === 777 && fr && /omit top cap/.test(fr.spec), JSON.stringify([R.errors, sc && sc.unit, fr && fr.spec]));
    q.topCapScreen = { kind: 'sarto', height: 19.5 }; const R2 = E.generate(T); const s2 = R2.lines.find(l => l.style === 'TS71948TSSC');
    ck('2022: the 19 1/2" Sarto screen on the same panel is TS71948TSSC at $712 (p403), drawn 18 1/2" of screen (p72)', s2 && s2.unit === 712 && E.topCapScreenHeight(q.topCapScreen) === 18.5, JSON.stringify(s2 && s2.unit));
    q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; E.generate(T); ck('2022: a top cap screen and a frameless glass screen do not share a panel: the glass is removed', !q.glassScreen && !!q.topCapScreen);
    E.setStack(T, q, [6]); E.generate(T); ck('2022: a top cap screen is removed from a panel segment with a 6" stacker (p71)', !q.topCapScreen);
    E.setStack(T, q, []); q.sides[0][0] = { kind: 'skin', type: 'back painted glass', height: 36, magneticBacker: true }; q.sides[1][0] = { kind: 'skin', type: 'back painted glass', height: 36 }; const R3 = E.generate(T); const g = R3.lines.filter(l => l.style === 'TS73648GS');
    ck('2022: 36"H back painted glass skins on a 48"W panel are TS73648GS at $2325 base, +$980 with the magnetic backer (p501)', g.length === 2 && g.some(l => l.unit === 2325) && g.some(l => l.unit === 2325 + 980), JSON.stringify(g.map(l => [l.unit, l.spec]))); }
  ck('dims: glass 47 7/8 recessed, 47 3/4 clip, 47 7/16 / 47 1/4 with a change-of-height end on a 48 (p64, p68)', eq(48 - 2 * E.GLASS.recessed.end, 47.875) && eq(48 - 2 * E.GLASS.clip.end, 47.75) && eq(48 - E.GLASS.recessed.end - E.GLASS.recessed.cohEnd, 47.4375) && eq(48 - E.GLASS.clip.end - E.GLASS.clip.cohEnd, 47.25));
  ck('dims: oval top screen 45 1/2" on a 48 (p111)', eq(48 - 2 * E.TOP_SCREEN.inset, 45.5) && eq(E.TOP_SCREEN.height, 12));
  { const P = E.newProject('oval'); ck('dims: oval change-of-height trim 1 1/8" slim, 2 1/4" cable routing (p95)', eq(E.cohTrimWidth(P), 1.125) && (P.options.ovalCohProfile = 'Cable-Routing Capability', eq(E.cohTrimWidth(P), 2.25))); }
  ck('dims: open base 3 1/4" with 2 1/2" opening (p59), worksurface 1 3/16" thick (p222)', eq(E.OPEN_BASE.height, 3.25) && eq(E.OPEN_BASE.opening, 2.5) && eq(E.WS_THICK, 1.1875));
  // DXF: panel body between the posts, end-of-run post and trim, in-line post 1 1/2" along the run
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); E.addPanel(P, P.nodes[a.b], 0, 48, 54); const R = E.generate(P); const d = E.toDXF(P, R).split('\r\n');
    const polys = []; let cur = null; for (let i = 0; i < d.length; i += 2) { const k = d[i], v = d[i + 1]; if (k === '0' && v === 'POLYLINE') cur = { layer: null, pts: [] }; else if (cur && k === '8' && cur.layer === null) cur.layer = v; else if (cur && k === '10') cur.pts.push([+v]); else if (cur && k === '20') cur.pts[cur.pts.length - 1].push(+v); else if (k === '0' && v === 'SEQEND') { polys.push(cur); cur = null; } }
    const xs = (q) => { const x = q.pts.map(p => p[0]); return [Math.min(...x), Math.max(...x)]; };
    const pan = polys.filter(q => /A-PANEL/.test(q.layer)).map(xs), jun = polys.filter(q => q.layer === 'A-JUNCTION').map(xs);
    ck('dxf: panel bodies 0.75..47.25 and 48.75..95.25', JSON.stringify(pan) === JSON.stringify([[0.75, 47.25], [48.75, 95.25]]), JSON.stringify(pan));
    ck('dxf: end-of-run posts and trims, in-line post 1 1/2"', ['[0,0.75]', '[-0.5,0]', '[47.25,48.75]', '[95.25,96]', '[96,96.5]'].every(t => jun.some(j => JSON.stringify(j) === t)), JSON.stringify(jun)); }
  // worksurface run limit at a wall start is the wall face (p21)
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); c.wallStart = true; const a = E.addPanel(P, c, 0, 48, 54); const w = E.newWorksurface(P, { panel: a.id, off: -1.5, width: 48, depth: 24 }); const R = E.generate(P);
    ck('dims: worksurface cannot run into the wall at a wall start', R.errors.some(e => e.panel === w.id && /runs past/.test(e.msg))); }
  // the technology-skin power check starts skins on the 3 3/4" base trim (p58)
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const p = E.addPanel(P, c, 0, 48, 54); p.power = { kind: 'powerkit', location: 'worksurface', receptacles: [2, 2], usb: [0, 0], infeed: null }; p.sides[0] = [{ kind: 'skin', type: 'technology', height: 6 }, { kind: 'skin', type: 'tackable acoustical', height: 42 }]; const R = E.generate(P);
    ck('dims: technology skin reported from 3 3/4" (on the base trim), not 4"', R.warnings.some(w => /3 3\/4"–9 3\/4" above the floor/.test(w.msg)), JSON.stringify(R.warnings.map(w => w.msg))); }
}
// ---------- corner junction geometry (p21 block-and-post, p30 46 1/2" frame, p224 1/2" cord drop, p225 butted worksurfaces, p563/p568 corner sizes) ----------
// A corner node stays on the centerline intersection; each panel's module starts E.CORNER_ALLOW out from it (1 1/2" at L, T, X; 2/sqrt(3) - 1/2" at V, Y).
{
  const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' — ' + info : '')); if (!ok) fails++; };
  const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-6);
  const d = (P, a, b) => Math.hypot(P.nodes[b].x - P.nodes[a].x, P.nodes[b].y - P.nodes[a].y);
  const sideToward = (P, p, v) => { const n = E.sideNormal(P, p, 0); return n[0] * v[0] + n[1] * v[1] > 0 ? 0 : 1; };
  const CA120 = 2 / Math.sqrt(3) - 0.5;
  ck('corner allowance: 1 1/2" at L, T, X; 2/sqrt(3) - 1/2" (0.6547") at V, Y; 0 at in-line, end of run, wall start', near(E.cornerAllow('L'), 1.5) && near(E.cornerAllow('T'), 1.5) && near(E.cornerAllow('X'), 1.5) && near(E.cornerAllow('V'), CA120) && near(E.cornerAllow('Y'), CA120) && near(CA120, 0.6547, 1e-4) && ['inline', 'EOR', 'wall'].every(t => E.cornerAllow(t) === 0));
  // L of two 48s, each continued by a 48 in line
  const L = (con) => { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 48, 54); const a2 = E.addPanel(P, P.nodes[a.b], 0, 48, 54); const b = E.addPanel(P, c, 90, 48, 54); const b2 = E.addPanel(P, P.nodes[b.b], 90, 48, 54); return { P, c, a, a2, b, b2 }; };
  { const { P, c, a, a2, b, b2 } = L();
    ck('L of 48s: node spacing 49 1/2" on each leg (48" + 1 1/2" corner allowance), 48" beyond the in-line junctions', near(d(P, c.id, a.b), 49.5) && near(d(P, c.id, b.b), 49.5) && near(d(P, a2.a, a2.b), 48) && near(d(P, b2.a, b2.b), 48), JSON.stringify(P.nodes));
    const fr = d(P, c.id, a.b) - E.junctionReach('thin', 'L').in - E.junctionReach('thin', 'inline').in;
    ck('L of 48s: frame 46 1/2" between the corner face (2 1/4") and the in-line junction face (p30)', near(E.junctionReach('thin', 'L').in, 2.25) && near(fr, 46.5), fr);
    const run = E.runOf(P, a.id); ck('runOf: a run from a corner starts its first module 1 1/2" out, length node to node', near(run.panels[0].from, 1.5) && near(run.panels[0].to, 49.5) && near(run.panels[1].to, 97.5) && near(run.length, 97.5) && near(run.ca.lo, 1.5) && run.ca.hi === 0, JSON.stringify(run.panels.map(r => [r.from, r.to])));
    const m = E.wsCollisions(P); ck('L of 48s: panel bodies clear of each other', !m.length && !E.panelConflicts(P).length); }
  for (const con of ['cord-drop', 'full-depth']) {
    const { P, c, a, a2, b } = L(con); const k = E.newWorksurface(P, { kind: 'corner', node: c.id, legs: [a.id, b.id], C: 48, D: 48, depthA: 24, depthB: 24, construction: con });
    const s = E.newWorksurface(P, { kind: 'straight', panel: a2.id, side: sideToward(P, a2, [0, 1]), off: 0, width: 48, depth: 24, construction: con });
    const g = E.wsGeometry(P, k), gs = E.wsGeometry(P, s), arm = g.arms.find(x => x.panel.id === a.id), jn = P.nodes[a.b];
    ck(`48 corner (${con}): back edge ${con === 'full-depth' ? '48"' : '47 1/2"'} from the rear corner, arm end on the next junction center (49 1/2")`, near(Math.hypot(arm.end[0] - g.o[0], arm.end[1] - g.o[1]), con === 'full-depth' ? 48 : 47.5) && near(arm.base[0], jn.x) && near(arm.base[1], jn.y) && near(arm.reach, 49.5), JSON.stringify([arm.base, jn, arm.reach]));
    ck(`48 corner (${con}) butts the 48 straight on the next panel: no gap, no overlap`, near(arm.end[0], gs.lo[0]) && near(arm.end[1], gs.lo[1]) && !E.wsCollisions(P).length, JSON.stringify([arm.end, gs.lo, E.wsCollisions(P)]));
    const R = E.generate(P); ck(`48 corner (${con}) + straight: one butted seam, supports on junctions, no errors`, !R.errors.length && k._seams.length === 1 && k._seams[0].gap < 0.01 && Object.values(k._supportAt).every(x => !x.junction || x.d < 0.01), JSON.stringify([R.errors, k._seams, k._supportAt]));
  }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const legs = [0, 90, 180].map(a => E.addPanel(P, c, a, 48, 54));
    ck('T of 48s: every leg 49 1/2" node to node', legs.every(p => near(E.panelSpan(P, p), 49.5) && near(d(P, p.a, p.b), 49.5)));
    E.addPanel(P, c, 270, 48, 54); ck('X of 48s: every leg 49 1/2" node to node', Object.values(P.panels).every(p => near(d(P, p.a, p.b), 49.5)) && E.junction(P, c).type === 'X'); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const first = [], second = []; for (const a of [90, 210, 330]) { const q = E.addPanel(P, c, a, 48, 48); first.push(q); second.push(E.addPanel(P, P.nodes[q.b], a, 48, 48)); }
    ck('Y of 48s: legs 48" + 0.6547" node to node, 48" beyond', first.every(p => near(d(P, p.a, p.b), 48 + CA120)) && second.every(p => near(d(P, p.a, p.b), 48)), JSON.stringify(first.map(p => d(P, p.a, p.b))));
    const k = E.newWorksurface(P, { kind: 'corner120', node: c.id, legs: [first[0].id, first[1].id], C: 48, D: 48, depthA: 24, depthB: 24 }); const g = E.wsGeometry(P, k);
    const q = second[0]; const run = E.runOf(P, q.id); const side = sideToward(P, q, g.arms.find(x => x.panel.id === first[0].id).n);
    const s = E.newWorksurface(P, { kind: 'straight', panel: q.id, side, off: 0, width: 48, depth: 24 }); const gs = E.wsGeometry(P, s); const arm = g.arms.find(x => x.panel.id === first[0].id);
    ck('Y: 120° corner 48 (back edge 47 1/2", p568) ends on the next junction center and butts the straight', g.arms.every(x => { const jn = P.nodes[x.panel.a === c.id ? x.panel.b : x.panel.a]; return near(x.base[0], jn.x) && near(x.base[1], jn.y); }) && near(Math.hypot(arm.end[0] - gs.lo[0], arm.end[1] - gs.lo[1]), 0) && !E.wsCollisions(P).length, JSON.stringify([arm.end, gs.lo, E.wsCollisions(P)]));
    const R = E.generate(P); ck('Y: corner + straight, no errors, butted seam', !R.errors.length && k._seams.length === 1, JSON.stringify(R.errors)); }
  { const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 72, 54); const b = E.addPanel(P, c, 90, 72, 54); const R = E.generate(P);
    { const d2 = E.toDXF(P, R).split('\r\n'); const polys = []; let cur = null; for (let i = 0; i < d2.length; i += 2) { const k = d2[i], v = d2[i + 1]; if (k === '0' && v === 'POLYLINE') cur = { layer: null, pts: [] }; else if (cur && k === '8' && cur.layer === null) cur.layer = v; else if (cur && k === '10') cur.pts.push([+v, 0]); else if (cur && k === '20') cur.pts[cur.pts.length - 1][1] = +v; else if (k === '0' && v === 'SEQEND' && cur) { polys.push(cur); cur = null; } }
      const pa = polys.find(q => /A-PANEL/.test(q.layer) && q.pts.every(p => Math.abs(p[1]) <= 1.5 + 1e-6)); const xs = pa ? pa.pts.map(p => p[0]) : [];
      ck('dxf: an L leg\'s panel body runs from the corner face (2 1/4") to its end-of-run post (72" + 1 1/2" - 3/4")', pa && near(Math.min(...xs), 2.25) && near(Math.max(...xs), 72.75), JSON.stringify(pa));
      ck('dxf: the corner junction is its 3" block plus a 3/4" post on each leg', polys.filter(q => q.layer === 'A-JUNCTION').some(q => { const x = q.pts.map(p => p[0]); return near(Math.min(...x), 1.5) && near(Math.max(...x), 2.25); })); }
    ck('footprint of an L 6×6: each 72" leg takes 1 1/2" block + 1 1/2" corner allowance + 72" + 1/2" end trim = 75 1/2"', R.footprint.length === 2 && R.footprint.every(f => f.nominal === 72 && near(f.actual, 75.5)), JSON.stringify(R.footprint)); }
  { const P = E.newProject('thin'); const n0 = E.addNode(P, 0, 0); const p1 = E.addPanel(P, n0, 0, 48, 54); const p2 = E.addPanel(P, P.nodes[p1.b], 0, 48, 54); const end = p2.b;
    ck('straight run of two 48s: 96" end to end', near(d(P, n0.id, end), 96));
    const leg = E.addPanel(P, P.nodes[end], 90, 48, 54);
    ck('end of run turned into an L: the far junctions are 1 1/2" further from the corner, the new leg 49 1/2"', near(d(P, n0.id, end), 97.5) && near(d(P, p1.b, end), 49.5) && near(d(P, leg.a, leg.b), 49.5) && E.junction(P, P.nodes[end]).type === 'L', JSON.stringify(P.nodes));
    E.removePanel(P, leg.id); ck('leg removed: back to an end of run, 96" end to end', near(d(P, n0.id, end), 96) && near(d(P, p1.b, end), 48) && E.junction(P, P.nodes[end]).type === 'EOR', JSON.stringify(P.nodes)); }
  { // a job saved before corner allowances: nodes spaced at nominal widths
    const P = E.newProject('thin'); P.nodes = { N1: { id: 'N1', x: 0, y: 0, wallStart: false }, N2: { id: 'N2', x: 48, y: 0, wallStart: false }, N3: { id: 'N3', x: 96, y: 0, wallStart: false }, N4: { id: 'N4', x: 0, y: 48, wallStart: false } };
    for (const [a, b] of [['N1', 'N2'], ['N2', 'N3'], ['N1', 'N4']]) E.newPanel(P, a, b, 48, 54); P.seq = 10;
    const w = E.newWorksurface(P, { kind: 'corner', node: 'N1', legs: [Object.keys(P.panels)[0], Object.keys(P.panels)[2]], C: 48, D: 48 });
    const r = E.normalizeGeometry(P);
    ck('saved-job migration: an L laid out at nominal widths moves to 49 1/2" legs', r.moved > 0 && !r.loops.length && near(d(P, 'N1', 'N2'), 49.5) && near(d(P, 'N2', 'N3'), 48) && near(d(P, 'N1', 'N4'), 49.5), JSON.stringify([r, P.nodes]));
    ck('saved-job migration: running it again moves nothing', E.normalizeGeometry(P).moved === 0);
    const R = E.generate(P); ck('saved-job migration: the corner worksurface then lands on its junctions', !R.errors.length, JSON.stringify(R.errors)); }
  { const P = E.newProject('thin'); const n = E.addNode(P, 0, 0); let m = n; const ps = []; for (const a of [0, 90, 180]) { const q = E.addPanel(P, m, a, 48, 54); ps.push(q); m = P.nodes[q.b]; } const q = E.addPanel(P, m, 270, 48, 54);
    ck('closed square of four 48s: closes on the first junction, 51" sides, no loop error', q.b === n.id && Object.values(P.panels).every(p => near(d(P, p.a, p.b), 51)) && !E.normalizeGeometry(P, { dry: true }).loops.length, JSON.stringify(P.nodes));
    E.addPanel(P, P.nodes[ps[0].b], 270, 24, 54); ck('an L corner of the square turned into a T keeps its 1 1/2" allowance: the loop still closes', !E.normalizeGeometry(P, { dry: true }).loops.length); }
  { const P = E.newProject('thin'); const n = E.addNode(P, 0, 0); let m = n; const ps = []; for (const a of [0, 0, 90, 180, 180, 270]) { const q = E.addPanel(P, m, a, 48, 54); ps.push(q); m = P.nodes[q.b]; }
    const before = JSON.stringify(P.nodes); E.addPanel(P, P.nodes[ps[0].b], 270, 24, 54); const r = E.normalizeGeometry(P, { dry: true });
    ck('an in-line junction of a closed loop turned into a T no longer fits the loop: reported, the loop left as it was', ps[5].b === n.id && r.loops.length > 0 && Object.entries(JSON.parse(before)).every(([id, q]) => near(P.nodes[id].x, q.x) && near(P.nodes[id].y, q.y)), JSON.stringify(r)); }
}
console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
process.exit(fails ? 1 : 0);
