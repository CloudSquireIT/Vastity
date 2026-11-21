# Genera il marchio di Vastity: simbolo (buco nero con disco), wordmark in tracciati (Space Grotesk 300,
# spaziatura ampia come nel caricamento) e le combinazioni orizzontale/verticale, a colori e monocromatiche.
# Uso: python3 scripts/brand.py  →  brand/*.svg
import io, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'brand')
FONT = os.path.join(ROOT, 'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2')

def wordmark_path(text='VASTITY', weight=300, size=100, tracking=0.42):
    f = TTFont(FONT)
    f = instantiateVariableFont(f, {'wght': weight})
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
    s = size / upm
    x = 0; parts = []
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, size * 0.72)))
        parts.append(pen.getCommands())
        x += gs[g].width * s + (size * tracking if i < len(text) - 1 else 0)
    cap = f['OS/2'].sCapHeight * s
    return ' '.join(parts), x, cap, size * 0.72

def mark(mono=None):
    """Simbolo 100×100: disco di accrescimento visto quasi di taglio, ombra, anello di fotoni."""
    if mono:
        c = mono
        return f'''<g fill="none" stroke="{c}" stroke-linecap="round">
  <path d="M25.5 52 C 24 21, 76 21, 74.5 52" stroke-width="2.4" opacity=".7"/>
  <circle cx="50" cy="50" r="19" stroke-width="3.2"/>
  <path d="M6 50 C 16 61, 84 61, 94 50" stroke-width="3.2"/>
</g>'''
    return '''<defs>
  <radialGradient id="vxGlow" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#ffd9a0" stop-opacity=".0"/><stop offset=".66" stop-color="#ffcf8a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9e4a" stop-opacity="0"/></radialGradient>
  <linearGradient id="vxDisk" x1="0" x2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".15"/><stop offset=".3" stop-color="#ffd08a"/><stop offset=".5" stop-color="#fff4e0"/><stop offset=".7" stop-color="#ffd08a"/><stop offset="1" stop-color="#ff8a3d" stop-opacity=".15"/></linearGradient>
  <linearGradient id="vxBack" x1="0" x2="1"><stop offset="0" stop-color="#ffb46a" stop-opacity="0"/><stop offset=".5" stop-color="#ffd9a6" stop-opacity=".8"/><stop offset="1" stop-color="#ffb46a" stop-opacity="0"/></linearGradient>
  <linearGradient id="vxLens" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff0d2"/><stop offset=".7" stop-color="#ffc27a" stop-opacity=".75"/><stop offset="1" stop-color="#ff9a4a" stop-opacity=".1"/></linearGradient>
</defs>
<circle cx="50" cy="50" r="31" fill="url(#vxGlow)"/>
<path d="M10 51 C 22 45, 78 45, 90 51" fill="none" stroke="url(#vxBack)" stroke-width="1.6" stroke-linecap="round"/>
<path d="M25.5 52 C 24 21, 76 21, 74.5 52" fill="none" stroke="url(#vxLens)" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="50" cy="50" r="19" fill="#000"/>
<circle cx="50" cy="50" r="19.6" fill="none" stroke="#fff1d6" stroke-width="1.6"/>
<path d="M6 50 C 16 61, 84 61, 94 50" fill="none" stroke="url(#vxDisk)" stroke-width="3.4" stroke-linecap="round"/>'''

def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}">{b}{body}</svg>\n'

def write(name, s):
    open(os.path.join(OUT, name), 'w').write(s)

os.makedirs(OUT, exist_ok=True)
wp, ww, cap, base = wordmark_path()
# simbolo
write('vastity-mark.svg', svg(100, 100, mark()))
write('vastity-mark-white.svg', svg(100, 100, mark('#ffffff')))
write('vastity-mark-black.svg', svg(100, 100, mark('#05070d')))
# wordmark
top = base - cap
write('vastity-wordmark-white.svg', svg(ww, cap + 2, f'<path transform="translate(0 {-top + 1:.2f})" d="{wp}" fill="#eef2ff"/>'))
write('vastity-wordmark-black.svg', svg(ww, cap + 2, f'<path transform="translate(0 {-top + 1:.2f})" d="{wp}" fill="#05070d"/>'))
# orizzontale: simbolo alto 2.2× l'altezza delle maiuscole
k = cap * 2.9 / 100
H = 100 * k
gap = cap * 0.55
hz = f'<g transform="scale({k:.4f})">{mark()}</g><path transform="translate({H + gap:.2f} {H / 2 - cap / 2 - top:.2f})" d="{wp}" fill="#eef2ff"/>'
write('vastity-lockup-horizontal.svg', svg(H + gap + ww, H, hz))
write('vastity-lockup-horizontal-dark-bg.svg', svg(H + gap + ww + 2 * cap, H + 2 * cap, f'<g transform="translate({cap:.1f} {cap:.1f})">{hz}</g>', '#05070d'))
# verticale
k2 = ww * 0.42 / 100
H2 = 100 * k2
vt = f'<g transform="translate({(ww - H2) / 2:.2f} 0) scale({k2:.4f})">{mark()}</g><path transform="translate(0 {H2 + cap * 1.1 - top:.2f})" d="{wp}" fill="#eef2ff"/>'
write('vastity-lockup-vertical.svg', svg(ww, H2 + cap * 2.2, vt))
print('ok', ww, cap)
