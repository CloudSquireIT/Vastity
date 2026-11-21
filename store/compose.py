# Compone le immagini finali per gli store: screenshot dell'app con una didascalia sopra, su fondo
# notte con il simbolo di Vastity. Formati: App Store iPhone 6,9" (2868×1320), iPad 13" (2752×2064),
# Google Play telefono (2400×1200) e grafica in evidenza Play (1024×500).
# Uso: python3 store/compose.py   (legge store/raw, scrive store/screens/<lingua>/...)
import io, os, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'store/raw'); OUT = os.path.join(ROOT, 'store/screens')
WOFF = os.path.join(ROOT, 'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2')

def font_ttf(weight):
    p = f'/tmp/vastity-sg-{weight}.ttf'
    if not os.path.exists(p):
        f = TTFont(WOFF); f.flavor = None
        instantiateVariableFont(f, {'wght': weight}, inplace=True)
        f.save(p)
    return p

CAP = {
  '1-sky': ('Il cielo di stanotte, sopra casa tua', "Tonight's sky, right above you", 'Le ciel de ce soir, au-dessus de vous'),
  '2-saturn': ('Vola tra gli anelli di Saturno', "Fly through Saturn's rings", 'Volez entre les anneaux de Saturne'),
  '3-milkyway': ('Esci dalla Via Lattea', 'Step outside the Milky Way', 'Sortez de la Voie lactée'),
  '4-andromeda': ('Raggiungi Andromeda, più veloce della luce', 'Reach Andromeda, faster than light', "Rejoignez Andromède, plus vite que la lumière"),
  '5-blackhole': ('Guarda dentro un buco nero', 'Stare into a black hole', 'Plongez dans un trou noir'),
  '6-story': ('Una storia dietro ogni stella', 'A story behind every star', 'Une histoire derrière chaque étoile'),
  '7-exo': ('Oltre 6000 mondi attorno ad altre stelle', 'Over 6,000 worlds around other stars', "Plus de 6 000 mondes autour d'autres étoiles"),
}
LI = {'it': 0, 'en': 1, 'fr': 2}

def background(W, H):
    bg = Image.new('RGB', (W, H), (5, 7, 13))
    glow = Image.new('RGB', (W, H), (5, 7, 13))
    d = ImageDraw.Draw(glow)
    d.ellipse((-W * 0.2, -H * 0.9, W * 1.2, H * 0.55), fill=(16, 26, 58))
    return Image.blend(bg, glow.filter(ImageFilter.GaussianBlur(H * 0.18)), 0.9)

def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), r, fill=255)
    out = Image.new('RGBA', im.size); out.paste(im, (0, 0), m); return out

def compose(raw, caption, W, H, top_frac):
    bg = background(W, H).convert('RGBA')
    shot = Image.open(raw).convert('RGB')
    # lo screenshot occupa la parte bassa; sopra la didascalia
    avail_h = int(H * (1 - top_frac)) - int(H * 0.04)
    sw = int(W * 0.9); sh = int(shot.height * sw / shot.width)
    if sh > avail_h: sh = avail_h; sw = int(shot.width * sh / shot.height)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x = (W - sw) // 2; y = H - sh - int(H * 0.04)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 10, x + sw, y + sh + 10), int(sw * 0.02), fill=(0, 0, 0, 170))
    bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(28)))
    bg.alpha_composite(rounded(shot, int(sw * 0.02)), (x, y))
    d = ImageDraw.Draw(bg)
    size = int(H * top_frac * 0.36)
    f = ImageFont.truetype(font_ttf(500), size)
    while d.textlength(caption, font=f) > W * 0.86: size -= 2; f = ImageFont.truetype(font_ttf(500), size)
    tw = d.textlength(caption, font=f)
    d.text(((W - tw) / 2, H * top_frac * 0.5 - size * 0.62), caption, font=f, fill=(238, 242, 255))
    return bg.convert('RGB')

for lang, li in LI.items():
    for scene, caps in CAP.items():
        for dev, (W, H, tf), outname in [('iphone', (2868, 1320, 0.2), 'appstore-iphone69'), ('ipad', (2752, 2064, 0.16), 'appstore-ipad13'), ('iphone', (2400, 1200, 0.2), 'play-phone')]:
            raw = os.path.join(RAW, f'{lang}-{dev}-{scene}.png')
            if not os.path.exists(raw): continue
            os.makedirs(os.path.join(OUT, lang, outname), exist_ok=True)
            compose(raw, caps[li], W, H, tf).save(os.path.join(OUT, lang, outname, f'{scene}.png'), optimize=True)
    # grafica in evidenza di Google Play (1024×500): Andromeda + marchio
    raw = os.path.join(RAW, f'{lang}-iphone-4-andromeda.png')
    if os.path.exists(raw):
        im = Image.open(raw).convert('RGB')
        im = im.resize((1024, int(im.height * 1024 / im.width)), Image.LANCZOS)
        top = (im.height - 500) // 2; im = im.crop((0, top, 1024, top + 500))
        im = Image.blend(im, Image.new('RGB', im.size, (5, 7, 13)), 0.35)
        d = ImageDraw.Draw(im)
        f = ImageFont.truetype(font_ttf(300), 64)
        t = 'V A S T I T Y'; tw = d.textlength(t, font=f)
        d.text(((1024 - tw) / 2, 200), t, font=f, fill=(238, 242, 255))
        os.makedirs(os.path.join(OUT, lang, 'play-feature'), exist_ok=True)
        im.save(os.path.join(OUT, lang, 'play-feature', 'feature-graphic.png'))
print('ok')
