import sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = sys.argv[1]
font = TTFont(sys.argv[2])
font = instantiateVariableFont(font, {"wght": 500})
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
capH = font['OS/2'].sCapHeight

def word(text, tracking_em=0.42):
    pen = SVGPathPen(gs); x = 0; adv_last = 0
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        x += gs[g].width + (tracking_em * upm if i < len(text) - 1 else 0)
    return pen.getCommands(), x  # baseline at y=0, caps go to -capH

# ---- marchio: buco nero ----
# anello di fotoni a mezzaluna (più spesso in basso a destra: beaming relativistico)
# + disco di accrescimento sottile e inclinato che passa davanti all'orizzonte
C = 128
RING = (f"M{C-80},{C} a80,80 0 1,0 160,0 a80,80 0 1,0 -160,0 Z "
        f"M{C-8-58},{C-8} a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0 Z")
DISK = "M-128,8 C-60,-18 40,-30 128,-10 C40,2 -60,16 -128,8 Z"   # lente affusolata
ROT = f"translate({C} {C}) rotate(-24)"

def mark(fill, uid, x=0, y=0, s=1.0, ring=None, disk=None):
    ring = ring or fill; disk = disk or fill
    return f'''<g transform="translate({x} {y}) scale({s})">
  <mask id="m{uid}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="356" height="356">
    <rect x="-50" y="-50" width="356" height="356" fill="#fff"/>
    <path d="{DISK}" transform="{ROT}" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/>
  </mask>
  <path d="{RING}" fill-rule="evenodd" fill="{ring}" mask="url(#m{uid})"/>
  <path d="{DISK}" transform="{ROT}" fill="{disk}"/>
</g>'''

GRAD = '''<linearGradient id="gr" x1="40" y1="40" x2="216" y2="216" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="#8fb4ff"/><stop offset=".6" stop-color="#c9dbff"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'''

def svg(w, h, body, bg=None, defs=""):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs>{defs}</defs>{b}{body}</svg>\n'

def save(name, s): open(os.path.join(OUT, name), "w").write(s)

# solo marchio
for name, fill in [("mark-black", "#0b0d12"), ("mark-white", "#ffffff")]:
    save(f"vastity-{name}.svg", svg(256, 256, mark(fill, name)))
save("vastity-mark-color.svg", svg(256, 256, mark(None, "c", ring="url(#gr)", disk="#ffffff"), defs=GRAD))

# icona app (sfondo scuro con bagliore)
ICON_DEFS = GRAD + '''<radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#121a30"/><stop offset="1" stop-color="#000"/></radialGradient>'''
save("vastity-app-icon.svg", svg(512, 512, f'<rect width="512" height="512" fill="url(#bg)"/>' + mark(None, "i", x=56, y=56, s=1.5625, ring="url(#gr)", disk="#ffffff"), defs=ICON_DEFS))

# lockup orizzontale e verticale
d, wlen = word("VASTITY")
for variant, fill, bg, defs, ring, disk in [
    ("black", "#0b0d12", None, "", None, None),
    ("white", "#ffffff", None, "", None, None),
    ("color", "#eef2ff", None, GRAD, "url(#gr)", "#ffffff"),
]:
    # orizzontale: marchio alto 120, maiuscole alte 44
    ts = 44 / capH; mh = 120; gap = 34; pad = 20
    W = pad + mh + gap + wlen * ts + pad; H = mh + 2 * pad
    ty = pad + mh / 2 + 44 / 2
    body = mark(fill, "h" + variant, x=pad, y=pad, s=mh / 256, ring=ring, disk=disk)
    body += f'<path d="{d}" transform="translate({pad+mh+gap} {ty}) scale({ts})" fill="{fill}"/>'
    save(f"vastity-logo-horizontal-{variant}.svg", svg(round(W), round(H), body, defs=defs))
    # verticale: marchio 200, testo 40 centrato
    ts = 40 / capH; mh = 200; pad = 30
    tw = wlen * ts; W = max(mh, tw) + 2 * pad; H = pad + mh + 40 + 40 + pad
    body = mark(fill, "v" + variant, x=(W - mh) / 2, y=pad, s=mh / 256, ring=ring, disk=disk)
    body += f'<path d="{d}" transform="translate({(W - tw) / 2} {pad + mh + 40 + 40}) scale({ts})" fill="{fill}"/>'
    save(f"vastity-logo-vertical-{variant}.svg", svg(round(W), round(H), body, defs=defs))
print("ok")
