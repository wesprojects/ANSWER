"""Isometric SVG render of the 3D blocks in a CAP DXF (ours or CAP's): every top-level INSERT is expanded through its 3_ twin (or itself
when it is a 3_ block), nested inserts included, polyface meshes and 3DFACEs drawn back to front. Usage: python cap/iso3d.py in.dxf out.svg [scale] [azimuth deg: turn the model so an L reads as a V]
"""
import sys, math, ezdxf

def rot(deg, x, y):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg)); return x * c - y * s, x * s + y * c

def faces_of(doc, block_name, origin, deg, out, depth=0):
    b = doc.blocks.get(block_name)
    if b is None or depth > 6: return
    for e in b:
        t = e.dxftype()
        if t == 'INSERT':
            ix, iy, iz = e.dxf.insert; rx, ry = rot(deg, ix, iy)
            faces_of(doc, e.dxf.name, (origin[0] + rx, origin[1] + ry, origin[2] + iz), deg + e.dxf.rotation, out, depth + 1)
        elif t == 'POLYLINE' and e.is_poly_face_mesh:
            verts = [v.dxf.location for v in e.vertices if not v.is_face_record]
            for f in e.vertices:
                if not f.is_face_record: continue
                idx = [abs(int(f.dxf.get(k, 0))) for k in ('vtx0', 'vtx1', 'vtx2', 'vtx3')]; idx = [i for i in idx if i]
                pts = []
                for i in idx:
                    v = verts[i - 1]; rx, ry = rot(deg, v.x, v.y); pts.append((origin[0] + rx, origin[1] + ry, origin[2] + v.z))
                out.append((e.dxf.layer, pts))
        elif t == '3DFACE':
            pts = []
            for k in ('vtx0', 'vtx1', 'vtx2', 'vtx3'):
                v = e.dxf.get(k); rx, ry = rot(deg, v.x, v.y); pts.append((origin[0] + rx, origin[1] + ry, origin[2] + v.z))
            out.append((e.dxf.layer, pts))

def main(src, dst, scale=4.0, azimuth=0.0):
    doc = ezdxf.readfile(src); msp = doc.modelspace(); faces = []
    for e in msp.query('INSERT'):
        name = e.dxf.name; twin = name if name.startswith('3_') else ('3_' + name[2:] if name.startswith('P_') else None)
        if twin and twin in doc.blocks:
            faces_of(doc, twin, (e.dxf.insert.x, e.dxf.insert.y, e.dxf.insert.z), e.dxf.rotation, faces)
    if not faces: print('no 3D faces found'); return
    # isometric: x to the right-down, y to the right-up, z up
    def proj(p):
        x, y = rot(azimuth, p[0], p[1]); z = p[2]; return ((x - y) * math.cos(math.radians(30)), (x + y) * math.sin(math.radians(30)) - z)
    def depth(pts): return sum(rot(azimuth, p[0], p[1])[0] + rot(azimuth, p[0], p[1])[1] + p[2] for p in pts) / len(pts)
    faces.sort(key=lambda f: depth(f[1]))
    projected = [(layer, [proj(p) for p in pts]) for layer, pts in faces]
    xs = [q[0] for _, ps in projected for q in ps]; ys = [q[1] for _, ps in projected for q in ps]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); pad = 10
    W, Hh = (x1 - x0 + 2 * pad) * scale, (y1 - y0 + 2 * pad) * scale
    colours = {'AFUPA-3D-004': '#9aa4b1', 'AFUPA-3D-020': '#3c3f45', 'AFUPA-3D-028': '#7a5c3a', 'AFUPA-3D-051': '#8ec5f0', 'AFUPA-3D-010': '#556', 'AFUSK-3D-017': '#e9d8b4', 'AFUSK-3D-006': '#6d7f99', 'AFUSK-3D-016': '#a9d3f5', 'A-FURN-P-WKSF': '#d9cbb3', 'A-FURN-3-PEDS': '#b8b8b8'}
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{Hh:.0f}" viewBox="0 0 {W:.0f} {Hh:.0f}"><rect width="100%" height="100%" fill="white"/>']
    for layer, ps in projected:
        d = ' '.join(f'{(q[0] - x0 + pad) * scale:.1f},{(q[1] - y0 + pad) * scale:.1f}' for q in ps)
        svg.append(f'<polygon points="{d}" fill="{colours.get(layer, "#cccccc")}" fill-opacity="{0.55 if layer in ("AFUPA-3D-051", "AFUSK-3D-016") else 0.92}" stroke="#222" stroke-width="0.4"/>')
    svg.append('</svg>'); open(dst, 'w', encoding='utf-8').write(''.join(svg)); print('faces', len(faces), '->', dst)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 4.0, float(sys.argv[4]) if len(sys.argv) > 4 else 0.0)
