/* ANSWER configurator engine — Steelcase Answer panels, Thin trim (primary) and Oval trim.
   Data: catalog.json extracted from the Answer Solutions Specification Guide, Feb 2015.
   All rules cite guide pages in comments. American English throughout. */
(function (root) {
  'use strict';
  const E = {};
  let CAT = null, BYID = {}, BYSTYLE = {};
  let RUN = null; // per-generate state: { errors, cohFramed:Set } (set in E.generate)
  const runError = (e) => { if (RUN) RUN.errors.push(e); };

  E.init = function (catalog) {
    CAT = catalog; BYID = {}; BYSTYLE = {};
    for (const p of catalog.products) {
      BYID[p.id] = p;
      for (const r of p.rows) { r._pid = p.id; (BYSTYLE[r.style] = BYSTYLE[r.style] || []).push(r); }
    }
    return E;
  };
  E.catalog = () => CAT;
  E.product = (id) => BYID[id] || null;
  E.products = () => CAT.products;
  E.rowsByStyle = (s) => BYSTYLE[s] || [];

  // ---------- constants (June 2022 guide: p22, p25, p30, p39, p66, p94) ----------
  // Panel heights p22; the 36"H panel is a thin-trim height (its junctions, trims and stackers are in the thin-trim pages only, p360-p396;
  // the square and oval sections p100-p138 list 30, 42, 48, 54, 66, 78).
  E.HEIGHTS = [30, 36, 42, 48, 54, 66, 78];
  E.HEIGHTS_BY_TRIM = { thin: [30, 36, 42, 48, 54, 66, 78], square: [30, 42, 48, 54, 66, 78], oval: [30, 42, 48, 54, 66, 78] };
  E.heightsFor = (trim) => E.HEIGHTS_BY_TRIM[trim] || E.HEIGHTS;
  E.WIDTHS = [18, 24, 30, 36, 42, 48, 60, 72];
  E.STACK_HEIGHTS = [6, 12, 18, 24];      // p39: 6 3/16", 12 3/8", 18 1/2", 24 3/4"
  E.COH_TRIM_HEIGHTS = [12, 18, 24, 30, 36];      // square and oval standard change-of-height trims (2022 p96, 2022 p452-2022 p453)
  E.COH_TRIM_HEIGHTS_THIN = [6, 12, 18, 24, 30, 36]; // 2022 p24: thin-trim change-of-height trims 6"H to 36"H (the 6"H trim is new in 2022, 2022 p383)
  E.SKIN_HEIGHTS = [12, 18, 24, 30, 36, 42, 48, 60];
  // heights offered per material (p434-461); windows p510
  E.SKIN_HEIGHTS_BY_TYPE = { 'tackable acoustical': [12, 18, 24, 30, 36, 42, 48, 60], 'performance tackable acoustical': [12, 18, 24, 30, 36, 42, 48, 60], steel: [12, 18, 24, 30, 36], laminate: [12, 18, 24, 30, 36, 42, 48, 60], wood: [12, 18, 24, 30, 36, 42, 48, 60], markerboard: [12, 18, 24, 30, 36], slatwall: [12, 18, 24], technology: [6, 12, 18], window: [12, 18, 24], 'back painted glass': [12, 18, 24, 30, 36] };
  E.TO_FLOOR_MIN = 24; // to-the-floor skins start at 24"H (p436-449)
  E.skinHeightsFor = (seg) => E.SKIN_HEIGHTS_BY_TYPE[seg.kind === 'window' ? 'window' : seg.type] || E.SKIN_HEIGHTS;
  // build a valid default skin stack for a target height (panel height - 6)
  E.defaultSegs = function (target, type) {
    const hs = E.SKIN_HEIGHTS_BY_TYPE[type] || E.SKIN_HEIGHTS;
    if (hs.includes(target)) return [{ kind: 'skin', type, height: target }];
    const desc = hs.slice().sort((a, b) => b - a);
    for (const a of desc) for (const b of desc) if (a + b === target && a >= b) return [{ kind: 'skin', type, height: a }, { kind: 'skin', type, height: b }];
    for (const a of desc) for (const b of desc) for (const c of desc) if (a + b + c === target) return [{ kind: 'skin', type, height: a }, { kind: 'skin', type, height: b }, { kind: 'skin', type, height: c }];
    return [{ kind: 'skin', type, height: desc[0] }];
  };
  // make a segment list total exactly `target` by adjusting the last segments; returns true when it could
  E.normalizeSegs = function (segs, target, fallbackType) {
    if (!segs.length) { segs.push(...E.defaultSegs(target, fallbackType)); return true; }
    for (const sg of segs) { const hs = E.skinHeightsFor(sg); if (!hs.includes(sg.height)) sg.height = hs.reduce((a, b) => Math.abs(b - sg.height) < Math.abs(a - sg.height) ? b : a); }
    let tot = sum(segs.map(x => x.height));
    if (tot === target) return true;
    // try: resize the last segment
    for (let i = segs.length - 1; i >= 0; i--) {
      const others = tot - segs[i].height; const need = target - others; const hs = E.skinHeightsFor(segs[i]);
      if (hs.includes(need)) { segs[i].height = need; return true; }
    }
    // try: drop last segment(s) until under target, then fill with default segments of the fallback type
    while (segs.length > 1 && sum(segs.map(x => x.height)) > target) segs.pop();
    tot = sum(segs.map(x => x.height));
    if (tot > target) { segs.splice(0, segs.length, ...E.defaultSegs(target, fallbackType)); return true; }
    if (tot < target) { const fill = E.defaultSegs(target - tot, fallbackType); if (sum(fill.map(x => x.height)) === target - tot) { segs.push(...fill); return true; } }
    segs.splice(0, segs.length, ...E.defaultSegs(target, fallbackType)); return true;
  };
  // stack combinations allowed for a base height (2022 p34: max 36" of stacking, two stackers, 90" total; a 6"H stacker sits on a base junction only,
  // never on or under another stacking junction)
  E.stackOptions = function (baseH) {
    const all = [[], [6], [12], [18], [24], [12, 12], [18, 18], [24, 12], [12, 24]];
    return all.filter(st => baseH + st.reduce((a, b) => a + b, 0) <= E.MAX_HEIGHT);
  };
  // 2022 p34 rules for the 6"H stacking junction: no stacking horizontal beam, nothing hung from it, no frameless glass, top cap screens or top cap
  // mounted storage on it, no window in the top position of a segment that has one, no 12"H slatwall skin on top of it, base junctions only
  E.SIX_STACK = { beam: false, hanging: false, topMounted: false, windowTop: false };
  // receptacle locations per side for a powerkit width (p189)
  E.TECH_CUTOUTS = { All: 'All cutouts', Right: 'Right-hand cutout only', Left: 'Left-hand cutout only', None: 'No cutouts' }; // UI value -> catalog attr (p505)
  E.powerBlocksPerSide = function (width) { const r = (BYID['wc-powerkit'] || { rows: [] }).rows.find(x => x.attrs.width === width); return r ? r.attrs.receptaclesPerSide : 0; };
  E.MAX_STACK = 36;        // p33, p100
  E.MAX_STACKERS = 2;      // p33, p100
  E.MAX_HEIGHT = 90;       // p33, p148
  E.SKIN_TRIM_ALLOWANCE = 6; // p19: skin height total = panel height - 6"
  E.BASE_TRIM_H = 3.75; // p58
  // the top cap snaps onto the top of the skins (p58, p104): a flat 3"-deep plate whose thin lips are all that shows on the face for thin trim, a taller rounded cap for oval (2015 p89 figure).
  // The guide gives no cap height; these face heights are for drawing only. Skins fill the height between the base trim and the cap; their nominal sizes still total panel height - 6" (p19).
  // thin: 5/8" derived from the guide, not stated: actual panel height minus the end-of-run vertical trim height is 5/8" at every height
  // (p16 54 1/4" vs p37 53 5/8"), and the trim meets the underside of the cap. oval: estimate, the guide gives no oval cap height (2015 p89).
  E.CAP_FACE = { thin: 0.625, oval: 1 };
  E.ACTUAL = { // p16 actual panel heights, p20 junction heights, p58 bar widths (thin)
    panelHeight: { 30: '29 1/2"', 36: '35 11/16"', 42: '41 7/8"', 48: '48 1/16"', 54: '54 1/4"', 66: '66 19/32"', 78: '78 31/32"' }, // 2022 2022 p16
    ovalPanelHeight: { 30: '29 3/8"', 42: '41 3/4"', 48: '47 15/16"', 54: '54 1/8"', 66: '66 15/32"', 78: '78 27/32"' },
    junctionHeight: { 30: '28 7/16"', 36: '34 5/8"', 42: '40 3/4"', 48: '47"', 54: '53 1/8"', 66: '65 1/2"', 78: '77 3/8"' }, // 2022 2022 p20
    thinBarWidth: { 18: '17 13/16"', 24: '23 13/16"', 30: '29 13/16"', 36: '35 13/16"', 42: '41 13/16"', 48: '47 13/16"', 60: '59 13/16"', 72: '71 13/16"' },
    ovalBarWidth: { 18: '17 15/16"', 24: '23 15/16"', 30: '29 15/16"', 36: '35 15/16"', 42: '41 15/16"', 48: '47 15/16"', 60: '59 15/16"', 72: '71 15/16"' },
    depth: '3"', glideRange: '2 3/4"',
  };
  // footprint adders (p20/p355 thin end-of-run trim +1/2", p21 wall-start +3/16"; p92 oval end-of-run +1", wall-start 0)
  E.FOOTPRINT = { thin: { eor: 0.5, wall: 0.1875 }, oval: { eor: 1, wall: 0 } };
  // corner junction caps seen from above (p388 figure): 90° corner cap TS790JC square, 3" (the junction depth, p20); 120° corner cap TS7120JC an equilateral
  // triangle. With 3" sides each leg's 3" end face is one side of the triangle and neighbouring legs meet at its points, so a leg stops 0.866" (the inradius) from the centre.
  E.CAP120_IN = 1.5 / Math.sqrt(3);
  E.cap120 = (cx, cy, a0) => [0, 1, 2].map(k => { const t = (a0 + 60 + 120 * k) * Math.PI / 180, r = 2 * E.CAP120_IN; return [cx + Math.cos(t) * r, cy + Math.sin(t) * r]; }); // vertices on the bisectors between legs, a0 = a leg's angle (deg)
  E.JUNCTION_W = 1.5; // an in-line junction is 3" deep and 1 1/2" along the run, centered on the module line: the 48" panel frame is 46 1/2" between junctions (p30)
  // An end-of-run junction post is 3/4" along the run and sits inside the panel's nominal width, so only its trim adds to the footprint (p20 +1/2" thin,
  // p92 +1" oval). p45 top view (to scale along the run): a 3" in-line junction is post + block + post = 3/4" + 1 1/2" + 3/4". A wall-start junction
  // adds 3/16" (p21, thin). Corner junctions are drawn as their 3" block (junction depth 3", p20) plus a 3/4" post on each leg (see CORNER_ALLOW).
  E.EOR_POST = 0.75;
  E.CORNER_POST = 3;
  // Corner junctions (L, T, X, V, Y) are block-and-post construction (p21): a 3" junction block sits on the centerline intersection and each panel's
  // module starts at the block face, CORNER_ALLOW out from the node; the panel's 3/4" post comes next, so its frame starts at CORNER_ALLOW + 3/4".
  // A panel's node-to-node length is its nominal width plus the corner allowance at each corner end (in-line, end-of-run and wall-start ends add 0).
  // 90° families: 1 1/2". Evidence: (a) straight worksurfaces run junction center to junction center and butt the corner worksurface's arm end there
  // (p225 figure); the 48" corner's back edge is 47 1/2" on the 1/2" cord-drop one (its back 1/2" off the panel face, p224) and 48" full depth, measured
  // from the rear inside corner at the panel faces 1 1/2" off each centerline (p563), so the arm ends 1 1/2" + 1/2" + 47 1/2" = 1 1/2" + 48" = 49 1/2"
  // from the node, which is 48" + 1 1/2"; (b) the corner face is then 1 1/2" (block half) + 3/4" (post) = 2 1/4" from the node, and a 48" panel's
  // frame between that face and the next in-line junction face (3/4" before its center) is 49 1/2" - 2 1/4" - 3/4" = 46 1/2", the frame of p30.
  // 120° families (V, Y), derived the same way from the 120° corner worksurface (p568, cord drop only, back edge 47 1/2" for the 48"): its back edges
  // run 2" off each centerline (1 1/2" panel face + 1/2" cord drop) and meet at the rear corner o. With the legs 120° apart, o lies on the bisector,
  // 2" / sin 60° from the node, and its projection on each leg is (2" / sin 60°) × cos 60° = 2" × tan 30° = 2/√3" ≈ 1.1547". The arm end on the leg
  // is then 2/√3 + 47 1/2" from the node, which must be the next junction center at 48" + allowance: allowance = 2/√3 - 1/2" ≈ 0.6547" (the 36"
  // and 42" sizes, 35 1/2" and 41 1/2", give the same value).
  E.CORNER_ALLOW = { 90: 1.5, 120: 2 / Math.sqrt(3) - 0.5 };
  E.cornerAllow = (type) => (type === 'L' || type === 'T' || type === 'X') ? E.CORNER_ALLOW[90] : (type === 'V' || type === 'Y') ? E.CORNER_ALLOW[120] : 0;
  // how far a junction reaches along a run from its node: in = toward its own panel, out = away from it (the run's end face, trim included).
  // A corner reaches in to its corner face (allowance + 3/4" post) and out 1 1/2" (the junction block's far face, the other leg's outer face).
  E.junctionReach = function (trim, type) {
    const fp = E.FOOTPRINT[trim] || E.FOOTPRINT.thin;
    if (type === 'inline') return { in: E.JUNCTION_W / 2, out: E.JUNCTION_W / 2, post: [-E.JUNCTION_W / 2, E.JUNCTION_W / 2] };
    if (type === 'EOR') return { in: E.EOR_POST, out: fp.eor, post: [-E.EOR_POST, 0], trim: [0, fp.eor] };
    if (type === 'wall') return { in: E.EOR_POST, out: fp.wall, post: [-E.EOR_POST, fp.wall] };
    const ca = E.cornerAllow(type) || E.CORNER_ALLOW[90];
    return { in: ca + E.EOR_POST, out: E.CORNER_POST / 2, post: [-E.CORNER_POST / 2, ca + E.EOR_POST], ca };
  };
  // actual heights for drawing (p16 thin, p90 oval: floor to top of top cap, glides retracted); stacking junctions add 12 3/8", 18 1/2", 24 3/4" (p32, p100)
  E.ACTUAL_H = { thin: { 30: 29.5, 36: 35.6875, 42: 41.875, 48: 48.0625, 54: 54.25, 66: 66.59375, 78: 78.96875 }, oval: { 30: 29.375, 42: 41.75, 48: 47.9375, 54: 54.125, 66: 66.46875, 78: 78.84375 } }; // 2022 2022 p16 (thin), 2022 p90 (oval)
  E.STACK_ACTUAL = { 6: 6.1875, 12: 12.375, 18: 18.5, 24: 24.75 }; // 2022 2022 p32
  E.actualBaseHeight = (trim, h) => (E.ACTUAL_H[trim] || E.ACTUAL_H.thin)[h] || h;
  E.actualTop = (trim, p) => E.actualBaseHeight(trim, p.height) + (p.stack || []).reduce((a, st) => a + (E.STACK_ACTUAL[st] || st), 0);
  E.TOP_CAP_SCREENS = { universal: { heights: [13.5, 19.5], screen: { 13.5: 13.5, 19.5: 19.5 } }, sarto: { heights: [13.5, 19.5], screen: { 13.5: 12.5, 19.5: 18.5 } } }; // 2022 p70, p72
  E.topCapScreenHeight = (sc) => sc ? (E.TOP_CAP_SCREENS[sc.kind] || E.TOP_CAP_SCREENS.universal).screen[sc.height] || sc.height : 0;
  E.OPEN_BASE = { height: 3.25, opening: 2.5 }; // open base trims occupy the bottom 3 1/4"; the opening is 2 1/2" high (p59, 2015 p89)
  // frameless glass (thin): glass heights for the 12/18/24" screens (p64), clip 11 3/4" (p68); per-end clearance from the junction center:
  // half the gap between adjacent screens (1/8" recessed p64, 1/4" clip p68); at a change-of-height end the glass stops 1/2" (recessed, 47 7/16" for 48")
  // or 5/8" (clip, 47 1/4") from the junction center (p64, p68)
  // 2022 2022 p64: the 6"/12"/18"/24"H recessed kits (2022 p396-2022 p398) carry 9 5/16", 15 1/2", 21 11/16", 27 7/8" of glass (keyed by kit height; the 2015
  // table keyed 12/18/24 and printed 21 5/8" for the 18" kit)
  E.GLASS = { recessed: { heights: { 6: 9.3125, 12: 15.5, 18: 21.6875, 24: 27.875 }, end: 1 / 16, cohEnd: 0.5 }, clip: { height: 11.75, end: 0.125, cohEnd: 0.625 } };
  E.GLASS_KITS = [6, 12, 18, 24];
  E.glassHeight = (g) => g.attach === 'clip' ? E.GLASS.clip.height : (E.GLASS.recessed.heights[g.height] || g.height);
  E.TOP_SCREEN = { height: 12, inset: 1.25 }; // oval panel top screen: 12"H, 27 1/2"–45 1/2"W on 30"–48" panels, 1 1/4" in from each end (p111, 2015 p97)
  // change-of-height trim width drawn over the lower panel: oval slim profile 1 1/8", cable-routing 2 1/4" (p95); thin: half the junction (the guide gives no width)
  E.cohTrimWidth = (P) => P.trim === 'oval' ? (/cable/i.test((P.options || {}).ovalCohProfile || '') ? 2.25 : 1.125) : E.JUNCTION_W / 2;
  E.WS_THICK = 1.1875; // worksurface thickness 1 3/16" (p222)
  E.PED_INSET = 0.5;   // pedestal set in from the worksurface end, plan and elevation alike. No guide basis (drawing choice).

  // ---------- helpers ----------
  const HD = { 30: '3', 42: '4', 48: '8', 54: '5', 66: '6', 78: '7', 90: '9' }; // style-number height digits (p25)
  E.heightDigit = (h) => HD[h];
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const uniq = (a) => [...new Set(a)];
  const inch = (n) => { // 40.5 -> 40 1/2"
    let w = Math.floor(n + 1e-9); const f = n - w;
    let q = Math.round(f * 16); const bd = Math.abs(f - q / 16); if (q === 16) { w += 1; q = 0; } // nearest sixteenth, reduced (11/16, 5/16, 1/2 ...)
    let den = 16; while (q && q % 2 === 0) { q /= 2; den /= 2; } const best = q ? ` ${q}/${den}` : '';
    if (bd >= 0.02) return n.toFixed(3) + '"';
    return (w === 0 && best ? best.trim() : `${w}${best}`) + '"';
  };
  E.inch = inch;

  function rowsOf(id) { const p = BYID[id]; if (!p) throw new Error('missing product ' + id); return p.rows; }
  function findRow(id, pred) { return rowsOf(id).find(pred) || null; }

  // price of an option for a given row (handles price / priceBy bands / row adders)
  function bandMatch(key, row) {
    // keys like "18W-48W", "12H,18H", "36H-60H", "30H-54H", "24W-36W"
    const a = row.attrs || {};
    const dim = key.includes('W') ? (a.width) : (a.height !== undefined ? a.height : a.stackHeight);
    if (dim === undefined) return false;
    for (const part of key.split(',')) {
      const m = part.trim().match(/^(\d+)[WH](?:-(\d+)[WH])?$/);
      if (!m) continue;
      const lo = +m[1], hi = m[2] ? +m[2] : lo;
      if (dim >= lo && dim <= hi) return true;
    }
    return false;
  }
  E.optionPrice = function (product, code, row) {
    if (row && row.adders && row.adders[code] !== undefined) return row.adders[code];
    const o = (product.options || []).find(x => x.code === code);
    if (!o) return null;
    if (typeof o.price === 'number') return o.price;
    if (o.priceBy) { for (const k in o.priceBy) if (bandMatch(k, row)) return o.priceBy[k]; }
    return null;
  };
  E.option = (product, code) => (product.options || []).find(x => x.code === code) || null;

  // ---------- finishes ----------
  E.paintGroupCode = (paint) => paint ? 'paintGroup' + (paint.group || 1) : 'paintGroup1';
  E.paints = function (component) {
    // paints available for a matrix component (p732). component e.g. "Panel trim components"
    const s = CAT.surface, m = s.paintAvailabilityMatrix;
    const okCodes = new Set();
    if (m && m.rows) for (const r of m.rows) { const v = r.available && r.available[component]; if (v === true || v === 'exceptions') okCodes.add(r.paintCode); }
    return s.paints.filter(p => p.code && (okCodes.size === 0 || okCodes.has(p.code)));
  };
  E.allPaints = () => CAT.surface.paints.filter(p => p.code);
  E.fabrics = () => CAT.surface.fabrics;
  E.woods = () => CAT.surface.woodVeneers;
  E.laminates = () => CAT.surface.laminates;
  // worksurface front edge colors (2015 p711) and oval trim plastics (junction caps, p433 p437, p724) are their own lists, not the receptacle colors
  E.edges = () => { const seen = new Set(); return (CAT.surface.edges || []).filter(e => e.code && /^Plastic edge/.test(e.type || 'Plastic edge') && !seen.has(e.code) && seen.add(e.code)); };
  E.ovalPlastics = () => { const seen = new Set(); return (CAT.surface.other || []).filter(o => o.category === 'Plastic' && (o.appliesTo || []).some(a => /Oval trim/.test(a)) && !seen.has(o.code) && seen.add(o.code)); };

  // ---------- project model ----------
  E.newProject = function (trim) {
    return {
      app: 'ANSWER', version: 1, name: 'Untitled', trim: trim || 'thin',
      nodes: {}, panels: {}, seq: 1,
      finishes: {
        trimPaint: { code: '7207', name: 'Black', group: 1 },      // junction trim / caps / top cap / base trim paint
        woodTrim: false, wood: { code: '3062', name: 'Graphite Walnut', cut: 'flat' },
        fabric: { code: '5F01', name: 'Buzz2', group: 1 }, fabricDirection: 'horizontal',
        skinType: 'tackable acoustical', steelPaint: { code: '7207', name: 'Black', group: 1 },
        laminate: { code: '2730', name: 'Arctic White' }, plasticColor: '6000',
        edge: { code: '6009', name: 'Arctic White' },          // worksurface front edge: p734 recommends 6009 for 2730 Arctic White
        ovalCap: { code: '6000', name: 'Black' },               // oval plastic junction cap color (p433, p437)
      },
      power: { schematic: 'X', nonPvc: false, receptacleAmps: 15, ground: 'System Ground' },
      options: { usePanelPackages: true, ovalCohProfile: 'Slim Profile', baseTrimStyle: 'knockouts', includeGlideCaps: false, cohTopCapAuto: true },
      manual: [],   // manual add-on lines [{style, qty, spec}]
    };
  };
  E.addNode = function (P, x, y) { const id = 'N' + (P.seq++); P.nodes[id] = { id, x, y, wallStart: false }; return P.nodes[id]; };
  E.nodeAt = function (P, x, y, tol) { tol = tol || 1; for (const n of Object.values(P.nodes)) if (Math.abs(n.x - x) < tol && Math.abs(n.y - y) < tol) return n; return null; };
  E.newPanel = function (P, a, b, width, height) {
    const id = 'P' + (P.seq++);
    const skinH = height - E.SKIN_TRIM_ALLOWANCE;
    const pnl = {
      id, a, b, width, height, stack: [],
      sides: [E.defaultSegs(skinH, P.finishes.skinType), E.defaultSegs(skinH, P.finishes.skinType)],
      stackSides: [], // per stacker: [[side1 segs],[side2 segs]]
      topCap: { wood: false, omit: false }, baseTrim: 'knockouts', openBase: false, skinsToFloor: false,
      cableTray: false, baseCableTray: false,
      power: { kind: 'none', location: 'base', receptacles: [0, 0], usb: [0, 0], infeed: null },
      glassScreen: null, topCapScreen: null, topScreen: false, window: null, label: '',
    };
    P.panels[id] = pnl; return pnl;
  };
  // a new panel leaves fromNode at angleDeg. It ends on an existing node when one sits where the panel's far end lands (its width plus the corner
  // allowance the junctions at either end will take, see CORNER_ALLOW), else on a new node; then the job's geometry is normalized (E.normalizeGeometry)
  // so every panel's node-to-node length is its width plus its corner allowances, whatever the new panel did to the junction types.
  // the corner allowance a node will have once a panel leaves it at angleDeg (0 when that makes an in-line or end-of-run junction)
  E.allowIfAdded = function (P, node, angleDeg, excludePanelId) {
    if (!node || !P.nodes[node.id]) return 0; const legs = legsAt(P, node).filter(l => l.panel.id !== excludePanelId); const a0 = ((Math.round(angleDeg) % 360) + 360) % 360;
    return legs.length ? E.cornerAllow(classify([...legs, { angle: a0 }].sort((x, y) => x.angle - y.angle), node).type) : 0;
  };
  E.addPanel = function (P, fromNode, angleDeg, width, height) {
    const rad = angleDeg * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
    const caFrom = E.allowIfAdded(P, fromNode, angleDeg);
    let to = null;
    for (const extra of [0, E.CORNER_ALLOW[120], E.CORNER_ALLOW[90]]) { const d = width + caFrom + extra; to = E.nodeAt(P, fromNode.x + ux * d, fromNode.y + uy * d, extra ? 0.5 : 2); if (to && to.id !== fromNode.id) break; to = null; }
    if (!to) { const d = width + caFrom; to = E.addNode(P, Math.round((fromNode.x + ux * d) * 1000) / 1000, Math.round((fromNode.y + uy * d) * 1000) / 1000); }
    const p = E.newPanel(P, fromNode.id, to.id, width, height);
    E.normalizeGeometry(P);
    return p;
  };
  E.removePanel = function (P, pid) {
    const p = P.panels[pid]; if (!p) return; delete P.panels[pid];
    for (const nid of [p.a, p.b]) if (!Object.values(P.panels).some(q => q.a === nid || q.b === nid)) delete P.nodes[nid];
    E.normalizeGeometry(P);
  };
  E.panelTotalHeight = (p) => p.height + sum(p.stack);
  // corner allowance at a node (0 unless it is an L, T, X, V or Y junction) and a panel's node-to-node length: width + allowance at each corner end
  E.nodeAllow = function (P, nid) { const n = P.nodes[nid]; return n ? E.cornerAllow(E.junction(P, n).type) : 0; };
  E.panelSpan = function (P, p) { return p.width + E.nodeAllow(P, p.a) + E.nodeAllow(P, p.b); };
  E.panelLength = function (P, p) { return p.width; };
  // Recompute node positions from panel widths and junction types (see CORNER_ALLOW): every panel keeps its direction (snapped to the 30° steps
  // Answer junctions use) and gets node-to-node length width + allowance at each corner end. Each connected group is laid out from one node, then
  // shifted so the most nodes keep their place (ties keep the oldest node): a change moves as little of the plan as it can. A closed loop whose
  // sides no longer fit is reported and its group left as it was. Returns { moved: nodes moved, loops: [panel ids of loops that do not close] }.
  // opts.dry: report only, move nothing.
  E.normalizeGeometry = function (P, opts) {
    opts = opts || {}; const nodes = P.nodes || {}, adj = {}; const out = { moved: 0, loops: [] };
    for (const id in nodes) adj[id] = [];
    for (const p of Object.values(P.panels || {})) { if (!nodes[p.a] || !nodes[p.b] || p.a === p.b) continue; adj[p.a].push(p); adj[p.b].push(p); }
    const ca = {}; for (const id in nodes) ca[id] = adj[id].length >= 2 ? E.cornerAllow(classify(legsAt(P, nodes[id], adj[id]), nodes[id]).type) : 0;
    const dirOf = {}; for (const p of Object.values(P.panels || {})) {
      if (!adj[p.a] || !adj[p.b]) continue; const a = nodes[p.a], b = nodes[p.b]; const L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) continue;
      let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; const s30 = Math.round(ang / 30) * 30;
      if (Math.abs(ang - s30) <= 4) { const r = s30 * Math.PI / 180; let c = Math.cos(r), s = Math.sin(r); if (Math.abs(c) < 1e-12) c = 0; if (Math.abs(s) < 1e-12) s = 0; dirOf[p.id] = [c, s]; }
      else dirOf[p.id] = [(b.x - a.x) / L, (b.y - a.y) / L];
    }
    const num = (id) => +String(id).replace(/\D/g, '') || 0;
    const ids = Object.keys(nodes).sort((x, y) => num(x) - num(y)); const done = new Set();
    for (const root of ids) {
      if (done.has(root)) continue;
      const pos = { [root]: [0, 0] }; const comp = [root]; const queue = [root]; done.add(root); const bad = [];
      while (queue.length) {
        const u = queue.shift();
        for (const p of adj[u]) {
          const d = dirOf[p.id]; if (!d) continue; const v = p.a === u ? p.b : p.a, sg = p.a === u ? 1 : -1, L = p.width + ca[p.a] + ca[p.b];
          const t = [pos[u][0] + sg * d[0] * L, pos[u][1] + sg * d[1] * L];
          if (!pos[v]) { pos[v] = t; if (!done.has(v)) { done.add(v); comp.push(v); queue.push(v); } }
          else if (Math.hypot(pos[v][0] - t[0], pos[v][1] - t[1]) > 0.01 && !bad.includes(p.id)) bad.push(p.id);
        }
      }
      for (const id of comp) if (!pos[id]) pos[id] = null;
      if (bad.length) { out.loops.push(...bad); continue; }
      // the shift that keeps the most nodes in place (ties: the oldest node)
      const groups = new Map(); for (const id of comp) { if (!pos[id]) continue; const n = nodes[id]; const k = Math.round((n.x - pos[id][0]) * 1000) + ',' + Math.round((n.y - pos[id][1]) * 1000); if (!groups.has(k)) groups.set(k, { n: 0, first: num(id), sh: [n.x - pos[id][0], n.y - pos[id][1]] }); groups.get(k).n++; }
      let best = null; for (const g of groups.values()) if (!best || g.n > best.n || (g.n === best.n && g.first < best.first)) best = g;
      if (!best) continue;
      for (const id of comp) {
        if (!pos[id]) continue; const n = nodes[id]; const x = Math.round((pos[id][0] + best.sh[0]) * 1e6) / 1e6, y = Math.round((pos[id][1] + best.sh[1]) * 1e6) / 1e6;
        if (Math.abs(x - n.x) > 1e-6 || Math.abs(y - n.y) > 1e-6) { if (Math.hypot(x - n.x, y - n.y) > 0.01) out.moved++; if (!opts.dry) { n.x = x; n.y = y; } }
      }
    }
    return out;
  };

  // set the stack list and keep default skins for stackers
  E.setStack = function (P, p, stack) {
    stack = stack.slice(); const prev = p.stack || [], prevSides = p.stackSides || [];
    if (p.height + sum(stack) > E.MAX_HEIGHT) { // keep the largest part of the requested stack that still fits (order kept)
      let best = []; for (let m = 1; m < (1 << stack.length); m++) { const sub = stack.filter((_, i) => m & (1 << i)); if (p.height + sum(sub) <= E.MAX_HEIGHT && (sum(sub) > sum(best) || (sum(sub) === sum(best) && sub.length < best.length))) best = sub; }
      stack = best;
    }
    // stacked tiers keep their tiles when the same tier height survives (matched in order)
    const used = new Set();
    p.stackSides = stack.map((s) => { const k = prev.findIndex((h, i) => h === s && !used.has(i) && prevSides[i] && sum(prevSides[i][0].map(x => x.height)) === s && sum(prevSides[i][1].map(x => x.height)) === s); if (k >= 0) { used.add(k); return prevSides[k]; } return [E.defaultSegs(s, P.finishes.skinType), E.defaultSegs(s, P.finishes.skinType)]; });
    p.stack = stack;
  };
  E.setHeight = function (P, p, h) {
    p.height = h; const skinH = h - 6;
    for (const s of [0, 1]) E.normalizeSegs(p.sides[s], skinH, P.finishes.skinType);
    E.setStack(P, p, p.stack);
    if (p.width < 24 && p.power.kind === 'powerkit') p.power.kind = 'passthrough';
  };
  // keep every panel valid (called before generating)
  E.sanitizePanel = function (P, p) {
    const skinH = p.height - 6;
    for (const s of [0, 1]) { p.sides[s] = p.sides[s] || []; E.normalizeSegs(p.sides[s], skinH, P.finishes.skinType); }
    E.setStack(P, p, p.stack || []);
    p.stack.forEach((st, i) => { for (const s of [0, 1]) E.normalizeSegs(p.stackSides[i][s], st, P.finishes.skinType); });
    if (p.width < 24 && p.power.kind === 'powerkit') p.power.kind = 'passthrough';
    if (p.power.kind === 'powerkit') { const cap = E.powerBlocksPerSide(p.width); for (const s of [0, 1]) { p.power.receptacles[s] = Math.max(0, Math.min(cap, p.power.receptacles[s] | 0)); p.power.usb[s] = Math.max(0, Math.min(cap - p.power.receptacles[s], p.power.usb[s] | 0)); } }
    const notes = []; const nm = 'Panel ' + String(p.id).replace(/^P/, '');
    if (p.skinsToFloor) { for (const s of [0, 1]) { const b = p.sides[s][0]; if (b.kind === 'window' || b.type === 'slatwall' || b.type === 'technology' || b.height < E.TO_FLOOR_MIN) p.skinsToFloor = false; } if (!p.skinsToFloor) notes.push(`${nm}: skins can run to the floor only when the bottom tile on both sides is a fabric, steel, laminate, wood or markerboard skin 24" or taller (p19, p436-449).`); }
    // settings one trim style does not offer are kept aside, not deleted, and come back when the job returns to that trim
    p.topCap = p.topCap || { wood: false, omit: false };
    if (P.trim !== 'thin') {
      if (p.glassScreen || p.topCapScreen || p.topCap.omit) { p.thinOnly = { glassScreen: p.glassScreen || null, topCapScreen: p.topCapScreen || null, omitCap: !!p.topCap.omit }; p.glassScreen = null; p.topCapScreen = null; p.topCap.omit = false; }
      if (p.ovalOnly) { if (p.ovalOnly.topScreen && !p.topScreen) p.topScreen = true; delete p.ovalOnly; }
      if (p.topScreen && ![30, 36, 42, 48].includes(p.width)) { p.topScreen = false; notes.push(`${nm}: the translucent top screen comes 30"–48" wide only, so it was removed.`); }
      if (p.topScreen && p.topCap.wood) { p.topScreen = false; notes.push(`${nm}: the translucent top screen needs a painted top cap, so it was removed.`); }
    } else {
      if (p.topScreen) { p.ovalOnly = { topScreen: true }; p.topScreen = false; }
      if (p.thinOnly) { if (p.thinOnly.glassScreen && !p.glassScreen) p.glassScreen = p.thinOnly.glassScreen; if (p.thinOnly.topCapScreen && !p.topCapScreen) p.topCapScreen = p.thinOnly.topCapScreen; if (p.thinOnly.omitCap && !p.topCap.wood) p.topCap.omit = true; delete p.thinOnly; }
      // Universal and Sarto screens with the Answer thin trim top cap (2022 p70-73): 24"-96"W, not with frameless glass, not over a window in the top position, not on a 6"H stacker
      if (p.topCapScreen && (p.width < 24 || p.width > 96)) { p.topCapScreen = null; notes.push(`${nm}: top cap screens come 24"-96" wide, so the screen was removed (2022 p70).`); }
      if (p.topCapScreen && p.glassScreen) { p.glassScreen = null; notes.push(`${nm}: a panel carries a frameless glass screen or a top cap screen, not both; the glass was removed.`); }
      if (p.topCapScreen && p.sides[0][p.sides[0].length - 1].kind === 'window') { p.topCapScreen = null; notes.push(`${nm}: a top cap screen cannot be used with a window in the top position, so the screen was removed (2022 p71).`); }
      if (p.topCapScreen && (p.stack || []).includes(6)) { p.topCapScreen = null; notes.push(`${nm}: a top cap screen cannot be added to a panel segment with a 6" stacker, so the screen was removed (2022 p71).`); }
      if (p.glassScreen && p.width < 24) { p.glassScreen = null; notes.push(`${nm}: frameless glass is made 24" wide and up, so the glass screen was removed (p64).`); }
      if (p.glassScreen && p.sides[0][p.sides[0].length - 1].kind === 'window') { p.glassScreen = null; notes.push(`${nm}: frameless glass cannot sit over a window in the top position, so the glass screen was removed (p65).`); }
    }
    if (p.openBase && p.baseCableTray) p.baseCableTray = false;
    if ((p.skinsToFloor || p.baseTrim === 'hardwire') && p.baseCableTray) p.baseCableTray = false;
    return notes;
  };
  // directions that keep a junction valid when adding a panel at `node` (90° family or 120° family, no mixing)
  E.allowedAngles = function (P, node, excludePanelId) {
    const legs = legsAt(P, node).filter(l => !excludePanelId || l.panel.id !== excludePanelId); const out = [];
    for (const a of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      if (legs.some(l => l.angle === a)) continue;
      const c = classify([...legs, { angle: a }].sort((x, y) => x.angle - y.angle), node);
      if (c.type !== 'unsupported') out.push(a);
    }
    return out;
  };

  // ---------- geometry / junction classification (p20-21) ----------
  function legsAt(P, node, list) {
    const legs = [];
    for (const p of list || Object.values(P.panels)) {
      if (p.a !== node.id && p.b !== node.id) continue;
      const other = P.nodes[p.a === node.id ? p.b : p.a];
      let ang = Math.atan2(other.y - node.y, other.x - node.x) * 180 / Math.PI; ang = ((ang % 360) + 360) % 360; const s30 = Math.round(ang / 30) * 30 % 360; ang = Math.abs(ang - s30) <= 4 || Math.abs(ang - s30) >= 356 ? s30 : Math.round(ang);
      legs.push({ panel: p, angle: ang, base: p.height, total: E.panelTotalHeight(p), stack: p.stack, farNode: other.id });
    }
    legs.sort((a, b) => a.angle - b.angle);
    return legs;
  }
  function classify(legs, node) {
    const n = legs.length;
    if (n === 0) return { type: 'none' };
    if (n === 1) return { type: node.wallStart ? 'wall' : 'EOR', family: 90 };
    const diffs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let d = Math.abs(legs[i].angle - legs[j].angle) % 360; d = Math.min(d, 360 - d); diffs.push(d); }
    const all90 = diffs.every(d => d % 90 === 0), all120 = diffs.every(d => d === 120 || d === 240);
    if (n === 2) {
      const d = diffs[0];
      if (d === 180) return { type: 'inline', family: 90 };
      if (d === 90) return { type: 'L', family: 90 };
      if (d === 120) return { type: 'V', family: 120 };
      return { type: 'unsupported', reason: `Two panels meet at ${d}°. Answer supports 90°, 120°, and in-line (180°) junctions only.` };
    }
    if (n === 3) {
      if (all90) return { type: 'T', family: 90 };
      if (all120) return { type: 'Y', family: 120 };
      return { type: 'unsupported', reason: 'Three panels must meet at 90° (T) or 120° (Y).' };
    }
    if (n === 4 && all90) return { type: 'X', family: 90 };
    return { type: 'unsupported', reason: `${n} panels meet here. Answer junctions accept at most four panels at 90°.` };
  }
  // slot index for 90° family: 0..3 around the node; for 120°: 0..2
  function assignSlots(legs, fam) {
    const step = fam === 120 ? 120 : 90; const base = legs[0].angle;
    for (const l of legs) l.slot = Math.round((((l.angle - base) % 360) + 360) % 360 / step) % (fam === 120 ? 3 : 4);
  }
  E.junction = function (P, node) {
    const legs = legsAt(P, node);
    const c = classify(legs, node);
    if (c.family) assignSlots(legs, c.family);
    return Object.assign({ node, legs }, c);
  };

  // ---------- band model (p40-44, p51 Step 11) ----------
  // Given legs with `slot`, `top` height, family 90/120: returns trim pieces, cap, aligners.
  // Pieces: {kind:'EOR'|'L'|'T'|'V'|'120', from, to, faces:key}
  function shapeOf(present, fam, nLegs) {
    // present: array of slots present
    const k = present.length;
    if (fam === 120) {
      if (k >= 3) return { kind: null };
      if (k === 2) return { kind: 'V', key: 'V:' + present.join(',') };
      return { kind: '120', key: '120:' + present[0] };
    }
    if (k === 4) return { kind: null };
    if (k === 3) { const missing = [0, 1, 2, 3].find(s => !present.includes(s)); return { kind: 'T', key: 'T:' + missing, faces: [missing] }; }
    if (k === 2) {
      const d = Math.abs(present[0] - present[1]);
      if (d === 2) { // in-line pair: exposed faces need T trims only when the node has a third leg (p22: in-line skins hide the junction)
        if (nLegs < 3) return { kind: null };
        const empties = [0, 1, 2, 3].filter(s => !present.includes(s)); return { kind: 'TT', pieces: empties.map(e => ({ kind: 'T', key: 'T:' + e })) }; }
      return { kind: 'L', key: 'L:' + present.join(',') };
    }
    return { kind: 'EOR', key: 'EOR:' + present[0] };
  }
  E.bandPlan = function (legs, fam, heightOf) {
    // heightOf(leg) -> top height used for the plan (total height)
    const tops = uniq(legs.map(heightOf)).sort((a, b) => a - b);
    const levels = [0, ...tops];
    const pieces = []; // merged by key
    const open = {};
    for (let i = 0; i < levels.length - 1; i++) {
      const lo = levels[i], hi = levels[i + 1];
      const present = legs.filter(l => heightOf(l) >= hi).map(l => l.slot).sort((a, b) => a - b);
      const sh = shapeOf(present, fam, legs.length);
      const list = sh.kind === 'TT' ? sh.pieces : (sh.kind ? [sh] : []);
      const keysNow = new Set(list.map(x => x.key));
      for (const k in open) if (!keysNow.has(k)) { pieces.push(open[k]); delete open[k]; }
      for (const x of list) { if (open[x.key]) open[x.key].to = hi; else open[x.key] = { kind: x.kind, key: x.key, from: lo, to: hi }; }
    }
    for (const k in open) pieces.push(open[k]);
    // cap & aligners (p50-51 Step 10)
    const maxH = tops[tops.length - 1];
    const tallest = legs.filter(l => heightOf(l) === maxH);
    const second = tops.length > 1 ? legs.filter(l => heightOf(l) === tops[tops.length - 2]) : [];
    let cap = null, aligners = 0;
    if (fam === 120) {
      if (legs.length >= 2) { cap = '120'; aligners = Math.max(0, tallest.length - 1); } // 120° cap has one integral aligner (p388)
    } else if (legs.length >= 2 && !(legs.length === 2 && Math.abs(legs[0].slot - legs[1].slot) === 2)) {
      // in-line junctions never take a junction cap (p352, p357: the end-of-run change-of-height trim carries its own aligner)
      if (tallest.length === 1 && tops.length > 1) { cap = '90COH'; aligners = second.length; }
      else { cap = '90'; aligners = tallest.length; }
    }
    // change-of-height aligners (p51 Step 13)
    const kinds = new Set(pieces.map(p => p.kind));
    const ltAligner = kinds.has('L') && kinds.has('T') && pieces.some(p => p.kind === 'L' && p.from > 0);
    const vAligner = kinds.has('120') && kinds.has('V');
    return { pieces, cap, aligners, ltAligner, vAligner, tops, maxH };
  };

  // ---------- BOM line helper ----------
  function Line(cat, qty, row, product, desc, spec, extra) {
    const l = Object.assign({ cat, qty, style: row ? row.style : extra.style, desc, spec: spec || '', unit: row ? row.price : (extra.unit || 0), page: (row && (row.page || (row.attrs && row.attrs.page))) || (product ? product.pages[0] : ((extra && extra.page) || '')), pid: product ? product.id : '', notes: [], flags: [], src: '', optPrices: [] }, extra || {});
    if (row && row.correction) l.flags.push('CORRECTED: ' + row.correction);
    if (row && row.note) l.notes.push(row.note);
    return l;
  }
  // A part sold only in packages (p387-388: aligners by 10 or 4, light seals by 4) is listed where it goes as pieces, unpriced
  // (piece: true), and ordered once for the whole job by rollupPackages() at the package price.
  function pieceLine(cat, n, row, product, name, spec, ctx) {
    const count = row && row.attrs && row.attrs.count || 1;
    const l = Line(cat, n, row, product, `${name} — pieces (ordered once for the job as ${row ? row.style : '—'}, package of ${count})`, spec, { src: ctx, unit: 0, piece: true, pack: count });
    return l;
  }
  function rollupPackages(lines) {
    const groups = new Map();
    for (const l of lines) { if (!l.piece || !l.style || l.style === '—') continue; const k = l.style + '|' + l.spec; const g = groups.get(k) || { lines: [], n: 0 }; g.lines.push(l); g.n += l.qty; groups.set(k, g); }
    for (const g of groups.values()) {
      const l0 = g.lines[0], row = E.rowsByStyle(l0.style).find(r => r._pid === l0.pid) || E.rowsByStyle(l0.style)[0], prod = BYID[l0.pid];
      const packs = Math.ceil(g.n / l0.pack);
      const name = l0.desc.replace(/ — pieces \(.*$/, '');
      const pl = Line(l0.cat, packs, row, prod, `${name} — package of ${l0.pack}: ${g.n} needed on the job`, l0.spec, { src: 'project' });
      pl.notes.push(`Ordered once for the job (p387-388 packages). Pieces go to: ${g.lines.map(x => `${x.src} ×${x.qty}`).join(', ')}.`);
      for (const x of g.lines) for (const f of x.flags) if (!pl.flags.includes(f)) pl.flags.push(f);
      lines.push(pl);
    }
  }
  function addOpt(l, product, code, row, label) {
    // apply an option: adds price and spec text
    const o = E.option(product, code); if (!o) { l.flags.push(`Option ${code} not offered on ${product.name} (p${product.pages[0]})`); return; }
    const pr = E.optionPrice(product, code, row);
    if (pr === null || pr === undefined) l.flags.push(`Option "${o.name}" has no price for this size (p${product.pages[0]})`); else { l.unit += pr; l.optPrices.push(pr); }
    l.spec += (l.spec ? '; ' : '') + (label || o.name) + (pr ? ` (${pr > 0 ? '+' : '–'}$${Math.abs(pr)})` : '');
  }
  function paintSpec(F) { return `paint ${F.trimPaint.code} ${F.trimPaint.name}`; }
  function woodSpec(F) { return `wood ${F.wood.code} ${F.wood.name}`; }

  // ---------- THIN junction BOM ----------
  function thinTrimPieces(J, plan, lines, P, F, ctx) {
    // convert band pieces to thin trim style numbers
    const wood = F.woodTrim, W = wood ? 'W' : '';
    const finish = wood ? woodSpec(F) : paintSpec(F);
    const pg = wood ? null : E.paintGroupCode(F.trimPaint);
    for (const pc of plan.pieces) {
      const span = pc.to - pc.from;
      if (pc.from === 0) {
        // vertical trim, full height (p380-382)
        const map = { EOR: ['thin-end-of-run-vertical-trim', null], L: ['thin-l-t-vertical-trim', 'L'], T: ['thin-l-t-vertical-trim', 'T'], V: ['thin-v-vertical-trim', null] };
        if (!map[pc.kind]) continue;
        const [pid, jt] = map[pc.kind]; const prod = BYID[pid];
        const row = findRow(pid, r => r.attrs.height === pc.to && (jt ? r.attrs.junctionType === jt : true) && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')));
        if (!row) { lines.push(Line('Trim', 1, null, prod, `${pc.kind} vertical trim ${pc.to}"H`, finish, { style: '—', flags: [`No ${pc.kind} vertical trim at ${pc.to}"H in the guide (p${prod.pages[0]}). Verify.`], src: ctx })); continue; }
        const l = Line('Trim', 1, row, prod, `${pc.kind === 'EOR' ? 'End-of-run' : pc.kind} vertical trim ${pc.to}"H — Thin`, finish, { src: ctx });
        if (pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
        lines.push(l);
      } else {
        // change-of-height trims (2022 p383-2022 p385): split spans > 36 or non-standard. The guide's own example trims a 42" change of height as 30 + 12
        // (2015 2022 p43); the 6"H trim (2022 2022 p24, 2022 p383) is used only where the difference needs it, so the split is tried without it first.
        const parts0 = splitSpan(span, E.COH_TRIM_HEIGHTS); const parts = parts0.flag ? splitSpan(span, E.COH_TRIM_HEIGHTS_THIN) : parts0;
        if (parts.flag) { const msg = `A ${span}" change-of-height (${pc.from}"→${pc.to}") cannot be trimmed: change-of-height trims come 6/12/18/24/30/36"H (2022 p383-385). Change a panel height.`; lines.push(Line('Trim', 0, null, null, `Change-of-height ${span}" cannot be trimmed`, '', { style: '—', unit: 0, flags: [msg], src: ctx })); runError({ node: ctx, msg }); }
        let at0 = pc.from;
        for (const h of parts.parts) {
          const map = { EOR: ['thin-end-of-run-inline-change-of-height-trim', null, 'End-of-run/in-line change-of-height trim'], L: ['thin-90-corner-change-of-height-trim', 'L', 'L corner change-of-height trim'], T: ['thin-90-corner-change-of-height-trim', 'T', 'T corner change-of-height trim'], '120': ['thin-120-corner-change-of-height-trim', '120°', '120° corner change-of-height trim'], V: ['thin-120-corner-change-of-height-trim', 'V', 'V corner change-of-height trim'] };
          const [pid, ct, nm] = map[pc.kind]; const prod = BYID[pid];
          const row = findRow(pid, r => r.attrs.stackHeight === h && (ct ? r.attrs.cornerType === ct : true) && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')));
          if (!row) { lines.push(Line('Trim', 1, null, prod, `${nm} ${h}"H`, finish, { style: '—', flags: ['Not found in guide'], src: ctx })); continue; }
          const l = Line('Trim', 1, row, prod, `${nm} ${h}"H (${parts.split ? `${at0}"→${at0 + h}" of ` : ''}${pc.from}"→${pc.to}") — Thin`, finish, { src: ctx }); at0 += h;
          if (parts.split) l.notes.push(`No single ${span}" change-of-height trim: two or more trims stacked, ${parts.parts.join('" + ')}" (12/18/24/30/36"H available, p383-385).`);
          if (pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
          lines.push(l);
        }
      }
    }
    // caps and aligners (p388)
    if (plan.cap) {
      const app = plan.cap === '120' ? '120° corner' : plan.cap === '90COH' ? '90° change-of-height corner' : '90° corner';
      const prod = BYID['thin-junction-caps'];
      const row = findRow('thin-junction-caps', r => r.attrs.application === app && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')));
      const l = Line('Junction', 1, row, prod, `Junction cap, ${app} — Thin`, finish, { src: ctx });
      if (pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
      lines.push(l);
      if (plan.aligners > 0) {
        const arow = findRow('thin-junction-cap-and-trim-aligners', r => r.style === 'TS7CJCA10');
        const al = pieceLine('Junction', plan.aligners, arow, BYID['thin-junction-cap-and-trim-aligners'], `Junction cap aligner`, 'black plastic', ctx);
        al.notes.push('Number of aligners this junction needs, as the guide lists it in its practice examples (p45, p50-51 Step 10).');
        lines.push(al);
      }
    }
    if (plan.ltAligner) lines.push(pieceLine('Junction', 1, findRow('thin-junction-cap-and-trim-aligners', r => r.style === 'TS7LTA4'), BYID['thin-junction-cap-and-trim-aligners'], 'L to T vertical trim aligner', 'black plastic', ctx));
    if (plan.vAligner) lines.push(pieceLine('Junction', 1, findRow('thin-junction-cap-and-trim-aligners', r => r.style === 'TS7120VA4'), BYID['thin-junction-cap-and-trim-aligners'], '120° to V vertical trim aligner', 'black plastic', ctx));
  }
  // a stacked span in stacking junction heights: 12/18/24" combine (p41: at most two, 36" in all); the 6"H stacker stands alone on a base
  // junction (p41), so it is used only when the span is exactly 6". The same sizes are the oval stacking change-of-height trims (p496).
  const STACK_SPLIT = [12, 18, 24];
  function stackSplit(span) { return span === 6 ? { parts: [6], flag: false, split: false } : splitSpan(span, STACK_SPLIT); }
  E.stackSplit = stackSplit;
  // exact split of a span into available sizes: fewest pieces, then largest pieces first (e.g. 42 -> 24+18, 30 -> 18+12).
  // flag is true only when no combination exists (parts is then empty); a possible split is never flagged here.
  function splitSpan(span, avail) {
    if (avail.includes(span)) return { parts: [span], flag: false, split: false };
    const desc = uniq(avail).sort((a, b) => b - a);
    for (let n = 2; n <= 6; n++) {
      // combinations with repetition, non-increasing, visited largest-first so the first hit is the preferred one
      const walk = (i, left, rem, acc) => {
        if (left === 0) return rem === 0 ? acc.slice() : null;
        for (let k = i; k < desc.length; k++) { if (desc[k] * left < rem) break; if (desc[k] > rem) continue; acc.push(desc[k]); const r = walk(k, left - 1, rem - desc[k], acc); acc.pop(); if (r) return r; }
        return null;
      };
      const hit = walk(0, n, span, []);
      if (hit) return { parts: hit, flag: false, split: true };
    }
    return { parts: [], flag: true, split: false };
  }
  E.splitSpan = splitSpan;
  function lightSeals(J, plan, lines, ctx, count) {
    // p41 Step 4, p387: packages of four, 54/66/78, field cut for shorter
    const need = count;
    if (!need) return;
    // p41: height corresponds to the tallest junction, field cut for shorter. p45 examples use 66" for 54" and 66" tallest,
    // so the seal is never specified below 66" (a longer seal can be cut, a shorter one cannot be stretched).
    const h = [54, 66, 78].find(x => x >= Math.max(66, plan.maxH)) || 78;
    const row = findRow('thin-inside-corner-light-seals', r => r.attrs.height === h);
    const l = pieceLine('Junction', need, row, BYID['thin-inside-corner-light-seals'], `Inside corner light seal ${h}"H`, 'black plastic', ctx);
    if (plan.maxH < h) l.notes.push(`Field cut to the ${plan.maxH}" junction height (p35, p41).`);
    if (plan.maxH > h) l.flags.push(`Light seal ${h}"H is ${plan.maxH - h}" shorter than the ${plan.maxH}" junction: tallest seal offered is 78"H (p35, p387). Verify with Steelcase.`);
    lines.push(l);
  }
  function junctionBlocks(fam, count, lines, ctx, why) {
    // p387: packages of 3, 4 or 5; pick the cheapest mix that covers the count (ties: fewer blocks, then fewer packages)
    const app = fam === 120 ? '120°' : '90°';
    const rows = rowsOf('thin-junction-blocks').filter(r => r.attrs.application === app).sort((a, b) => b.attrs.count - a.attrs.count);
    let best = null; const max = Math.ceil(count / 3) + 1;
    const walk = (i, left, pick) => {
      if (i === rows.length) { const n = pick.reduce((a, q, k) => a + q * rows[k].attrs.count, 0); if (n < count) return; const cost = pick.reduce((a, q, k) => a + q * rows[k].price, 0), pk = sum(pick);
        if (!best || cost < best.cost || (cost === best.cost && (n < best.n || (n === best.n && pk < best.pk)))) best = { cost, n, pk, pick: pick.slice() }; return; }
      for (let q = 0; q <= left; q++) { pick.push(q); walk(i + 1, left - q, pick); pick.pop(); }
    };
    walk(0, max, []);
    const packs = best.pick.map((q, k) => [q, rows[k]]).filter(x => x[0] > 0);
    for (const [q, row] of packs) {
      const l = Line('Junction', q, row, BYID['thin-junction-blocks'], `${app} junction blocks (package of ${row.attrs.count}) — ${count} needed${packs.length > 1 ? ` (${packs.map(x => x[0] + '×' + x[1].attrs.count).join(' + ')})` : ''}`, 'black paint', { src: ctx });
      if (why) l.notes.push(why);
      lines.push(l);
    }
  }
  function stackingPieces(J, lines, P, ctx, coversUpTo) {
    // stacking junction hardware by band above each leg's base (p48-51); coversUpTo(leg) = height already covered by the base junction hardware
    const fam = J.family, legs = J.legs;
    // band edges at every stacker top so each stacking junction matches a real stacker (p33: one junction per 12/18/24 stacker)
    const tops = legs.flatMap(l => l.stack.map((s, k) => l.base + sum(l.stack.slice(0, k + 1))));
    // cut only at the stacked legs' own tiers (p49 Step 7: look at each stacked panel individually); an unstacked neighbor's top is a
    // post beside the stacker, not a reason to split it (a 48"+12" stacker next to a 54" panel is one 12" stacking junction, not 6"+6")
    const stacked = legs.filter(l => l.stack.length);
    const levels = uniq([...stacked.map(l => l.base), ...stacked.map(l => coversUpTo(l)).filter(x => stacked.some(l => x > l.base && x < l.total)), ...tops]).sort((a, b) => a - b);
    const minBase = Math.min(...legs.map(l => l.base));
    let blocksNeeded = 0;
    for (let i = 0; i < levels.length - 1; i++) {
      const lo = levels[i], hi = levels[i + 1]; if (lo < minBase) continue;
      const present = legs.filter(l => l.total >= hi);
      const posts = legs.filter(l => coversUpTo(l) >= hi);
      const stackLegs = present.filter(l => !posts.includes(l));
      if (!stackLegs.length) continue;
      const beside = legs.filter(l => !stackLegs.includes(l) && !posts.includes(l) && coversUpTo(l) > lo); // shorter post alongside part of the band
      const span = hi - lo;
      const slots = stackLegs.map(l => l.slot).sort((a, b) => a - b);
      let type;
      if (fam === 120) type = slots.length === 3 ? 'Y' : slots.length === 2 ? 'V' : 'EOR';
      else if (slots.length === 4) type = 'X'; else if (slots.length === 3) type = 'T'; else if (slots.length === 2) type = Math.abs(slots[0] - slots[1]) === 2 ? 'inline' : 'L'; else type = J.node.wallStart && J.type === 'wall' ? 'wall' : 'EOR';
      // p375: the 36" end-of-run stacker is for build-your-own in-line change-of-height only, never as a stacking junction
      const parts = stackSplit(span);
      // p49 Step 7 (Note 1, 3): an in-line pair of stackers over a thin T or X base takes one end-of-run stacking junction per panel, tied with junction blocks (p50 Step 9)
      const eorPair = P.trim === 'thin' && type === 'inline' && J.type !== 'inline';
      for (const leg of eorPair ? stackLegs : [null]) {
        let at = lo;
        for (const h of parts.parts) {
          pushStackingJunction(P, eorPair ? 'EOR' : type, h, lines, ctx, `${at}"→${at + h}"${eorPair ? `, ${leg.panel.label || leg.panel.id}` : ''}`, null);
          at += h;
        }
      }
      if (parts.flag) { const msg = `A ${span}" stacking band (${lo}"→${hi}") at ${ctx} cannot be built: stacking junctions are 12/18/24"H (p375-376).`; lines.push(Line('Stacking', 0, null, null, `Stacking band ${span}" cannot be built`, '', { style: '—', unit: 0, flags: [msg], src: ctx })); runError({ node: ctx, msg }); }
      if (eorPair && !posts.length) blocksNeeded += slots.length; // p50 Step 9: two stacking junctions adjacent in a corner
      if ((posts.length || beside.length) && fam) blocksNeeded += slots.length; // stacker adjacent to a post in a corner: blocks tie them (p50 Step 9)
    }
    return blocksNeeded;
  }
  function pushStackingJunction(P, type, h, lines, ctx, band, flag) {
    const thin = P.trim === 'thin';
    let pid, pred, name;
    if (thin) {
      if (type === 'inline') { pid = 'thin-stacking-inline-end-of-run-wall-start-junctions'; pred = r => r.attrs.stackHeight === h && r.style.includes('IPJS'); name = 'Stacking in-line junction'; }
      else if (type === 'EOR') { pid = 'thin-stacking-inline-end-of-run-wall-start-junctions'; pred = r => r.attrs.stackHeight === h && r.style.includes('TEPJS'); name = 'Stacking end-of-run junction — Thin'; }
      else if (type === 'wall') { pid = 'thin-stacking-inline-end-of-run-wall-start-junctions'; pred = r => r.attrs.stackHeight === h && r.style.includes('WPJS'); name = 'Stacking wall-start junction'; }
      else { pid = 'thin-stacking-l-t-x-v-y-junction'; pred = r => r.attrs.stackHeight === h && r.attrs.junctionType === type; name = `Stacking ${type} junction — Thin`; }
    } else {
      if (type === 'inline') { pid = 'so-stacking-inline-junction'; pred = r => r.attrs.stackHeight === h; name = 'Stacking in-line junction'; }
      else if (type === 'EOR') { pid = 'so-stacking-end-of-run-junction'; pred = r => r.attrs.stackHeight === h && !r.style.endsWith('W'); name = 'Stacking end-of-run junction — Oval'; }
      else if (type === 'wall') { pid = 'sh-stacking-wall-start-junction'; pred = r => r.attrs.stackHeight === h; name = 'Stacking wall-start junction'; }
      else if (type === 'V' || type === 'Y') { pid = 'so-stacking-v-y-junction'; pred = r => r.attrs.stackHeight === h && r.attrs.junctionType === type && !r.style.endsWith('W'); name = `Stacking ${type} junction — Oval`; }
      else { pid = 'so-stacking-l-t-x-junction'; pred = r => r.attrs.stackHeight === h && r.attrs.junctionType === type && !r.style.endsWith('W'); name = `Stacking ${type} junction — Oval`; }
    }
    const prod = BYID[pid]; const row = findRow(pid, pred);
    if (!row) { lines.push(Line('Stacking', 1, null, prod, `${name} ${h}"H`, '', { style: '—', flags: [`No ${h}" ${type} stacking junction in the guide.`], src: ctx })); return; }
    const l = Line('Stacking', 1, row, prod, `${name} ${h}"H (${band})`, thin ? 'black paint' : '', { src: ctx });
    if (flag) l.flags.push(flag);
    if (!thin && (type === 'L' || type === 'T' || type === 'EOR' || type === 'V')) {
      const F = P.finishes; addOpt(l, prod, E.paintGroupCode(F.trimPaint), row, `trim paint ${F.trimPaint.code} ${F.trimPaint.name}, group ${F.trimPaint.group}`);
    }
    lines.push(l);
  }

  function thinJunctionBOM(P, J, lines, warn) {
    const F = P.finishes, ctx = J.node.id, wood = F.woodTrim;
    const legs = J.legs;
    const bases = uniq(legs.map(l => l.base)).sort((a, b) => a - b);
    const anyStack = legs.some(l => l.stack.length);
    const totals = uniq(legs.map(l => l.total)).sort((a, b) => a - b);
    const pg = wood ? null : E.paintGroupCode(F.trimPaint);
    const finish = wood ? woodSpec(F) : paintSpec(F);
    const plan = J.family ? E.bandPlan(legs, J.family, l => l.total) : null;
    const W = wood ? 'W' : '';
    // p357 tip: stacking horizontal frame package with an in-line change-of-height, unless a window is in the top position of the taller panel
    const cohFrame = (tall) => {
      const top = tall.stack.length && tall.stackSides[tall.stack.length - 1] ? tall.stackSides[tall.stack.length - 1][0] : tall.sides[0];
      if (top.length && top[top.length - 1].kind === 'window') return;
      // p50 Step 8: stacking junctions on both sides of a panel share one stacking horizontal frame package. The taller panel's own stacking
      // tier already carries one (panelBOM), and a panel with change-of-height junctions at both ends needs only one for both.
      const jl = lines.filter(x => x.src === ctx && x.cat === 'Junction').pop();
      const shared = tall.stack.length ? `the stacking horizontal frame package on ${tall.label || tall.id}'s stacking tier` : RUN && RUN.cohFramed.has(tall.id) ? `the one ordered for ${tall.label || tall.id} at its other change-of-height junction` : null;
      if (shared) { if (jl) jl.notes.push(`Stacking horizontal frame package (p357 tip): shared with ${shared} (p50 Step 8).`); return; }
      if (RUN) RUN.cohFramed.add(tall.id);
      const r2 = findRow('thin-stacking-horizontal-frame-package', r => r.attrs.width === tall.width);
      lines.push(Line('Frame', 1, r2, BYID['thin-stacking-horizontal-frame-package'], `Stacking horizontal frame package ${tall.width}"W (supports in-line change-of-height stacker, p357)`, 'black paint', { src: ctx }));
    };

    if (J.type === 'wall') {
      const h = legs[0].base;
      const row = findRow('sh-wall-start-junction', r => r.attrs.height === h);
      // 2022: the wall-start table prices 30"H and 36"H (2022 p372) and the off-module page lists 30"H (2022 p30), while the base junction page keeps the
      // note that wall-start junctions are not available at the 28 7/16" post height (2022 p20). The priced part is specified, with the note as a flag.
      const wl = Line('Junction', 1, row, BYID['sh-wall-start-junction'], `Wall-start junction ${h}"H`, 'black paint', row ? { src: ctx } : { style: '—', unit: 0, flags: [`No ${h}"H wall-start junction in the guide (2022 p20, 2022 p372). Use an end-of-run junction or change the panel height.`], src: ctx });
      if (h === 30 && row) wl.flags.push('30"H wall-start: priced on 2022 p372 and listed on 2022 p30, but 2022 p20 still notes wall-start junctions are not available at the 28 7/16" post height. Verify with Steelcase.');
      lines.push(wl);;
      // stackers on a wall-start
      for (const s of legs[0].stack) pushStackingJunction(P, 'wall', s, lines, ctx, 'stacker', null);
      return;
    }
    if (J.type === 'EOR') {
      const h = legs[0].base;
      const prod = BYID['thin-end-of-run-base-junction'];
      const row = findRow('thin-end-of-run-base-junction', r => r.attrs.height === h && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')));
      const l = Line('Junction', 1, row, prod, `End-of-run base junction ${h}"H — Thin ${wood ? 'wood' : 'painted'} trim`, finish, { src: ctx });
      if (pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
      if (anyStack) { addOpt(l, prod, 'omitTrim', row, 'omit trim (stacking)'); }
      lines.push(l);
      if (anyStack) {
        stackingPieces(J, lines, P, ctx, l2 => l2.base);
        thinTrimPieces(J, { pieces: [{ kind: 'EOR', from: 0, to: legs[0].total }], cap: null, aligners: 0 }, lines, P, F, ctx);
      }
      return;
    }
    if (J.type === 'unsupported' || !J.family) return;

    // ---- in-line change-of-height to a panel stacked to 90": pre-configured rows 54/90, 66/90, 78/90 (p25, p357) ----
    if (J.type === 'inline') {
      const low = legs.find(l => !l.stack.length), tall = legs.find(l => l !== low);
      const row = low && tall.total === 90 && tall.base >= low.base ? findRow('thin-inline-change-of-height-junction', r => r.attrs.heightA === low.base && r.attrs.heightB === 90 && (wood ? r.style.endsWith('W') : !r.style.endsWith('W'))) : null;
      if (row) {
        const prod = BYID['thin-inline-change-of-height-junction'];
        const l = Line('Junction', 1, row, prod, `In-line change-of-height junction ${low.base}"/90"H — Thin ${wood ? 'wood' : 'painted'} trim`, finish, { src: ctx });
        if (pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
        l.notes.push(`Includes ${low.base}"H in-line base junction, ${90 - low.base}" end-of-run stacking junction, stacking fork, end-of-run change-of-height trim and aligner (p357). The ${tall.base}"H panel's stacker(s) connect to it; no separate stacking junction or trim at this junction.`);
        lines.push(l); cohFrame(tall.panel);
        return;
      }
    }

    // ---- same-height base junction (p352-356) ----
    if (bases.length === 1) {
      const h = bases[0], t = J.type;
      let pid, pred, name;
      if (t === 'inline') { pid = 'thin-inline-base-junction'; pred = r => r.attrs.height === h; name = 'In-line base junction'; }
      else if (t === 'X') { pid = 'thin-x-same-height-base-junction'; pred = r => r.attrs.height === h && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')); name = 'X same-height base junction'; }
      else if (t === 'L' || t === 'T') { pid = 'thin-l-t-same-height-base-junction'; pred = r => r.attrs.height === h && r.attrs.junctionType === t && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')); name = `${t} same-height base junction`; }
      else { pid = 'thin-v-y-same-height-base-junction'; pred = r => r.attrs.height === h && r.attrs.junctionType === t && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')); name = `${t} same-height base junction`; }
      const prod = BYID[pid]; const row = findRow(pid, pred);
      const l = Line('Junction', 1, row, prod, `${name} ${h}"H — Thin${t === 'inline' ? '' : (wood ? ' wood' : ' painted') + ' trim'}`, t === 'inline' ? 'black paint (hidden)' : finish, { src: ctx });
      if (t !== 'inline' && t !== 'X' && pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
      if (anyStack && t !== 'inline') addOpt(l, prod, 'omitTrim', row, 'omit trim (stacking)');
      lines.push(l);
      if (anyStack) {
        const blocks = stackingPieces(J, lines, P, ctx, l2 => l2.base);
        thinTrimPieces(J, plan, lines, P, F, ctx);
        if (t !== 'inline') lightSeals(J, plan, lines, ctx, t === 'X' ? 4 : t === 'T' ? 2 : t === 'L' ? 1 : 0);
        if (blocks && J.family) junctionBlocks(J.family, blocks, lines, ctx, 'Blocks tie stacking junctions to adjacent taller posts in a corner (p50 Step 9). Verify quantity.');
      }
      return;
    }

    // ---- two base heights: pre-configured change-of-height junction (p357/358/360/364/368/370) ----
    if (bases.length === 2) {
      const lo = bases[0], hi = bases[1], t = J.type;
      const tallSlots = legs.filter(l => l.base === hi).map(l => l.slot);
      let pid, pred, name, cfg = '';
      if (t === 'inline') { pid = 'thin-inline-change-of-height-junction'; pred = r => r.attrs.heightA === lo && r.attrs.heightB === hi; name = 'In-line change-of-height junction'; }
      else if (t === 'L') { pid = 'thin-l-change-of-height-junction'; pred = r => r.attrs.heightA === lo && r.attrs.heightB === hi; name = 'L change-of-height junction'; }
      else if (t === 'V') { pid = 'thin-v-change-of-height-junction'; pred = r => r.attrs.heightA === lo && r.attrs.heightB === hi; name = 'V change-of-height junction'; }
      else if (t === 'T') {
        // spine = the two opposite legs; leg B = perpendicular. Slots: find the pair with diff 2.
        const spine = legs.filter(a => legs.some(b => Math.abs(a.slot - b.slot) === 2));
        const perp = legs.find(a => !spine.includes(a));
        const tallCount = legs.filter(l => l.base === hi).length;
        if (tallCount === 1 && perp.base === hi) cfg = 'B tall'; // p360
        else if (tallCount === 2 && perp.base === lo) cfg = 'A and C tall'; // p360 upper
        else if (tallCount === 1) cfg = 'C tall'; // p360 lower (one spine end tall; A-tall is the mirrored hand)
        else cfg = 'A and B tall'; // p360 (one spine end + perpendicular tall)
        pid = 'thin-t-change-of-height-junction'; name = 'T change-of-height junction';
        pred = r => r.attrs.configuration.startsWith(cfg) && Math.min(r.attrs.heightA, r.attrs.heightB, r.attrs.heightC) === lo && Math.max(r.attrs.heightA, r.attrs.heightB, r.attrs.heightC) === hi;
      } else if (t === 'X') {
        const n = tallSlots.length;
        if (n === 2) cfg = Math.abs(tallSlots[0] - tallSlots[1]) === 2 ? 'B and D tall' : 'C and D tall';
        else if (n === 1) cfg = 'D tall'; else cfg = 'A, B and C tall';
        pid = 'thin-x-change-of-height-junction'; name = 'X change-of-height junction';
        pred = r => r.attrs.configuration.startsWith(cfg) && Math.min(r.attrs.heightA, r.attrs.heightB, r.attrs.heightC, r.attrs.heightD) === lo && Math.max(r.attrs.heightA, r.attrs.heightB, r.attrs.heightC, r.attrs.heightD) === hi;
      } else { // Y
        cfg = tallSlots.length === 1 ? 'A tall' : 'B and C tall';
        pid = 'thin-y-change-of-height-junction'; name = 'Y change-of-height junction';
        pred = r => r.attrs.configuration.startsWith(cfg) && Math.min(r.attrs.heightA, r.attrs.heightB, r.attrs.heightC) === lo && Math.max(r.attrs.heightA, r.attrs.heightB, r.attrs.heightC) === hi;
      }
      const prod = BYID[pid];
      const row = findRow(pid, r => pred(r) && (wood ? r.style.endsWith('W') : !r.style.endsWith('W')));
      if (row) {
        const l = Line('Junction', 1, row, prod, `${name} ${lo}"/${hi}"H${cfg ? ` (${cfg})` : ''} — Thin ${wood ? 'wood' : 'painted'} trim`, finish, { src: ctx });
        if (pg) addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
        if (anyStack) addOpt(l, prod, 'omitTrim', row, 'omit trim (stacking)');
        const tips = (prod.tips || []).filter(x => x.toLowerCase().includes('handed'));
        // L and V always ship right-handed (p358, p368); T only when A and C differ, i.e. "C tall" and "A and B tall" (p360)
        if (tips.length && (t === 'L' || t === 'V' || (t === 'T' && (cfg === 'C tall' || cfg === 'A and B tall')))) l.notes.push(`Junction is handed. The other hand is achieved in the field by moving a post (${t === 'L' ? 'p25, p358' : t === 'V' ? 'p28, p368' : 'p26, p360'}).`);
        if (t === 'inline') { l.notes.push('Includes in-line base junction, end-of-run stacking junction, stacking fork, end-of-run change-of-height trim and aligner (p357).'); }
        lines.push(l);
        if (t === 'inline') cohFrame(legs.find(l2 => l2.base === hi).panel);
        if (anyStack) {
          const blocks = stackingPieces(J, lines, P, ctx, l2 => (t === 'inline' && l2.base === lo) ? hi : l2.base); // TCIJ already includes the EOR stacker up to hi
          thinTrimPieces(J, plan, lines, P, F, ctx);
          if (J.family === 90) lightSeals(J, plan, lines, ctx, t === 'X' ? 4 : t === 'T' ? 2 : t === 'L' ? 1 : 0);
          if (blocks) junctionBlocks(J.family, blocks, lines, ctx, 'Blocks tie stacking junctions to adjacent taller posts in a corner (p50 Step 9). Verify quantity.');
        }
        return;
      }
      lines.push(Line('Junction', 0, null, prod, `${name} ${lo}"/${hi}"`, '', { style: '—', unit: 0, flags: [`No pre-configured ${t} change-of-height junction for ${lo}"/${hi}"${cfg ? ` (${cfg})` : ''}. ${t === 'inline' ? 'Built from an in-line base junction and end-of-run stacking junctions below (p357, p375).' : 'Built from posts below.'}`], src: ctx }));
    }

    // ---- Build Your Own (3+ heights, or unsupported combination) p40-45 ----
    if (J.type === 'inline' && bases.length === 2) {
      // in-line change-of-height not in the list: in-line base junction at lower height + end-of-run stacker + EOR CoH trim (p357 composition)
      const lo = bases[0], hi = bases[1];
      const r = findRow('thin-inline-base-junction', x => x.attrs.height === lo);
      lines.push(Line('Junction', 1, r, BYID['thin-inline-base-junction'], `In-line base junction ${lo}"H (BYO in-line change-of-height)`, 'black paint', { src: ctx }));
      const parts = splitSpan(hi - lo, [12, 18, 24, 36]); let at = lo;
      if (parts.flag) {
        const msg = `In-line change-of-height ${lo}"/${hi}" at ${ctx} cannot be built: there is no pre-configured ${lo}"/${hi}" junction (p357), and building it needs ${hi - lo}" of end-of-run stacking junctions over the ${lo}"H in-line junction, and stacking junctions come 12/18/24/36"H only (p375). Change a panel height.`;
        lines.push(Line('Junction', 0, null, null, `In-line change-of-height ${lo}"/${hi}" cannot be built`, '', { style: '—', unit: 0, flags: [msg], src: ctx })); runError({ node: ctx, msg });
        return;
      }
      for (const h of parts.parts) { pushStackingJunction(P, 'EOR', h, lines, ctx, `${at}"→${at + h}"`, 'Used as the change-of-height stacker in a build-your-own in-line change-of-height (p375 tip).'); at += h; }
      cohFrame(legs.find(l2 => l2.base === hi).panel);
      stackingPieces(J, lines, P, ctx, l2 => l2.base === lo ? hi : l2.base);
      thinTrimPieces(J, plan, lines, P, F, ctx);
      return;
    }
    // posts (p386) one per leg at its base height
    for (const l of legs) {
      const r = findRow('thin-junction-post', x => x.attrs.height === l.base);
      lines.push(Line('Junction', 1, r, BYID['thin-junction-post'], `Junction post ${l.base}"H (leg ${l.panel.label || l.panel.id}, BYO)`, 'black paint', { src: ctx }));
    }
    // blocks (p41 Step 3)
    const n = legs.length, minB = bases[0], maxB = bases[bases.length - 1];
    const tallCount = legs.filter(l => l.base === maxB).length;
    let blocks;
    if (J.type === 'X') {
      if (bases.length === 4) blocks = 4;
      else if (tallCount === 2 && maxB === 78 && minB === 54) blocks = 5;
      else if (minB <= 48 && tallCount === 1) blocks = 3;
      else blocks = 4;
    } else blocks = minB <= 48 ? 3 : 4; // T and Y
    blocks += stackingPieces(J, lines, P, ctx, l2 => l2.base);
    junctionBlocks(J.family, blocks, lines, ctx, 'Build-your-own change-of-height junction (p41 Step 3).');
    thinTrimPieces(J, plan, lines, P, F, ctx);
    if (J.family === 90) lightSeals(J, plan, lines, ctx, J.type === 'X' ? 4 : J.type === 'T' ? 2 : 1);
  }

  // ---------- OVAL junction BOM (2015 p76-81, p431-437, p375/376/443, p453-454) ----------
  function ovalJunctionBOM(P, J, lines, warn) {
    const F = P.finishes, ctx = J.node.id, legs = J.legs, woodCap = F.woodTrim;
    const bases = uniq(legs.map(l => l.base)).sort((a, b) => a - b);
    const anyStack = legs.some(l => l.stack.length);
    const pg = E.paintGroupCode(F.trimPaint);
    if (J.type === 'wall') {
      const h = legs[0].base; const wl = Line('Junction', 1, findRow('sh-wall-start-junction', r => r.attrs.height === h), BYID['sh-wall-start-junction'], `Wall-start junction ${h}"H`, 'black paint', { src: ctx });
      if (h === 30) wl.flags.push('30"H wall-start: priced on 2022 p372, but 2022 p20 still notes wall-start junctions are not available at the 28 7/16" post height. Verify with Steelcase.');
      lines.push(wl);
      for (const s of legs[0].stack) pushStackingJunction(P, 'wall', s, lines, ctx, 'stacker', null);
      return;
    }
    if (J.type === 'unsupported' || !J.family) return;
    const hJ = bases[bases.length - 1]; // 2015 p81: specify the tallest height junction at a change-of-height
    let pid, pred, name;
    const t = J.type;
    if (t === 'EOR') { pid = 'oval-end-of-run-base-junction'; pred = r => r.attrs.height === hJ && (woodCap ? r.style.endsWith('W') : !r.style.endsWith('W')); name = 'End-of-run base junction'; }
    else if (t === 'inline') { pid = 'oval-inline-base-junction'; pred = r => r.attrs.height === hJ; name = 'In-line base junction'; }
    else if (t === 'V' || t === 'Y') { pid = 'oval-v-y-base-junction'; pred = r => r.attrs.height === hJ && r.attrs.junctionType === t && (woodCap ? r.style.endsWith('W') : !r.style.endsWith('W')); name = `${t} base junction`; }
    else { pid = 'oval-l-t-x-base-junction'; pred = r => r.attrs.height === hJ && r.attrs.junctionType === t && (woodCap ? r.style.endsWith('W') : !r.style.endsWith('W')); name = `${t} base junction`; }
    const prod = BYID[pid], row = findRow(pid, pred);
    const hasTrim = t === 'EOR' || t === 'L' || t === 'T' || t === 'V';
    const capSpec = woodCap ? `wood junction cap ${F.wood.code} ${F.wood.name}` : `plastic junction cap ${(F.ovalCap || {}).code || '6000'} ${(F.ovalCap || {}).name || 'Black'}`; // p433 p437: plastic or wood color number for the junction cap
    const l = Line('Junction', 1, row, prod, `${name} ${hJ}"H — Oval, ${t === 'inline' ? 'no cap' : (woodCap ? 'wood' : 'plastic') + ' junction cap'}`, t === 'inline' ? 'black paint (hidden)' : (hasTrim && !(F.ovalWoodTrim && woodCap && !F.ovalTrimFabric) ? paintSpec(F) : ''), { src: ctx }); // wood trim replaces the painted trim (p435)
    if (hasTrim) {
      if (F.ovalTrimFabric) { addOpt(l, prod, 'fabricTrim', row, `fabric trim ${F.fabric.code} ${F.fabric.name}`); if (hJ === 78) l.notes.push('78"H fabric-covered junction trim: vertical application only (p433).'); }
      else if (F.ovalWoodTrim && woodCap) addOpt(l, prod, 'woodTrim', row, `wood trim ${F.wood.code} ${F.wood.name}`);
      else addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
    }
    if (t !== 'inline') l.spec += (l.spec ? '; ' : '') + capSpec;
    if (bases.length > 1) l.notes.push(`Change-of-height: tallest-height junction shared by ${bases.join('"/')}" panels (2015 p81).`);
    lines.push(l);
    // stacking junctions (include trim) p375/376/443. The shared oval junction is hJ tall (2015 p81), so stacking starts at hJ: fork connectors go into the
    // top of the base junction (p100) and bars below hJ lock into its slots. Every stacking junction is the base junction's type (p93: "Base junctions
    // can accept a stacking junction of the same type only"); faces where a leg is not stacked are closed with change-of-height trim below.
    // One stacking junction per stacker tier (cut at every tier top above hJ), 12/18/24"H (p375/376/443).
    const topAll = Math.max(...legs.map(l2 => l2.total));
    if (anyStack && topAll > hJ) {
      const n0 = lines.length, st = t === 'inline' ? 'inline' : t;
      const cuts = uniq([hJ, ...legs.flatMap(l2 => l2.stack.map((s, i) => l2.base + sum(l2.stack.slice(0, i + 1)))).filter(x => x > hJ), topAll]).sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const sp = stackSplit(cuts[i + 1] - cuts[i]); let at = cuts[i];
        if (sp.flag) { const msg = `A ${cuts[i + 1] - cuts[i]}" stacking band (${cuts[i]}"→${cuts[i + 1]}") above the shared ${hJ}"H junction at ${ctx} cannot be built: oval stacking junctions are 12/18/24"H and start at the tallest base junction (2015 p81, p375/376/443). Change a panel height or stacker.`; lines.push(Line('Stacking', 0, null, null, `Stacking band ${cuts[i + 1] - cuts[i]}" cannot be built`, '', { style: '—', unit: 0, flags: [msg], src: ctx })); runError({ node: ctx, msg }); }
        for (const h of sp.parts) { pushStackingJunction(P, st, h, lines, ctx, `${at}"→${at + h}"`, null); at += h; }
      }
      // p376/443: stacking L/T/V/end-of-run trim matches the base junction trim: wood trim is its own style (…PJSW), fabric is an option on steel trim
      const woodTr = F.ovalWoodTrim && woodCap;
      if (woodTr || F.ovalTrimFabric) for (const sl of lines.slice(n0)) {
        if (!/^so-stacking-(l-t-x|end-of-run|v-y)-junction$/.test(sl.pid)) continue;
        const prod = BYID[sl.pid], base = E.rowsByStyle(sl.style).find(r => r._pid === sl.pid);
        if (!base || base.attrs.junctionType === 'X' || base.attrs.junctionType === 'Y') continue; // X and Y stacking junctions have no trim
        if (woodTr) { const w = findRow(sl.pid, r => r.style === base.style + 'W'); if (w) { sl.style = w.style; sl.unit = w.price; sl.spec = `wood trim ${F.wood.code} ${F.wood.name}`; } }
        else { sl.unit = base.price; sl.spec = ''; addOpt(sl, prod, 'fabricTrim', base, `fabric trim ${F.fabric.code} ${F.fabric.name}`); }
      }
    }
    // change-of-height trims p453 (standard) / p454 (stacking). Per exposed face the lowest trim sits on the lower panel's top cap and is always
    // standard (rounded bottom edge, 36"H max, 2015 p80-81); it covers up to the first stacked tier. Above it stacking trims (straight bottom, 12/18/24"H),
    // one per stacked tier and for any height over 36" (2015 p81: "When stacking more than one panel … Only the second tier requires stacking change-of-height trim").
    // One trim run per exposed face (p95: the trim is a single 1 1/8"W x 3"D channel in one junction face): every leg lower than the junction
    // top exposes its face from its own top cap up to the junction top. Faces without a panel are closed by the base/stacking junction's own
    // trim (p93, p376/443), so they take no change-of-height trim.
    const profile = P.options.ovalCohProfile || 'Slim Profile';
    const app = (t === 'inline' || t === 'EOR') ? 'in-line application' : 'corner application';
    const tierTops = uniq(legs.flatMap(l2 => l2.stack.map((s, i) => l2.base + sum(l2.stack.slice(0, i + 1))))).sort((a, b) => a - b);
    const jTop = Math.max(...legs.map(l2 => l2.total));
    const lowFaces = legs.filter(l2 => l2.total < jTop).sort((a, b) => a.total - b.total);
    for (const lg of lowFaces) {
      const from = lg.total, to = jTop, face = lg.panel.label || lg.panel.id;
      const cuts = [from, ...tierTops.filter(x => x > from && x < to), to];
      // first tier: standard trim on the top cap (12-36"H), topped up with stacking trims when that tier is taller than 36" (2015 p81, p453-454)
      const seg1 = cuts[1] - from; let stdH = null, rest = [];
      if (E.COH_TRIM_HEIGHTS.includes(seg1)) stdH = seg1;
      else for (const h of E.COH_TRIM_HEIGHTS.slice().sort((x, y) => y - x)) { if (h >= seg1) continue; const sp = splitSpan(seg1 - h, STACK_SPLIT); if (!sp.flag) { stdH = h; rest = sp.parts; break; } }
      const parts = []; let bad = stdH === null;
      if (!bad) { parts.push({ std: true, from, h: stdH }); let at = from + stdH; for (const h of rest) { parts.push({ std: false, from: at, h }); at += h; }
        for (const c of cuts.slice(2)) { const sp = splitSpan(c - at, STACK_SPLIT); if (sp.flag) { bad = true; break; } for (const h of sp.parts) { parts.push({ std: false, from: at, h }); at += h; } } }
      if (bad) { const msg = `The ${to - from}" change-of-height on ${face}'s face at ${ctx} (${from}"→${to}") cannot be trimmed: standard trims are 12-36"H and stacking trims 12/18/24"H (p453-454). Change a panel height.`; lines.push(Line('Trim', 0, null, null, `Change-of-height ${to - from}" cannot be trimmed`, '', { style: '—', unit: 0, flags: [msg], src: ctx })); runError({ node: ctx, msg }); continue; }
      for (const pt of parts) {
        const band = `${pt.from}"→${pt.from + pt.h}", ${face} face`;
        if (pt.std) {
          const prod2 = BYID['oval-standard-change-of-height-trim'];
          const r2 = findRow('oval-standard-change-of-height-trim', r => r.attrs.stackHeight === pt.h && r.attrs.profile === profile && r.attrs.junctionCap === (woodCap ? 'wood' : 'painted'));
          if (!r2) { lines.push(Line('Trim', 1, null, prod2, `Standard change-of-height trim ${pt.h}"H — Oval (${band})`, '', { style: '—', flags: [`No ${pt.h}"H standard change-of-height trim (12/18/24/30/36 available, p453). Verify with Steelcase.`], src: ctx })); continue; }
          const l2 = Line('Trim', 1, r2, prod2, `Standard change-of-height trim ${pt.h}"H, ${profile}, ${woodCap ? 'wood' : 'plastic'} cap — Oval (${band})`, `${app}; ${F.ovalWoodTrim && !F.ovalTrimFabric ? '' : paintSpec(F) + '; '}${woodCap ? `wood cap ${F.wood.code} ${F.wood.name}` : `plastic cap ${(F.ovalCap || {}).code || '6000'} ${(F.ovalCap || {}).name || 'Black'}`}`, { src: ctx });
          if (F.ovalTrimFabric) addOpt(l2, prod2, 'fabricTrim', r2, `fabric trim ${F.fabric.code}`); else if (F.ovalWoodTrim) addOpt(l2, prod2, 'woodTrim', r2, `wood trim ${F.wood.code}`); else addOpt(l2, prod2, pg, r2, `paint group ${F.trimPaint.group}`);
          if (lowFaces.length > 1) l2.notes.push(`${lowFaces.length} exposed faces at this junction: one trim per face (p95).`);
          lines.push(l2);
        } else {
          const prod2 = BYID['so-stacking-change-of-height-trim'];
          const r2 = findRow('so-stacking-change-of-height-trim', r => r.attrs.stackHeight === pt.h && r.attrs.profile === profile && r.style.endsWith('W') === !!F.ovalWoodTrim);
          const l2 = Line('Trim', 1, r2, prod2, `Stacking change-of-height trim ${pt.h}"H, ${profile}${F.ovalWoodTrim ? ', wood' : ''} — on the standard trim below (${band})`, F.ovalWoodTrim ? `wood trim ${F.wood.code} ${F.wood.name}` : paintSpec(F), { src: ctx });
          if (!F.ovalWoodTrim) { if (F.ovalTrimFabric) addOpt(l2, prod2, 'fabricTrim', r2, `fabric trim ${F.fabric.code}`); else addOpt(l2, prod2, pg, r2, `paint group ${F.trimPaint.group}`); }
          l2.notes.push('Uses the change-of-height junction cap of the standard trim below (p454).');
          lines.push(l2);
        }
      }
    }
    if (bases.length > 2) warn.push({ node: ctx, msg: `Three or more panel heights meet at ${ctx}. The guide documents oval change-of-height for two heights per junction (2015 p80-81). Trims below follow the exposed-face model. Verify with Steelcase.` });
  }

  // ---------- panel BOM ----------
  function segTotal(segs) { return sum(segs.map(s => s.height)); }
  function panelBOM(P, p, lines, warn, nodesInfo) {
    const F = P.finishes, thin = P.trim === 'thin', ctx = p.id, W = p.width;
    const pg = E.paintGroupCode(F.trimPaint);
    const Ja = nodesInfo[p.a], Jb = nodesInfo[p.b];
    // ---- change-of-height top cap ends (thin p25: in-line only; oval 2015 p81: any lower panel adjacent to a taller panel) ----
    let cohEnds = 0;
    for (const J of [Ja, Jb]) {
      if (!J || !J.legs) continue;
      const me = J.legs.find(l => l.panel.id === p.id); const others = J.legs.filter(l => l !== me);
      const tallerAdjacent = others.some(o => o.total > me.total);
      if (!tallerAdjacent) continue;
      if (thin) { if (J.type === 'inline') cohEnds++; } else cohEnds++;
    }
    if (!P.options.cohTopCapAuto) cohEnds = 0;
    // ---- decide: panel package vs frame package + skins ----
    const s0 = p.sides[0], s1 = p.sides[1];
    const mono = (segs) => segs.length === 1 && segs[0].kind === 'skin' && (segs[0].type === 'tackable acoustical' || segs[0].type === 'performance tackable acoustical');
    const canPackage = P.options.usePanelPackages && [42, 48, 54, 66].includes(p.height) && mono(s0) && mono(s1) && s0[0].type === s1[0].type && !p.skinsToFloor && !p.openBase && !p.topCap.omit && !(p.glassScreen) && !p.topCapScreen
      && p.baseTrim !== 'hardwire' && !(P.power.nonPvc && p.power.kind !== 'none'); // p393: hardwire needs omitted base trims; p407 package power options are PVC only
    const fabricOf = (seg) => seg.fabric || F.fabric;
    if (canPackage) {
      const pid = thin ? 'thin-panel-package' : 'oval-panel-package'; const prod = BYID[pid];
      const row = findRow(pid, r => r.attrs.width === W && r.attrs.height === p.height && r.attrs.skinType === s0[0].type);
      const l = Line('Panel', 1, row, prod, `Panel package ${W}"W × ${p.height}"H, ${s0[0].type} skins both sides — ${thin ? 'Thin' : 'Oval'}`, `trim ${paintSpec(F)}`, { src: ctx });
      addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
      for (const [i, seg] of [[1, s0[0]], [2, s1[0]]]) {
        const fb = fabricOf(seg); const code = 'fabricGroup' + fb.group;
        addOpt(l, prod, code, row, `side ${i} fabric ${fb.code} ${fb.name} (group ${fb.group})`);
        const dir = seg.direction || F.fabricDirection;
        if (dir === 'vertical') { if (W === 72) l.flags.push('72"W fabric skins accept horizontal fabric application only (p407).'); else addOpt(l, prod, 'verticalSide' + i, row, `side ${i} vertical application`); }
      }
      if (p.topCap.wood) addOpt(l, prod, 'woodTopCap', row, `wood top cap ${F.wood.code} ${F.wood.name}`);
      if (cohEnds === 1) addOpt(l, prod, 'cohOneEnd', row, thin ? 'change-of-height top cap, one end' : 'shortened change-of-height top cap, one end');
      if (cohEnds === 2) { if (W < 36) l.flags.push('Change-of-height at both ends of the top cap is offered on 36"W and wider only.'); addOpt(l, prod, 'cohBothEnds', row, 'change-of-height top cap, both ends'); }
      if (p.baseTrim === 'plainBothSides') { if (W === 18) l.notes.push('18"W base trim is plain by default.'); else addOpt(l, prod, 'plainBothSides', row, 'base trim plain both sides'); }
      if (p.baseTrim === 'knockoutsOneSidePlainOneSide') addOpt(l, prod, 'knockoutsOneSidePlainOneSide', row, 'base trim knockouts one side, plain one side');
      if (p.cableTray) addOpt(l, prod, 'cableTray', row, 'cable tray');
      if (p.baseCableTray) addOpt(l, prod, 'baseCableTray', row, 'base cable tray');
      // power as a package option
      if (p.power.kind === 'powerkit' && W >= 24) { addOpt(l, prod, 'powerkit', row, `one powerkit, ${schematicName(P)}`); }
      else if (p.power.kind === 'passthrough') { addOpt(l, prod, 'passThroughHarness', row, `one pass-through power harness, ${schematicName(P)}`); }
      lines.push(l);
    } else {
      // frame package (p393 thin / p458 oval)
      const pid = thin ? 'thin-base-horizontal-frame-package' : 'oval-base-horizontal-frame-package'; const prod = BYID[pid];
      const row = findRow(pid, r => r.attrs.width === W);
      const l = Line('Panel', 1, row, prod, `Base horizontal frame package ${W}"W — ${thin ? 'Thin' : 'Oval'} (2 bars, top cap, base trims)`, `top cap/base trim ${paintSpec(F)}`, { src: ctx });
      addOpt(l, prod, pg, row, `paint group ${F.trimPaint.group}`);
      if (p.topCap.omit || p.glassScreen || p.topCapScreen) { if (thin) addOpt(l, prod, 'omitTopCap', row, 'omit top cap'); else l.flags.push('Omit top cap is not offered on oval trim frame packages (p458).'); }
      else if (p.topCap.wood) addOpt(l, prod, 'woodTopCap', row, `wood top cap ${F.wood.code} ${F.wood.name}`);
      if (!p.topCap.omit && !p.glassScreen && !p.topCapScreen) {
        if (cohEnds === 1) addOpt(l, prod, 'cohOneEnd', row, thin ? 'change-of-height top cap, one end' : 'shortened change-of-height top cap, one end');
        if (cohEnds === 2) { if (W < 36) l.flags.push('Change-of-height at both ends is offered on 36"W and wider only.'); addOpt(l, prod, 'cohBothEnds', row, 'change-of-height top cap, both ends'); }
      }
      if (p.openBase) { if (thin) addOpt(l, prod, 'openBase', row, 'open base (both base trims omitted)'); else { addOpt(l, prod, 'omitBothSides', row, 'omit base trim both sides'); l.notes.push('Order an open base trim conversion kit separately for oval (2015 p89).'); } }
      else if (p.skinsToFloor) addOpt(l, prod, 'omitBothSides', row, 'omit base trims (skins to the floor)');
      else if (p.baseTrim === 'plainBothSides' && W >= 24) addOpt(l, prod, 'plainBothSides', row, 'base trim plain both sides');
      else if (p.baseTrim === 'knockoutsOneSidePlainOneSide' && W >= 24) addOpt(l, prod, 'knockoutsOneSidePlainOneSide', row, 'base trim knockouts one side, plain one side');
      else if (p.baseTrim === 'hardwire') { addOpt(l, prod, 'omitBothSides', row, 'omit base trims (hardwire base trim ordered separately)'); }
      if (p.cableTray) addOpt(l, prod, 'cableTray', row, 'cable tray');
      if (p.baseCableTray) { if (p.openBase || p.skinsToFloor || p.baseTrim === 'hardwire') l.flags.push('Base cable tray cannot be used with omitted or open base trim (p393).'); else addOpt(l, prod, 'baseCableTray', row, 'base cable tray'); }
      lines.push(l);
      if (p.baseTrim === 'hardwire') { const r2 = findRow('sh-hardwire-base-trim', r => r.attrs.width === W); lines.push(Line('Panel', 2, r2, BYID['sh-hardwire-base-trim'], `Hardwire base trim ${W}"W`, paintSpec(F), { src: ctx })); }
      // skins both sides
      skinsBOM(P, p, p.sides, p.height, lines, warn, ctx, 'base');
      // power ordered separately
      powerBOM(P, p, lines, warn, ctx);
    }
    if (canPackage && p.power.kind === 'powerkit' && W < 24) { warn.push({ panel: ctx, msg: '18"W panels accommodate pass-through power only (p407).' }); }
    // stackers: stacking horizontal frame package per tier + skins (p394, p62). A window tier needs no bar (p63), but when double stacking
    // at least one stacking junction must be connected with a horizontal beam (p63, p109, 2015 p119): keep the bar on tier 1 if every tier is a window.
    const tierWin = p.stack.map((s, i) => !!(p.stackSides[i] && p.stackSides[i].some(sd => sd.some(x => x.kind === 'window'))));
    const allWin = p.stack.length > 1 && tierWin.every(Boolean);
    p.stack.forEach((s, i) => {
      const sides = p.stackSides[i];
      if (!tierWin[i] || (allWin && i === 0)) {
        const pid = thin ? 'thin-stacking-horizontal-frame-package' : 'sh-stacking-horizontal-frame-package';
        const r = findRow(pid, x => x.attrs.width === W);
        const l = Line('Frame', 1, r, BYID[pid], `Stacking horizontal frame package ${W}"W (tier ${i + 1}, ${s}"H)`, 'black paint', { src: ctx });
        if (tierWin[i]) l.notes.push('Both stacked tiers are windows: at least one stacking junction must be connected with a horizontal beam (p63, 2015 p119).');
        if (i === p.stack.length - 1) l.notes.push('Move the base panel\'s top cap up to trim the top of the stack; no separate top cap is ordered (p32).');
        lines.push(l);
      }
      if (sides) skinsBOM(P, p, sides, s + 6, lines, warn, ctx, 'tier ' + (i + 1));
    });
    // stacked windows (p140): read side A bottom to top through the base panel and the tiers
    const colA = [...p.sides[0], ...p.stack.flatMap((s, i) => (p.stackSides[i] || [[]])[0])];
    let run = 0, maxRun = 0; for (const x of colA) { run = x.kind === 'window' ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
    if (maxRun > 2) warn.push({ panel: ctx, msg: `${maxRun} glass windows stacked on top of each other. No more than two windows may be stacked (p140).` });
    const topB = p.sides[0][p.sides[0].length - 1], firstT = p.stack.length && p.stackSides[0] ? p.stackSides[0][0][0] : null;
    if (topB && topB.kind === 'window' && topB.height === 24 && firstT && firstT.kind === 'window') warn.push({ panel: ctx, msg: 'A 24"H glass window in the top of a base panel cannot accommodate any windows stacked on top (p140).' });
    // Universal and Sarto screens with Answer thin trim top cap (2022 p402-403; rules p70-73): one screen per panel, its own top cap included
    if (p.topCapScreen) {
      const sc = p.topCapScreen;
      if (!thin) warn.push({ panel: ctx, msg: 'Universal and Sarto top cap screens are available on thin trim only (2022 p70, p72).' });
      else {
        const prod = BYID['thin-top-cap-screens']; const r = findRow('thin-top-cap-screens', x => x.attrs.width === W && x.attrs.height === sc.height && x.attrs.kind === sc.kind);
        if (!r) warn.push({ panel: ctx, msg: `No ${sc.kind} top cap screen ${W}"W x ${sc.height}"H (2022 p402).` });
        else {
          const fb = F.fabric; const l = Line('Screens', 1, r, prod, `${sc.kind === 'sarto' ? 'Sarto' : 'Universal'} screen with Answer thin trim top cap ${W}"W x ${sc.height}"H`, `top cap ${paintSpec(F)}; screen fabric ${fb.code} ${fb.name}${sc.kind === 'universal' ? '; edge ' + (sc.edge || 'P630 Medium Heather Grey PET') : ''}`, { src: ctx });
          addOpt(l, prod, pg, r, `paint group ${F.trimPaint.group}`); if (fb.group > 1) addOpt(l, prod, 'fabricGroup' + fb.group, r, `fabric group ${fb.group}`);
          l.notes.push('The screen includes the thin trim top cap with bracket slots; the frame package top cap is omitted (2022 p70). Brackets install on the horizontal connecting bar before the skins and top cap; the top bar must be in the top position of the frame (2022 p71, p73).');
          const lowerCoh = [Ja, Jb].some(J => J && J.type === 'inline' && J.legs && J.legs.some(o => o.panel.id !== p.id && o.total > E.panelTotalHeight(p)));
          if (lowerCoh) l.flags.push('A top cap screen cannot be added to the lower panel segment of an in-line change-of-height condition (2022 p71, p73).');
          if (sc.kind === 'sarto' && W >= 60) l.notes.push('Sarto screens 60"W and wider carry three brackets; one screen cannot span two panel sections of equal width (2022 p72-73).');
          lines.push(l);
        }
      }
    }
    // frameless glass screens (thin only) p396/399/400
    if (p.glassScreen) {
      if (!thin) warn.push({ panel: ctx, msg: 'Frameless glass screens are available on thin (and square) trim only, not oval (p109).' });
      else {
        const g = p.glassScreen; const pid = g.attach === 'clip' ? 'thin-frameless-glass-screen-clip' : 'thin-frameless-glass-screen-recessed'; const prod = BYID[pid];
        const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === (g.attach === 'clip' ? 12 : g.height));
        if (!r) warn.push({ panel: ctx, msg: `No ${g.height}"H frameless glass screen at ${W}"W (p${prod.pages[0]}).` });
        else {
          const l = Line('Glass', 1, r, prod, `Frameless glass screen, ${g.attach === 'clip' ? 'clip' : 'recessed'} attachment ${W}"W × ${r.attrs.height}"H — Thin`, `top cap ${paintSpec(F)}`, { src: ctx });
          if (p.topCap.wood) addOpt(l, prod, 'woodTopCap', r, `wood top cap ${F.wood.code}`); else addOpt(l, prod, pg, r, `paint group ${F.trimPaint.group}`);
          if (g.frosted) addOpt(l, prod, 'frostedGlass', r, '6530 frosted glass'); else l.spec += '; 6500 clear glass';
          if (g.omitGlass) addOpt(l, prod, 'omitGlass', r, 'omit glass (customer glass)');
          if (cohEnds === 1 && thin) addOpt(l, prod, 'cohOneEnd', r, 'change-of-height one end');
          if (cohEnds === 2) l.flags.push('Frameless glass will not fit between two in-line change-of-height trims (p65).');
          const wallStart = [Ja, Jb].some(J => J && J.type === 'wall');
          if (wallStart && g.attach !== 'clip') addOpt(l, prod, 'wallStart', r, 'wall start application');
          lines.push(l);
          // recessed top cap connector, one per end (p65, p399): wall-start end; corner junction whose cap is higher than this panel's glass top caps
          // (a taller leg meets the corner); in-line change-of-height with the glass on the lower panel. Not needed at a same-height corner.
          const myTop = E.panelTotalHeight(p);
          const why = [Ja, Jb].map(J => { if (!J || !J.legs) return null; if (J.type === 'wall') return 'wall-start'; const taller = J.legs.some(o => o.panel.id !== p.id && o.total > myTop); if (!taller) return null; return J.type === 'inline' ? 'in-line change-of-height, glass on the lower panel' : ['L', 'T', 'X', 'V', 'Y'].includes(J.type) ? 'corner junction cap above the glass top caps' : null; }).filter(Boolean);
          if (g.attach !== 'clip' && why.length) lines.push(Line('Glass', why.length, findRow('thin-recessed-frameless-glass-top-cap-connector', () => true), BYID['thin-recessed-frameless-glass-top-cap-connector'], `Recessed frameless glass top cap connector (${why.join('; ')}, p399)`, '', { src: ctx }));
          const topIsWindow = p.sides[0][p.sides[0].length - 1].kind === 'window';
          if (topIsWindow) warn.push({ panel: ctx, msg: 'Frameless glass screen cannot be used when a window is in the top position of the panel (p65).' });
        }
      }
    }
    // 12"H panel top screen (oval p462; thin has none)
    if (p.topScreen) {
      if (thin) warn.push({ panel: ctx, msg: '12"H panel top screens are offered for square and oval trim only (2015 p96-97).' });
      else {
        const r = findRow('oval-panel-top-screen', x => x.attrs.width === W);
        if (!r) warn.push({ panel: ctx, msg: `Oval panel top screens are offered in 30", 36", 42" and 48"W only (p462).` });
        else { const l = Line('Glass', 1, r, BYID['oval-panel-top-screen'], `12"H panel top screen ${W}"W — Oval`, 'translucent screen, 6623 metallic supports', { src: ctx }); if (p.topCap.wood) l.flags.push('Oval panel top screens mount on painted oval top caps only, not wood (2015 p97).'); lines.push(l); }
      }
    }
    // glide caps option
    if (P.options.includeGlideCaps && thin) { /* handled at project level */ }
  }

  function skinsBOM(P, p, sides, panelH, lines, warn, ctx, where) {
    const F = P.finishes, W = p.width, target = panelH - 6;
    const windowsDone = new Set();
    // window positions per side, keyed by elevation above the bottom of the skins (a window serves both sides, p18)
    const winAt = sides.map(sg => { let e = 0; const o = new Set(); for (const x of sg) { if (x.kind === 'window') o.add(e + ':' + x.height); e += x.height; } return o; });
    for (const si of [0, 1]) {
      const segs = sides[si];
      const tot = segTotal(segs);
      if (tot !== target) warn.push({ panel: ctx, msg: `${where} side ${'AB'[si]}: skin heights total ${tot}" but must equal ${target}" (panel height ${panelH}" − 6" trim, p19).` });
      let bottom = true, elev = 0;
      for (const [k, seg] of segs.entries()) {
        const toFloor = bottom && p.skinsToFloor && where === 'base';
        bottom = false; const el = elev; elev += seg.height;
        if (seg.kind === 'window') {
          const key = el + ':' + seg.height; if (windowsDone.has(key)) continue; windowsDone.add(key); // one window serves both sides (p18)
          if (!winAt[1 - si].has(key)) warn.push({ panel: ctx, msg: `${where} side ${'AB'[si]}: ${seg.height}"H window at ${el}"–${el + seg.height}" has no matching window on side ${'BA'[si]}. A glass window serves both sides of the panel (p18, 2015 p75).` });
          if (where === 'base' && k === 0) warn.push({ panel: ctx, msg: 'Glass window cannot be used at the base of a panel (p140).' });
          else if (where === 'base' && k !== segs.length - 1) warn.push({ panel: ctx, msg: `${seg.height}"H glass window below the top of a base panel. Windows go in the top position only, by lowering the top horizontal bar (24" max) or on stacking junctions (p59, p140).` });
          const prod = BYID['sh-glass-windows'];
          const r = findRow('sh-glass-windows', x => x.attrs.width === W && x.attrs.height === seg.height && (seg.pane === 'double' ? x.style.includes('DPW') : x.style.includes('SPW')));
          if (!r) { warn.push({ panel: ctx, msg: `No ${seg.pane || 'single'}-pane ${seg.height}"H × ${W}"W glass window (p510).` }); continue; }
          const l = Line('Skins', 1, r, prod, `Glass window ${W}"W × ${seg.height}"H, ${seg.pane === 'double' ? 'double-pane 6530 frosted' : 'single-pane 6500 clear'} (both sides)`, `frame ${paintSpec(F)}`, { src: ctx });
          addOpt(l, prod, E.paintGroupCode(F.trimPaint), r, `frame paint group ${F.trimPaint.group}`);
          if (seg.frosted && seg.pane !== 'double') addOpt(l, prod, 'frostedGlass' + seg.height + 'H', r, '6530 frosted glass');
          if (where === 'base' && k === segs.length - 1) l.notes.push('Window in top position: top horizontal bar lowered (p59).');
          lines.push(l);
          // 2015 p119, p510 tip: a 72"W or wider single-pane window over a steel or fabric skin takes two clips T521328SR
          if (W >= 72 && seg.pane !== 'double') {
            const ti = where === 'base' ? -1 : (parseInt(where.replace(/\D+/g, ''), 10) || 1) - 1;
            const belowOn = (side) => { // the segment whose top is the window's bottom edge (el); at a tier's bottom, the top of the tier below
              if (el > 0) { let e = 0; for (const x of sides[side] || []) { e += x.height; if (e === el) return x; } return null; }
              const prev = ti < 0 ? null : ti === 0 ? p.sides[side] : (p.stackSides[ti - 1] || [])[side]; return prev && prev.length ? prev[prev.length - 1] : null; };
            const skinBelow = [0, 1].map(belowOn).find(x => x && x.kind === 'skin' && ['steel', 'technology', 'tackable acoustical', 'performance tackable acoustical'].includes(x.type));
            if (skinBelow) { const c = Line('Skins', 2, null, null, `Window clip T521328SR for the ${W}"W single-pane window over a ${skinBelow.type} skin`, '', { style: 'T521328SR', unit: 0, page: 464, src: ctx }); c.flags.push('Price is not listed in the guide (2015 p119, p510). Verify pricing with Steelcase.'); c.notes.push('Two clips per window kit 72"W or wider with steel or fabric skins directly below it (2015 p119, p510).'); lines.push(c); }
          }
          continue;
        }
        const t = seg.type;
        if (t === 'tackable acoustical' || t === 'performance tackable acoustical') {
          const pid = toFloor ? 'sh-fabric-skins-to-floor' : 'sh-fabric-skins'; const prod = BYID[pid];
          const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === seg.height && x.attrs.skinType === t);
          if (!r) { warn.push({ panel: ctx, msg: `No ${t} skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} (p${prod.pages[0]}).` }); continue; }
          const fb = seg.fabric || F.fabric;
          const l = Line('Skins', 1, r, prod, `${t[0].toUpperCase() + t.slice(1)} skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} — side ${si + 1}${where !== 'base' ? ' ' + where : ''}`, `fabric ${fb.code} ${fb.name}`, { src: ctx });
          addOpt(l, prod, 'fabricGroup' + fb.group, r, `fabric group ${fb.group}`);
          const dir = seg.direction || F.fabricDirection;
          const vertOnly = toFloor && (seg.height === 48 || seg.height === 60); // p472: 48"H and 60"H to-the-floor skins take fabric vertically only
          if (vertOnly) { if (W === 72) l.flags.push('72"W × 48"H to-the-floor skin: the guide allows 48"H to-the-floor fabric vertically only and 72"W fabric horizontally only (p472). Verify with Steelcase.'); else { addOpt(l, prod, 'fabricVertical', r, 'vertical application'); if (dir !== 'vertical') l.notes.push(`${seg.height}"H to-the-floor skins accept fabric in the vertical direction only (p472).`); } }
          else if (dir === 'vertical') { if (W === 72) l.flags.push('72"W fabric skins: horizontal application only (p470).'); else addOpt(l, prod, 'fabricVertical', r, 'vertical application'); }
          if ([18, 30, 42].includes(seg.height)) l.notes.push('18/30/42"H skins fit junctions manufactured on or after October 10, 2011 (p470).');
          lines.push(l);
        } else if (t === 'steel') {
          const pid = toFloor ? 'sh-steel-skins-to-floor' : 'sh-steel-skins'; const prod = BYID[pid];
          const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === seg.height);
          if (!r) { warn.push({ panel: ctx, msg: `No steel skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} (p${prod.pages[0]}).` }); continue; }
          const sp = seg.paint || F.steelPaint;
          const l = Line('Skins', 1, r, prod, `Steel skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} — side ${si + 1}${where !== 'base' ? ' ' + where : ''}`, `paint ${sp.code} ${sp.name}`, { src: ctx });
          addOpt(l, prod, E.paintGroupCode(sp), r, `paint group ${sp.group}`);
          if (seg.finish === 'perforated') { if (seg.height <= 24 && !toFloor) addOpt(l, prod, 'perforatedSteel', r, 'perforated steel'); else l.flags.push('Perforated steel: 12"–24"H skins only (p477).'); }
          if (seg.finish === 'ribbed') { if (seg.height <= 24 && !toFloor) addOpt(l, prod, 'ribbedSteel', r, 'ribbed steel'); else l.flags.push('Ribbed steel: 12"–24"H skins only (p477).'); }
          lines.push(l);
        } else if (t === 'laminate') {
          const pid = toFloor ? 'sh-laminate-skins-to-floor' : 'sh-laminate-skins'; const prod = BYID[pid];
          const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === seg.height);
          if (!r) { warn.push({ panel: ctx, msg: `No laminate skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} (p${prod.pages[0]}).` }); continue; }
          const lam = seg.laminate || F.laminate;
          lines.push(Line('Skins', 1, r, prod, `Laminate skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} — side ${si + 1}${where !== 'base' ? ' ' + where : ''}`, `laminate ${lam.code} ${lam.name}; trim ${paintSpec(F)}`, { src: ctx })); // p486-487: trim paint color is required
        } else if (t === 'wood') {
          const pid = toFloor ? 'sh-wood-skins-to-floor' : 'sh-wood-skins'; const prod = BYID[pid];
          const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === seg.height);
          if (!r) { warn.push({ panel: ctx, msg: `No wood skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} (p${prod.pages[0]}).` }); continue; }
          const l = Line('Skins', 1, r, prod, `Wood skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} — side ${si + 1}${where !== 'base' ? ' ' + where : ''}`, `${woodSpec(F)}; trim ${paintSpec(F)}`, { src: ctx }); // p488/490: trim paint color is required
          const wg = F.wood.group || 1; if (wg === 2) addOpt(l, prod, 'premiumWood2', r, 'premium wood group 2'); if (wg === 3) addOpt(l, prod, 'premiumWood3', r, 'premium wood group 3');
          lines.push(l);
        } else if (t === 'back painted glass') {
          const pid = toFloor ? 'sh-back-painted-glass-skins-to-floor' : 'sh-back-painted-glass-skins'; const prod = BYID[pid];
          const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === seg.height);
          if (!r) { warn.push({ panel: ctx, msg: `No back painted glass skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} (2022 p${prod.pages[0]}).` }); continue; }
          const l = Line('Skins', 1, r, prod, `Back painted glass skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} — side ${si + 1}${where !== 'base' ? ' ' + where : ''}`, `${seg.glassColor ? 'glass ' + seg.glassColor + '; ' : ''}trim ${paintSpec(F)}`, { src: ctx }); // 2022 p500: glass color and trim paint are required
          if (seg.magneticBacker) { l.optPrices.push(r.adders.magneticBacker); l.unit += r.adders.magneticBacker; l.spec += `; magnetic backer (+$${r.adders.magneticBacker})`; }
          l.notes.push('Back painted glass skins fit junctions manufactured on or after October 10, 2011 and do not attach to wall-start junctions (2022 p500).');
          if ([p.a, p.b].some(id => P.nodes[id] && P.nodes[id].wallStart)) l.flags.push('Back painted glass skins do not attach to wall-start junctions (2022 p500).');
          lines.push(l);
        } else if (t === 'markerboard') {
          const pid = toFloor ? 'sh-markerboard-skins-to-floor' : 'sh-markerboard-skins'; const prod = BYID[pid];
          const r = findRow(pid, x => x.attrs.width === W && x.attrs.height === seg.height);
          if (!r) { warn.push({ panel: ctx, msg: `No markerboard skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} (p${prod.pages[0]}).` }); continue; }
          lines.push(Line('Skins', 1, r, prod, `Markerboard skin ${W}"W × ${seg.height}"H${toFloor ? ' to the floor' : ''} — side ${si + 1}${where !== 'base' ? ' ' + where : ''}`, '', { src: ctx }));
        } else if (t === 'slatwall') {
          if (toFloor) warn.push({ panel: ctx, msg: 'Slatwall skins are not offered to the floor (p484).' });
          else if (where === 'base' && k === 0) warn.push({ panel: ctx, msg: `Side ${'AB'[si]}: slatwall skins cannot be used in the bottom 12" of an Answer panel (p131, p484).` });
          const prod = BYID['sh-slatwall-skins'];
          const r = findRow('sh-slatwall-skins', x => x.attrs.width === W && x.attrs.height === seg.height);
          if (!r) { warn.push({ panel: ctx, msg: `No slatwall skin ${W}"W × ${seg.height}"H (p484).` }); continue; }
          lines.push(Line('Skins', 1, r, prod, `Slatwall skin ${W}"W × ${seg.height}"H — side ${si + 1}`, `paint ${F.steelPaint.code} ${F.steelPaint.name}`, { src: ctx }));
          // brace package only when the tile is marked for a Details flat panel monitor arm (p131: required for monitor arms only)
          const b = seg.brace && findRow('sh-slatwall-skin-brace-packages', x => x.attrs.width === W && x.attrs.height === seg.height);
          if (b) { const bl = Line('Skins', 1, b, BYID['sh-slatwall-skin-brace-packages'], `Slatwall skin brace package ${W}"W × ${seg.height}"H — side ${si + 1}`, '', { src: ctx }); bl.notes.push('Required when mounting a Details flat panel monitor arm on the slatwall skin (p131).'); lines.push(bl); }
        } else if (t === 'technology') {
          const prod = BYID['sh-steel-technology-skins'];
          // technology covers (TS7TSCOVER only, p505): one per cutout opening (2015 p117). Openings per 2015 p117 diagrams: 24"W one; 30"W one double (2);
          // 36"-48"W two; 60"/72"W two doubles (4). Handed (right- or left-hand only) skins carry half. No-cutout skins take none.
          const cu = String(seg.cutouts || 'All').split(/[\s-]/)[0], allN = W === 24 ? 1 : W >= 60 ? 4 : 2;
          const nCov = /^No/.test(cu) ? 0 : cu === 'All' ? allN : Math.ceil(allN / 2), cr = findRow('sh-technology-skin-cover', () => true);
          if (nCov && cr && rowsOf('sh-steel-technology-skins').some(x => x.attrs.width === W && x.attrs.height === seg.height)) {
            const pc = F.plasticColor || '6000'; const c = Line('Skins', nCov, cr, BYID['sh-technology-skin-cover'], `Technology skin cover — ${nCov} for the ${W}"W × ${seg.height}"H technology skin, side ${si + 1}`, `plastic ${pc}`, { src: ctx });
            c.notes.push('Number of technology covers must match the number of cutouts in the skin (2015 p117).');
            if (!['6000', '6009', '6249', '6654', '6697'].includes(pc)) c.flags.push(`Technology covers come in 6000, 6009, 6249, 6654 and 6697 only (2015 p117); ${pc} is not offered.`);
            lines.push(c);
          }
          const r = findRow('sh-steel-technology-skins', x => x.attrs.width === W && x.attrs.height === seg.height && x.attrs.cutouts === (E.TECH_CUTOUTS[seg.cutouts || 'All'] || seg.cutouts));
          if (!r) { warn.push({ panel: ctx, msg: `No steel technology skin ${W}"W × ${seg.height}"H (${seg.cutouts || 'All'} cutouts) (p505).` }); continue; }
          const l = Line('Skins', 1, r, prod, `Steel technology skin ${W}"W × ${seg.height}"H, ${seg.cutouts || 'All'} cutouts — side ${si + 1}`, `paint ${F.steelPaint.code} ${F.steelPaint.name}`, { src: ctx });
          addOpt(l, prod, E.paintGroupCode(F.steelPaint), r, `paint group ${F.steelPaint.group}`);
          lines.push(l);
          if (p.power.kind !== 'powerkit' || (p.power.receptacles[si] || 0) + (p.power.usb[si] || 0) < E.powerBlocksPerSide(W)) l.flags.push(`Technology skins require receptacles in all power block locations of a powerkit (p189): side ${si + 1} needs ${E.powerBlocksPerSide(W) || 'a powerkit with'} receptacle(s).`);
          if (p.baseTrim === 'hardwire') l.flags.push('Technology skins cannot be used with the hardwired solution (p192).');
          // 2015 p117: technology covers snap onto the powerkit, so the skin must sit in front of it (skins start above the 3 3/4" base trim, p58)
          else if (where === 'base' && p.power.kind === 'powerkit') {
            const z0 = E.BASE_TRIM_H + el, z1 = z0 + seg.height, kz = p.power.location === 'base' ? null : E.POWER_WS_ELEV;
            if (kz === null || kz < z0 || kz >= z1) { const msg = `Side ${'AB'[si]}: the technology skin (${inch(z0)}–${inch(z1)} above the floor) is not in front of the powerkit (${kz === null ? 'in the base' : `at worksurface height, about ${kz}"`}). Technology covers snap onto the powerkit (2015 p117): move the technology skin to the powerkit or the powerkit behind it (p189).`; l.flags.push(msg); warn.push({ panel: ctx, msg }); }
          }
        }
      }
    }
  }

  function schematicName(P) { return { X: '4-circuit 3+1', Y: '4-circuit 2+2', Z: '3-circuit separate neutrals (3SN)' }[P.power.schematic]; }
  function powerBOM(P, p, lines, warn, ctx) {
    const pw = p.power, W = p.width, sch = P.power.schematic, mat = P.power.nonPvc ? 'Non-PVC' : 'PVC';
    if (pw.kind === 'none') return;
    if (pw.kind === 'powerkit' && p.baseTrim === 'hardwire') { // p192, p531: hardwired installations order the panel without power plus a hardwired powerkit of the same width
      const r = findRow('wc-hardwired-powerkit', x => x.attrs.width === W);
      if (!r) { warn.push({ panel: ctx, msg: `No ${W}"W hardwired powerkit (p531).` }); return; }
      const l = Line('Power', 1, r, BYID['wc-hardwired-powerkit'], `Hardwired powerkit ${W}"W, ${r.attrs.junctionBoxes} junction box(es) — ${pw.location === 'base' ? 'base' : 'worksurface height'} location`, '', { src: ctx });
      l.notes.push('Receptacles, conduit and wiring are supplied by the electrician (p192).'); if (W === 30 && pw.location === 'base') l.notes.push('30"W in the base: only one junction box can be used (p192).');
      lines.push(l); return;
    }
    if (pw.kind === 'powerkit') {
      if (W < 24) { warn.push({ panel: ctx, msg: '18"W panels accommodate pass-through power only (p189).' }); return; }
      const prod = BYID['wc-powerkit'];
      const r = findRow('wc-powerkit', x => x.attrs.width === W && x.attrs.circuitCode === sch && x.attrs.material === mat);
      const l = Line('Power', 1, r, prod, `Powerkit ${W}"W, ${schematicName(P)}, ${mat} — ${pw.location === 'base' ? 'base' : 'worksurface height'} location`, '', { src: ctx });
      l.notes.push(`${r.attrs.receptaclesPerSide} power block(s) per side (p189).`);
      lines.push(l);
    } else if (pw.kind === 'passthrough') {
      const prod = BYID['wc-pass-through-powerkit'];
      const r = findRow('wc-pass-through-powerkit', x => x.attrs.width === W && x.attrs.circuitCode === sch && x.attrs.material === mat);
      lines.push(Line('Power', 1, r, prod, `Pass-through powerkit ${W}"W, ${schematicName(P)}, ${mat}`, '', { src: ctx }));
    }
  }
  // skin segment in front of a worksurface-height powerkit; skins start above the 3 3/4" base trim (p58)
  const skinAt = (segs, z) => { let y = 4; for (const g of segs) { if (z < y + g.height) return g; y += g.height; } return segs[segs.length - 1]; };
  E.POWER_WS_ELEV = 30; // receptacles just above the 28 1/2" worksurface (p189 powerkits every 12", p314)
  function receptaclesBOM(P, p, lines, warn, ctx) {
    const pw = p.power; const hardwired = pw.kind === 'powerkit' && p.baseTrim === 'hardwire';
    const baseOk = pw.kind === 'powerkit' && pw.location === 'base' && !p.openBase && !hardwired;
    if (pw.infeed && !baseOk) warn.push({ panel: ctx, msg: `Base power infeed not ordered: it plugs into a powerkit in the base of the panel, behind the base trim (p184)${pw.kind === 'passthrough' ? '; a pass-through powerkit has no power block for its connector' : ''}${hardwired ? '; hardwired installations are connected by the electrician (p192)' : ''}.` });
    if (pw.kind !== 'powerkit' || hardwired) return;
    const sch = P.power.schematic, F = P.finishes;
    const kit = findRow('wc-powerkit', x => x.attrs.width === p.width && x.attrs.circuitCode === sch && x.attrs.material === 'PVC');
    const perSide = kit ? kit.attrs.receptaclesPerSide : 0;
    const colorOpt = (prod) => { const o = E.option(prod, 'color' + F.plasticColor); return o ? o.name : F.plasticColor; };
    const cnt = [0, 1].map(s => (pw.receptacles[s] || 0) + (pw.usb[s] || 0));
    if (pw.location === 'base') { // p59 open base, p58 knockouts in base trim
      if (p.openBase) warn.push({ panel: ctx, msg: 'Open base trims do not accommodate power in the base (p59). Locate the powerkit higher in the panel.' });
      else if (p.baseTrim === 'plainBothSides' && cnt[0] + cnt[1]) warn.push({ panel: ctx, msg: 'Base receptacles need base trim with knockouts; plain base trim is specified on both sides (p58).' });
      else if (p.baseTrim === 'knockoutsOneSidePlainOneSide' && cnt[0] && cnt[1]) warn.push({ panel: ctx, msg: 'Base receptacles on both sides, but one base trim is plain (no knockouts) (p58).' });
    }
    let k = 0;
    for (const si of [0, 1]) {
      const n = pw.receptacles[si] || 0, u = pw.usb[si] || 0;
      if (n + u > perSide) warn.push({ panel: ctx, msg: `Side ${'AB'[si]}: ${n + u} receptacles requested but a ${p.width}"W powerkit has ${perSide} power block location(s) per side (p189).` });
      // receptacles above the base (or behind skins to the floor) go through a field-cut fabric skin with a faceplate (p124, p189, p193)
      const seg = !(n + u) ? null : pw.location !== 'base' ? skinAt(p.sides[si], E.POWER_WS_ELEV) : p.skinsToFloor ? p.sides[si][0] : null;
      if (seg && (seg.kind === 'window' || !['tackable acoustical', 'performance tackable acoustical', 'technology'].includes(seg.type))) warn.push({ panel: ctx, msg: `Side ${'AB'[si]}: receptacles cannot be accessed through a ${seg.kind === 'window' ? 'window' : seg.type} skin; only fabric skins are field-cut, or use a technology skin (p126, p131, p131, p136, p189).` });
      else if (seg && seg.type !== 'technology') { const r = findRow('wc-faceplate', () => true); lines.push(Line('Power', n + u, r, BYID['wc-faceplate'], `Faceplate for receptacle in field-cut ${seg.type} skin — side ${si + 1}`, `plastic ${colorOpt(BYID['wc-faceplate'])}`, { src: ctx })); }
      const lines_ = pw.lines || (sch === 'Z' ? [1, 2, 3] : [1, 2, 3, 4]);
      for (let i = 0; i < n; i++) {
        const line = lines_[(k++) % lines_.length];
        const prod = BYID['wc-duplex-receptacle'];
        const r = findRow('wc-duplex-receptacle', x => x.attrs.circuitCode === sch && x.attrs.line === line && x.attrs.amps === (P.power.receptacleAmps || 15) && x.attrs.ground === (P.power.ground || 'System Ground'));
        if (!r) { warn.push({ panel: ctx, msg: `No line ${line} ${P.power.receptacleAmps}A receptacle for ${schematicName(P)} (p523).` }); continue; }
        lines.push(Line('Power', 1, r, prod, `Duplex receptacle ${r.attrs.amps}A line ${line}, ${schematicName(P)}, ${r.attrs.ground} — side ${si + 1}`, `plastic ${colorOpt(prod)}`, { src: ctx }));
      }
      for (let i = 0; i < u; i++) {
        const line = lines_[(k++) % lines_.length];
        const prod = BYID['wc-usb-receptacle'];
        const r = findRow('wc-usb-receptacle', x => x.attrs.circuitCode === sch && x.attrs.line === line) || findRow('wc-usb-receptacle', x => x.attrs.circuitCode === sch);
        if (r) lines.push(Line('Power', 1, r, prod, `USB receptacle line ${r.attrs.line}, ${schematicName(P)} — side ${si + 1}`, `plastic ${colorOpt(prod)}`, { src: ctx }));
      }
    }
    if (pw.infeed && baseOk) {
      if (cnt[0] + cnt[1] + 1 > 2 * perSide) warn.push({ panel: ctx, msg: `The base power infeed occupies one receptacle location (p184, p529): a ${p.width}"W powerkit takes at most ${2 * perSide - 1} receptacle(s) with an infeed, ${cnt[0] + cnt[1]} requested.` });
      const prod = BYID['wc-base-power-infeed'];
      const r = findRow('wc-base-power-infeed', x => x.attrs.circuitCode === sch && x.attrs.length === (pw.infeed.length || 6) && !x.group);
      if (r) { const l = Line('Power', 1, r, prod, `Base power infeed ${r.attrs.length}', ${schematicName(P)}`, `cover plastic ${colorOpt(prod)}`, { src: ctx }); l.notes.push('Occupies one receptacle location on the powerkit (p529).'); if (p.skinsToFloor) l.notes.push('Skins to the floor: the infeed harness is normally backfed through the base trim opening (p184); field-cut the skin.'); lines.push(l); }
    }
  }
  // circuit runs: powered panels (powerkit or pass-through) joined at shared junctions, as lists of panel ids in id order
  E.powerRuns = function (P) {
    const pw = Object.values(P.panels).filter(p => p.power && p.power.kind && p.power.kind !== 'none'); const at = {};
    for (const p of pw) for (const n of [p.a, p.b]) (at[n] = at[n] || []).push(p);
    const seen = new Set(), out = []; const num = (id) => +String(id).slice(1);
    for (const p of pw) { if (seen.has(p.id)) continue; const run = [], st = [p]; seen.add(p.id); while (st.length) { const q = st.pop(); run.push(q.id); for (const n of [q.a, q.b]) for (const r of at[n] || []) if (!seen.has(r.id)) { seen.add(r.id); st.push(r); } } out.push(run.sort((a, b) => num(a) - num(b))); }
    return out;
  };
  // ---------- project BOM ----------
  E.generate = function (P) {
    const lines = [], warn = [], errors = [];
    RUN = { errors, cohFramed: new Set() };
    const nodesInfo = {};
    for (const n of Object.values(P.nodes)) {
      const J = E.junction(P, n); nodesInfo[n.id] = J;
      if (J.type === 'unsupported') errors.push({ node: n.id, msg: J.reason });
    }
    for (const c of E.panelConflicts(P)) errors.push({ panel: c.panel, msg: c.msg });
    const notices = []; for (const p of Object.values(P.panels)) notices.push(...(E.sanitizePanel(P, p) || []));
    // validations per panel (p33, p100, p148)
    for (const p of Object.values(P.panels)) {
      const st = sum(p.stack);
      if (p.stack.length > E.MAX_STACKERS) errors.push({ panel: p.id, msg: `${p.stack.length} stacking junctions on one base panel. Maximum is two (p33).` });
      if (st > E.MAX_STACK) errors.push({ panel: p.id, msg: `${st}" stacked on a base panel. Maximum is 36" (one 24" + one 12", or two 18") (p33).` });
      if (p.height + st > E.MAX_HEIGHT) errors.push({ panel: p.id, msg: `Total height ${p.height + st}" exceeds the 90" maximum (p33, p148).` });
      if (p.stack.some(s => !E.STACK_HEIGHTS.includes(s))) errors.push({ panel: p.id, msg: 'Stacking junctions are 6", 12", 18" or 24"H only (2022 p32).' });
      if (p.stack.includes(6)) { // 2022 p34: a 6"H stacking junction sits on a base junction only, never with another stacker; nothing mounts on top of it
        if (p.stack.length > 1) errors.push({ panel: p.id, msg: 'A 6"H stacking junction cannot be used with another stacking junction (2022 p34).' });
        if (p.glassScreen) errors.push({ panel: p.id, msg: 'Frameless glass cannot be mounted on a 6"H stacking junction (2022 p34).' });
        const top = p.stackSides && p.stackSides[p.stack.length - 1]; if (top && top.some(sd => sd.length && sd[sd.length - 1].kind === 'window')) errors.push({ panel: p.id, msg: 'A glass window cannot be in the top position of a panel segment that has a 6"H stacker (2022 p34).' });
      }
      if (!E.heightsFor(P.trim).includes(p.height)) errors.push({ panel: p.id, msg: P.trim === 'thin' ? 'Panel height must be 30, 36, 42, 48, 54, 66 or 78 (2022 p16).' : 'Panel height must be 30, 42, 48, 54, 66 or 78 (2022 p90); 36"H is a thin-trim height (2022 p16).' });
      if (!E.WIDTHS.includes(p.width)) errors.push({ panel: p.id, msg: 'Panel width must be 18, 24, 30, 36, 42, 48, 60 or 72 (p58).' });
      if (p.height + st > 72) warn.push({ panel: p.id, msg: 'Panel over six feet: in seismic zones 3 or 4 the plan must be reviewed by a structural engineer (p148).' });
    }
    for (const n of Object.values(P.nodes)) {
      const J = nodesInfo[n.id];
      if (J.type === 'none' || J.type === 'unsupported') continue;
      if (P.trim === 'thin') thinJunctionBOM(P, J, lines, warn); else ovalJunctionBOM(P, J, lines, warn);
    }
    for (const p of Object.values(P.panels)) { panelBOM(P, p, lines, warn, nodesInfo); receptaclesBOM(P, p, lines, warn, p.id); }
    // modular harness between adjacent powerkits at different heights (p190)
    for (const n of Object.values(P.nodes)) {
      const J = nodesInfo[n.id]; if (!J.legs || J.legs.length < 2) continue;
      // pass-through powerkits are powerkits too (p188); a base-location kit in an open-base panel sits in the bottom (not base) location (p190)
      const kits = J.legs.filter(l => (l.panel.power.kind === 'powerkit' && l.panel.baseTrim !== 'hardwire') || l.panel.power.kind === 'passthrough');
      const lvl = (q) => { const pw = q.power, loc = pw.kind === 'passthrough' ? (pw.location || 'base') : pw.location; return loc === 'base' && q.openBase ? 'bottom' : loc; };
      for (let i = 0; i < kits.length; i++) for (let j = i + 1; j < kits.length; j++) {
        const a = lvl(kits[i].panel), b = lvl(kits[j].panel), corner = J.type !== 'inline' && (a === 'bottom' || b === 'bottom');
        if ((a !== b && !(J.type === 'inline' && [a, b].sort().join() === 'base,bottom')) || corner) {
          const r = findRow('wc-modular-harness', x => x.attrs.circuitCode === P.power.schematic && x.attrs.length === 43 && x.attrs.material === (P.power.nonPvc ? 'Non-PVC' : 'PVC'));
          const l = Line('Power', 1, r, BYID['wc-modular-harness'], `Modular harness 43", ${schematicName(P)} (${a === b ? 'open-base bottom powerkit at a corner' : 'powerkits at different heights'}, ${kits[i].panel.id}/${kits[j].panel.id})`, '', { src: n.id });
          l.notes.push(a === b || corner && a !== 'worksurface' && b !== 'worksurface' ? 'In a corner, extra-length harness is required when a powerkit is in the bottom (not base) location of an open-base panel; route it through the first large junction opening above the powerkit (p190).' : 'Extra-length harness is required when connecting two powerkits at different heights (p190).'); lines.push(l);
        }
      }
    }
    // p172/p184: power is planned per circuit run, the powered panels (powerkits and pass-throughs) joined at junctions.
    // Each run needs one building power-in; a power-in supplies at most 30 (3-circuit) or 40 (4-circuit) receptacles (NEC, p172).
    for (const run of E.powerRuns(P)) {
      const ids = new Set(run); const on = (l) => ids.has(l.src);
      const rec = lines.filter(l => on(l) && (l.pid === 'wc-duplex-receptacle' || l.pid === 'wc-usb-receptacle')).reduce((a, l) => a + l.qty, 0);
      const ins = lines.filter(l => on(l) && /power-infeed/.test(l.pid)).reduce((a, l) => a + l.qty, 0), cap = P.power.schematic === 'Z' ? 30 : 40;
      const nm = run.length === 1 ? 'Panel ' + run[0].slice(1) : `Powered run of ${run.length} panels (Panel ${run.map(x => x.slice(1)).join(', ')})`;
      if (rec && !ins) warn.push({ panel: run[0], msg: `${nm}: ${rec} receptacle${rec === 1 ? '' : 's'} and no power-in. Add a base power infeed on one powerkit panel of the run (panel editor › Power infeed), or plan a ceiling or wall feed (p184, p529).` });
      else if (rec > cap * Math.max(1, ins)) warn.push({ panel: run[0], msg: `${nm}: ${rec} receptacles on ${ins === 1 ? 'one power-in' : ins + ' power-ins'}: a ${schematicName(P)} power-in supplies at most ${cap} receptacles (p172). Split it into ${Math.ceil(rec / cap)} circuit runs (a panel without power between them), each with its own power-in.` });
      else if (ins > 1) warn.push({ panel: run[0], msg: `${nm}: ${ins} power-ins on one connected circuit run. One building power-in feeds a run through its powerkits (p172, p184): keep one, or split the run into separate circuit runs with a panel without power between them.` });
    }
    // stability (p150-151)
    stability(P, nodesInfo, warn);
    // project-level extras
    if (P.options.includeGlideCaps && P.trim === 'thin') {
      const n = Object.values(nodesInfo).filter(J => J.legs && J.legs.length).length;
      const r = findRow('thin-gripper-glide-caps', () => true);
      lines.push(Line('Accessories', Math.ceil(n / 10), r, BYID['thin-gripper-glide-caps'], `Gripper glide caps (package of 10) — ${n} junctions`, 'soft black plastic', { src: 'project' }));
    }
    // manual add-ons
    for (const m of P.manual || []) {
      const rows = E.rowsByStyle(m.style); const r = rows[0]; const prod = r ? BYID[r._pid] : null;
      lines.push(Line(prod ? prod.category : 'Manual', m.qty || 1, r, prod, m.desc || (prod ? prod.name : m.style), m.spec || '', { src: 'manual', style: m.style, unit: r ? r.price : (m.unit || 0) }));
    }
    rollupPackages(lines);
    RUN = null;
    for (const l of lines) { l.ext = Math.round((l.unit || 0) * l.qty); try { l.contents = E.packageContents(P, l); } catch (err) { l.contents = []; } }
    return { lines, warnings: warn, errors, notices, nodes: nodesInfo, totals: totals(lines), footprint: footprint(P, nodesInfo) };
  };
  // 2015 p1: Canadian list = base price and each option × 1.09, each rounded to the dollar, then added
  E.cadOf = (l) => { const o = l.optPrices || []; return l.qty * (Math.round(((l.unit || 0) - sum(o)) * 1.09) + sum(o.map(x => Math.round(x * 1.09)))); };
  E.cadTotal = (lines) => lines.reduce((a, l) => a + E.cadOf(l), 0);
  function totals(lines) {
    const byCat = {}; let all = 0;
    for (const l of lines) { byCat[l.cat] = (byCat[l.cat] || 0) + l.ext; all += l.ext; }
    // 2015 p1: Canadian list = base price and each option × 1.09, each rounded to the dollar, then added
    return { byCat, all, canadian: lines.reduce((a, l) => a + E.cadOf(l), 0) };
  }
  function footprint(P, nodesInfo) {
    // A nominal width runs module line to module line (in-line junctions are centered on it, end-of-run posts sit inside it, p20, p30, p45); the length a
    // panel takes along its line adds the finished trim at an end of run (p20 +1/2" thin, p92 +1" oval), the wall-start face (p21 +3/16" thin) and, at a
    // corner junction, the corner allowance to the node (CORNER_ALLOW) plus the 1 1/2" of junction block beyond it (the other leg's outer face) when no
    // panel continues straight on. An L of two 72" panels measures 1 1/2" + 1 1/2" + 72" + 1/2" = 75 1/2" along each leg (thin).
    const fp = E.FOOTPRINT[P.trim]; const runs = [];
    for (const p of Object.values(P.panels)) {
      let len = p.width; const notes = [];
      for (const nid of [p.a, p.b]) {
        const J = nodesInfo[nid]; if (J.type === 'EOR') { len += fp.eor; notes.push('end-of-run trim +' + inch(fp.eor)); } if (J.type === 'wall') { len += fp.wall; if (fp.wall) notes.push('wall-start +' + inch(fp.wall)); }
        const ca = E.cornerAllow(J.type); if (ca) {
          const me = J.legs.find(l => l.panel.id === p.id); const through = me && J.legs.some(l => l !== me && Math.abs((((l.angle - me.angle) % 360) + 360) % 360 - 180) < 1);
          len += ca; notes.push(`${J.type} corner allowance +${inch(ca)}`); if (!through) { len += E.CORNER_POST / 2; notes.push('corner block +' + inch(E.CORNER_POST / 2)); }
        }
      }
      runs.push({ panel: p.id, nominal: p.width, actual: Math.round(len * 10000) / 10000, notes });
    }
    return runs;
  }
  function stability(P, nodesInfo, warn) {
    // a straight run continues through in-line, T and X junctions; perpendicular legs brace it there and anchor it at its ends (p150-151).
    // Lengths are nominal panel widths: the guide states these limits in nominal feet ("an 8' run", two 48" panels), so the corner allowances a T or
    // X adds along the run (CORNER_ALLOW) are not counted against them.
    const seen = new Set(), ft = (x) => (x / 12).toFixed(1) + "'";
    const walk = (nid, cur) => { // -> { end: {d, w}, braces: [{d, w}] }, d measured from the start node, w = widest perpendicular leg (wall-start = anchored)
      const braces = []; let d = 0;
      for (let i = 0; i < 200; i++) {
        const J = nodesInfo[nid], me = J.legs.find(l => l.panel.id === cur.id);
        const cont = J.legs.find(l => l !== me && Math.abs((((l.angle - me.angle) % 360) + 360) % 360 - 180) < 1);
        const side = J.legs.filter(l => l !== me && l !== cont), w = side.length ? Math.max(...side.map(l => l.panel.width)) : J.type === 'wall' ? Infinity : 0;
        if (!cont || seen.has(cont.panel.id)) return { end: { d, w }, braces };
        braces.push({ d, w }); seen.add(cont.panel.id); chain.push(cont.panel); d += cont.panel.width; cur = cont.panel; nid = cont.farNode;
      }
      return { end: { d, w: 0 }, braces };
    };
    let chain;
    for (const p of Object.values(P.panels)) {
      if (seen.has(p.id)) continue;
      chain = [p]; seen.add(p.id);
      const A = walk(p.a, p), B = walk(p.b, p), a0 = A.end.d, len = a0 + p.width + B.end.d, ids = chain.map(x => x.id).join(',');
      const ends = [{ x: 0, w: A.end.w }, { x: len, w: B.end.w }];
      const mid = [...A.braces.map(s => ({ x: a0 - s.d, w: s.w })), ...B.braces.map(s => ({ x: a0 + p.width + s.d, w: s.w }))];
      if (len > 96) { // p150: an 8' run needs no return; over 8' up to 18' at least a 30"W return panel anchoring each end
        const anchors = [...ends, ...mid].filter(s => s.w >= 30);
        const narrow = ends.filter(e => e.w > 0 && e.w < 30).map(e => `${e.w}"W`);
        if (!anchors.length) warn.push({ panel: ids, msg: `Straight run of ${len}" (${ft(len)}) has no return panel of 30"W or more${narrow.length ? ` (${narrow.join(', ')} return too narrow)` : ''}. Runs over 8' need a 30"W minimum return, or a junction stabilizer bracket every 8' bolted to concrete (p150).` });
        else for (const e of ends) { if (e.w >= 30) continue; const near = anchors.reduce((b, s) => Math.abs(s.x - e.x) < Math.abs(b.x - e.x) ? s : b), dist = Math.abs(near.x - e.x); if (dist > 96) warn.push({ panel: ids, msg: `Straight run of ${len}" (${ft(len)}): ${e.w ? `the ${e.w}"W return at one end is narrower than 30"` : 'one end is free'} and ${ft(dist)} from the nearest anchor (${near.w === Infinity ? 'the wall-start junction at the other end, p161' : `a ${near.w}"W return`}). Over 8', anchor each end with a 30"W minimum return, or a junction stabilizer bracket every 8' bolted to concrete (p150).` }); }
      }
      if (len > 216) { // p151: over 18', a 48"W perpendicular panel every 12'
        const xs = [0, ...mid.filter(s => s.w >= 48).map(s => s.x).sort((x, y) => x - y), len]; let span = 0;
        for (let i = 1; i < xs.length; i++) span = Math.max(span, xs[i] - xs[i - 1]);
        if (span > 144) warn.push({ panel: ids, msg: `Run of ${ft(len)} exceeds 18'. Locate a 48"W perpendicular panel every 12' (p151); the longest span without one is ${ft(span)}.` });
      }
    }
  }
  // ---------- aggregation for order pulling ----------
  // by(line) -> extra grouping value (e.g. the line's source), kept on the row as .by; .keys lists the stable line keys in the row
  E.aggregate = function (lines, by) {
    const map = new Map();
    // package pieces (rollupPackages): when the job-level package line is in the set, it is what gets ordered and the pieces are left out;
    // a subset without it (one junction, one workstation) still lists its pieces, at $0
    const packed = new Set(lines.filter(l => l.pack === undefined && l.src === 'project').map(l => l.style + '|' + l.spec));
    for (const l of lines) {
      if (!l.style || l.style === '—' || (l.piece && packed.has(l.style + '|' + l.spec))) continue;
      const b = by ? by(l) : ''; const key = l.style + '|' + l.spec + (l.piece ? '|piece' : '') + '|' + b;
      const a = map.get(key) || { piece: !!l.piece, style: l.style, spec: l.spec, desc: l.desc, cat: l.cat, page: l.page, qty: 0, unit: l.unit, ext: 0, flags: new Set(), notes: new Set(), src: new Set(), by: b, keys: [], contents: l.contents || [] };
      a.qty += l.qty; a.ext += l.ext; l.flags.forEach(f => a.flags.add(f)); l.notes.forEach(f => a.notes.add(f)); a.src.add(l.src); a.keys.push(E.lineKey(l));
      map.set(key, a);
    }
    return [...map.values()].map(a => Object.assign(a, { flags: [...a.flags], notes: [...a.notes], src: [...a.src] })).sort((x, y) => x.cat.localeCompare(y.cat) || x.style.localeCompare(y.style));
  };
  E.toCSV = function (rows, cols) {
    const esc = (v) => { v = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.map(c => esc(c.label)).join(','), ...rows.map(r => cols.map(c => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))].join('\r\n');
  };

  // ---------- SIF (Standard Interchange Format) for dealer ordering ----------
  // One record per style number + finish set (+ tag). Fields follow the generic SIF layout used by
  // CAP Worksheet, ProjectSpec and dealer business systems: SF/ST header, then PN MC CT PD QT PL,
  // ON/OD pairs for every finish or option, TG for the tag. CRLF ends every line, no CRLF inside a value.
  E.sifText = (v) => String(v === undefined || v === null ? '' : v)
    .replace(/[\r\n]+/g, ' ').replace(/×/g, 'x').replace(/[—–]/g, '-').replace(/→/g, ' to ').replace(/°/g, ' deg').replace(/″/g, '"').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/·/g, '-').replace(/\s{2,}/g, ' ').trim();
  // parse the planner's "Specify" text ("paint 7207 Black; side 1 fabric B902 Soft White (group 1); wood top cap 3062 ...")
  // into option number / description pairs. Finish numbers are the Steelcase surface material codes.
  E.specOptions = function (spec) {
    const out = []; const seen = new Set();
    for (const part of String(spec || '').split(/;\s*/)) {
      // finish codes are four characters: 7207, B902, 5F01, 5FAB, 25G1 (all start with a digit or a letter + digit)
      const m = part.match(/^(.*?)\b((?:\d[A-Z0-9]{3})|(?:[A-Z]\d[A-Z0-9]{2}))\b\s*(.*)$/);
      if (!m) continue;
      const on = m[2]; const od = (m[1] + ' ' + m[3]).replace(/\((?:\+|–|-)?\$[\d.,]+\)/g, '').replace(/\s{2,}/g, ' ').trim();
      const key = on + '|' + od; if (seen.has(key)) continue; seen.add(key);
      out.push({ on, od: od.replace(/^(.)/, c => c.toUpperCase()) });
    }
    return out;
  };
  // the Specify parts with no finish number (one powerkit, omit top cap, vertical application, shortened cap, omit trim, paint group adders ...):
  // they still change the product, so the SIF carries each one as an AN/AD attribute pair next to the ON/OD finish pairs
  E.specNotes = function (spec) {
    const out = [], seen = new Set();
    for (const part of String(spec || '').split(/;\s*/)) { const t = part.trim(); if (!t || /\b((?:\d[A-Z0-9]{3})|(?:[A-Z]\d[A-Z0-9]{2}))\b/.test(t) || seen.has(t)) continue; seen.add(t); out.push(t.replace(/^(.)/, c => c.toUpperCase())); }
    return out;
  };
  // lines: BOM lines. opts: { mc, ct, title, sf, tagOf(line) -> string, includeUnpriced }
  E.toSIF = function (lines, opts) {
    opts = opts || {};
    const mc = E.sifText(opts.mc || 'STEEL').slice(0, 5), ct = E.sifText(opts.ct || 'ANSWER');
    const map = new Map(); const skipped = [];
    for (const l of lines) {
      if (l.piece) continue; // pieces of a package: ordered on the job-level package line (rollupPackages)
      if (!l.style || l.style === '—' || !l.qty) { skipped.push(l); continue; }
      const tag = opts.tagOf ? E.sifText(opts.tagOf(l)) : '';
      const key = l.style + '|' + l.spec + '|' + tag;
      const a = map.get(key) || { style: l.style, spec: l.spec, desc: l.desc.replace(/ — side \d.*$/, '').replace(/\s*\(\d+"→\d+"\)/, ''), unit: l.unit, qty: 0, tag, flags: new Set() };
      a.qty += l.qty; l.flags.forEach(f => a.flags.add(f)); map.set(key, a);
    }
    const recs = [...map.values()];
    const L = [];
    L.push('SF=' + E.sifText(opts.sf || 'Generic SIF;Answer Panel Planner'));
    if (opts.title) L.push('ST=' + E.sifText(opts.title));
    for (const r of recs) {
      L.push('PN=' + E.sifText(r.style));
      L.push('MC=' + mc);
      L.push('CT=' + ct);
      L.push('PD=' + E.sifText(r.desc));
      L.push('QT=' + r.qty);
      L.push('PL=' + (Math.round(r.unit * 100) / 100).toFixed(2));
      for (const o of E.specOptions(r.spec)) { L.push('ON=' + E.sifText(o.on)); L.push('OD=' + E.sifText(o.od)); }
      for (const a of E.specNotes(r.spec)) { L.push('AN=OPTION'); L.push('AD=' + E.sifText(a)); }
      if (r.tag) L.push('TG=' + r.tag);
      for (const f of r.flags) if (/CORRECTED|Verify/i.test(f)) { L.push('AN=NOTE'); L.push('AD=' + E.sifText(f)); }
    }
    return { text: L.join('\r\n') + '\r\n', records: recs.length, pieces: recs.reduce((s, r) => s + r.qty, 0), skipped };
  };

  // ---------- planner helpers ----------
  E.ftin = function (n) { // 78 -> 6'-6"
    const neg = n < 0; n = Math.abs(n); const ft = Math.floor(n / 12); let i = n - ft * 12; let s = i % 1 ? inch(i) : `${i}"`; if (ft && i > 0 && i < 1 && /^\d+\/\d+"$/.test(s)) s = '0 ' + s; // 4'-0 1/2", not 4'-1/2"
    return (neg ? '-' : '') + (ft ? `${ft}'-${s}` : s);
  };
  // split a run length into standard panel widths. pref: 'auto' or a width. Returns {widths, length}
  E.segmentRun = function (L, pref) {
    L = Math.max(0, Math.round(L / 6) * 6);
    if (L < 18) return { widths: [], length: 0 };
    if (pref && pref !== 'auto') { const w = +pref; const n = Math.max(1, Math.round(L / w)); return { widths: Array(n).fill(w), length: n * w }; }
    const std = [72, 60, 48, 42, 36, 30, 24, 18];
    const solve = (len) => { // fewest panels wins; ties go to equal widths, then to the smallest size spread
      const cands = [];
      for (let n = 1; n <= 12; n++) if (len % n === 0 && std.includes(len / n)) cands.push({ arr: Array(n).fill(len / n), spread: 0 });
      for (const a of std) for (const b of std) if (b < a) for (let i = 1; i <= 12; i++) { const rest = len - a * i; if (rest <= 0) break; if (rest % b === 0) cands.push({ arr: [...Array(i).fill(a), ...Array(rest / b).fill(b)], spread: a - b }); }
      if (cands.length) { cands.sort((x, y) => x.arr.length - y.arr.length || x.spread - y.spread); return cands[0].arr; }
      const out = []; let rem = len;
      while (rem >= 18) { const w = std.find(x => x <= rem && (rem - x === 0 || rem - x >= 18)); if (!w) break; out.push(w); rem -= w; }
      return rem === 0 ? out : null;
    };
    for (let d = 0; d <= 36; d += 6) { const a = solve(L - d); if (a) return { widths: a, length: L - d }; const b = solve(L + d); if (b && d) return { widths: b, length: L + d }; }
    return { widths: [48], length: 48 };
  };
  // connected groups of panels (workstations / runs)
  E.components = function (P) {
    const seen = new Set(), out = [];
    const adj = {}; for (const p of Object.values(P.panels)) { (adj[p.a] = adj[p.a] || []).push(p); (adj[p.b] = adj[p.b] || []).push(p); }
    for (const p of Object.values(P.panels)) {
      if (seen.has(p.id)) continue;
      const panels = [], nodes = new Set(); const stack = [p];
      while (stack.length) { const q = stack.pop(); if (seen.has(q.id)) continue; seen.add(q.id); panels.push(q); for (const nid of [q.a, q.b]) { nodes.add(nid); for (const r of adj[nid] || []) if (!seen.has(r.id)) stack.push(r); } }
      const key = panels.map(x => x.id).sort((a, b) => +a.slice(1) - +b.slice(1))[0];
      out.push({ key, panels: panels.sort((a, b) => +a.id.slice(1) - +b.id.slice(1)), nodes: [...nodes], name: (P.areas && P.areas[key]) || '' });
    }
    out.sort((a, b) => +a.key.slice(1) - +b.key.slice(1));
    out.forEach((c, i) => { if (!c.name) c.name = 'Workstation ' + (i + 1); });
    return out;
  };
  // Workstations as the planner means them. By default one per connected group of panels (E.components). A panel's `station`
  // (a name) takes it, and the worksurfaces mounted on it, into that named workstation instead, so a pod of back-to-back or
  // side-by-side stations can be split; a worksurface's own `station` overrides its host panel (the far side of a shared spine).
  // Each junction belongs to exactly one workstation (the one most of its panels belong to), so staged pieces still add up.
  // Returns [{ key, uid, name, panels, nodes (owned junctions), allNodes, ws (worksurface ids), figPanels, comp }].
  E.workstations = function (P) {
    const comps = E.components(P); const groups = new Map(); const order = [];
    const get = (key, comp) => { if (!groups.has(key)) { const g = { key, name: '', panels: [], ws: [], allNodes: new Set(), nodes: [], comp, min: Infinity }; groups.set(key, g); order.push(g); } return groups.get(key); };
    const pnum = (id) => +String(id).replace(/^\D+/, '') || 0;
    const stKey = (name) => 'st:' + name;
    const panelGroup = {};
    for (const c of comps) for (const p of c.panels) { const g = p.station ? get(stKey(p.station), c.key) : get(c.key, c.key); g.panels.push(p); g.min = Math.min(g.min, pnum(p.id)); p.a && g.allNodes.add(p.a); p.b && g.allNodes.add(p.b); panelGroup[p.id] = g; }
    for (const w of Object.values(P.worksurfaces || {})) {
      const host = E.hostPanelOf(P, w.id); const hg = panelGroup[host];
      const g = w.station ? get(stKey(w.station), hg ? hg.comp : null) : hg; if (!g) continue;
      g.ws.push(w.id); if (!g.panels.length) g.min = Math.min(g.min, 1e6 + pnum(w.id));
    }
    // junction ownership
    const legs = {}; for (const p of Object.values(P.panels)) for (const n of [p.a, p.b]) (legs[n] = legs[n] || []).push(p.id);
    order.sort((a, b) => a.min - b.min);
    const rank = new Map(order.map((g, i) => [g, i]));
    for (const [nid, ps] of Object.entries(legs)) { const cnt = new Map(); for (const pid of ps) { const g = panelGroup[pid]; if (g) cnt.set(g, (cnt.get(g) || 0) + 1); } let best = null; for (const [g, k] of cnt) if (!best || k > cnt.get(best) || (k === cnt.get(best) && rank.get(g) < rank.get(best))) best = g; if (best) best.nodes.push(nid); }
    // names: named stations keep their name; the rest are the connected group's name, or Workstation N (skipping names in use)
    const used = new Set(order.filter(g => g.key.startsWith('st:')).map(g => g.key.slice(3)));
    order.forEach((g, i) => { if (g.key.startsWith('st:')) g.name = g.key.slice(3); else if (P.areas && P.areas[g.key]) { g.name = P.areas[g.key]; used.add(g.name); } });
    order.forEach((g, i) => { if (g.name) return; let n = i + 1; while (used.has('Workstation ' + n)) n++; g.name = 'Workstation ' + n; used.add(g.name); });
    const figIds = (g) => { const ids = new Set(g.panels.map(p => p.id)); for (const wid of g.ws) { const w = P.worksurfaces[wid]; if (!w) continue; for (const pid of (w.kind === 'straight' ? [w.panel] : (w.legs || []))) if (P.panels[pid]) ids.add(pid); } return [...ids].map(id => P.panels[id]); };
    return order.map((g, i) => { const figPanels = figIds(g); const all = new Set(g.allNodes); for (const p of figPanels) { all.add(p.a); all.add(p.b); } return { key: g.key, uid: 'w' + i, name: g.name, panels: g.panels.sort((a, b) => pnum(a.id) - pnum(b.id)), nodes: g.nodes.sort((a, b) => pnum(a) - pnum(b)), allNodes: [...all], ws: g.ws, figPanels, comp: g.comp }; });
  };
  // the workstation a spec line (by its source: panel, junction or worksurface id) belongs to, or null for job-wide lines
  E.workstationOf = function (P, src, list) {
    list = list || E.workstations(P);
    if (P.worksurfaces && P.worksurfaces[src]) return list.find(g => g.ws.includes(src)) || null;
    if (P.panels[src]) return list.find(g => g.panels.some(p => p.id === src)) || null;
    if (P.nodes[src]) return list.find(g => g.nodes.includes(src)) || null;
    return null;
  };
  // automatic split of one connected group into stations: worksurfaces that touch (butted seams, L joints, a corner and its
  // straights) form a station; each panel joins the station whose worksurfaces are mounted on it, else the nearest one.
  // A panel carrying worksurfaces of two stations (a shared spine) goes to the first; the other station's worksurfaces are
  // assigned by their own `station`. Returns the station names, or null when the group has fewer than two worksurface clusters.
  E.splitStations = function (P, compKey, baseName) {
    const c = E.components(P).find(x => x.key === compKey); if (!c) return null;
    const ids = new Set(c.panels.map(p => p.id));
    const wss = Object.values(P.worksurfaces || {}).filter(w => ids.has(E.hostPanelOf(P, w.id)));
    const geo = new Map(wss.map(w => [w.id, E.wsGeometry(P, w)]).filter(([, g]) => g));
    const box = (g) => { const xs = g.poly.map(q => q[0]), ys = g.poly.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    const polyGap = (A, B) => { let m = Infinity; for (const [X, Y] of [[A, B], [B, A]]) for (const p of X) for (let i = 0; i < Y.length; i++) m = Math.min(m, segDist(p, Y[i], Y[(i + 1) % Y.length])); return m; };
    const touch = (a, b) => { const A = geo.get(a.id), B = geo.get(b.id); if (!A || !B) return false; const x = box(A), y = box(B); if (x[0] > y[2] + 1 || y[0] > x[2] + 1 || x[1] > y[3] + 1 || y[1] > x[3] + 1) return false; return polyGap(A.poly, B.poly) <= 1; };
    const list = wss.filter(w => geo.has(w.id)); const cl = new Map(); let k = 0;
    for (const w of list) { if (cl.has(w.id)) continue; const st = [w]; cl.set(w.id, k); while (st.length) { const a = st.pop(); for (const b of list) if (!cl.has(b.id) && touch(a, b)) { cl.set(b.id, k); st.push(b); } } k++; }
    if (k < 2) return null;
    // cluster order: by the lowest host panel number, so names read in drawing order
    const pnum = (id) => +String(id).replace(/^\D+/, '') || 0;
    const first = Array.from({ length: k }, (_, i) => Math.min(...list.filter(w => cl.get(w.id) === i).map(w => pnum(E.hostPanelOf(P, w.id))))); const ord = first.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const used = new Set(E.workstations(P).filter(g => g.comp !== compKey || g.key.startsWith('st:')).map(g => g.name));
    const names = []; for (let i = 0; i < k; i++) { let nm = baseName + String.fromCharCode(65 + i); let j = 2; while (used.has(nm)) nm = baseName + String.fromCharCode(65 + i) + j++; names.push(nm); }
    const nameOf = (ci) => names[ord.indexOf(ci)];
    const mounted = (p) => list.filter(w => (w.kind === 'straight' ? [w.panel] : (w.legs || [])).includes(p.id));
    for (const p of c.panels) {
      const on = mounted(p).map(w => cl.get(w.id)).sort((a, b) => ord.indexOf(a) - ord.indexOf(b));
      if (on.length) { p.station = nameOf(on[0]); continue; }
      const a = P.nodes[p.a], b = P.nodes[p.b]; const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      let best = null, bd = Infinity; for (const w of list) { const g = geo.get(w.id); const d = Math.min(...g.poly.map((q, i) => segDist(mid, q, g.poly[(i + 1) % g.poly.length]))); if (d < bd - 1e-6 || (Math.abs(d - bd) < 1e-6 && ord.indexOf(cl.get(w.id)) < ord.indexOf(cl.get(best.id)))) { bd = d; best = w; } }
      p.station = nameOf(cl.get(best.id));
    }
    for (const w of list) { const want = nameOf(cl.get(w.id)); const host = P.panels[E.hostPanelOf(P, w.id)]; w.station = host && host.station === want ? '' : want; }
    return names.slice().sort();
  };
  // stable key for sourcing and shop/pick checks: where the line is used, the product, and its place among that product's lines there.
  // Finish, style suffix (wood trim) and description changes keep the key; E.lineKeyV1 is the old text key, used to migrate saved jobs.
  E.lineKey = (l) => l.key || `${l.src}#${l.pid || l.style}#1`;
  E.lineKeyV1 = (l) => `${l.src}|${l.style}|${l.desc}|${l.spec}`;
  E.sourcingOf = function (P, l) { const S = P.sourcing || {}; const k = E.lineKey(l); return (S.byKey && S.byKey[k]) || (S.byCat && S.byCat[l.cat]) || 'buy'; };
  // panels that share floor space without a junction: crossing, drawn on top of each other, a run ending against the middle
  // of another panel, or posts/panels closer than the 3" panel thickness. Answer panels only connect at junctions (p20-21).
  // `ids` (optional) limits the check to pairs that involve at least one of those panels.
  E.PANEL_THICK = 3;
  E.panelConflicts = function (P, ids) {
    const want = ids ? new Set(ids) : null; const out = []; const T = E.PANEL_THICK - 0.01;
    const segs = Object.values(P.panels).map(p => { const a = P.nodes[p.a], b = P.nodes[p.b]; if (!a || !b) return null; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { p, a, b, L, ux: (b.x - a.x) / L, uy: (b.y - a.y) / L }; }).filter(Boolean);
    const near = (pt, s) => { const t = Math.max(0, Math.min(s.L, (pt.x - s.a.x) * s.ux + (pt.y - s.a.y) * s.uy)); return { d: Math.hypot(pt.x - (s.a.x + s.ux * t), pt.y - (s.a.y + s.uy * t)), t }; };
    const nm = (p) => 'Panel ' + p.id.replace(/^P/, '');
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], B = segs[j]; if (want && !want.has(A.p.id) && !want.has(B.p.id)) continue;
      const shared = [A.p.a, A.p.b].filter(n => n === B.p.a || n === B.p.b);
      const parallel = Math.abs(A.ux * B.uy - A.uy * B.ux) < 0.02;
      const push = (kind, msg) => out.push({ kind, panels: [A.p.id, B.p.id], panel: A.p.id + ',' + B.p.id, msg });
      if (shared.length === 2) { push('overlap', `${nm(B.p)} is drawn on top of ${nm(A.p)}: both run between the same two junctions. Delete one of them.`); continue; }
      if (shared.length === 1) {
        const s = P.nodes[shared[0]]; const oa = A.p.a === s.id ? A.b : A.a, ob = B.p.a === s.id ? B.b : B.a;
        const ang = Math.acos(Math.max(-1, Math.min(1, ((oa.x - s.x) * (ob.x - s.x) + (oa.y - s.y) * (ob.y - s.y)) / (Math.hypot(oa.x - s.x, oa.y - s.y) * Math.hypot(ob.x - s.x, ob.y - s.y) || 1)))) * 180 / Math.PI;
        if (ang < 5) push('overlap', `${nm(B.p)} is drawn on top of ${nm(A.p)}: both leave ${'Junction ' + s.id.replace(/^N/, '')} in the same direction. Delete one of them, or swing it to a direction Answer offers.`);
        continue;
      }
      const ends = [[A.a, B, A, B], [A.b, B, A, B], [B.a, A, B, A], [B.b, A, B, A]].map(([pt, s, own, other]) => ({ pt, own, other, ...near(pt, s) }));
      const dmin = Math.min(...ends.map(e => e.d));
      // proper crossing of the two center lines
      const cr = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
      const d1 = cr(A.a, A.b, B.a), d2 = cr(A.a, A.b, B.b), d3 = cr(B.a, B.b, A.a), d4 = cr(B.a, B.b, A.b);
      const cross = !parallel && ((d1 > 0.01 && d2 < -0.01) || (d1 < -0.01 && d2 > 0.01)) && ((d3 > 0.01 && d4 < -0.01) || (d3 < -0.01 && d4 > 0.01));
      if (!cross && dmin >= T) continue;
      if (parallel && dmin < 0.5) { const t0 = (B.a.x - A.a.x) * A.ux + (B.a.y - A.a.y) * A.uy, t1 = (B.b.x - A.a.x) * A.ux + (B.b.y - A.a.y) * A.uy; if (Math.min(A.L, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 1) { push('overlap', `${nm(B.p)} is drawn on top of ${nm(A.p)}. Delete one of them or move the run.`); continue; } }
      const tee = ends.filter(e => e.d < T && e.t > E.PANEL_THICK / 2 && e.t < e.other.L - E.PANEL_THICK / 2).sort((x, y) => x.d - y.d)[0];
      if (cross && !tee) push('cross', `${nm(A.p)} and ${nm(B.p)} cross with no junction. Panels only meet at a junction (p20): move one run, or split both runs so they meet at an X junction.`);
      else if (tee) push('tee', `${nm(tee.own.p)} ends against the middle of ${nm(tee.other.p)} with no junction. Panels only connect at a junction (p20): split ${nm(tee.other.p)}'s run so a junction falls there, or move the run.`);
      else push('close', `${nm(A.p)} and ${nm(B.p)} are closer than the 3" panel thickness, so their posts or panels collide. Join them at a junction or move one run.`);
    }
    return out;
  };
  // move a set of nodes, merging onto existing nodes when the result is a valid junction; returns false (and reverts) when not
  E.moveNodes = function (P, nodeIds, dx, dy) {
    const before = JSON.stringify({ n: P.nodes, p: P.panels });
    for (const id of nodeIds) { P.nodes[id].x += dx; P.nodes[id].y += dy; }
    for (const id of nodeIds) {
      const n = P.nodes[id]; if (!n) continue;
      const other = Object.values(P.nodes).find(m => m.id !== id && !nodeIds.includes(m.id) && Math.abs(m.x - n.x) < 1 && Math.abs(m.y - n.y) < 1);
      if (other) { for (const p of Object.values(P.panels)) { if (p.a === id) p.a = other.id; if (p.b === id) p.b = other.id; } delete P.nodes[id]; }
    }
    for (const p of Object.values(P.panels)) if (p.a === p.b) { const st = JSON.parse(before); P.nodes = st.n; P.panels = st.p; return false; }
    for (const n of Object.values(P.nodes)) { const J = E.junction(P, n); if (J.type === 'unsupported') { const st = JSON.parse(before); P.nodes = st.n; P.panels = st.p; return false; } }
    // a join can change junction types (an end of run becomes an L): lay the joined runs out again; a loop that no longer closes is refused
    const st0 = JSON.parse(before); const loopsBefore = new Set(E.normalizeGeometry({ nodes: st0.n, panels: st0.p }, { dry: true }).loops);
    if (E.normalizeGeometry(P, { dry: true }).loops.some(id => !loopsBefore.has(id))) { const st = JSON.parse(before); P.nodes = st.n; P.panels = st.p; return false; }
    E.normalizeGeometry(P);
    return true;
  };


  // ---------- package contents (what the shop pulls for each boxed part) ----------
  // Sources: p20-21 (junction contents), p32-33 (stacking), p58 (frame package), p78 (panel package), p64/60 (glass), p188 (powerkits), p453 (oval CoH trim)
  E.packageContents = function (P, l) {
    const rows = E.rowsByStyle(l.style); const r = rows.find(x => x._pid === l.pid) || rows[0]; if (!r) return [];
    const a = r.attrs || {}; const pid = l.pid || ''; const spec = l.spec || ''; const c = []; const W = a.width, thin = P.trim === 'thin';
    const has = (s) => spec.toLowerCase().includes(s);
    const qty = (n, item) => c.push({ qty: n, item });
    if (/panel-package/.test(pid)) {
      const skinH = a.height - 6;
      qty(2, `${a.skinType} skin ${W}"W × ${skinH}"H (one per side)`);
      qty(1, has('omit top cap') ? 'no top cap (omitted)' : `${has('wood top cap') ? 'wood veneer' : 'painted'} top cap ${W}"W${has('change-of-height') ? ', change-of-height end' : ''}`);
      if (has('open base')) qty(1, `open base trim set ${W}"W (no base trims)`); else qty(2, `base trim ${W}"W ${W === 18 ? '(plain)' : has('plain both') ? '(plain)' : has('plain one side') ? '(one with knockouts, one plain)' : '(with knockouts)'}`);
      qty(2, `horizontal connecting bar ${W}"W`);
      if (has('cable tray')) qty(1, `cable tray ${W}"W`); if (has('base cable tray')) qty(1, `base cable tray ${W}"W`);
      if (has('one powerkit')) qty(1, `powerkit ${W}"W with power tray and harness`); if (has('pass-through')) qty(1, `pass-through power harness ${W}"W`);
    } else if (/base-horizontal-frame-package/.test(pid)) {
      qty(1, has('omit top cap') ? 'no top cap (omitted)' : `${has('wood top cap') ? 'wood veneer' : 'painted'} top cap ${W}"W${has('change-of-height') ? ', change-of-height end' : ''}`);
      if (has('open base')) qty(1, `open base trim set ${W}"W`); else if (has('omit base trims')) qty(0, 'base trims omitted'); else qty(2, `base trim ${W}"W ${W === 18 ? '(plain)' : has('plain both') ? '(plain)' : has('plain one side') ? '(one with knockouts, one plain)' : '(with knockouts)'}`);
      qty(2, `horizontal connecting bar ${W}"W`);
      if (has('cable tray')) qty(1, `cable tray ${W}"W`); if (has('base cable tray')) qty(1, `base cable tray ${W}"W`);
    } else if (/stacking-horizontal-frame-package/.test(pid)) {
      qty(1, `horizontal connecting bar ${W}"W (stacking)`);
    } else if (/base-junction|change-of-height-junction/.test(pid) && !/utility/.test(pid)) {
      const t = a.junctionType || (/inline/.test(pid) ? 'inline' : /end-of-run/.test(pid) ? 'EOR' : /x-/.test(pid) ? 'X' : /l-change/.test(pid) ? 'L' : /t-change/.test(pid) ? 'T' : /v-change/.test(pid) ? 'V' : /y-change/.test(pid) ? 'Y' : /x-change/.test(pid) ? 'X' : '?');
      const omit = has('omit trim');
      const h = a.height || Math.max(a.heightA || 0, a.heightB || 0, a.heightC || 0, a.heightD || 0);
      qty(1, `${t === 'inline' ? 'in-line' : t === 'EOR' ? 'end-of-run' : t} junction ${h}"H (posts and blocks, black)`);
      if (/change-of-height/.test(pid)) {
        const inc = (E.product(pid).tips || []).find(x => /Junction includes/.test(x) && (a.configuration ? x.includes(a.configuration.split(' (')[0].split(';')[0]) : true)) || (E.product(pid).tips || []).find(x => /Junction includes/.test(x));
        if (inc && !omit) inc.split(':')[1].split(';').map(s => s.trim()).filter(s => s && !/junction$/i.test(s)).forEach(s => qty(1, s.replace(/^(Inside corner light seals?)/, '$1') + (/trim|cap/i.test(s) ? ` (${has('wood') ? 'wood' : 'painted'})` : '')));
        else if (omit) qty(0, 'trim, junction cap and aligners omitted (ordered separately for stacking)');
        if (t === 'inline') qty(1, 'stacking fork connector');
      } else if (!omit) {
        if (t === 'inline') qty(1, 'top cap aligner (plastic)');
        if (t === 'EOR') { qty(1, `end-of-run vertical trim ${h}"H (${has('wood') ? 'wood' : 'painted'})`); if (!thin) qty(1, 'end-of-run junction cap'); qty(1, 'trim aligner'); }
        if (t === 'L') { qty(1, 'inside corner light seal'); qty(1, `L vertical trim ${h}"H (${has('wood') ? 'wood' : 'painted'})`); qty(1, thin ? '90° junction cap' : 'junction cap'); qty(2, 'top cap aligner'); }
        if (t === 'T') { qty(2, 'inside corner light seal'); qty(1, `T vertical trim ${h}"H (${has('wood') ? 'wood' : 'painted'})`); qty(1, thin ? '90° junction cap' : 'junction cap'); qty(3, 'top cap aligner'); }
        if (t === 'X') { qty(4, 'inside corner light seal'); qty(1, thin ? '90° junction cap' : 'junction cap'); qty(4, 'top cap aligner'); }
        if (t === 'V') { qty(1, `V vertical trim ${h}"H (${has('wood') ? 'wood' : 'painted'})`); qty(1, '120° junction cap'); qty(1, 'top cap aligner'); }
        if (t === 'Y') { qty(1, '120° junction cap'); qty(2, 'top cap aligner'); }
      } else qty(0, 'trim, junction cap, light seals and aligners omitted (ordered separately for stacking)');
    } else if (/stacking.*junction/.test(pid) && !/frame/.test(pid)) {
      const t = a.junctionType || (/IPJS$/.test(l.style) ? 'inline' : /WPJS$/.test(l.style) ? 'wall' : 'EOR');
      const forks = { inline: 2, L: 2, V: 2, EOR: 2, T: 3, Y: 3, X: 4, wall: 1 }[t] || 2;
      qty(1, `${t === 'inline' ? 'in-line' : t === 'EOR' ? 'end-of-run' : t === 'wall' ? 'wall-start' : t} stacking junction ${a.stackHeight}"H (black)`);
      qty(forks, 'fork connector');
      if (!thin && ['L', 'T', 'EOR', 'V'].includes(t)) { qty(1, `stacking vertical trim ${a.stackHeight}"H`); qty(1, 'stacking trim aligner (plastic)'); }
    } else if (/frameless-glass-screen/.test(pid)) {
      const gh = a.height; qty(has('omit glass') ? 0 : 1, `${has('frosted') ? '6530 frosted' : '6500 clear'} glass ${W}"W × ${gh}"H, 3/8" thick${has('omit glass') ? ' (customer supplies)' : ''}`);
      if (/recessed/.test(pid)) { qty(W >= 78 ? 3 : 2, 'glass support'); qty(2, `thin top cap (${has('wood') ? 'wood' : 'painted'})`); qty(2, 'top cap aligner'); }
      else { qty(W >= 90 ? 3 : 2, 'clip bracket (painted)'); qty(2, 'glass support'); qty(1, `thin top cap with bracket holes ${W}"W (${has('wood') ? 'wood' : 'painted'})`); }
    } else if (/panel-top-screen/.test(pid)) { qty(1, `translucent screen ${a.screenWidth}"W × 12"H`); qty(2, 'support bracket (6623 metallic)'); }
    else if (pid === 'wc-powerkit') { qty(1, `power tray ${W}"W (black)`); qty(a.receptaclesPerSide, 'power block (receptacles both faces)'); qty(1, 'harness with modular connectors'); }
    else if (pid === 'wc-pass-through-powerkit') { qty(1, `power tray ${W}"W`); qty(1, 'pass-through harness with modular connectors'); }
    else if (/standard-change-of-height-trim/.test(pid)) { qty(1, `change-of-height trim ${a.stackHeight}"H, ${a.profile}`); qty(1, `change-of-height junction cap (${a.junctionCap})`); qty(1, 'bottom top cap filler'); }
    else if (/stacking-change-of-height-trim/.test(pid)) { qty(1, `stacking change-of-height trim ${a.stackHeight}"H`); qty(1, 'stacking trim aligner'); }
    else if (/light-seals/.test(pid)) qty(4, `inside corner light seal ${a.height}"H`);
    else if (/junction-blocks/.test(pid)) qty(a.count, `${a.application} junction block with fasteners`);
    else if (/aligners/.test(pid)) qty(a.count, a.description);
    else if (/gripper/.test(pid)) qty(10, 'gripper glide cap');
    else if (/wood-skin-sets|wood-to-the-floor-skin-sets/.test(pid)) { (a.skinHeights || []).forEach(h => qty(1, `wood skin ${W}"W × ${h}"H`)); if (!a.skinHeights) qty(1, a.description || 'skin set'); }
    else if (/glass-windows/.test(pid)) { qty(1, `${a.glass && a.glass.includes('Double') ? 'double-pane' : 'single-pane'} glass ${W}"W × ${a.height}"H`); qty(1, 'window frame (painted), both faces'); }
    else if (/off-module/.test(pid)) { qty(1, 'top bracket'); qty(1, 'bottom bracket'); qty(1, `bottom channel ${W}"W`); qty(1, 'top cap filler (oval only)'); }
    else if (/utility-package|utility-pole/.test(pid)) { (E.product(pid).standardIncludes || []).forEach(s => qty(1, s)); }
    else if (/vertical-trim/.test(pid) && /end-of-run/.test(pid)) { qty(1, `end-of-run vertical trim ${a.height}"H`); qty(1, 'trim aligner'); }
    else if (/end-of-run-inline-change-of-height-trim/.test(pid)) { qty(1, `change-of-height trim ${a.stackHeight}"H`); qty(1, 'trim aligner'); }
    return c;
  };
  E.isPackage = (l) => /package|junction|screen|powerkit|window|kit|set/i.test((l.pid || '') + ' ' + (l.desc || '')) && !/skin\b/i.test(l.cat || '');

  // =====================================================================================
  // Workstations: Universal Systems worksurfaces, panel-mounted supports and pedestals
  // Sources: 2015 p200-201 (statement of line), p223-225 (application), p222/236/237/238 (supports), p314-315 (pedestals),
  // specifying p539 (straight), p563 (corner), p567 (extended corner), p568 (120°), p588-591 (supports),
  // p594 (legs), p651/652/653/655/656 (pedestals), p652 (fillers)
  // =====================================================================================
  E.WS_HEIGHT = 28.5;                 // seated worksurface height with 27"H fixed pedestals (p314, p590)
  E.WS_DEPTHS = [24, 30, 18]; // panel-mounted depths. 36"D (35 1/2") straights are freestanding only (p539 tip): not offered on panels
  E.WS_EDGES = { '3mm': 'Plastic 3 mm edge', P: 'Plastic P-edge', SW: 'Wood square edge', K: 'Plastic knife edge' };
  E.WS_SPAN_MAX = 54;                 // supports at least every 54" (p224, p237)
  E.PED_W = 15;
  const RAD = Math.PI / 180;
  function unit(P, p) { const a = P.nodes[p.a], b = P.nodes[p.b]; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return [(b.x - a.x) / L, (b.y - a.y) / L]; }
  // side 0 is the right-hand side walking a→b (elevation "Side A" reads a→b left to right); side 1 is the left-hand side
  E.sideNormal = function (P, p, side) { const [dx, dy] = unit(P, p); return side === 0 ? [dy, -dx] : [-dy, dx]; };
  // the straight run (in-line chain) through a panel, ordered so every panel points the same way as `pid` a→b
  E.runOf = function (P, pid) {
    const p = P.panels[pid]; if (!p) return null;
    const [dx, dy] = unit(P, p); const same = (q) => { const [ex, ey] = unit(P, q); return dx * ex + dy * ey > 0.999; };
    const opp = (q) => { const [ex, ey] = unit(P, q); return dx * ex + dy * ey < -0.999; };
    const at = (nid, excl) => Object.values(P.panels).filter(q => q.id !== excl && (q.a === nid || q.b === nid));
    const walk = (nid, cur, fwd) => { const out = []; let node = nid, c = cur; for (let i = 0; i < 60; i++) { const legs = at(node, c.id); if (legs.length !== 1) break; const q = legs[0]; const enter = q.a === node ? 'a' : 'b'; const ok = fwd ? (enter === 'a' && same(q)) || (enter === 'b' && opp(q)) : (enter === 'b' && same(q)) || (enter === 'a' && opp(q)); if (!ok) break; out.push({ p: q, flip: !same(q) }); c = q; node = enter === 'a' ? q.b : q.a; } return out; };
    const back = walk(p.a, p, false).reverse(), fwd = walk(p.b, p, true);
    const seq = [...back, { p, flip: false }, ...fwd];
    const first = seq[0]; const start = P.nodes[first.flip ? first.p.b : first.p.a];
    // offsets from the start node: each panel's module (from..to, its nominal width); a run that starts or ends at a corner junction starts its first
    // module (ends its last) the corner allowance away from that node (CORNER_ALLOW), so length is node to node. Inner nodes are in-line (allowance 0).
    const last = seq[seq.length - 1]; const end = P.nodes[last.flip ? last.p.a : last.p.b];
    const caLo = E.nodeAllow(P, start.id), caHi = E.nodeAllow(P, end.id);
    let off = caLo; const panels = seq.map(s => { const o = off; off += s.p.width; return { id: s.p.id, panel: s.p, flip: s.flip, from: o, to: off }; });
    return { start, end, dir: [dx, dy], length: off + caHi, panels, startNode: start.id, endNode: end.id, ca: { lo: caLo, hi: caHi } };
  };
  // offset of a point along a run measured from the run start
  E.runOffset = function (run, x, y) { return (x - run.start.x) * run.dir[0] + (y - run.start.y) * run.dir[1]; };
  E.newWorksurface = function (P, spec) {
    P.worksurfaces = P.worksurfaces || {};
    const id = 'W' + (P.seq++);
    const ws = Object.assign({ id, kind: 'straight', panel: null, side: 0, off: 0, width: 48, depth: 24, edge: '3mm', construction: 'cord-drop', material: 'laminate', node: null, legs: null, C: 42, D: 42, depthA: 24, depthB: 24, hand: 'L', supports: { lo: 'auto', hi: 'auto' }, peds: [], options: { openLine: false, omitScallop: false }, label: '' }, spec);
    P.worksurfaces[id] = ws;
    // corners are kept left-arm first (C and depth A are the user's left arm, p563, p567, p568); swapping the legs keeps the same plan
    if (ws.kind !== 'straight' && ws.node && ws.legs) { const dm = E.cornerDims(P, ws); if (dm && !dm.leftFirst) Object.assign(ws, { legs: [ws.legs[1], ws.legs[0]], C: ws.D, D: ws.C, depthA: ws.depthB, depthB: ws.depthA, peds: (ws.peds || []).map(d => Object.assign(d, { at: d.at === 'arm0' ? 'arm1' : d.at === 'arm1' ? 'arm0' : d.at })) }); if (dm && ws.kind === 'extcorner') ws.hand = dm.hand; }
    return ws;
  };
  E.removeWorksurface = function (P, id) { if (P.worksurfaces) delete P.worksurfaces[id]; };
  E.addPedestal = function (P, ws, spec) { const id = 'D' + (P.seq++); const d = Object.assign({ id, at: 'hi', type: 'fixed', config: 'A', front: 'F', pull: 'contemporary', pullColor: '9201' }, spec); ws.peds = ws.peds || []; ws.peds = ws.peds.filter(x => x.at !== d.at); ws.peds.push(d); return d; };
  E.removePedestal = function (P, ws, id) { ws.peds = (ws.peds || []).filter(x => x.id !== id); };
  // widths a straight worksurface can be at a given place on a run (limited by the run and by the catalog)
  E.wsWidths = function (P, ws) { const rows = rowsOf('uw-straight').filter(r => r.attrs.depth === wsDepthActual(ws.depth, ws.construction)); const ws_ = [...new Set(rows.map(r => r.attrs.width))].sort((a, b) => a - b); const run = ws.panel ? E.runOf(P, ws.panel) : null; if (!run) return ws_; const host = run.panels.find(r => r.id === ws.panel); const from = host.from + ws.off; const al = E.runEndAllow(P, run); return ws_.filter(w => from + w <= run.length + al.hi + 0.01); };
  function wsDepthActual(d, construction) { return construction === 'full-depth' ? ({ 18: 18.875, 24: 24, 30: 30, 36: 36 })[d] : ({ 18: 18.375, 24: 23.5, 30: 29.5, 36: 35.5 })[d]; }
  E.wsDepthActual = wsDepthActual;
  // plan geometry. A 1/2" cord-drop worksurface is 1/2" shallower than the full-depth one and sits on the same supports: the 1/2" is left
  // behind it so cords pass over the back edge at any point (p224, p236 alignment tab), and its front edge lands where a full-depth
  // worksurface's does. P-edge profiles are 3/8" deeper at the front (p223, p225).
  const CORD_GAP = 0.5, PEDGE = 0.375;
  function wsBackGap(ws) { return ws.construction === 'full-depth' ? 0 : CORD_GAP; }
  function wsPlanDepth(ws, d) { return wsDepthActual(d, ws.construction) + (ws.material !== 'wood' && ws.edge === 'P' ? PEDGE : 0); }
  E.wsBackGap = wsBackGap; E.wsPlanDepth = wsPlanDepth;
  // a corner arm's actual back-edge length for its nominal size and construction, from the catalog (widthC/widthD: 47 1/2" cord drop, 48" full depth
  // for a 48", p563, p567, p568); sizes the catalog lacks fall back to nominal less the cord-drop gap, the rule every listed size follows
  const CORNER_PID = { corner: 'uw-corner-curved', extcorner: 'uw-extended-corner-curved', corner120: 'uw-corner-120' };
  function armActual(ws, nom) {
    const rows = (BYID[CORNER_PID[ws.kind]] || { rows: [] }).rows;
    for (const r of rows) { if (r.attrs.construction !== ws.construction) continue; if (nominal(r.attrs.widthC) === nom) return r.attrs.widthC; if (nominal(r.attrs.widthD) === nom) return r.attrs.widthD; }
    return nom - wsBackGap(ws);
  }
  const quad = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  // geometry in plan inches: poly (the outline, curve sampled), outline (hard corners, the cove starts at outline[curveAt]), back edge, ends (lo/hi), arms for corners.
  // Every end also carries its base: the point on the panel centerline the end lines up with, used for seams and junction checks.
  E.wsGeometry = function (P, ws) {
    if (ws.kind === 'straight') {
      const p = P.panels[ws.panel]; if (!p) return null;
      const run = E.runOf(P, ws.panel); const [dx, dy] = run.dir; const hostPanel = run.panels.find(r => r.id === ws.panel);
      // ws.off is measured from the host panel's low end along the run direction
      const base = hostPanel.from + ws.off; const [nx, ny] = ws.side === 0 ? [dy, -dx] : [-dy, dx];
      const h = POST_HALF + wsBackGap(ws); const c0 = [run.start.x + dx * base, run.start.y + dy * base];
      const s = [c0[0] + nx * h, c0[1] + ny * h]; const d = wsPlanDepth(ws, ws.depth);
      const lo = s, hi = [s[0] + dx * ws.width, s[1] + dy * ws.width];
      const poly = [lo, hi, [hi[0] + nx * d, hi[1] + ny * d], [lo[0] + nx * d, lo[1] + ny * d]];
      return { kind: 'straight', poly, outline: poly, lo, hi, loBase: c0, hiBase: [c0[0] + dx * ws.width, c0[1] + dy * ws.width], n: [nx, ny], dir: [dx, dy], run, from: base, to: base + ws.width, back: h, depth: d, depth0: wsDepthActual(ws.depth, ws.construction), front: [[lo[0] + nx * d, lo[1] + ny * d], [hi[0] + nx * d, hi[1] + ny * d]] };
    }
    const node = P.nodes[ws.node]; if (!node || !ws.legs) return null;
    const p1 = P.panels[ws.legs[0]], p2 = P.panels[ws.legs[1]]; if (!p1 || !p2) return null;
    const dirFrom = (p) => { const o = P.nodes[p.a === node.id ? p.b : p.a]; const L = Math.hypot(o.x - node.x, o.y - node.y) || 1; return [(o.x - node.x) / L, (o.y - node.y) / L]; };
    const d1 = dirFrom(p1), d2 = dirFrom(p2);
    const C = ws.C, D = ws.D, dA = wsPlanDepth(ws, ws.depthA), dB = wsPlanDepth(ws, ws.depthB);
    // rear corner where the two back edges meet (post face plus the cord-drop gap off each leg's centerline, 90° or 120°)
    const cs = d1[0] * d2[0] + d1[1] * d2[1], sn = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) || 1, h = POST_HALF + wsBackGap(ws), k = h / sn;
    const o = [node.x + (d1[0] + d2[0]) * k, node.y + (d1[1] + d2[1]) * k];
    // worksurfaces butt at the junction centerline: straights run junction to junction, corner arms end on the junction. Each arm's back edge is the
    // catalog's actual width C or D (47 1/2" for a 48" cord-drop arm, 48" full depth, p563, p567, p568) from the rear corner o; o projects `back` along
    // each leg, so the arm end lands back + actual from the node: the corner allowance + nominal width, the next junction center (see CORNER_ALLOW)
    const back = k * (1 + cs), la = armActual(ws, C), lb = armActual(ws, D);
    // arm depths are measured perpendicular to each leg, into the sector between the legs (90° or 120°)
    const n1 = [(d2[0] - d1[0] * cs) / sn, (d2[1] - d1[1] * cs) / sn], n2 = [(d1[0] - d2[0] * cs) / sn, (d1[1] - d2[1] * cs) / sn];
    const A1 = [o[0] + d1[0] * la, o[1] + d1[1] * la], A2 = [o[0] + d2[0] * lb, o[1] + d2[1] * lb];
    const F1 = [A1[0] + n1[0] * dA, A1[1] + n1[1] * dA], F2 = [A2[0] + n2[0] * dB, A2[1] + n2[1] * dB];
    const inner = [o[0] + d1[0] * (dB / sn) + d2[0] * (dA / sn), o[1] + d1[1] * (dB / sn) + d2[1] * (dA / sn)];
    // curved front: a corner's cove runs from arm end to arm end (p563, p568). An extended corner keeps a straight front along the extra length of
    // its long arm and has the cove of the standard corner of its short arm (p567 figure).
    let S1 = F1, S2 = F2;
    if (ws.kind === 'extcorner') { const s = Math.min(la, lb); if (la > lb + 0.01) S1 = [o[0] + d1[0] * s + n1[0] * dA, o[1] + d1[1] * s + n1[1] * dA]; else if (lb > la + 0.01) S2 = [o[0] + d2[0] * s + n2[0] * dB, o[1] + d2[1] * s + n2[1] * dB]; }
    const N = 20, cove = [S1]; for (let i = 1; i < N; i++) cove.push(quad(S1, inner, S2, i / N)); cove.push(S2);
    const outline = [o, A1, F1]; if (S1 !== F1) outline.push(S1); const curveAt = outline.length - 1; if (S2 !== F2) outline.push(S2); outline.push(F2, A2);
    const poly = [o, A1, F1, ...cove.filter((q, i) => !(i === 0 && S1 === F1) && !(i === N && S2 === F2)), F2, A2];
    const r1 = back + la, r2 = back + lb; // arm end along each leg from the node
    const base1 = [node.x + d1[0] * r1, node.y + d1[1] * r1], base2 = [node.x + d2[0] * r2, node.y + d2[1] * r2];
    return { kind: ws.kind, poly, outline, curveAt, o, back: h, arms: [{ end: A1, base: base1, dir: d1, n: n1, panel: p1, len: C, reach: r1, depth: dA, depth0: wsDepthActual(ws.depthA, ws.construction), front: F1 }, { end: A2, base: base2, dir: d2, n: n2, panel: p2, len: D, reach: r2, depth: dB, depth0: wsDepthActual(ws.depthB, ws.construction), front: F2 }], inner, curve: [S1, inner, S2], cove };
  };
  const POST_HALF = 1.5;
  // how far a worksurface may run past the end node of its run: at a corner, over the junction block to its far face (the other leg's outer face,
  // 1 1/2"); to the finished trim face at an end of run (FOOTPRINT.eor, p20, p92); to the wall at a wall start (p21). The run's modules already stop
  // the corner allowance short of a corner node (CORNER_ALLOW), so a worksurface wrapped by the return panel ends on its module line.
  function runEndAllow(P, nid) { const n = P.nodes[nid]; const J = n ? E.junction(P, n) : null; const t = J && J.type; const fp = E.FOOTPRINT[P.trim] || E.FOOTPRINT.thin; return t === 'wall' ? fp.wall : t === 'EOR' ? fp.eor : POST_HALF; }
  E.runEndAllow = (P, run) => ({ lo: runEndAllow(P, run.startNode), hi: runEndAllow(P, run.endNode) });
  const ON_JUNCTION = 1.6; // an on-module support engages the junction uprights (p236): its worksurface end lines up with the junction center, within the 1 1/2" post face (p20)
  const SEAM_TOL = 0.6;    // two ends butt at a seam: no more than this apart, same side, facing each other
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  // is a worksurface end wrapped by a return panel (a panel leaving the junction at that end toward the worksurface side)?
  function wrappedBy(P, e) {
    for (const n of Object.values(P.nodes)) {
      if (dist([n.x, n.y], e.base) > ON_JUNCTION) continue;
      for (const q of Object.values(P.panels)) {
        if (q.a !== n.id && q.b !== n.id) continue; const o = P.nodes[q.a === n.id ? q.b : q.a]; const L = Math.hypot(o.x - n.x, o.y - n.y) || 1; const d = [(o.x - n.x) / L, (o.y - n.y) / L];
        if (dot(d, e.n) > 0.95) return q;
      }
    }
    return null;
  }
  // guide dimensions of a corner worksurface: C and depth A are always the user's left arm (plans on p563, p567, p568), whatever order the legs were picked in
  function cornerDims(ws, g) { const [a0, a1] = g.arms; const leftFirst = a0.dir[0] * a1.dir[1] - a0.dir[1] * a1.dir[0] > 0; const d = leftFirst ? { C: ws.C, D: ws.D, depthA: ws.depthA, depthB: ws.depthB } : { C: ws.D, D: ws.C, depthA: ws.depthB, depthB: ws.depthA }; d.hand = d.C > d.D ? 'L' : d.C < d.D ? 'R' : null; d.leftFirst = leftFirst; return d; }
  E.cornerDims = (P, ws) => { const g = E.wsGeometry(P, ws); return g && g.arms ? cornerDims(ws, g) : null; };
  function cornerRow(pid, ws, dm) { return findRow(pid, r => r.attrs.construction === ws.construction && nominal(r.attrs.depthA) === dm.depthA && nominal(r.attrs.depthB) === dm.depthB && nominal(r.attrs.widthC) === dm.C && nominal(r.attrs.widthD) === dm.D && (ws.kind !== 'extcorner' || r.attrs.handed === (dm.hand === 'L' ? 'left' : 'right'))); }
  const JUNCTION_MOUNTED = { cantilever: 'cantilever', ssb: 'side support bracket', endpanel: 'end panel', csp: 'center support panel' };
  const SUPPORT_NAME = Object.assign({ leg: 'post leg', pedestal: 'fixed pedestal' }, JUNCTION_MOUNTED);
  // the points a support can hang on: every node, and on each leg of a corner junction its module line, the corner allowance out (CORNER_ALLOW)
  E.junctionPoints = function (P, nodesInfo) {
    const pts = [];
    for (const n of Object.values(P.nodes)) {
      pts.push([n.x, n.y]); const J = (nodesInfo && nodesInfo[n.id]) || E.junction(P, n); const ca = E.cornerAllow(J.type); if (!ca) continue;
      for (const l of J.legs) { const o = P.nodes[l.farNode]; if (!o) continue; const L = Math.hypot(o.x - n.x, o.y - n.y) || 1; pts.push([n.x + (o.x - n.x) / L * ca, n.y + (o.y - n.y) / L * ca]); }
    }
    return pts;
  };
  function nearestNodeDist(pts, pt) { let b = Infinity; for (const q of pts) b = Math.min(b, dist(q, pt)); return b; }
  const PULLS = { A: 3, B: 2, C: 2 }; // drawers (one pull each): box/box/file, file/file, box/file (p651, p656)
  // pull finishes (p316): contemporary, handle, jazz and bar pulls are plated metal; c:scape pulls are painted
  E.PULL_COLORS = { metal: [['9201', 'Polished Chrome'], ['0835', 'Black'], ['9211', 'Nickel'], ['9212', 'Silver']], cscape: [['4140', 'Arctic White Gloss'], ['4144', 'Black Gloss'], ['4799', 'Platinum Metallic']] };
  E.pullColors = (pull) => pull === 'c:scape' ? E.PULL_COLORS.cscape : E.PULL_COLORS.metal;
  function pedNominalDepth(d, wd) { return d.type === 'mobile' ? (wd >= 24 ? 24 : 18) : Math.min(30, Math.max(18, wd)); }
  // on-module supports along a span: take the panel junctions under it so no two supports are more than lim apart (p224, p237);
  // when no junction is within lim, the nearest one beyond still shortens the span
  function spanSupports(js, posLo, posHi, lim) { const mids = []; let last = posLo; while (posHi - last > lim + 0.01) { const ahead = js.filter(t => t > last + 0.01); if (!ahead.length) break; const within = ahead.filter(t => t - last <= lim + 0.01); const c = within.length ? within[within.length - 1] : ahead[0]; mids.push(c); last = c; } const stops = [posLo, ...mids, posHi]; const span = Math.max(...stops.slice(1).map((t, i) => Math.round((t - stops[i]) * 10) / 10)); return { mids, span }; }
  // supports and BOM for every worksurface on the plan
  function worksurfacesBOM(P, lines, warn, errors, nodesInfo) {
    const W = Object.values(P.worksurfaces || {}); if (!W.length) return;
    const F = P.finishes; const geo = {}; for (const ws of W) geo[ws.id] = E.wsGeometry(P, ws); const jpts = E.junctionPoints(P, nodesInfo);
    for (const ws of W) { const g = geo[ws.id]; ws._armNames = null; ws._lret = null; ws._seams = []; ws._supportAt = {}; ws._armMid = []; if (g && g.arms) ws._armNames = cornerDims(ws, g).leftFirst ? ['left arm', 'right arm'] : ['right arm', 'left arm']; }
    const ends = []; // {ws, key, pt (back corner), base (on the panel centerline), out (outward), n (worksurface side), g, depth}
    for (const ws of W) {
      const g = geo[ws.id]; if (!g) { errors.push({ panel: ws.id, msg: 'Worksurface has lost its panel. Delete it and place it again.' }); continue; }
      if (g.kind === 'straight') { ends.push({ ws, key: 'lo', pt: g.lo, base: g.loBase, out: [-g.dir[0], -g.dir[1]], n: g.n, g, depth: g.depth }); ends.push({ ws, key: 'hi', pt: g.hi, base: g.hiBase, out: g.dir, n: g.n, g, depth: g.depth }); }
      else g.arms.forEach((a, i) => ends.push({ ws, key: 'arm' + i, pt: a.end, base: a.base, out: a.dir, n: a.n, g, arm: a, depth: a.depth }));
    }
    const nomDepth = (e) => e.g.kind === 'straight' ? e.ws.depth : e.key === 'arm1' ? e.ws.depthB : e.ws.depthA;
    // two ends meet at a seam when they butt end to end on the same side of the panel run
    const abutting = (e) => ends.find(f => f.ws !== e.ws && dist(f.base, e.base) <= SEAM_TOL && dot(f.out, e.out) < -0.9 && dot(f.n, e.n) > 0.9);
    // L-configuration of two straight worksurfaces (p225 tip, p223): this end butts the front edge of a perpendicular straight worksurface
    const lJoint = (e) => {
      if (e.g.kind !== 'straight') return null;
      for (const ws of W) {
        const g = geo[ws.id]; if (!g || ws === e.ws || g.kind !== 'straight' || Math.abs(dot(g.dir, e.g.dir)) > 0.01 || dot(e.out, g.n) > -0.99) continue;
        const f0 = g.front[0]; if (Math.abs((e.pt[0] - f0[0]) * g.n[0] + (e.pt[1] - f0[1]) * g.n[1]) > SEAM_TOL) continue;
        const along = (p) => (p[0] - g.lo[0]) * g.dir[0] + (p[1] - g.lo[1]) * g.dir[1]; const a0 = along(e.pt), a1 = along([e.pt[0] + e.n[0] * e.depth, e.pt[1] + e.n[1] * e.depth]);
        if (Math.min(Math.max(a0, a1), ws.width) - Math.max(Math.min(a0, a1), 0) > 1) return ws;
      }
      return null;
    };
    // pass 1: what each end asks for on its own
    for (const e of ends) {
      const ws = e.ws; e.flags = []; e.notes = []; e.nb = abutting(e); e.lj = e.nb ? null : lJoint(e); e.wrap = wrappedBy(P, e); e.ped = (ws.peds || []).find(d => d.at === e.key && d.type === 'fixed');
      e.explicit = ((ws.supports || {})[e.key] || 'auto') !== 'auto';
      let s = (ws.supports || {})[e.key] || 'auto';
      // a side support bracket needs a return panel whose width matches the worksurface depth (p236); any other wrapped end takes a cantilever
      if (s === 'auto') s = e.ped ? 'pedestal' : e.nb ? 'seam' : (e.wrap && ws.kind === 'straight' && e.wrap.width === nomDepth(e)) ? 'ssb' : 'cantilever';
      if (s === 'ssb' && !e.wrap) { e.flags.push(`Side support bracket at the ${endName(ws, e.key)} end needs a return panel wrapping that end (p236). Changed to a cantilever.`); s = 'cantilever'; }
      e.s = s;
    }
    // pass 2: one support per seam (p237 tip: "Answer panel junctions can accommodate only one support at each worksurface seam")
    const done = new Set(), seams = [];
    for (const e of ends) {
      const f = e.nb; if (!f || done.has(e) || done.has(f)) continue; done.add(e); done.add(f); seams.push([e, f]);
      const carries = (x) => ['seam', 'cantilever', 'csp'].includes(x.s);
      if (carries(e) && carries(f)) {
        const rank = (x) => (x.s !== 'seam' ? 4 : 0) + (x.ws.kind !== 'straight' ? 2 : 0) + (x.key === 'hi' ? 1 : 0); // an explicit support, then the corner, then the lower-offset worksurface carries it
        const [c, o] = rank(e) >= rank(f) ? [e, f] : [f, e];
        if (c.s === 'seam') c.s = 'cantilever';
        if (o.explicit && o.s !== 'seam') o.notes.push(`The ${SUPPORT_NAME[o.s]} set at the ${endName(o.ws, o.key)} end is the one ${wsName(c.ws)} carries at this seam: Answer junctions take one support per seam (p237 tip).`);
        o.s = 'shared';
      } else for (const [x, y] of [[e, f], [f, e]]) if (carries(x) && !carries(y)) {
        if (x.s === 'seam') x.s = 'cantilever'; // the neighbor's end rests on a pedestal, leg or end panel, so this end needs its own support
        if (y.s === 'endpanel') errors.push({ panel: y.ws.id, msg: `${wsName(y.ws)}: an end panel supports one worksurface end, and ${wsName(x.ws)} also needs a support at that seam. Answer junctions take one support per seam: use a shared cantilever or center support panel (p236, p237).` });
      }
    }
    for (const e of ends) if (e.s === 'seam') e.s = 'cantilever';
    // a center support panel is shared by two worksurfaces at a seam; it is not a substitute for an end panel (p236, p237)
    for (const e of ends) if (e.s === 'csp' && !e.nb) errors.push({ panel: e.ws.id, msg: `${wsName(e.ws)}: a center support panel at the free ${endName(e.ws, e.key)} end. Center support panels are shared by two worksurfaces at a seam and cannot substitute for an end panel (p237). Use a cantilever, end panel, post leg or pedestal.` });
    // L-configurations: the return butts the other worksurface's front edge and supports it (p223 "adjacent return worksurface"); a tie plate joins them
    const lseams = ends.filter(e => e.lj);
    for (const e of lseams) {
      const A = e.lj; A._lret = (A._lret || []).concat(e.ws.id); const both = [A, e.ws];
      e.notes.push(`L-configuration: the ${endName(e.ws, e.key)} end butts the front edge of ${wsName(A)} and is tied to it (p225, p223).`);
      if (both.some(w => w.construction !== 'full-depth')) warn.push({ panel: e.ws.id, msg: `${wsName(e.ws)} and ${wsName(A)} form an L-configuration with a 1/2" cord-drop worksurface, which leaves uneven gaps. Use full-depth worksurfaces for L-configurations (p225 tip).` });
      if (both.some(w => w.material !== 'wood' && w.edge === 'P')) warn.push({ panel: e.ws.id, msg: `${wsName(e.ws)} and ${wsName(A)}: a P-edge profile produces a valley where it meets a perpendicular worksurface, and its extra 3/8" depth is an interference fit on-module. Use the 3 mm edge profile for L-configurations (p225).` });
      if (both.some(w => w.material !== 'wood' && w.edge === 'K')) warn.push({ panel: e.ws.id, msg: `${wsName(e.ws)} and ${wsName(A)}: knife-edge L-configurations are joined with two UFB flat brackets, since a cantilever is not wide enough for the joint (p223). The guide gives no style number for them: order them with the worksurfaces.` });
    }
    // seams between a full-depth and a cord-drop worksurface: the 1/2" cable gap at the back stops at the seam (p225)
    for (const [e, f] of seams) if (e.ws.construction !== f.ws.construction) warn.push({ panel: e.ws.id, msg: `${wsName(e.ws)} and ${wsName(f.ws)} butt at a seam but one is full depth and the other has the 1/2" cord drop, so the gap at the back is uneven. Use one construction for worksurfaces that meet (p225).` });
    const endOf = (ws, k) => ends.find(x => x.ws === ws && x.key === k);
    let ssbSingles = 0; const ssbWhere = [];
    const paint = paintSpec(F); const pg = E.paintGroupCode(F.trimPaint);
    for (const ws of W) {
      const g = geo[ws.id]; if (!g) continue; const ctx = ws.id;
      // ---- the worksurface itself ----
      const pid = { straight: 'uw-straight', corner: 'uw-corner-curved', extcorner: 'uw-extended-corner-curved', corner120: 'uw-corner-120' }[ws.kind];
      const prod = BYID[pid]; let row = null;
      if (ws.kind === 'straight') row = findRow(pid, r => r.attrs.width === ws.width && r.attrs.depth === wsDepthActual(ws.depth, ws.construction));
      else row = cornerRow(pid, ws, cornerDims(ws, g));
      const edge = ws.material === 'wood' ? 'SW' : ws.edge;
      if (!row) { lines.push(Line('Worksurface', 1, null, prod, `${wsName(ws)} — no matching style in the guide`, '', { style: '—', flags: [`No ${wsName(ws)} in the guide at that size (p${prod.pages[0]}).`], src: ctx })); errors.push({ panel: ws.id, msg: `${wsName(ws)}: that size is not in the guide (p${prod.pages[0]}).` }); continue; }
      const price = row.priceByEdge[edge]; const offered = price !== undefined && price !== null; const suffix = edge === '3mm' || !offered ? '' : edge;
      const l = Line('Worksurface', 1, row, prod, `${row.desc} — ${E.WS_EDGES[offered ? edge : '3mm']}`, '', { style: row.style + suffix, unit: offered ? price : row.price, src: ctx, page: row.page || prod.pages[0] });
      if (!offered) { l.flags.push(`${E.WS_EDGES[edge]} is not offered on ${row.style} (p${prod.pages[0]}). Listed and priced at the 3 mm edge.`); errors.push({ panel: ws.id, msg: `${wsName(ws)}: ${E.WS_EDGES[edge]} is not offered on ${row.style} (p${prod.pages[0]}). Pick an offered edge.` }); }
      if (ws.material === 'wood') { l.spec = `wood ${F.wood.code} ${F.wood.name}`; if (ws.options.fullFill && row.adders.fullFill) { l.unit += row.adders.fullFill; l.spec += `; full-fill finish (+$${row.adders.fullFill})`; } }
      else { l.spec = `laminate ${F.laminate.code} ${F.laminate.name}; edge plastic ${(F.edge || {}).code || '6009'} ${(F.edge || {}).name || 'Arctic White'}`; if (ws.options.openLine) addOpt(l, prod, 'openLine', row, 'Open Line laminate'); }
      if (ws.options.omitScallop) l.spec += '; omit scallop';
      if (ws.construction === 'full-depth') l.notes.push('Full-depth worksurface: bend down the alignment tab on each support (p236).');
      lines.push(l);
      // ---- supports ----
      const resolved = {}; const keys = g.kind === 'straight' ? ['lo', 'hi'] : ['arm0', 'arm1'];
      for (const k of keys) {
        const e = endOf(ws, k); resolved[k] = e.s; l.flags.push(...e.flags); l.notes.push(...e.notes);
        if (e.s === 'ssb' && e.wrap && e.wrap.width !== nomDepth(e)) warn.push({ panel: ws.id, msg: `${wsName(ws)}: the side support bracket at the ${endName(ws, k)} end rides on a ${e.wrap.width}"W return panel, but a side support bracket supports an end wrapped by a panel whose width matches the ${nomDepth(e)}"D worksurface (p236). Use a cantilever there or a ${nomDepth(e)}"W return.` });
      }
      let mids = [];
      if (g.kind === 'straight') {
        // 30"D (and deeper) straight worksurfaces need floor support along the front edge (p223, p237): a pedestal, end panel, post leg, side support bracket or an adjacent return worksurface
        const floor = (k) => ['pedestal', 'endpanel', 'ssb', 'leg'].includes(resolved[k]);
        if (ws.depth >= 30 && !floor('lo') && !floor('hi') && !ws._lret) {
          const free = (k) => !endOf(ws, k).nb && resolved[k] === 'cantilever' && (ws.supports[k] || 'auto') === 'auto';
          const ep = findRow('uw-end-panels', x => x.attrs.depth === ws.depth && !x.attrs.standingHeight);
          const k = free('hi') ? 'hi' : free('lo') ? 'lo' : null;
          if (k && ep) { resolved[k] = 'endpanel'; l.notes.push(`${ws.depth}"D cantilevered worksurfaces need floor support along the front edge: an end panel was added at the ${endName(ws, k)} end. A pedestal, post leg or side support bracket also satisfies this (p223, p237).`); }
          else warn.push({ panel: ws.id, msg: `${wsName(ws)} is ${ws.depth}"D and has no floor support along the front edge. Add a fixed pedestal or a post leg under it${ep ? '' : ` (end panels come 24"D and 30"D only, p590)`}, or butt a return worksurface to its front edge (p223, p237).` });
        }
        // supports at least every 54" (p224, p237): a cantilever goes on each panel junction under the worksurface where needed; a reinforcing channel allows 60" (heavy) or 72" (light)
        const knife = edge === 'K' && offered; const lim = knife ? 48 : E.WS_SPAN_MAX;
        const posLo = g.from + (resolved.lo === 'pedestal' ? E.PED_W : 0), posHi = g.to - (resolved.hi === 'pedestal' ? E.PED_W : 0);
        const js = g.run.panels.map(r => r.to).filter(t => t > posLo + 3.2 && t < posHi - 3.2).sort((a, b) => a - b);
        const sp = spanSupports(js, posLo, posHi, lim); mids = sp.mids; const span = sp.span;
        if (span > lim) {
          const rc = findRow('uw-reinforcing-channels', r => r.attrs.forWorksurfaceWidths.includes(ws.width));
          if (span > 72) errors.push({ panel: ws.id, msg: `${wsName(ws)}: ${span}" between supports is over the 72" a reinforcing channel allows. Add a pedestal or center support (p224).` });
          else if (rc) { const c = Line('Supports', 1, rc, BYID['uw-reinforcing-channels'], `Reinforcing channel ${rc.attrs.width}"W for ${ws.width}"W worksurface`, 'black', { src: ctx }); c.notes.push(`Unsupported span of ${span}" is over ${knife ? '48" (knife edge)' : '54"'}. The channel allows 60" for heavy loads or 72" for light loads (p224). A pedestal or center support panel under the worksurface is the alternative.`); lines.push(c); }
          else warn.push({ panel: ws.id, msg: `${wsName(ws)}: ${span}" unsupported span and the guide lists no reinforcing channel for a ${ws.width}"W worksurface (p224, p589). Add a pedestal or center support under it.` });
        }
        if (ws.depth === 36) errors.push({ panel: ws.id, msg: `${wsName(ws)}: 35 1/2"D worksurfaces can only be used in freestanding applications (p539 tip). Use 30"D or less on panels.` });
        { const al = E.runEndAllow(P, g.run); if (g.from < -al.lo - 0.01 || g.to > g.run.length + al.hi + 0.01) errors.push({ panel: ws.id, msg: `${wsName(ws)} runs past the end of its panel run. Slide it or shorten it.` }); }
      } else {
        // corner worksurfaces: rear corner takes one side support bracket, each arm end a cantilever unless shared (p237, p588 tip); junctions under a long arm take a cantilever before a channel is needed (p224)
        ssbSingles += 1; ssbWhere.push(wsName(ws) + ' rear corner');
        const node = P.nodes[ws.node];
        g.arms.forEach((a, i) => {
          const runA = E.runOf(P, a.panel.id); const along = E.runOffset(runA, a.base[0], a.base[1]);
          const alA = E.runEndAllow(P, runA); if (along > runA.length + alA.hi + 0.01 || along < -alA.lo - 0.01) errors.push({ panel: ws.id, msg: `${wsName(ws)}: the ${a.len}" ${ws._armNames[i]} runs past the ${a.panel.id} run.` });
          const posEnd = a.reach - (resolved['arm' + i] === 'pedestal' ? E.PED_W : 0); // measured along the leg from the node, like the junctions
          const t0 = E.runOffset(runA, node.x, node.y), sg = dot(a.dir, runA.dir) > 0 ? 1 : -1;
          const js = [...new Set(runA.panels.flatMap(r => [r.from, r.to]))].map(x => (x - t0) * sg).filter(t => t > 3.2 && t < posEnd - 3.2).sort((p, q) => p - q);
          const sp = spanSupports(js, 0, posEnd, E.WS_SPAN_MAX); for (const t of sp.mids) ws._armMid.push([i, t]);
          if (sp.span > E.WS_SPAN_MAX) { const rc = findRow('uw-reinforcing-channels', r => r.attrs.forWorksurfaceWidths.includes(a.len)); if (rc) { const c = Line('Supports', 1, rc, BYID['uw-reinforcing-channels'], `Reinforcing channel ${rc.attrs.width}"W for the ${a.len}" ${ws._armNames[i]}`, 'black', { src: ctx }); c.notes.push('Extended corner arm over 54" (p224, p567 tip).'); lines.push(c); } }
        });
        const J = nodesInfo[ws.node]; if (ws.kind === 'corner120' && (!J || J.family !== 120)) errors.push({ panel: ws.id, msg: '120° corner worksurfaces go on a V or Y junction (p568).' });
        if (ws.kind !== 'corner120' && J && J.family === 120) errors.push({ panel: ws.id, msg: 'A 90° corner worksurface cannot sit on a 120° junction. Use the 120° corner worksurface (p568).' });
      }
      // on-module supports engage the slots in the junction uprights (p236): the end they carry must line up with a panel junction
      for (const k of keys) { const s = resolved[k]; const d = nearestNodeDist(jpts, endOf(ws, k).base); ws._supportAt[k] = { s, d: Math.round(d * 100) / 100, junction: !!JUNCTION_MOUNTED[s] }; if (!JUNCTION_MOUNTED[s]) continue; if (d > ON_JUNCTION) errors.push({ panel: ws.id, msg: `${wsName(ws)}: the ${JUNCTION_MOUNTED[s]} at the ${endName(ws, k)} end is ${Math.round(d * 10) / 10}" from the nearest panel junction. On-module supports engage the junction uprights (p236). Put the worksurface ends on panel seams (worksurface widths match the panel widths, p225) or support that end with a pedestal or post leg.` }); }
      ws._resolved = resolved; ws._mid = mids.map(t => t - g.from);
      // where each support sits, for the plan and the installer figures (the same data the spec counts): at the junction for on-module supports (p236),
      // at the end for end panels and legs. kind, point on the panel centreline, direction into the worksurface (n), along-run direction (u).
      ws._supports = [];
      const nearNode = (pt) => { let b = null, bd = Infinity; for (const nd of Object.values(P.nodes)) { const d0 = dist([nd.x, nd.y], pt); if (d0 < bd) { bd = d0; b = nd; } } return b; };
      const onFace = (pt, nd, u) => { const t = (nd.x - pt[0]) * u[0] + (nd.y - pt[1]) * u[1]; return [pt[0] + u[0] * t, pt[1] + u[1] * t]; }; // slide along the back line to line up with the junction
      for (const k of keys) { const sk = resolved[k]; if (!['cantilever', 'csp', 'endpanel', 'ssb', 'leg'].includes(sk)) continue; const e = endOf(ws, k), u = [-e.out[0], -e.out[1]], nd = nearNode(e.base);
        const at = JUNCTION_MOUNTED[sk] && sk !== 'endpanel' && sk !== 'ssb' && nd ? onFace(e.base, nd, u) : e.base; ws._supports.push({ kind: sk, key: k, at, n: e.n, u, depth: e.depth, end: e.base, front: [e.base[0] + e.n[0] * e.depth, e.base[1] + e.n[1] * e.depth] }); }
      if (g.kind === 'straight') for (const t of mids) ws._supports.push({ kind: 'cantilever', key: 'mid', at: [g.run.start.x + g.run.dir[0] * t, g.run.start.y + g.run.dir[1] * t], n: g.n, u: g.dir, depth: g.depth });
      else for (const [i, t] of ws._armMid) { const a = g.arms[i], nd0 = P.nodes[ws.node]; if (a && nd0) ws._supports.push({ kind: 'cantilever', key: 'arm' + i + 'mid', at: [nd0.x + a.dir[0] * t, nd0.y + a.dir[1] * t], n: a.n, u: a.dir, depth: a.depth }); }
      // emit support parts
      const armMids = ws._armMid.length;
      const cants = Object.values(resolved).filter(s => s === 'cantilever').length + mids.length + armMids;
      if (cants) { const r = findRow('uw-cantilever', () => true); const c = Line('Supports', cants, r, BYID['uw-cantilever'], 'Cantilever, on-module (tie plate included)', paint, { src: ctx }); if (Object.values(resolved).includes('shared')) c.notes.push('One end shares the neighbor\'s cantilever: adjacent cantilevered worksurfaces must be the same height and are tied with the tie plate (p237).'); if (mids.length) c.notes.push(`${mids.length} at the panel junction${mids.length > 1 ? 's' : ''} under the worksurface (${ws._mid.map(t => Math.round(t * 10) / 10 + '"').join(', ')} from the ${endName(ws, 'lo')} end), so supports are no more than 54" apart (p224, p237).`); if (armMids) c.notes.push(`${armMids} at the panel junction${armMids > 1 ? 's' : ''} under the ${ws._armMid.map(([i, t]) => `${ws._armNames[i]} (${Math.round(t * 10) / 10}" from the rear corner)`).join(', ')}, so supports are no more than 54" apart (p224, p237).`); lines.push(c); }
      const armDepth = (k) => g.kind === 'straight' ? ws.depth : k === 'arm1' ? ws.depthB : ws.depthA;
      for (const [k, s] of Object.entries(resolved)) {
        if (s === 'ssb') { ssbSingles += 1; ssbWhere.push(`${wsName(ws)} ${endName(ws, k)} end`); }
        if (s === 'endpanel') { const r = findRow('uw-end-panels', x => x.attrs.depth === armDepth(k) && !x.attrs.standingHeight); if (!r) { lines.push(Line('Supports', 1, null, BYID['uw-end-panels'], `End panel for a ${armDepth(k)}"D worksurface — ${endName(ws, k)} end`, '', { style: '—', flags: [`End panels come 24"D and 30"D only (p590).`], src: ctx })); errors.push({ panel: ws.id, msg: `${wsName(ws)}: there is no ${armDepth(k)}"D end panel (UEP24 and UEP30 only, p590). Use a cantilever, post leg or pedestal at the ${endName(ws, k)} end.` }); continue; } const c = Line('Supports', 1, r, BYID['uw-end-panels'], `End panel ${r.attrs.depth}"D × 28 1/2"H, on-module — ${endName(ws, k)} end`, paint, { src: ctx }); addOpt(c, BYID['uw-end-panels'], pg, r, `paint group ${F.trimPaint.group}`); lines.push(c); }
        if (s === 'leg') { const r = findRow('uw-post-legs', x => x.style === 'UPL'); const c = Line('Supports', 1, r, BYID['uw-post-legs'], `Post leg with glide 28 1/2"H — ${endName(ws, k)} end`, paint, { src: ctx }); addOpt(c, BYID['uw-post-legs'], pg, r, `paint group ${F.trimPaint.group}`); lines.push(c); }
        if (s === 'csp') { const r = findRow('uw-center-support-panels', x => !x.attrs.standingHeight); const c = Line('Supports', 1, r, BYID['uw-center-support-panels'], `Center support panel 11"D × 28 1/2"H (tie plate included) — ${endName(ws, k)} end`, paint, { src: ctx }); addOpt(c, BYID['uw-center-support-panels'], pg, r, `paint group ${F.trimPaint.group}`); lines.push(c); }
      }
      // ---- pedestals ----
      for (const d of ws.peds || []) {
        const wd = armDepth(d.at); const depth = pedNominalDepth(d, wd);
        const cfg = d.type === 'mobile' ? (d.config === 'C' ? '21C' : d.config === 'B' ? '27B' : '27A') : (d.config === 'B' ? '27B' : '27A');
        const base = (d.type === 'mobile' ? 'RPM' : 'RPF') + depth + cfg; const pidP = d.type === 'mobile' ? 'us-mobile-pedestals' : 'us-fixed-pedestals';
        const r = findRow(pidP, x => x.baseStyle === base || x.style.replace(/_+$/, '') === base);
        if (!r) { lines.push(Line('Storage', 1, null, BYID[pidP], `Pedestal ${base}`, '', { style: '—', flags: ['Pedestal not found in the guide'], src: ctx })); continue; }
        const front = d.front || 'F'; const price = r.priceBySuffix[front];
        const c = Line('Storage', 1, r, BYID[pidP], `${d.type === 'mobile' ? 'Mobile' : 'Fixed'} pedestal ${r.attrs.config} ${depth}"D × 15"W × ${r.attrs.height}"H, ${{ F: 'flush steel front', P: 'proud steel front', W: 'proud wood front' }[front]} — ${endName(ws, d.at)} end`, paint, { style: r.style.replace(/_+$/, '') + front, unit: price, src: ctx, page: r.page || BYID[pidP].pages[0] });
        addOpt(c, BYID[pidP], pg, r, `paint group ${F.trimPaint.group}`);
        if (front === 'W') c.spec += `; wood fronts ${F.wood.code} ${F.wood.name}`;
        if (front !== 'F') {
          const pull = d.pull || 'contemporary'; const pullCode = 'pull' + pull.replace(':', '').replace(/^./, ch => ch.toUpperCase()); const o = E.option(BYID[pidP], pullCode); const n = PULLS[d.config] || 3;
          if (!o) c.flags.push(`Option ${pullCode} not offered on ${BYID[pidP].name} (p${BYID[pidP].pages[0]})`);
          else { const pr = E.optionPrice(BYID[pidP], pullCode, r) || 0; c.unit += pr * n; c.spec += `; ${pull} pull${pr ? ` (+$${pr} per pull × ${n})` : ''}`; }
          if (pull === 'c:scape' && front === 'W') { c.flags.push('c:scape pulls are offered on proud steel fronts only (p651, p655).'); errors.push({ panel: ws.id, msg: `${wsName(ws)}: c:scape pulls are offered on proud steel fronts only, not proud wood fronts (p651, p655). Pick another pull or a proud steel front.` }); }
          // c:scape pulls are painted 4140, 4144 or 4799; the other pulls are plated metal 0835, 9201, 9211 or 9212 (p316)
          const cols = E.pullColors(pull); const col = cols.find(([code]) => code === d.pullColor) || cols[0];
          if (d.pullColor && col[0] !== d.pullColor) c.notes.push(`Pull color ${d.pullColor} is not offered on ${pull} pulls; ${col[0]} ${col[1]} is specified (p316).`);
          c.spec += pull === 'c:scape' ? `; pull paint ${col[0]} ${col[1]}` : `; pull metal ${col[0]} ${col[1]}`;
        }
        if (d.lock === 'none' && d.type === 'fixed') addOpt(c, BYID[pidP], 'noLock', r, 'no lock');
        if (d.type === 'fixed') c.notes.push('27"H fixed pedestal attaches under the worksurface and supports it at 28 1/2"H (p314).');
        if (d.type === 'mobile') c.notes.push('Mobile pedestals roll and do not support the worksurface (p314).');
        lines.push(c);
        if (d.type === 'fixed') {
          const fr = findRow('us-pedestal-fillers', x => x.attrs.front === (front === 'F' ? 'flush' : 'proud'));
          const f = Line('Storage', 1, fr, BYID['us-pedestal-fillers'], `Pedestal filler, ${front === 'F' ? 'flush' : 'proud'} front, Answer panels — ${endName(ws, d.at)} end`, paint, { src: ctx });
          f.notes.push('Conceals the gap between the panel face and the back of a 27"H pedestal and steadies pedestal/worksurface configurations that are not panel-wrapped (p315, p652).'); lines.push(f);
        }
      }
    }
    if (ssbSingles) {
      const r = findRow('uw-side-support-brackets', () => true); const packs = Math.ceil(ssbSingles / 2);
      const c = Line('Supports', packs, r, BYID['uw-side-support-brackets'], `Side support brackets, pair (left and right) — ${ssbSingles} bracket${ssbSingles === 1 ? '' : 's'} used`, 'black', { src: 'project' });
      c.notes.push('Ships as a handed pair. One bracket supports a rear corner or a wrapped worksurface end, so specify one pair for every two (p588). Used at: ' + ssbWhere.join('; ') + '.');
      lines.push(c);
    }
    // tie plates: every seam where two worksurfaces butt, and every L-configuration joint, is tied underneath with a flat tie plate near the front edge (p589; placement
    // per the p208-p209 figures). One ships with each cantilever and each center support panel (p237, p588, p590); joints beyond those take the package of six.
    for (const ws of W) ws._tie = [];
    for (const [e, f] of seams) { const mid = [(e.pt[0] + f.pt[0]) / 2, (e.pt[1] + f.pt[1]) / 2]; e.ws._tie.push({ pt: mid, dir: e.out, n: e.n, depth: Math.min(e.depth, f.depth), with: f.ws.id }); const gap = Math.round(dist(e.base, f.base) * 100) / 100; e.ws._seams.push({ with: f.ws.id, gap }); f.ws._seams.push({ with: e.ws.id, gap }); }
    for (const e of lseams) e.ws._tie.push({ pt: e.pt, dir: e.out, n: e.n, depth: e.depth, with: e.lj.id, l: true });
    const joints = seams.length + lseams.length;
    if (joints) {
      const inc = sum(lines.filter(l => l.pid === 'uw-cantilever' || l.pid === 'uw-center-support-panels').map(l => l.qty)); const extra = joints - inc;
      const where = [...seams.map(([e, f]) => `${e.ws.id}/${f.ws.id}`), ...lseams.map(e => `${e.ws.id}/${e.lj.id} L`)].join(', ');
      const what = `${joints} worksurface seam${joints === 1 ? '' : 's'} (${where})`;
      if (extra > 0) { const r = findRow('uw-tie-plates', () => true); const c = Line('Supports', Math.ceil(extra / 6), r, BYID['uw-tie-plates'], `Tie plates 3 3/4"L, package of six — ${extra} more than ship with the cantilevers and center support panels`, 'black', { src: 'project' }); c.notes.push(`One tie plate per worksurface seam: ${what}; ${inc} tie plate${inc === 1 ? ' is' : 's are'} included with the supports (p237, p589).`); lines.push(c); }
      else { const c = lines.find(l => l.pid === 'uw-cantilever'); if (c) c.notes.push(`Tie plates: ${what}, covered by the ${inc} tie plate${inc === 1 ? ' that ships' : 's that ship'} with the supports (p237).`); }
    }
    for (const m of E.wsCollisions(P)) errors.push({ panel: m.id, msg: m.msg });
  }
  // worksurfaces, pedestals and panels must not occupy the same floor space. Shapes are split into convex parts and tested
  // by separating axes; parts that only touch (a worksurface against a panel face, two worksurfaces butted at a seam) pass.
  E.wsParts = function (P, ws, g) {
    g = g || E.wsGeometry(P, ws); if (!g) return [];
    if (g.kind === 'straight') return [g.poly];
    // each arm as a rectangle, plus the curved front beyond the arms' inside edges as a fan of triangles from the inside corner
    const out = g.arms.map(a => [g.o, a.end, a.front, [g.o[0] + a.n[0] * a.depth, g.o[1] + a.n[1] * a.depth]]);
    for (let i = 0; i + 1 < g.cove.length; i++) out.push([g.inner, g.cove[i], g.cove[i + 1]]);
    return out;
  };
  E.wsCollisions = function (P) {
    const out = [], TOL = 0.1, W = Object.values(P.worksurfaces || {});
    const pen = (A, B) => { let m = Infinity; for (const Q of [A, B]) for (let i = 0; i < Q.length; i++) { const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % Q.length]; let nx = y2 - y1, ny = x1 - x2; const L = Math.hypot(nx, ny); if (L < 1e-9) continue; nx /= L; ny /= L; let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } m = Math.min(m, Math.min(a1, b1) - Math.max(a0, b0)); if (m <= TOL) return 0; } return m; };
    const area = (Q) => Math.abs(Q.reduce((s, p, i) => { const q = Q[(i + 1) % Q.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    const hits = (as, bs) => as.some(a => area(a) > 1e-6 && bs.some(b => area(b) > 1e-6 && pen(a, b) > TOL));
    const shapes = W.map(ws => { const g = E.wsGeometry(P, ws); return g && { ws, parts: E.wsParts(P, ws, g), peds: (ws.peds || []).map(d => ({ d, poly: E.pedRect(P, ws, g, d) })) }; }).filter(Boolean);
    // panel body between the junction faces: 3/4" from an in-line, end-of-run or wall-start node, the corner face (allowance + 3/4" post) at a corner
    const inOf = {}; const reachIn = (nid) => { if (!(nid in inOf)) { const n = P.nodes[nid]; const J = n ? E.junction(P, n) : null; inOf[nid] = E.junctionReach(P.trim, J && J.legs.length ? J.type : 'EOR').in; } return inOf[nid]; };
    const panels = Object.values(P.panels).map(p => { const n0 = P.nodes[p.a], n1 = P.nodes[p.b]; const L = Math.hypot(n1.x - n0.x, n1.y - n0.y) || 1, ux = (n1.x - n0.x) / L, uy = (n1.y - n0.y) / L, nx = -uy * POST_HALF, ny = ux * POST_HALF; const ra = reachIn(p.a), rb = reachIn(p.b); const a = { x: n0.x + ux * ra, y: n0.y + uy * ra }, b = { x: n1.x - ux * rb, y: n1.y - uy * rb }; return { p, poly: [[a.x + nx, a.y + ny], [b.x + nx, b.y + ny], [b.x - nx, b.y - ny], [a.x - nx, a.y - ny]] }; });
    const nm = (ws) => wsName(ws);
    const compOf = {}; for (const c of E.components(P)) for (const q of c.panels) compOf[q.id] = c.key;
    const hostComp = (ws) => compOf[ws.kind === 'straight' ? ws.panel : (ws.legs || [])[0]];
    const pnm = (id) => 'Panel ' + String(id).replace(/^P/, '');
    // a panel on a worksurface's footprint: from another run (moved or drawn into it), or from its own run (the worksurface does not fit)
    const intoPanel = (ws, q) => hostComp(ws) !== compOf[q.p.id]
      ? `${pnm(q.p.id)} of another run stands on ${nm(ws)}: panels, worksurfaces and pedestals cannot share floor space (p225). Move that run clear of the worksurface, or move or delete the worksurface.`
      : ws.kind === 'straight'
        ? `${nm(ws)} runs into panel ${q.p.id}. A worksurface wrapped by a panel has to fit between the panel faces: plan with actual dimensions (p225), use a narrower worksurface, or use a corner worksurface.`
        : `${nm(ws)} runs into panel ${q.p.id}: a ${ws.C}×${ws.D} corner reaches past that panel's face. Pick a smaller size (right-click › Size) or change the panel widths so the arms end on panel seams (p225, p236).`;
    for (let i = 0; i < shapes.length; i++) {
      const A = shapes[i];
      // two pedestals under one worksurface: 15"W each (p315), so the worksurface has to be wide enough for both
      for (let a = 0; a < A.peds.length; a++) for (let b = a + 1; b < A.peds.length; b++) if (hits([A.peds[a].poly], [A.peds[b].poly])) out.push({ id: A.ws.id, msg: `The two pedestals under ${nm(A.ws)} overlap: pedestals are 15"W (p315), so ${A.ws.kind === 'straight' ? `a ${A.ws.width}"W worksurface` : 'this arm'} cannot take one at each end. Delete one or use a wider worksurface.` });
      for (let j = i + 1; j < shapes.length; j++) { const B = shapes[j]; if (hits(A.parts, B.parts)) out.push({ id: A.ws.id, msg: `${nm(A.ws)} overlaps ${nm(B.ws)}. Worksurfaces butt at the panel junctions but cannot share floor space (p225).` }); else if (hits(A.peds.map(x => x.poly), B.peds.map(x => x.poly))) out.push({ id: A.ws.id, msg: `The pedestals under ${nm(A.ws)} and ${nm(B.ws)} overlap (p315).` }); }
      for (const q of panels) { if (hits(A.parts, [q.poly])) out.push({ id: A.ws.id, msg: intoPanel(A.ws, q) }); else if (hits(A.peds.map(x => x.poly), [q.poly])) out.push({ id: A.ws.id, msg: hostComp(A.ws) !== compOf[q.p.id] ? `${pnm(q.p.id)} of another run stands on a pedestal under ${nm(A.ws)} (p315). Move that run clear of the pedestal.` : `A pedestal under ${nm(A.ws)} runs into panel ${q.p.id} (p315).` }); }
    }
    return out;
  };
  function nominal(v) { return Math.round(v / 6) * 6; } // every Universal nominal size is a multiple of 6": 18 3/8 and 18 7/8 -> 18, 23 1/2 -> 24, 41 1/2 -> 42 (p539, p563)
  E.wsNominal = nominal;
  function wsName(ws) { return ({ straight: 'Straight worksurface', corner: 'Corner worksurface', extcorner: 'Extended corner worksurface', corner120: '120° corner worksurface' })[ws.kind] + ' ' + ws.id; }
  // end names as the user sees them: sitting at the worksurface facing the panel. Corner arms are the left and right arm (C/A is the left arm, p563, p567, p568)
  function endName(ws, k) { if (k === 'arm0' || k === 'arm1') return (ws._armNames || ['left arm', 'right arm'])[k === 'arm0' ? 0 : 1]; const left = ws.side === 0 ? 'lo' : 'hi'; return k === left ? 'left' : 'right'; }
  E.wsName = wsName; E.endName = endName;
  // where a straight worksurface sits in some run's frame (the run may point the other way from the host panel)
  E.wsSpanInRun = function (P, ws, run) {
    const h = run.panels.find(r => r.id === ws.panel); if (!h) return null;
    const from = h.flip ? h.from + h.panel.width - ws.off - ws.width : h.from + ws.off;
    return { from, to: from + ws.width, side: h.flip ? 1 - ws.side : ws.side };
  };
  // nominal size choices for corner worksurfaces: [{C, D, depthA, depthB, hand, style}]
  E.cornerSizes = function (kind, construction) {
    const pid = { corner: 'uw-corner-curved', extcorner: 'uw-extended-corner-curved', corner120: 'uw-corner-120' }[kind];
    return rowsOf(pid).filter(r => r.attrs.construction === construction).map(r => ({ C: nominal(r.attrs.widthC), D: nominal(r.attrs.widthD), depthA: nominal(r.attrs.depthA), depthB: nominal(r.attrs.depthB), hand: r.attrs.handed === 'right' ? 'R' : 'L', style: r.style, edges: Object.keys(r.priceByEdge) }));
  };
  E.wsEdgesFor = function (P, ws) {
    const g = E.wsGeometry(P, ws); const pid = { straight: 'uw-straight', corner: 'uw-corner-curved', extcorner: 'uw-extended-corner-curved', corner120: 'uw-corner-120' }[ws.kind];
    let row = null;
    if (ws.kind === 'straight') row = findRow(pid, r => r.attrs.width === ws.width && r.attrs.depth === wsDepthActual(ws.depth, ws.construction));
    else if (g) row = cornerRow(pid, ws, cornerDims(ws, g));
    return row ? Object.keys(row.priceByEdge) : ['3mm'];
  };
  const _removePanel = E.removePanel;
  E.removePanel = function (P, pid) {
    _removePanel(P, pid);
    for (const ws of Object.values(P.worksurfaces || {})) if (ws.panel === pid || (ws.legs && ws.legs.includes(pid))) delete P.worksurfaces[ws.id];
  };
  E.hostPanelOf = function (P, src) { const ws = P.worksurfaces && P.worksurfaces[src]; if (!ws) return null; return ws.kind === 'straight' ? ws.panel : ws.legs[0]; };
  // wire into generate(): worksurfaces run after panels and junctions
  const _generate = E.generate;
  E.generate = function (P) {
    const res = _generate(P);
    try { worksurfacesBOM(P, res.lines, res.warnings, res.errors, res.nodes); } catch (err) { res.errors.push({ panel: 'worksurfaces', msg: 'Worksurface rules failed: ' + err.message }); }
    for (const l of res.lines) { if (l.ext === undefined) { l.ext = Math.round((l.unit || 0) * l.qty); try { l.contents = E.packageContents(P, l); } catch (e) { l.contents = []; } } }
    res.totals = totals(res.lines);
    { const n = {}; for (const l of res.lines) { const b = `${l.src}#${l.pid || l.style}`; l.key = b + '#' + (n[b] = (n[b] || 0) + 1); } }
    return res;
  };
  // package contents for workstation parts come from the guide's Standard Includes, narrowed to what this line actually is
  const _contents = E.packageContents;
  E.packageContents = function (P, l) {
    if (/^(uw|us)-/.test(l.pid || '')) {
      const prod = BYID[l.pid]; let items = (prod.standardIncludes || []).map(s => s.replace(/^\s*[–-]\s*/, ''));
      const ws = P.worksurfaces && P.worksurfaces[l.src];
      if (/^uw-(straight|corner|extended)/.test(l.pid) && ws) { // p539, p563, p567, p568 Standard Includes, for the material and edge chosen
        const wood = ws.material === 'wood';
        items = [wood ? 'Worksurface: wood veneer' : 'Worksurface: High-Pressure Laminate',
          wood ? 'Wood worksurface: wood 3 mm edge profile on the front edge, matching veneer flat profile on side and back edges' : `Laminate worksurface: ${(E.WS_EDGES[ws.edge] || E.WS_EDGES['3mm']).replace(/^Plastic /, 'plastic ')} profile on the front edge, plastic flat profile on side and back edges`,
          ...(ws.options && ws.options.omitScallop ? [] : items.filter(s => /^Cable scallop/.test(s))), ...(wood ? ['Wire manager: black'] : [])];
      }
      const m = /^RP([FM])\d{4}([ABC])([FPW])$/.exec(l.style || '');
      if (m && /pedestals$/.test(l.pid)) { // p651, p656: drawer fronts, pulls and trays for this configuration and front
        const [, , cfg, fr] = m; const spec = l.spec || '';
        items = items.filter(s => /^Integral pulls/.test(s) ? fr === 'F' : /^Pulls: metal/.test(s) ? fr !== 'F' : /pencil tray/i.test(s) ? cfg !== 'B' : /^Lock, keyed/.test(s) ? !/no lock/.test(spec) : true)
          .map(s => /^Removable drawer fronts/.test(s) ? `Removable drawer fronts: ${fr === 'W' ? 'wood veneer' : 'paint to match pedestal'}` : /^Pulls: metal/.test(s) && /c:scape pull/.test(spec) ? 'Pulls: c:scape, paint' : /^Integral pulls/.test(s) ? 'Integral pulls' : s);
      }
      if (l.pid === 'us-pedestal-fillers') items = items.map(s => s.replace('all paint price groups', 'paint'));
      if (l.pid === 'uw-post-legs') items = items.filter(s => !/if selected/.test(s));
      return items.map(item => ({ qty: 1, item }));
    }
    return _contents(P, l);
  };

  // ---------- DXF export (AutoCAD R12 ASCII, inches, y up) ----------
  // Layers follow the AIA style CAP users expect. Every element carries its style number as TEXT so a CAP
  // planner can drop the matching symbol on it; true CAP symbol tagging is added once a CAP export shows its block format.
  // pedestal footprint: 15" wide at one end, E.PED_INSET (1/2", no guide basis) in from it. Its front lines up with the worksurface's full-depth front edge: a proud front
  // matches the cord-drop worksurface depth and a flush front is 7/8" shorter, and the filler takes up the gap behind (1/2" proud, 1 3/8" flush) (p315, p652)
  E.pedRect = function (P, ws, g, d) {
    const wd = g.kind === 'straight' ? ws.depth : d.at === 'arm1' ? ws.depthB : ws.depthA;
    const pd = pedNominalDepth(d, wd); const dep = (d.front === 'F' ? -0.875 : 0) + wsDepthActual(pd, 'cord-drop'); const frontAt = wsDepthActual(pd, 'full-depth'); // from the panel face
    const gap = wsBackGap(ws);
    let s0, inward, n;
    if (g.kind === 'straight') { inward = d.at === 'lo' ? g.dir : [-g.dir[0], -g.dir[1]]; s0 = d.at === 'lo' ? g.lo : g.hi; n = g.n; }
    else { const arm = g.arms[d.at === 'arm1' ? 1 : 0]; inward = [-arm.dir[0], -arm.dir[1]]; s0 = arm.end; n = arm.n; }
    const back = frontAt - dep - gap; // measured from the worksurface's back edge
    const a = [s0[0] + inward[0] * E.PED_INSET + n[0] * back, s0[1] + inward[1] * E.PED_INSET + n[1] * back], b = [a[0] + inward[0] * E.PED_W, a[1] + inward[1] * E.PED_W];
    return [a, b, [b[0] + n[0] * dep, b[1] + n[1] * dep], [a[0] + n[0] * dep, a[1] + n[1] * dep]];
  };
  E.toDXF = function (P, res, opts) {
    opts = opts || {}; const out = []; const w = (c, v) => { out.push(String(c)); out.push(String(v)); };
    const num = (v) => (Math.round(v * 10000) / 10000).toString();
    const LAYERS = [['0', 7], ['A-JUNCTION', 8], ['A-WORKSURFACE', 30], ['A-PEDESTAL', 32], ['A-TEXT', 7], ['A-TITLE', 7], ...E.HEIGHTS.map(h => ['A-PANEL-' + h, { 30: 3, 36: 4, 42: 5, 48: 150, 54: 2, 66: 30, 78: 1 }[h]])];
    // one closed POLYLINE per shape; a vertex may carry a bulge (p[2]) for a true arc to the next vertex
    const poly = (layer, pts, closed) => { w(0, 'POLYLINE'); w(8, layer); w(66, 1); w(70, closed ? 1 : 0); for (const p of pts) { w(0, 'VERTEX'); w(8, layer); w(10, num(p[0])); w(20, num(p[1])); w(30, 0); if (p[2]) w(42, num(p[2])); } w(0, 'SEQEND'); w(8, layer); };
    const line = (layer, a, b) => { w(0, 'LINE'); w(8, layer); w(10, num(a[0])); w(20, num(a[1])); w(30, 0); w(11, num(b[0])); w(21, num(b[1])); w(31, 0); };
    const text = (layer, p, h, s, ang, center) => { w(0, 'TEXT'); w(8, layer); w(10, num(p[0])); w(20, num(p[1])); w(30, 0); w(40, num(h)); w(1, String(s).replace(/[^\x20-\x7e]/g, c => c === '×' ? 'x' : c === '°' ? ' deg' : c === '—' || c === '–' ? '-' : c === '·' ? '-' : '')); if (ang) w(50, num(ang)); if (center) { w(72, 1); w(11, num(p[0])); w(21, num(p[1])); w(31, 0); } };
    const circle = (layer, c, r) => { w(0, 'CIRCLE'); w(8, layer); w(10, num(c[0])); w(20, num(c[1])); w(30, 0); w(40, num(r)); };
    // header + layer table
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$INSUNITS'); w(70, 1); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES'); w(0, 'TABLE'); w(2, 'LAYER'); w(70, LAYERS.length);
    for (const [name, color] of LAYERS) { w(0, 'LAYER'); w(2, name); w(70, 0); w(62, color); w(6, 'CONTINUOUS'); }
    w(0, 'ENDTAB'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES');
    const H = 3; // panel thickness (p16)
    const styleOf = (src, cat) => { const l = (res.lines || []).find(x => x.src === src && (!cat || x.cat === cat) && x.style && x.style !== '—'); return l ? l.style : ''; };
    for (const p of Object.values(P.panels)) {
      const a = P.nodes[p.a], b = P.nodes[p.b]; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; const d = [(b.x - a.x) / L, (b.y - a.y) / L], n = [-d[1], d[0]];
      // panel body between the junction posts, as on the plan: in-line 3/4" either side of the node, end of run / wall start 3/4" inside it, corners at the
      // corner face (corner allowance + 3/4" post: 2 1/4" for L, T, X; see CORNER_ALLOW)
      const reach = (nid) => { const J = res.nodes && res.nodes[nid]; return E.junctionReach(P.trim, J && J.legs && J.legs.length ? J.type : 'L').in; };
      const s = [a.x + d[0] * reach(p.a), a.y + d[1] * reach(p.a)], e = [b.x - d[0] * reach(p.b), b.y - d[1] * reach(p.b)];
      const pts = [[s[0] + n[0] * H / 2, s[1] + n[1] * H / 2], [e[0] + n[0] * H / 2, e[1] + n[1] * H / 2], [e[0] - n[0] * H / 2, e[1] - n[1] * H / 2], [s[0] - n[0] * H / 2, s[1] - n[1] * H / 2]];
      poly('A-PANEL-' + p.height, pts, true);
      let ang = Math.atan2(d[1], d[0]) * 180 / Math.PI; if (ang > 90 || ang <= -90) ang += 180;
      const m = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2]; const st = styleOf(p.id, 'Panel') || styleOf(p.id);
      text('A-TEXT', [m[0] + n[0] * 3, m[1] + n[1] * 3], 2, `${p.id} ${p.width}x${E.panelTotalHeight(p)} ${st}`, ang, true);
    }
    for (const n of Object.values(P.nodes)) {
      const J = res.nodes && res.nodes[n.id]; if (!J || !J.legs || !J.legs.length) continue;
      if (['inline', 'EOR', 'wall'].includes(J.type)) { // straight junctions: the post (and the finished end's trim) along the leg direction, 3" deep
        const ang = (J.type === 'inline' ? J.legs[0].angle : J.legs[0].angle + 180) * Math.PI / 180, u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]];
        const rect = (a0, a1) => [[a0, -1.5], [a1, -1.5], [a1, 1.5], [a0, 1.5]].map(([x, y]) => [n.x + u[0] * x + v[0] * y, n.y + u[1] * x + v[1] * y]);
        const R = E.junctionReach(P.trim, J.type); poly('A-JUNCTION', rect(R.post[0], R.post[1]), true); if (R.trim) poly('A-JUNCTION', rect(R.trim[0], R.trim[1]), true);
      } else {
        // corner junction: each leg's 3/4" post, from the corner allowance to the corner face (CORNER_ALLOW), then the corner cap over the block (p388)
        const Rc = E.junctionReach(P.trim, J.type);
        for (const l of J.legs) { const a = l.angle * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]]; poly('A-JUNCTION', [[Rc.ca, -1.5], [Rc.in, -1.5], [Rc.in, 1.5], [Rc.ca, 1.5]].map(([x, y]) => [n.x + u[0] * x + v[0] * y, n.y + u[1] * x + v[1] * y]), true); }
      }
      if (['inline', 'EOR', 'wall'].includes(J.type)) { /* drawn above */ } else if (J.family === 120) poly('A-JUNCTION', E.cap120(n.x, n.y, J.legs[0].angle), true); // triangular 120° cap (p388)
      else { const rot = (J.legs[0].angle % 90) * Math.PI / 180; const c = Math.cos(rot), s = Math.sin(rot); const q = [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]].map(([x, y]) => [n.x + x * c - y * s, n.y + x * s + y * c]); poly('A-JUNCTION', q, true); }
      text('A-TEXT', [n.x + 2.5, n.y + 2.5], 1.5, `${n.id} ${J.type} ${styleOf(n.id, 'Junction')}`, 0, false);
    }
    for (const ws of Object.values(P.worksurfaces || {})) {
      const g = E.wsGeometry(P, ws); if (!g) continue;
      let pts = g.poly;
      if (g.curve) { // the curved front (cove) as a single arc segment from outline[curveAt] to the next vertex (bulge = 2 x sagitta / chord), through the plan curve's midpoint
        const [F1, C, F2] = g.curve; const Q = [0.25 * F1[0] + 0.5 * C[0] + 0.25 * F2[0], 0.25 * F1[1] + 0.5 * C[1] + 0.25 * F2[1]]; const M = [(F1[0] + F2[0]) / 2, (F1[1] + F2[1]) / 2];
        const chord = Math.hypot(F2[0] - F1[0], F2[1] - F1[1]) || 1; const sag = Math.hypot(Q[0] - M[0], Q[1] - M[1]); const cross = (F2[0] - F1[0]) * (Q[1] - M[1]) - (F2[1] - F1[1]) * (Q[0] - M[0]);
        pts = g.outline.map((p, i) => i === g.curveAt ? [p[0], p[1], (cross >= 0 ? 1 : -1) * 2 * sag / chord] : p); }
      poly('A-WORKSURFACE', pts, true);
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      text('A-TEXT', [cx, cy], 2, `${ws.id} ${styleOf(ws.id, 'Worksurface')}`, 0, true);
      for (const d of ws.peds || []) { const r = E.pedRect(P, ws, g, d); poly('A-PEDESTAL', r, true); const l = (res.lines || []).find(x => x.src === ws.id && x.cat === 'Storage' && /pedestal/i.test(x.desc) && !/filler/i.test(x.desc) && new RegExp(E.endName(ws, d.at)).test(x.desc)); text('A-TEXT', [(r[0][0] + r[2][0]) / 2, (r[0][1] + r[2][1]) / 2], 1.2, l ? l.style : 'PED', 0, true); }
    }
    // workstation names and title
    for (const c of E.workstations(P)) { if (!c.allNodes.length) continue; const xs = c.allNodes.map(i => P.nodes[i].x), ys = c.allNodes.map(i => P.nodes[i].y); text('A-TITLE', [Math.min(...xs), Math.max(...ys) + 8], 4, c.name, 0, false); }
    const allY = Object.values(P.nodes).map(n => n.y), allX = Object.values(P.nodes).map(n => n.x);
    if (allX.length) text('A-TITLE', [Math.min(...allX), Math.min(...allY) - 60], 4, `${P.name || 'Untitled'}${P.job && P.job.number ? ' - Job ' + P.job.number : ''} - Steelcase Answer ${P.trim} trim - Answer Panel Planner ${opts.build || ''} - units inches - U.S. list $${Math.round(res.totals ? res.totals.all : 0)}`, 0, false);
    w(0, 'ENDSEC'); w(0, 'EOF');
    return out.join('\r\n') + '\r\n';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.ANSWER = E;
})(typeof window !== 'undefined' ? window : globalThis);
