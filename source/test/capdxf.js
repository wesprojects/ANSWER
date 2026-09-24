// CAP DXF export: the file audits clean as AutoCAD 2000, and every CAPPN in it (nested blocks x their insert count) equals the
// specification's quantity per style number. Verified with python3 + ezdxf (pip install ezdxf).
const E = require('../src/engine.js'); require('../src/capdxf.js'); E.init(require('../src/catalog.json'));
const fs = require('fs'), cp = require('child_process');
let fails = 0; const ck = (n, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); if (!ok) fails++; };
function jobL() { // L workstation, furnished: glass on the spine, a stacked panel, power, corner worksurface with a pedestal, a straight with a filler
  const P = E.newProject('thin'); P.name = 'L test'; let n = E.addNode(P, 0, 0); const o = n; const sp = [];
  for (const w of [36, 36]) { const q = E.addPanel(P, n, 0, w, 66); q.glassScreen = { attach: 'recessed', height: 12, frosted: false, omitGlass: false }; sp.push(q); n = P.nodes[q.b]; }
  n = o; const rt = []; for (const w of [36, 36]) { const q = E.addPanel(P, n, 270, w, 54); rt.push(q); n = P.nodes[q.b]; }
  sp[0].power = { kind: 'powerkit', location: 'base', receptacles: [2, 1], usb: [0, 0], infeed: null }; rt[1].stack = [12];
  E.generate(P);
  const c = E.newWorksurface(P, { kind: 'corner', node: o.id, legs: [rt[0].id, sp[0].id], C: 36, D: 36, depthA: 24, depthB: 24, edge: '3mm', material: 'laminate', construction: 'cord-drop' });
  const s = E.newWorksurface(P, { kind: 'straight', panel: sp[1].id, side: 0, off: 0, width: 36, depth: 24, edge: '3mm', material: 'laminate' });
  E.addPedestal(P, s, { at: 'hi', type: 'fixed', config: 'A' });
  return P;
}
function jobTX() { // a spine with a T and an X, 120 deg V, oval trim
  const P = E.newProject('oval'); P.name = 'TX test'; let n = E.addNode(P, 0, 0); const ns = [n];
  for (const w of [48, 48, 48]) { const q = E.addPanel(P, n, 0, w, 66); n = P.nodes[q.b]; ns.push(n); }
  E.addPanel(P, ns[1], 270, 36, 54); E.addPanel(P, ns[2], 90, 36, 66); E.addPanel(P, ns[2], 270, 36, 66); E.addPanel(P, ns[3], 300, 42, 66);
  return P;
}
const py = `
import sys, json, ezdxf, collections
fn, exp = sys.argv[1], json.load(open(sys.argv[2]))
d = ezdxf.readfile(fn); a = d.audit(); msp = d.modelspace()
cnt = collections.Counter()
def walk(ents, mult):
    for e in ents:
        if e.dxftype() != 'INSERT': continue
        at = {x.dxf.tag: x.dxf.text for x in e.attribs}
        if 'CAPPN' in at and at['CAPPN']: cnt[at['CAPPN']] += mult
        if e.dxf.name not in d.blocks: print('MISSING BLOCK', e.dxf.name); continue
        walk(d.blocks.get(e.dxf.name), mult)
walk(msp, 1)
bad = {k: [exp.get(k, 0), cnt.get(k, 0)] for k in set(exp) | set(cnt) if exp.get(k, 0) != cnt.get(k, 0)}
tops = list(msp.query('INSERT')); nattr = collections.Counter(len(e.attribs) for e in tops)
print(json.dumps({'version': d.dxfversion, 'audit': len(a.errors), 'auditmsgs': [str(x) for x in a.errors][:5], 'inserts': len(tops), 'blocks': len(d.blocks), 'styles': len(cnt), 'bad': bad, 'attribs': dict(nattr), 'layers': len(d.layers)}))
`;
fs.writeFileSync('test/capout/verify.py', py);
for (const [name, mk] of [['L', jobL], ['TX', jobTX]]) {
  const P = mk(); const R = E.generate(P); const exp = {}; for (const l of R.lines) if (l.style && l.style !== '—') exp[l.style] = (exp[l.style] || 0) + l.qty;
  const dxf = E.toCapDXF(P, R, { build: 'test' }); fs.writeFileSync(`test/capout/${name}.dxf`, dxf); fs.writeFileSync(`test/capout/${name}.json`, JSON.stringify(exp));
  let r; try { r = JSON.parse(cp.execSync(`python3 test/capout/verify.py test/capout/${name}.dxf test/capout/${name}.json`, { encoding: 'utf8' }).trim().split('\n').pop()); } catch (e) { ck(name + ': ezdxf reads the file', false, String(e.stdout || e.message).slice(-400)); continue; }
  ck(name + ': AutoCAD 2000 DXF, audit clean', r.version === 'AC1015' && r.audit === 0, JSON.stringify(r.auditmsgs));
  ck(name + ': every style number appears exactly as many times as the specification says', !Object.keys(r.bad).length, `${r.styles} styles, ${r.inserts} inserts, ${r.blocks} blocks` + (Object.keys(r.bad).length ? ' mismatches ' + JSON.stringify(r.bad) : ''));
  ck(name + ': every part insert carries the CAP attributes (16 part / 10 panel-config)', Object.keys(r.attribs).every(k => k === '16' || k === '10'), JSON.stringify(r.attribs));
  ck(name + ': no rule errors in the test job', !R.errors.length, R.errors.map(e => e.msg).join(' | '));
}
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
