# June 2022 Answer guide against the February 2015 guide (first pass, 2026-09-25)

Source: `answer-2022.pdf` at the checkout root (766 pages, same count as 2015 but re-organised; printed page = PDF page). Text by page in
`guide2022/pNNN.txt` (the PDF's fonts encode "fi" as "À " and sometimes "w"; fractions print as e.g. 417¼8 for 41 7/8). Section map: `_toc.txt`
(2022 bookmarks, then 2015). Page similarity: `_pagediff.json`. Style universe: `_styles.json`.

## Style numbers
- 2,394 style numbers in the 2015 text, 2,772 in 2022; 2,379 common. Gone in 2022 (15): TS742HB/748HB/760HB/772HB, TS778xxPF (6 widths), TS7AVH,
  TS7BMH, TS7BSWHC, TS7CNTSTKR, TS7PVWM. Of the catalog's 2,622 styles only TS7CNTSTKR is absent from the 2022 text.
- The two 2015 corrections (p400 TS748SVPJW, p401 TS748VPJ) are printed as such in 2022: confirmed.
- New in 2022 (393): a 36"H panel height (35 11/16", post 34 5/8") with its own thin-trim junction, trim and stacking families (TS736T..., TS76...);
  change-of-height junction variants with a W suffix and many new CoH combinations (TS7...TCXJ/TCTJ/TCYJ/TCLJ/TCVJ/TCIJ, 90 + 28 + 28 + 14 + 7 x 3);
  6"H stacking junctions (6 3/16") and 6"H CoH trims; 24"H frameless glass kits (27 7/8" glass); Universal and Sarto screens on the Answer thin top cap
  (TS713xxTSSC/TUSC, 52); back-painted glass skins (40) and to-the-floor (24); Big Open Base skins, fabric (8) and steel (8); Answer boundary screens (10);
  worksurface reinforcing channels TS7WKSPT48..66 (6); junction grommet TS7FGJG; monitor mount TS7MTRMNT; markerboard surface TS7MBSP; access TS7BCC.

## Prices
- Every price checked differs (TS742TLPJ $156 -> $222; TS71236SPW $466 -> $688). Page 1: a further 9% adjustment effective July 18, 2022 is NOT in the
  book; price list 198.B (U.S.) / 155.B (Canada) dated June 20, 2022.

## Rules and dimensions (settled facts), 2022 page in brackets
- Actual heights (p16): 29 1/2, 35 11/16 (new), 41 7/8, 48 1/16, 54 1/4, 66 19/32, 78 31/32: unchanged plus the 36"H.
- Post heights (p20): 28 7/16 (no wall-start), 34 5/8 (new), 40 3/4, 47, 53 1/8, 65 1/2, 77 3/8; junction 3"; end-of-run trim adds 1/2" to the footprint;
  wall-start adds 3/16": unchanged.
- Stacking junction heights (p32): 6 3/16 (new), 12 3/8, 18 1/2, 24 3/4. CoH trims (p24): 6 3/16, 12 5/32, 18 1/2, 24 1/2, 30 7/8, 36 7/8 (6"H and 36"H new).
- Frameless glass (p64, p67): glass heights 9 5/16, 15 1/2, 21 11/16, 27 7/8 (2015 p56 printed 21 5/8 for the 18" kit: 1/16" change); width = panel
  width - 1/8" (1/16" each end), change-of-height end 7/16" short; thickness 3/8"; clamp spacing max 48".
- Worksurfaces (p213-218): reinforcing channels (new, TS7WKSPT) with span tables; support-span rules re-stated (>54"W light use, >48"W knife edge).
  The 2015 p209/p216 support rules the engine applies must be re-read against p214-218 before any change.
- Still to compare: p50-51 skins and tiles (2022 p124-141), corner caps (2015 p375), tie plates (2015 p181-182), stability (2022 p148-166),
  the L-of-two-straights and 35 1/2"D rules (2015 p508), pedestals/storage, power.

## What a switch needs
- The catalog was built by `build_catalog.py` from JSON extracted in the cloud session's scratchpad (`spec/out/*.json`), which is not in the repo:
  either recover that pipeline from the cloud session or write a new extractor for the 2022 text.
- Every page cite in the code (about 190 distinct 2015 pages) is remapped through the section map.
