# Installa le icone generate (brand/icons) in iOS (icona principale + icone alternative),
# Android (icona adattiva e classica) e web (PWA, favicon). Uso: python3 scripts/install-icons.py
import os, json
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I = os.path.join(R, 'brand', 'icons')
img = lambda n: Image.open(os.path.join(I, n + '.png')).convert('RGBA')
DEFAULT = 'night'
ALT = {'aurora': 'AppIcon-Aurora', 'gold': 'AppIcon-Gold', 'minimal': 'AppIcon-Minimal'}
cat = os.path.join(R, 'ios/App/App/Assets.xcassets')
def iosset(folder, src):
    d = os.path.join(cat, folder + '.appiconset'); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f.endswith('.png'): os.remove(os.path.join(d, f))
    img(src).convert('RGB').save(os.path.join(d, 'icon-1024.png'))
    json.dump({'images': [{'idiom': 'universal', 'size': '1024x1024', 'filename': 'icon-1024.png', 'platform': 'ios'}], 'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(d, 'Contents.json'), 'w'), indent=2)
iosset('AppIcon', DEFAULT)
for k, v in ALT.items(): iosset(v, k)
# anteprime piccole per le impostazioni dell'app
os.makedirs(os.path.join(R, 'public/icons/alt'), exist_ok=True)
for k in ['night', *ALT]: img(k).resize((120, 120), Image.LANCZOS).convert('RGB').save(os.path.join(R, f'public/icons/alt/{k}.png'))
# Android
res = os.path.join(R, 'android/app/src/main/res')
dens = {'ldpi': .75, 'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
full, fg, bg = img(DEFAULT), img(DEFAULT + '-fg'), img(DEFAULT + '-bg')
for k, f in dens.items():
    d = os.path.join(res, 'mipmap-' + k); os.makedirs(d, exist_ok=True)
    s = round(48 * f)
    full.resize((s, s), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
    m = Image.new('L', (s * 4, s * 4), 0); from PIL import ImageDraw; ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255); m = m.resize((s, s), Image.LANCZOS)
    rr = full.resize((s, s), Image.LANCZOS); rr.putalpha(m); rr.save(os.path.join(d, 'ic_launcher_round.png'))
    a = round(108 * f)
    # nell'icona adattiva il disegno sta nella zona sicura (66/108)
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); inner = fg.resize((int(1024 * 0.78), int(1024 * 0.78)), Image.LANCZOS)
    canvas.alpha_composite(inner, ((1024 - inner.width) // 2, (1024 - inner.height) // 2))
    canvas.resize((a, a), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))
    bg.resize((a, a), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_background.png'))
# web
w = os.path.join(R, 'public/icons')
full.resize((192, 192), Image.LANCZOS).convert('RGB').save(os.path.join(w, 'icon-192.png'))
full.resize((512, 512), Image.LANCZOS).convert('RGB').save(os.path.join(w, 'icon-512.png'))
mk = bg.copy(); inner = fg.resize((800, 800), Image.LANCZOS); mk.alpha_composite(inner, (112, 112)); mk.resize((512, 512), Image.LANCZOS).convert('RGB').save(os.path.join(w, 'icon-maskable-512.png'))
full.resize((180, 180), Image.LANCZOS).convert('RGB').save(os.path.join(w, 'apple-touch-icon.png'))
full.resize((64, 64), Image.LANCZOS).save(os.path.join(w, 'favicon-64.png'))
full.resize((32, 32), Image.LANCZOS).save(os.path.join(w, 'favicon-32.png'))
full.convert('RGB').save(os.path.join(R, 'resources/icon.png'))
print('ok')
