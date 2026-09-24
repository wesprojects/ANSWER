# ANSWER PANEL PLANNER

CONKLIN OFFICE FURNITURE - RESEARCH AND DEVELOPMENT

# ANSWER PANEL PLANNER

Plan, specify, build and install Steelcase Answer panel systems, Thin trim first and Oval trim second, from one job file. Draw panel runs on a plan or drop in typicals, set height, stacking, tiles, windows, power and frameless glass per panel, then right-click to add Universal worksurfaces, corner worksurfaces and fixed or mobile pedestals that snap to the panels. Every shared junction, trim, cap, aligner, cantilever, side support bracket, end panel, reinforcing channel, pedestal filler and package is resolved to the exact style number from the February 2015 Answer Solutions Specification Guide. Four stages carry the job from the office to the shop floor: Plan, Specification (buy new, refurbish or stock per line, with package contents spelled out), Shop (upholstery and paint work orders, junction build sheets, field cuts) and Pick & Install (pick list with bins, staging by workstation, installer sheets with plan, elevations and junction-by-junction parts). The specification exports as a SIF file for CAP Worksheet, ProjectSpec and dealer ordering systems, with every finish written as an option pair.

Every reference to the Answer Specification Guide opens that page of the PDF.

<span style="color:grey">OUTPUT IN .ANSWER JOB, SIF, CSV, PRINTABLE SPEC / WORK ORDER / PICK LIST / INSTALLER SHEET FORMAT</span>

LAUNCH — https://wesprojects.github.io/ANSWER/

README — https://github.com/wesprojects/ANSWER

## Files

- `index.html` — the whole app in one file. Opens from disk or GitHub Pages.
- `answer-1.pdf` (pages 1–200) and `answer-2.pdf` (pages 201–766) — the Steelcase Answer Solutions Specification Guide, February 2015, split in two to stay under GitHub's 25 MB upload limit. Keep both next to index.html. Page links use the guide's printed page numbers.
- `src/` — `engine.js` (junction classification, exposed-face trim rules, stacking, oval mapping, worksurface support rules, pricing, validation), `planner.js` / `planner.css` / `planner.html` (interface), `catalog.json` (146 product groups, 2,642 priced rows covering 2,622 distinct style numbers, surface materials; every row cites the guide page that prints it).
- Workstations — Universal straight (18, 24, 30 and 36"D), corner, extended corner and 120° corner worksurfaces (p506–526), panel-mounted supports (p545–548), post legs (p552), fixed and mobile pedestals with fillers (p608–614). Supports follow p207–217: cantilevers at free ends, one shared cantilever per seam, a side support bracket where a return panel as wide as the worksurface is deep wraps the end (p216) and at every rear corner, an end panel for the front edge of 30"D worksurfaces (36"D ones need a pedestal or post leg, since end panels come 24"D and 30"D only), a cantilever at each junction under a long worksurface or corner arm and a reinforcing channel where a span still tops 54", a fixed pedestal replaces the cantilever where it sits. Center support panels are shared at seams and never stand in for an end panel. Worksurfaces butt at the panel junctions with no gap: two ends make a seam only when they meet (within 1/2"), and an on-module support has to line up with a junction center (within the 1 1/2" post face, p14, p216). The 1/2" cord-drop gap is drawn behind the worksurface and fronts line up with full-depth worksurfaces (p208); P-edge profiles are 3/8" deeper (p207). An L of two straight worksurfaces is planned the p209/p226 way: the return butts the other worksurface's front edge and is tied to it (full depth recommended, P-edge flagged for its valley). Extended corners keep a straight front on the long arm and the standard cove at the corner (p524). Every butted seam and L joint gets a tie plate, drawn under the seam 3" in from the user's edge as the p181–p182 figures show: one ships with each cantilever and center support panel, and any seams beyond those order TS7TIEPLATE packages of six (p217, p546). UFB flat brackets (p226) are for knife-edge L-configurations only and have no style number in the guide. Worksurfaces, pedestals and panels never share floor space: an overlap is an error, and the right-click menu and the inspector only place, resize, re-depth, flip or re-construct a worksurface, change a corner's size or kind, or add a pedestal when the result still fits with its supports on junctions. c:scape pulls are painted 4140/4144/4799, the other pulls plated metal (p274).
- Guide worked examples — the Typicals dialog includes every worked example from the thin trim Build Your Own pages as a preset: p38 Examples One–Three, p35 T Options 1–3 and Y Option 1, p36–p37 X Options 1–8, and the p41 stacking examples. p35–p37 draw the options without heights; the presets use heights that reproduce each option's printed trim list (checked in `test/test.js`). The p39 3" in-line junction is not modelled.
- SIF export — one record per style number and finish set (PN, MC, CT, PD, QT, PL, ON/OD pairs for every finish number, AN=OPTION/AD pairs for every option without one such as a powerkit, omit top cap or vertical application, TG tag). Manufacturer and catalog codes are set under Finishes & settings so they match your CAP or dealer system. Group the specification by workstation to tag each record with its workstation.
- Workstations — a workstation is a connected group of panels unless panels are named into one: the panel editor's Workstation field or right-click › Assign to workstation (both work on a multi-selection), and right-click › Split this pod into stations, which makes one station per cluster of touching worksurfaces and puts each panel with the worksurfaces on it (or the nearest ones). A worksurface follows its panel or carries its own workstation, so back-to-back stations on a shared spine split cleanly. The names drive the plan labels, the Specification grouped by workstation, the SIF TG tag, staging and the installer sheets; every junction belongs to one workstation, so the staged pieces add up to the pick list.
- Power-ins — checked per circuit run (powerkit and pass-through panels joined at junctions): a run with receptacles and no power-in, more than one power-in on a run, and more than 30/40 receptacles on a power-in are flagged (p146, p158). An infeed chosen with several panels selected goes on one panel. Powered typicals come with a 6' base power infeed.
- `build_catalog.py` / `build_workstations.py` — merge the extracted guide data (`data/`) into `src/catalog.json`.
- `build.py` — assembles `dist/index.html`, build number YYYY-MM-DD.N.
- `test/test.js` — engine tests against the guide's worked examples on p35–39 and the p41 stacking examples, plus regression checks for each rule below (`node test/test.js`).
- `test/guidex.js` — places every guide-example preset and checks it for errors.
- `test/outputs.js` — Specification, Shop and Pick & Install outputs: Show filter on CSV and SIF, CAD column, UTF-8 BOM, code-less SIF options, sourcing kept across finish changes, pick list split by source, live bins in the pick print, job-wide staging adding up to the pick list, plan printout, worksurface edge and oval junction cap colors.
- `test/final.js` — final QA regressions through the interface: runs moved or typicals dropped onto worksurfaces are refused, pods split into stations (spec, SIF, staging, installer sheets, save/load), power-ins per run, installer print, elevation posts, the ⊕ size, what-fits messages, shop inspect and print, Fit on big jobs, the one-row header.
- `test/wsoverlap.js` / `test/wsstress.js` — check every typical, and every typical filled with corners and straights from the right-click menu, for worksurface overlaps and rule errors, butted seams and supports on junctions.
- `test/ws2.js` — drives the fit-checked worksurface menus and inspector: refused placements, corner size and kind changes, pedestals, pull colors, 36"D and a straight-to-straight L.
- `test/overlap.js` — sweeps every stage, editor, menu, dialog and print view at four window sizes for text that overlaps, is clipped or runs off screen, including labels drawn on the plan and elevations.

## Guide corrections applied

- p400 Square V/Y junctions, wood cap, 48" V row printed TS742SVPJW. Corrected to TS748SVPJW and flagged on the BOM.
- p401 Oval V/Y junctions, plastic cap, 48" V row printed TS742VPJ. Corrected to TS748VPJ and flagged.
- p487 Series 9000 grommet color 6612 carries an unreadable mark. Offered and marked verify.
- p38 Example Two lists a 66" inside corner light seal for a 54" junction. Seals are never specified below 66" and never below the tallest junction, since a long seal can be field cut (p28).
- p13 lists a 72" skin (TS77230TK) that does not exist on the skin pages. 78" panels default to 60" + 12" tiles.
- p38 Example One prints TS712TCICHT for the end-of-run change-of-height trim. The part is TS712TICHT (p35–p37, p351).
- p38 Example Three prints TS7120A4 for the 120° aligner. The aligner is TS7120VA4 (p375).
- TS712XPJS and TS724XPJS are $293 on p363 (thin) and $299 on p406 (square/oval). Thin trim jobs use the p363 price and square or oval jobs the p406 price.
- RPXFTAKPP is $64 on p610 and $62 on p702. The p610 price is used.

Scope: panels, shared components, wiring and cabling, surface materials, Universal worksurfaces and supports, fixed and mobile pedestals. Other storage, tables and lighting are not in this build.
