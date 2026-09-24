# ANSWER PANEL PLANNER — working rules for Claude Code

Single-file web app (`dist/index.html`, published as `index.html` on GitHub Pages from `main` of wesprojects/ANSWER) that plans, specifies,
builds and installs Steelcase Answer panel systems from the **February 2015 Answer Solutions Specification Guide**. Space planners use it live.

## The one rule that outranks everything
**Nothing may leave the specification guide.** Every style number, quantity, dimension, junction rule, support rule and option comes from the
guide, cited by page in a code comment. When a customer's system (CAP catalog, reman numbers) differs from the guide, keep the guide's numbers
and list the difference in the README for the owner to decide. Never rename, add or drop a part to make an export or an import work.
Never guess a dimension: read the page (`guide/pNNN.txt`, the PDFs `answer-1.pdf` p1–200 and `answer-2.pdf` p201–766, rendered with pymupdf).

## Layout
- `src/engine.js` rules, BOM, geometry, SIF, plain DXF; `src/capdxf.js` CAP DXF export; `src/planner.js` interface and drawing; `src/planner.html`,
  `src/planner.css`; `src/catalog.json` (146 products, 2,642 priced rows, every row cites its guide page).
- `build.py` writes `dist/index.html` (build number = New York date + counter; `--same` keeps the number). `build_catalog.py`, `build_workstations.py`.
- `test/` — engine and Playwright tests. `cap/` — CAP format findings (`NOTES.md`), the R2000 skeleton (`tpl.js`, also `CAPDXF_TPL` in
  `src/capdxf.js`), the reference drawings (`ref_r2000.dxf`, `TEST_B2_one_workstation_cap_blocks.dxf`, `TEST_C_R2000.dxf`) and the render scripts
  (`render.py`, `svg2png.js`, `make_b2.py`).
- **The authoritative source is `source/` in this repo** (pushed from the cloud session 2026-09-24 at build .14 plus CLAUDE.md and the guide text).
  A local checkout that rebuilt from a stale zip must merge its own changes onto `source/`, not the other way round: diff first, keep both sides' work.
- `guide/pNNN.txt` — the guide's text by page. `README.md` — the product description, the guide's rules as applied, corrections applied, tests.

## Facts already settled (do not re-derive or relitigate)
- In-line junction 1 1/2" along the run centred on the node (p24); end-of-run post 3/4" inside the module, trim 1/2" thin / 1" oval beyond (p14, p39, p76);
  skins run over straight junctions (p16); base trim 3 3/4", top cap 2 1/4" (p13); thin cap drawn as its 5/8" lip; corner caps p375 (90° square 3",
  120° triangular, inradius 1.5/√3).
- Corner allowance: a panel off an L/T/X starts 1 1/2" from the corner centre (about 5/8" at V/Y); node-to-node = width + allowances; geometry
  normalised on every change (`E.normalizeGeometry`); CAP's own drawings confirm it.
- Worksurfaces butt with no gap; supports on junctions (p209, p216); tie plates at every seam, 3" in from the edge (p181–182); one per cantilever/CSP,
  packs of 6 TS7TIEPLATE; cantilever 15 1/2" deep; CSP 11".
- Frameless glass thin only, 24"W and up, not over a top-position window, connector TS7TFGRC per p386, one glass kit may span in-line panels (p57).
- Worksurface ends hang on junctions (p209, p216), so an L of two straights needs the return leg segmented to put a junction at the other
  worksurface's front edge (24"W panel + 1 1/2" = 25 1/2" for a 24"D); 35 1/2"D straights are freestanding only (p508 tip), so 36"D is not offered on panels.
- Guide corrections applied: p400 TS742SVPJW→TS748SVPJW, p401 TS742VPJ→TS748VPJ, p487 6612 mark (verify).
- CAP DXF: CAP refuses R12; accepts R2000 (AC1015). Parts are `P_<style>` blocks with the 16 CAP attributes; panels are config blocks with the
  frame and skins nested; CAP keeps block definitions that are in the drawing (so correct `3_<style>` 3D blocks can ship in the file).

## Workflow — every change
1. Work in the source; add or extend a test for the change (a Playwright test for interface changes, `test/test.js` for rules).
2. Run the whole suite before any push: `node test/test.js`, then `NODE_PATH=$(npm root -g) node test/<name>.js` for
   ui3 ui5 ui6 ui7 ui8 ui9 ui10 ui11 guidex plan ws2 outputs wsoverlap wsstress final dims caps elevpick handle join corner capbtn overlap, and
   `node test/capdxf.js` (needs `pip install ezdxf`). `overlap` must end `TOTAL 0`. Symlink `answer-1.pdf` and `answer-2.pdf` into `dist/` for the guide tests.
   On the owner's Windows machine (Git Bash): the project is `Desktop\ANSWER PANEL PLANNER` (this repo's checkout) and the tests run from `source\`;
   use `python` (`python3` is the Store stub; `pip install pymupdf ezdxf tzdata`), `export NODE_PATH="$(npm root -g)"`, copy the PDFs into `dist/`
   (symlinks need admin rights), and `build.py` writes LF so the built file matches the repo.
3. Update `README.md` (what changed and the guide pages behind it). Build with `python3 build.py`.
4. Commit the source (`source/` is part of this repo now; `dist/`, caches and test output stay ignored) with a clear message.
   Copy `dist/index.html` and `README.md` (and this file) into the repo checkout, commit, push to
   `claude/dazzling-gauss-0nzo38`, fast-forward `main` (`git checkout main && git merge --ff-only claude/dazzling-gauss-0nzo38 && git push`), so it goes live.
5. Zip the source (everything but `.git`, `__pycache__`, `test/overlap`, `test/capout`, `dist/*.pdf`, PNGs, `test/run_*.log`) to `Downloads\ANSWER\ANSWER_source.zip`.
6. Report plainly: what changed, what the tests showed, what is not done. No silent skips.

## Interface conventions the owner has set
Thin top cap thin; ends and junctions look like the real parts; ⊕ handles 20px, left-click extends straight, right-click lists compliant directions
only; Add worksurface tool with depth and width choices; dragging a run snaps onto another run only where Answer allows the junction; clicking a
part in an elevation centres the plan on it without scrolling the page; the hide/show editor control is « ».

## Open work (in order)
1. Correct 3D `3_<style>` blocks in the CAP export, built from the guide's actual dimensions (waiting on a 3D CAP DXF sample and screenshots).
2. Import CAP Worksheet exports / SIF / CAP DXF attributes as a job for the Pick & Install stage (waiting on worksheet exports and a pick list sample).
3. Frameless glass drawn heights: check `E.GLASS.recessed.heights` against p56/p384–385 (6"H kit = 9 5/16" glass, 12"H = 15 1/2", 18"H = 21 5/8").
   Seen 2026-09-24: the table is keyed 12/18/24 while the interface offers 6/12/18, so a 6" kit draws 6" of glass and a 12" kit 9 5/16". Read the pages before changing it.
