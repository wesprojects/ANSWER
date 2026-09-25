# CAP-readable DXF export — findings and plan (2026-09-24)

**Status: implemented in `src/capdxf.js` (`E.toCapDXF`), wired to Export DXF for CAP, verified by `test/capdxf.js`. R2000 confirmed accepted by CAP.**

Goal: the planner's DXF must open in AutoCAD and list its parts in CAP (Configura/2020 CAP Worksheet), with every part number
identical to the Specification tab. Nothing in the export may leave the Feb 2015 Answer Specification Guide.

## What CAP reads (decoded from the customer's CAP drawing `QQ - 6X6X66 - 6 PACK.dxf`, AutoCAD 2013 / AC1027)

* Every part is an INSERT of a block named `P_<style number>` (e.g. `P_TS766LPJ`). No loose geometry.
* Each part block carries ATTDEFs and each INSERT the matching ATTRIBs, 16 tags in this order:
  `CAPPN` (style number), `CAPPD` (description), `CAPMG` (maker: STC = Steelcase, CNK = Conklin), `CAPMC` (category: TSA = Answer),
  `CAPGC`, `CAPALIAS1..3`, `CAPBLDG`, `CAPFLOOR`, `CAPDEPT`, `CAPPERSON`, `CAPPL` (list price, "83.0000"), `CAPTG` (the visible tag,
  e.g. L66, 36/66, 36/24, SS/RH), `CAPQT` ("1"), `CAPDH` ("0"). All invisible (height 0.001) except CAPTG.
* A panel is a "panel config" block `P_D36.000000` (D = the config name, 36 = width) with attributes `CAPSTD` ("D 36", visible),
  `CAPSTDTITLE`, `CAPPANELCAT` (TSA), `CAPPANELNAME` (D), `CAPPANELCONFIG` (a cap: URL, not needed), `CAPPANELWIDTH`, `CAPPANELHEIGHT`
  (65.8 for 66"), `CAPALIAS1..3`. Inside it are nested part INSERTs: the frame `P_TS736HF_____XI_____QUALIFIER_____66` (a 36x3 closed
  POLYLINE, CAPTG 36/66) at (0,0) and two point-part skins `P_TS76036TK` (a single POINT) at (0,3) and (36,0) rot 180.
* CAP also attaches a hidden catalog link per part (an ACAD_PROXY_OBJECT under the extension dictionary CAPX_DATA_DICTIONARY /
  CAPX_SPEC_DATA holding a `cap:\\capstudio\default.htm?...&GUID=` string). **Test result: not needed.** TEST_B2 (blocks + attributes
  only, no links) lists its parts in CAP.
* **Format: R12 (AC1009) is rejected** ("invalid or incomplete DXF format, drawing discarded"). **R2000 (AC1015) is accepted**:
  TEST_C_R2000.dxf, the same blocks and attributes written as R2000 by ezdxf, lists its parts in CAP (confirmed 2026-09-24).
  Write the export as R2000 from the skeleton in `cap/tpl.js`, following the entity layout in `cap/ref_r2000.dxf`.

## CAP geometry conventions (all match the app's corner-allowance model, build .13)

* Corner blocks L/T/X: a 3x3 square of LINEs plus inner lines (L: notch at the inside corner; T: crossbar (0,1.5)-(3,1.5) and stem
  (1.5,1.5)-(1.5,0); X: both), 4 POINTs at the corners, layer A-FURN-P-PNLS-JNCT. The insert point is a corner of the square, so
  block centre = insert + R(rot)(1.5,1.5); our node is that centre. Panel modules start at the block face: a 36" panel off an L runs
  36" from the face = 37.5" from the centre (= our 1.5" allowance). Rotation rules (block angles at rot 0): L legs at 180 and 270
  (rot = b - 180 where the legs are b and b+90); T stem at 270 (rot = stem + 90); X rot = leg % 90.
* In-line `TS766IPJ`: LINE rectangle x in [-1,1], y in [0.5,2.5], POINT (0,3); insert on the panel's right face (panel frame is
  y 0..3 to the left of the run direction), rot = run direction. Node centre = insert + R(rot)(0,1.5).
* End of run `TS766EPJ`: LINEs (0,3)-(1,3)-(1,0)-(0,0), 4 POINTs: a 1" cap beyond the module; rot = leg angle + 180 (points away
  from the panel); node = insert + R(rot)(0,1.5).
* Frame `TS7<w>HF...`: closed POLYLINE (0,0)-(w,0)-(w,3)-(0,3) on layer A-FURN-P-PNLS-<h>; CAPTG (w/h) at (w/2, 4) h 4 MONOTXT.
  Panel insert = start-node + dir*allowance + right-normal*1.5, rot = run direction.
* Worksurface `WLU2436G2` (Avenir): LINEs (0,0)-(36,0)-(36,-24)-(0,-24), POINTs at corners, grommet CIRCLE; insert at the back-left
  corner, front toward -y. Corner worksurfaces add an ARC for the cove.
* Cantilever `TS7UCANT`: LWPOLYLINE taper (-1.42,0)-(1.42,0)-(1.30,-13.6)-(-1.30,-13.6) + centre line, colour 1, from the panel face
  toward the front. Side brackets `USSBR-L/-R`, pedestals (3DSOLIDs + MTEXT "BBF"), power kit (nested block), duplexes (circle r1.5
  + two lines), infeed (arrow). Layers and colours: see `cap/tpl.js` comments and the dump in the session notes; A-FURN 7,
  A-FURN-P-PNLS-JNCT(-T) 3, A-FURN-P-PNLS-66(-T) 3, A-FURN-P-WKSF(-T) 1, A-FURN-P-WKSF-SUP(-T) 1, A-FURN-P-POWR(-T) 5, A-FURN-3-PEDS 4,
  A-FURN-P-PEDS-T 6, A-FURN-PNLS-BUILDUP-T 7, A-FURN-POINT-PART(-T) 7, A-FURN-P-GEN 3, CAPTAG 7. Text styles: Standard, MONOTXT (MONOTXT.SHX).

## Part-number differences between the customer's CAP catalog and the guide (decide with the customer, never substitute silently)

`TS7UCANT` (guide UCANT), `USSBR-L`/`USSBR-R` (guide USSBR, a pair), `5TS76BPX` (guide TS76BPX), Conklin Avenir worksurfaces WLU...
and pedestals 5C... (the app specifies Steelcase Universal US.../UCC... and RPF...). CAP's panel breakdown is frame TS736HF + skins
TS76036TK (oval reman); the app's thin spec is the panel package TS76636TTF (skins included, p66) or frame TS748THF + skins.

## Implementation plan for `E.toCapDXF(P, res, opts)` (new file src/capdxf.js, appended after engine.js by build.py)

1. R2000 skeleton from `cap/tpl.js` (extracted from ezdxf's output: header variables, CLASSES, VPORT/LTYPE/STYLE/VIEW/UCS/APPID/
   DIMSTYLE tables, OBJECTS with layouts, EZDXF entries removed; handles up to 0x69, fixed: *Model_Space record 17 / block 18-19 /
   layout 1A, *Paper_Space 1B / 1C-1D / 1E, layer table 1, block-record table 9, plot style placeholder 13). Generate LAYER and
   BLOCK_RECORD tables, BLOCKS, ENTITIES with handles from 0x100; write $HANDSEED, $EXTMIN/MAX, $LIMMIN/MAX, $TDCREATE (Julian),
   the GUIDs. Entity layout (330 owner, 100 subclass markers, ATTRIB/SEQEND) exactly as in `cap/ref_r2000.dxf`.
2. One INSERT per unit of every specification line (`res.lines`, grouped by `l.src`): CAPPN = l.style, CAPPD = l.desc (ASCII),
   CAPMG STC, CAPMC TSA, CAPPL = l.unit, CAPQT 1, CAPALIAS1 = workstation name. Inserts per line = l.qty, always.
   * panels (src = panel id): a config block per distinct (width, total height, nested styles) with the frame/package line as the
     frame shape and the other lines (skins, glass, stacking, trims, caps) as point parts spread along the panel; Power lines as
     top-level point parts beside the panel; CAPSTD "<letter> <w>", CAPSTDTITLE lists the contents; a TEXT legend below the plan.
   * nodes: the first Junction line gets the shape block by J.type (V/Y: the triangular cap E.cap120 polygon), the rest point parts.
   * worksurfaces: outline from E.wsGeometry (closed POLYLINE with a bulge for the cove, POINTs at corners), insert at the back
     corner at the start of the run direction (side 1 reversed); supports from ws._supports by kind (cantilever taper 15 1/2" deep
     per the guide, CSP 1x11, end panel 1 x depth, leg circle, SSB 6x1); pedestals from E.pedRect; fillers as point parts.
   * project lines (aligner/light-seal packs, USSBR pairs, TS7TIEPLATE packs): placed at the first matching positions (ws._tie,
     ssb supports) else in a "job parts" row below the plan, so counts stay exact.
3. Verification: `test/capdxf.js` writes the DXF for the guide presets and a furnished job, then runs python3 + ezdxf to audit the
   file (0 errors) and to count every CAPPN (nested blocks x insert count) against the spec quantities per style — must match.
   `cap/make_b2.py`, `cap/render.py` + `cap/svg2png.js` render a DXF to PNG through Playwright for eyeballing.
4. UI: the Export DXF button writes the CAP file; keep the old line-only R12 export as "DXF (lines only)".

## 3D view (decoded from the owner's `claude-request-v1.dxf` and `-v2.dxf`, 2026-09-25, AutoCAD 2013 / AC1027, saved with the 3D view on)

* In the 3D view model space holds `3_` inserts instead of `P_` ones: `3_A-T36` (a panel config with the `CAPSTD`, `CAPSTDTITLE`, `CAPPANELCAT`,
  `CAPPANELNAME`, `CAPPANELCONFIG`, `CAPPANELWIDTH`, `CAPPANELHEIGHT` attributes; `CAPPANELHEIGHT` 41.08 for a 42", 53.44 for a 54") and
  `3_<style>_____XI_____QUALIFIER_____<h>_____XO` part blocks (6-7 attributes: `CAPPN`, `CAPMG`, `CAPMC`, `CAPQT`, `CAPTG`, `CAPDH`, sometimes `CAPGC`).
  Each `3_` part block only nests one CAP library block (`3TN4TEJ`, `3TN4TLJ`, `3TCLJ45`, `3TT364F`, `3TSA443`, `3TWS412`, `3TS71236TFGR30` ...),
  which holds the geometry: POLYLINE polyface meshes and POINTs on layers `AFUPA-3D-004` (frame, colour 4), `-020` (junctions, 20),
  `-028` (stacking, 28), `-010`/`-051` (glass screen, 4/51), `AFUSK-3D-017` (skins, 17), `-006`/`-016` (window frame/pane, 6/16). No solids.
* A 3D config nests: the frame `3_TS736THF...<h>` at (0,0,0) — only a top cap (36 x 3, z 41.02-41.42 for a 42") and two 4"-tall base trims
  0.572" thick on each face; skins `3_TS73636TK` at (0,3,4) rot 0 and (36,0,4) rot 180, each a 36 x 0.5 x 37.08 box (top at 41.08); a window
  `3_TS71236SPW` at (0,0,41.08), a 36 x 3 x 12.28 frame with a 0.2" pane; the stacking junction `3_TS712TLPJS` at z 41.08 (the 42" panel's height).
* What CAP's library gets wrong against the guide (the defects the owner sees): the 42"/54" end-of-run junctions `3TN4TEJ`/`3TN5TEJ` are two
  POINTs, no body; the same-height L junction `3TN4TLJ` is only a 3 x 3 x 0.4" cap at z 0 (on the floor), no block or posts; stacking junctions
  are a TEXT label and a POINT; the 12"H recessed glass screen used on the 42" panel is the 30"-panel block (`...TFGR30`: glass z 25.9-41.4 with the
  clips at 28.7-29.1), so on a 42" panel the glass ends flush with the top cap instead of standing 12" above it; in v1 the 42" top cap stays at
  41.02-41.42 under the stacked window instead of moving to the top of the stack; the change-of-height L junction `3TCLJ45` is a 3 x 3 column to
  53.77 with the trim on one face, so junction bodies are inconsistent between same-height and change-of-height. Heights also differ from the guide:
  CAP's 42" panel tops out at 41.42 (guide 41 7/8", p11) with a 4" base trim (guide 3 3/4", p50).
* What we write instead (`src/capdxf.js`, `E.toCapDXF`): a `3_<name>` twin for every `P_<name>` block, built from the guide (README "3D blocks in
  the CAP export"), checked by `test/cap3d.js`; `cap/iso3d.py in.dxf out.svg [scale] [azimuth]` renders the 3D blocks of any CAP DXF for eyeballing.
  Still open: whether CAP's 3D view picks up `3_<name>` twins of blocks it did not author (the settled fact says it keeps them), and whether the
  `_____XI_____QUALIFIER_____` suffix matters for the swap (our names carry none).
* Seen in CAP 2026-09-25 (the owner's screenshots): the first exports opened with the tiles scattered, and CAP said on opening "this drawing contains
  cap panel builder graphics that require updating, cap will update these graphics now". CAP rebuilds a panel's 3D graphics from the 2D config
  itself: every nested symbol stays where the 2D config puts it, is swapped for its `3_` twin and lifted by its CAPDH. So the config now nests the
  tiles exactly as CAP's own configs do (TEST_B2 and the claude-request samples): frame at the origin; side B skin at (0, 3) rot 0 and side A skin
  at (width, 0) rot 180, one block for both faces, CAPDH = the base trim height (3 3/4"; CAP writes 4); window tiles, stacked tiers and the recessed
  glass at the origin with CAPDH = their bottom; parts without a body stay point symbols along the centreline with CAPDH 0. Every tile body is
  drawn at its own origin from z = 0, and the `3_` config nests the same points at z = CAPDH, as CAP writes it.
