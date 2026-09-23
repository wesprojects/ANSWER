# ANSWER PANEL PLANNER

CONKLIN OFFICE FURNITURE - RESEARCH AND DEVELOPMENT

# ANSWER PANEL PLANNER

Plan, specify, build and install Steelcase Answer panel systems, Thin trim first and Oval trim second, from one job file. Draw panel runs on a plan or drop in typicals, set height, stacking, tiles, windows, power and frameless glass per panel, and every shared junction, trim, cap, aligner and package is resolved to the exact style number from the February 2015 Answer Solutions Specification Guide. Four stages carry the job from the office to the shop floor: Plan, Specification (buy new, refurbish or stock per line, with package contents spelled out), Shop (upholstery and paint work orders, junction build sheets, field cuts) and Pick & Install (pick list with bins, staging by workstation, installer sheets with plan, elevations and junction-by-junction parts). Every guide reference opens that page of the guide.

<span style="color:grey">OUTPUT IN .ANSWER JOB, CSV, PRINTABLE SPEC / WORK ORDER / PICK LIST / INSTALLER SHEET FORMAT</span>

LAUNCH — https://wesprojects.github.io/ANSWER/

README — https://github.com/wesprojects/ANSWER

## Files

- `index.html` — the whole app in one file. Opens from disk or GitHub Pages.
- `answer-1.pdf` (pages 1–200) and `answer-2.pdf` (pages 201–766) — the Steelcase Answer Solutions Specification Guide, February 2015, split in two to stay under GitHub's 25 MB upload limit. Keep both next to index.html. Page links use the guide's printed page numbers.
- `src/` — `engine.js` (junction classification, exposed-face trim rules, stacking, oval mapping, pricing, validation), `planner.js` / `planner.css` / `planner.html` (interface), `catalog.json` (129 product groups, 2,413 style numbers, surface materials).
- `build.py` — assembles `dist/index.html`, build number YYYY-MM-DD.N.
- `test/test.js` — engine tests against the guide's worked examples on p35–39 (`node test/test.js`).

## Guide corrections applied

- p400 Square V/Y junctions, wood cap, 48" V row printed TS742SVPJW. Corrected to TS748SVPJW and flagged on the BOM.
- p401 Oval V/Y junctions, plastic cap, 48" V row printed TS742VPJ. Corrected to TS748VPJ and flagged.
- p487 Series 9000 grommet color 6612 carries an unreadable mark. Offered and marked verify.
- p38 Example Two lists a 66" inside corner light seal for a 54" junction. Seals are never specified below 66" and never below the tallest junction, since a long seal can be field cut (p28).
- p13 lists a 72" skin (TS77230TK) that does not exist on the skin pages. 78" panels default to 60" + 12" tiles.

Scope: panels, shared components, wiring and cabling, surface materials. Worksurfaces, storage, tables and lighting are not in this build.
