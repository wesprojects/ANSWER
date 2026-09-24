const E = require('./src/engine.js'); E.init(require('./src/catalog.json'));
const P = E.newProject(); P.trim = 'thin';
const s = E.addNode(P, 0, 0); E.addPanel(P, s, 270, 24, 66); let n = s; const sp = []; for (let i = 0; i < 2; i++) { const q = E.addPanel(P, n, 0, 36, 66); sp.push(q); n = P.nodes[q.b]; }
const R0 = E.generate(P);
const ws = E.newWorksurface(P, { kind: 'straight', panel: sp[0].id, side: 0, off: 0, width: 36, depth: 24, edge: '3mm', material: 'laminate' });
const R = E.generate(P);
console.log('keys of a line', Object.keys(R.lines[0]));
for (const l of R.lines) console.log(JSON.stringify({ src: l.src, pid: l.pid, style: l.style, qty: l.qty, spec: (l.spec || '').slice(0, 60), desc: (l.desc || l.name || '').slice(0, 50), price: l.price ?? l.list, key: l.key }));
console.log('ws keys', Object.keys(ws).filter(k => k.startsWith('_')), 'geom', JSON.stringify(E.wsGeometry(P, ws)).slice(0, 400));
console.log('nodes', JSON.stringify(Object.values(R.nodes).map(j => ({ id: j.node && j.node.id, type: j.type, legs: j.legs.map(l => [l.angle, l.panel.id]) }))));
console.log('E keys', Object.keys(E).filter(k => /ped|Ped|Geometry|geom|rowsBy|catalog|desc|price/i.test(k)));
