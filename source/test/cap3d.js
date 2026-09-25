// 3D blocks in the CAP DXF export: beside every P_<name> symbol the file defines 3_<name>, the body CAP shows when its 3D view swaps the
// symbols. The bodies are checked against the guide's dimensions: panel heights p16, base trim 3 3/4" p58, skins filling to the 5/8" cap lip,
// junction post heights p20 with the cap to the top cap, 3/4" corner posts and 1 1/2" in-line junctions (p21, p30), 1/2" end trim p20,
// stacking junctions 12 3/8" p32 with the top cap moved to the top of the stack, glass screens 15 1/2" tall for a 12"H kit standing 12"
// above the cap and 3/8" thick p64, window tiles at their tile height p19, worksurfaces 1 3/16" thick at 28 1/2" p222.
// Needs Python with ezdxf (pip install ezdxf). Writes test/capout/.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const E = require('../src/capdxf.js'); const cat = require('../src/catalog.json'); E.init(cat);
let fails = 0; const ck = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info !== undefined ? ' — ' + info : '')); if (!ok) fails++; };
fs.mkdirSync('test/capout', { recursive: true });
const PY = ['python3', 'python'].find(p => { try { cp.execSync(p + ' -c "import ezdxf"', { stdio: 'ignore' }); return true; } catch (e) { return false; } }) || 'python3';
const SURVEY = `
import ezdxf, json, sys
d = ezdxf.readfile(sys.argv[1]); a = d.audit()
out = {'version': d.dxfversion, 'audit': len(a.errors), 'blocks': {}, 'msp3d': 0}
for b in d.blocks:
    if b.name.startswith('*'): continue
    meshes = [e for e in b if e.dxftype() == 'POLYLINE' and e.is_poly_face_mesh]
    vs = [v.dxf.location for m in meshes for v in m.vertices if not v.is_face_record]
    ins = [[e.dxf.name, round(e.dxf.insert.x, 4), round(e.dxf.insert.y, 4), round(e.dxf.insert.z, 4), round(e.dxf.rotation, 1)] for e in b if e.dxftype() == 'INSERT']
    dh = [next((a.dxf.text for a in e.attribs if a.dxf.tag == 'CAPDH'), '0') for e in b if e.dxftype() == 'INSERT']
    faces = sum(1 for m in meshes for v in m.vertices if v.is_face_record)
    out['blocks'][b.name] = {'meshes': len(meshes), 'faces': faces, 'points': sum(1 for e in b if e.dxftype() == 'POINT'), 'ins': ins, 'dh': dh,
        'x': [round(min(v.x for v in vs), 4), round(max(v.x for v in vs), 4)] if vs else None, 'y': [round(min(v.y for v in vs), 4), round(max(v.y for v in vs), 4)] if vs else None, 'z': [round(min(v.z for v in vs), 4), round(max(v.z for v in vs), 4)] if vs else None,
        'layers': sorted(set(e.dxf.layer for e in meshes))}
out['msp3d'] = sum(1 for e in d.modelspace().query('INSERT') if e.dxf.name.startswith('3_'))
print(json.dumps(out))
`;
fs.writeFileSync('test/capout/survey3d.py', SURVEY);
const near = (a, b, t = 0.002) => Math.abs(a - b) <= t;
const survey = (file) => JSON.parse(cp.execSync(`${PY} test/capout/survey3d.py ${file}`, { encoding: 'utf8' }).trim().split('\n').pop());
const exportJob = (P, name) => { const R = E.generate(P); ck(`${name}: the job specifies without errors`, !R.errors.length, R.errors.map(e => e.msg).join(' | ')); const dxf = E.toCapDXF(P, R, { build: 'test' }); const file = `test/capout/${name}_CAP.dxf`; fs.writeFileSync(file, dxf); return { R, file, s: survey(file) }; };
const twin = (s, p) => s.blocks['3_' + p.slice(2)];
const hasTwins = (s, name) => { const P = Object.keys(s.blocks).filter(n => n.startsWith('P_')); const missing = P.filter(n => !twin(s, n)); ck(`${name}: AutoCAD 2000, audit clean, every P_ block has its 3_ twin (${P.length}), no 3_ insert in model space`, s.version === 'AC1015' && s.audit === 0 && !missing.length && s.msp3d === 0, JSON.stringify([s.version, s.audit, missing, s.msp3d])); };
const find = (s, rx, pred) => Object.entries(s.blocks).find(([n, b]) => rx.test(n) && n.startsWith('3_') && (!pred || pred(b))); // a 3_ block by style
// CAP builds a 3D panel from the 2D config's nested inserts (kept where they are, swapped for the 3_ twin, lifted by CAPDH), so every nested twin is
// measured in the config's frame: block extents through the insert point, its rotation (0 or 180) and its z
const nested = (s, cfg) => (s.blocks[cfg] ? s.blocks[cfg].ins : []).map(i => { const b = s.blocks[i[0]] || {}; const flip = Math.abs(i[4] - 180) < 0.01; const w = (r, o) => r ? (flip ? [o - r[1], o - r[0]] : [r[0] + o, r[1] + o]) : null; return { name: i[0], ins: i, x: w(b.x, i[1]), y: w(b.y, i[2]), z: b.z ? [b.z[0] + i[3], b.z[1] + i[3]] : null, faces: b.faces, layers: b.layers || [] }; });
const rng = (r, a, b, t = 0.002) => !!r && near(r[0], a, t) && near(r[1], b, t);

// ---- v2: 36"W 42"H panel with a 12" glass screen, L to a 36"W 54"H panel whose top 12" is a glass window tile (the owner's claude-request-v2 run)
{
  const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 36, 42); a.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false };
  const b = E.addPanel(P, c, 270, 36, 54); b.sides = [[{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 12, pane: 'single' }], [{ kind: 'skin', type: 'tackable acoustical', height: 36 }, { kind: 'window', height: 12, pane: 'single' }]];
  P.name = 'v2'; const { s } = exportJob(P, 'v2'); hasTwins(s, 'v2');
  const f42 = find(s, /^3_TS736THF/, x => x.z && near(x.z[1], 41.875)), f54 = find(s, /^3_TS736THF/, x => x.z && near(x.z[1], 54.25));
  ck('v2: 42" frame block from the floor to 41 7/8" (p16), 54" frame to 54 1/4"; 3" deep, 36" wide', !!f42 && !!f54 && near(f42[1].x[1], 36) && near(f42[1].y[1], 3) && f42[1].z[0] === 0, JSON.stringify([f42 && f42[1], f54 && f54[1]]));
  const A = nested(s, '3_A36.000000'), B = nested(s, '3_B36.000000');
  const skins = A.filter(n => /TS73636TK/.test(n.name));
  ck('v2: the 42" config nests its frame at the origin and a skin on each face, 36" wide, 37 1/2" tall from the 3 3/4" base trim to the 5/8" cap lip at 41 7/8" (p16, p19, p58)', A.some(n => /TS736THF/.test(n.name) && n.ins[1] === 0 && n.ins[2] === 0) && skins.length === 2 && skins.every(n => rng(n.x, 0, 36) && rng(n.z, 3.75, 41.25) && n.faces === 1) && skins.some(n => rng(n.y, 0, 0)) && skins.some(n => rng(n.y, 3, 3)), JSON.stringify(skins.map(n => [n.name, n.x, n.y, n.z])));
  ck('v2: tiles are nested the way CAP nests them (side A skin at (36, 0) turned 180 deg, side B skin at (0, 3), both lifted to the 3 3/4" base trim; window and glass at the origin lifted to their bottoms), one skin block for both faces', skins.some(n => n.ins[1] === 36 && n.ins[2] === 0 && n.ins[4] === 180 && near(n.ins[3], 3.75)) && skins.some(n => n.ins[1] === 0 && n.ins[2] === 3 && n.ins[4] === 0 && near(n.ins[3], 3.75)) && skins[0].name === skins[1].name && A.concat(B).filter(n => /TS71236TFGR|SPW/.test(n.name)).every(n => n.ins[1] === 0 && n.ins[2] === 0 && n.ins[4] === 0 && n.ins[3] > 3.75), JSON.stringify(A.concat(B).map(n => n.ins)));
  ck('v2: the 2D config nests the same symbols at the same points with CAPDH = the lift, so CAP\'s panel builder can rebuild the 3D panel from it', (() => { const c2 = s.blocks['P_A36.000000'], c3 = s.blocks['3_A36.000000']; return !!c2 && !!c3 && c2.ins.length === c3.ins.length && c2.ins.every((i, k) => '3_' + i[0].slice(2) === c3.ins[k][0] && i[1] === c3.ins[k][1] && i[2] === c3.ins[k][2] && i[4] === c3.ins[k][4] && near(+c2.dh[k], c3.ins[k][3])); })(), JSON.stringify([s.blocks['P_A36.000000'] && s.blocks['P_A36.000000'].ins, s.blocks['P_A36.000000'] && s.blocks['P_A36.000000'].dh]));
  const gl = A.find(n => /TS71236TFGR/.test(n.name) && n.z);
  ck('v2: the 12"H recessed glass screen is 15 1/2" of glass (p64) whose top stands 12" above the 41 7/8" cap, 3/8" thick on the centreline, 1/16" short of each module line', !!gl && rng(gl.z, 41.875 + 12 - 15.5, 41.875 + 12) && rng(gl.y, 1.3125, 1.6875) && rng(gl.x, 0.0625, 35.9375), JSON.stringify(gl && [gl.x, gl.y, gl.z]));
  const win = B.find(n => /TS71236SPW/.test(n.name)); const k54 = (54.25 - 3.75 - 0.625) / 48;
  ck('v2: the 54" config puts the window tile above the 36" skin, from 3 3/4" + 36" x the fill factor to the cap lip, through the 3" depth with a pane on the centreline', !!win && rng(win.x, 0, 36) && rng(win.y, 0, 3) && rng(win.z, 3.75 + 36 * k54, 53.625, 0.01) && win.faces === 5 && win.layers.includes('AFUSK-3D-016'), JSON.stringify(win && [win.x, win.y, win.z]));
  const jc = find(s, /^3_TS745TCLJ/); // 42/54 change-of-height L junction
  ck('v2: the change-of-height L junction rises to the 54" cap top (54 1/4"), with the 3/4" posts beyond the 3" block on both legs and its trim toward the lower leg', !!jc && near(jc[1].z[1], 54.25) && near(jc[1].x[0], -0.75) && near(jc[1].y[0], -0.75) && jc[1].meshes >= 4, JSON.stringify(jc && jc[1]));
  const e42 = find(s, /^3_TS742TEPJ/), e54 = find(s, /^3_TS754TEPJ/);
  ck('v2: end-of-run junctions: 3/4" post inside the module to the 40 3/4" / 53 1/8" post height (p20), the 1/2" trim beyond it to the cap lip', !!e42 && !!e54 && near(e42[1].x[0], -0.75) && near(e42[1].x[1], 0.5) && near(e42[1].z[1], 41.875 - 0.625) && near(e54[1].z[1], 54.25 - 0.625) && e42[1].meshes === 2, JSON.stringify([e42 && e42[1], e54 && e54[1]]));
}
// ---- v1: the same L with a 12" stacker on the second leg carrying a glass window, the first leg's glass screen (the owner's claude-request-v1 run)
{
  const P = E.newProject('thin'); const c = E.addNode(P, 0, 0); const a = E.addPanel(P, c, 0, 36, 42); a.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false };
  const b = E.addPanel(P, c, 270, 36, 42); E.setStack(P, b, [12]); b.stackSides = [[[{ kind: 'window', height: 12, pane: 'single' }], [{ kind: 'window', height: 12, pane: 'single' }]]];
  P.name = 'v1'; const { R, s } = exportJob(P, 'v1'); hasTwins(s, 'v1');
  const pk = find(s, /^3_TS74236TTF/);
  ck('v1: the stacked panel package: skins both faces to the 42" cap lip (41 1/4"), the one top cap moved to the top of the stack (54 1/4", p32)', !!pk && near(pk[1].z[1], 54.25) && pk[1].meshes === 4, JSON.stringify(pk && pk[1]));
  const cfgB = Object.entries(s.blocks).find(([nm, x]) => nm.startsWith('3_') && x.ins && x.ins.some(i => /TS74236TTF/.test(i[0]))); const win = cfgB && nested(s, cfgB[0]).find(n => /TS71236SPW/.test(n.name));
  ck('v1: the stacker\'s window tile sits on the base skins at the 42" cap lip (41 1/4") and is 12 3/8" tall (the stacking junction height, p32)', !!win && rng(win.z, 41.25, 41.25 + 12.375) && rng(win.x, 0, 36), JSON.stringify(win && [win.x, win.y, win.z]));
  const sj = find(s, /^3_TS712TEPJS/, x => x.z && near(x.z[0], 40.75));
  ck('v1: the 12" stacking junction stands on the 40 3/4" post to 53 1/8" (p20 + p32)', !!sj && near(sj[1].z[1], 53.125), JSON.stringify(sj && sj[1]));
  const cap = find(s, /^3_TS790COHJC/), lj = find(s, /^3_TS742TLPJ/);
  ck('v1: the base L junction stops at its post height with no cap (trim omitted for stacking, p32); the separate change-of-height cap sits on the stack from 53 1/8" to 54 1/4"', !!lj && near(lj[1].z[1], 40.75) && !!cap && near(cap[1].z[0], 53.125) && near(cap[1].z[1], 54.25), JSON.stringify([lj && lj[1], cap && cap[1]]));
  const tr = find(s, /^3_TS754TEVT/), coh = find(s, /^3_TS712TICHT/), lvt = find(s, /^3_TS742TLVT/);
  ck('v1: separate trims: the 54" end trim 1/2" x 3" to the 54" cap lip, the change-of-height trim 3/4" wide from the 42" lip to the 54" lip, the L vertical trim faces to the 42" lip', !!tr && near(tr[1].x[1] - tr[1].x[0], 0.5) && near(tr[1].z[1], 53.625) && !!coh && near(coh[1].x[1] - coh[1].x[0], 0.75) && near(coh[1].z[0], 41.25) && near(coh[1].z[1], 53.625) && !!lvt && near(lvt[1].z[1], 41.25), JSON.stringify([tr && tr[1], coh && coh[1], lvt && lvt[1]]));
  const pieces = Object.values(s.blocks).filter(b => b.points === 1 && b.meshes === 0 && b.ins.length === 0).length;
  ck('v1: parts with no body in the guide (aligners, seals, connectors) are points, as in CAP\'s library', pieces >= 3, pieces);
  const count = R.lines.reduce((a, l) => a + (l.style !== '—' ? l.qty : 0), 0);
  ck('v1: the 2D symbol count is unchanged by the 3D twins (one insert per specified piece)', count > 10, count);
}
// ---- a furnished job: worksurface slab; the whole export still audits clean
{
  const P = E.newProject('thin'); let n = E.addNode(P, 0, 0); const o = n; const spine = []; for (const w of [42, 30]) { const q = E.addPanel(P, n, 0, w, 66); spine.push(q); n = P.nodes[q.b]; }
  const r1 = E.addPanel(P, o, 270, 42, 54); E.newWorksurface(P, { kind: 'corner', node: o.id, legs: [r1.id, spine[0].id], C: 42, D: 42, depthA: 24, depthB: 24, supports: { arm0: 'auto', arm1: 'auto' } });
  const w1 = E.newWorksurface(P, { kind: 'straight', panel: spine[1].id, side: 0, off: 0, width: 30, depth: 24 }); E.addPedestal(P, w1, { at: 'hi', type: 'fixed', config: 'A' });
  P.name = 'furnished'; const { s } = exportJob(P, 'furnished'); hasTwins(s, 'furnished');
  const ws = Object.entries(s.blocks).filter(([nm, b]) => nm.startsWith('3_') && b.layers.includes('A-FURN-P-WKSF'));
  ck('furnished: worksurfaces are slabs 1 3/16" thick with their top at 28 1/2" (p222)', ws.length === 2 && ws.every(([, b]) => near(b.z[1], 28.5) && near(b.z[0], 28.5 - 1.1875)), JSON.stringify(ws.map(([nm, b]) => [nm, b.z])));
}
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
