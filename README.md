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
- Workstations — Universal straight, corner, extended corner and 120° corner worksurfaces (p506–526), panel-mounted supports (p545–548), post legs (p552), fixed and mobile pedestals with fillers (p608–614). Supports follow p207–217: cantilevers at free ends, one shared cantilever per seam, side support brackets at wrapped ends and rear corners, an end panel for the front edge of 30"D worksurfaces, a reinforcing channel over 54" spans, a fixed pedestal replaces the cantilever where it sits. Worksurfaces butt at the panel junctions with no gap. Every butted seam gets a tie plate (drawn on the plan): one ships with each cantilever and center support panel, and any seams beyond those order TS7TIEPLATE packages of six (p217, p546). UFB flat brackets (p226) are for knife-edge L-configurations only and have no style number in the guide. Worksurfaces, pedestals and panels never share floor space: an overlap is an error, and the right-click menu only places a worksurface that fits with its supports on junctions.
- SIF export — one record per style number and finish set (PN, MC, CT, PD, QT, PL, ON/OD pairs, TG tag). Manufacturer and catalog codes are set under Finishes & settings so they match your CAP or dealer system. Group the specification by workstation to tag each record with its workstation.
- `build_catalog.py` / `build_workstations.py` — merge the extracted guide data (`data/`) into `src/catalog.json`.
- `build.py` — assembles `dist/index.html`, build number YYYY-MM-DD.N.
- `test/test.js` — engine tests against the guide's worked examples on p35–39 and the p41 stacking examples, plus regression checks for each rule below (`node test/test.js`).
- `test/wsoverlap.js` / `test/wsstress.js` — check every typical, and every typical filled with corners and straights from the right-click menu, for worksurface overlaps and rule errors.
- `test/overlap.js` — sweeps every stage, editor, menu, dialog and print view at four window sizes for text that overlaps, is clipped or runs off screen, including labels drawn on the plan and elevations.

## Guide corrections applied

- p400 Square V/Y junctions, wood cap, 48" V row printed TS742SVPJW. Corrected to TS748SVPJW and flagged on the BOM.
- p401 Oval V/Y junctions, plastic cap, 48" V row printed TS742VPJ. Corrected to TS748VPJ and flagged.
- p487 Series 9000 grommet color 6612 carries an unreadable mark. Offered and marked verify.
- p38 Example Two lists a 66" inside corner light seal for a 54" junction. Seals are never specified below 66" and never below the tallest junction, since a long seal can be field cut (p28).
- p13 lists a 72" skin (TS77230TK) that does not exist on the skin pages. 78" panels default to 60" + 12" tiles.
- p38 Example Three prints TS7120A4 for the 120° aligner. The aligner is TS7120VA4 (p375).
- TS712XPJS and TS724XPJS are $293 on p363 (thin) and $299 on p406 (square/oval). Thin trim jobs use the p363 price and square or oval jobs the p406 price.
- RPXFTAKPP is $64 on p610 and $62 on p702. The p610 price is used.

Scope: panels, shared components, wiring and cabling, surface materials, Universal worksurfaces and supports, fixed and mobile pedestals. Other storage, tables and lighting are not in this build.
