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
