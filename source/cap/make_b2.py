# TEST_B2: one workstation taken from the CAP 6-pack, rebuilt in a fresh drawing with CAP's own block definitions, attributes, layers and
# insertion points, and no CAP catalog links (the ACAD_PROXY_OBJECT extension data). Written as R2013 to match the sample.
import ezdxf
from ezdxf.addons import Importer
src = ezdxf.readfile('cap_sample.dxf'); smsp = src.modelspace()
X0, X1, Y0, Y1 = 1430, 1600, 510, 600   # the top-left workstation of the pack
picked = [e for e in smsp.query('INSERT') if X0 < e.dxf.insert.x < X1 and Y0 < e.dxf.insert.y < Y1]
print('picked', len(picked), sorted({e.dxf.name for e in picked}))
new = ezdxf.new('R2013'); new.header['$INSUNITS'] = 1; new.header['$MEASUREMENT'] = 0
imp = Importer(src, new)
imp.import_tables(['layers', 'linetypes', 'styles'])
imp.import_entities(picked, new.modelspace()); imp.finalize()
msp = new.modelspace()
for e in msp: e.translate(-1441.891, -591.96, 0)
# CAP's own hidden catalog links do not survive the import (proxy objects); make sure nothing is left
left = sum(1 for e in msp.query('INSERT') if e.has_extension_dict)
print('inserts', len(msp.query('INSERT')), 'ext dicts left', left, 'blocks', len(new.blocks))
new.saveas('captest/TEST_B2_one_workstation_cap_blocks.dxf')
d = ezdxf.readfile('captest/TEST_B2_one_workstation_cap_blocks.dxf'); a = d.audit(); print('audit errors', len(a.errors), [str(x) for x in a.errors][:5])
