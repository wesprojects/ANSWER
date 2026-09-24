import sys, ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext, layout, svg
from ezdxf.addons.drawing.config import Configuration
src, out, box = sys.argv[1], sys.argv[2], sys.argv[3:]
doc = ezdxf.readfile(src); msp = doc.modelspace()
if box:
    x0, y0, x1, y1 = map(float, box)
    for e in list(msp):
        try: p = e.dxf.insert
        except Exception: continue
        if not (x0 < p.x < x1 and y0 < p.y < y1): msp.delete_entity(e)
be = svg.SVGBackend()
Frontend(RenderContext(doc), be, config=Configuration(min_lineweight=0.3)).draw_layout(msp)
open(out, 'w').write(be.get_string(layout.Page(0, 0)))
print('rendered', out)
