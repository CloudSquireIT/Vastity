"""Esporta tutte le icone (iPhone/iPad, PWA, favicon) dal render master 2048x2048.

Uso: python3 scripts/brand/export-icons.py <master-2048.png>
"""
import json, os, sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
master = Image.open(sys.argv[1]).convert("RGB")  # iOS non accetta trasparenza
W = master.width

def size(img, px, sharpen=False):
    out = img.resize((px, px), Image.LANCZOS, reducing_gap=3.0)
    if sharpen and px <= 64:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=1))
    return out

# per le dimensioni minuscole si inquadra più da vicino il buco nero: le stelle sparirebbero comunque
def tight(img, keep=0.72):
    m = int(W * (1 - keep) / 2)
    return img.crop((m, m, W - m, W - m))

def save(img, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True, **kw)

# ---------- iPhone / iPad (Xcode AppIcon.appiconset) ----------
ios = os.path.join(ROOT, "resources/ios/AppIcon.appiconset")
entries = [  # (idiom, punti, scala)
    ("iphone", 20, 2), ("iphone", 20, 3), ("iphone", 29, 2), ("iphone", 29, 3),
    ("iphone", 40, 2), ("iphone", 40, 3), ("iphone", 60, 2), ("iphone", 60, 3),
    ("ipad", 20, 1), ("ipad", 20, 2), ("ipad", 29, 1), ("ipad", 29, 2),
    ("ipad", 40, 1), ("ipad", 40, 2), ("ipad", 76, 1), ("ipad", 76, 2), ("ipad", 83.5, 2),
    ("ios-marketing", 1024, 1),
]
images, done = [], {}
for idiom, pt, sc in entries:
    px = int(round(pt * sc))
    name = f"AppIcon-{px}.png"
    if px not in done:
        src = tight(master, 0.82) if px <= 60 else master
        save(size(src, px, sharpen=True), os.path.join(ios, name)); done[px] = name
    p = f"{pt:g}"
    images.append({"idiom": idiom, "size": f"{p}x{p}", "scale": f"{sc}x", "filename": name})
# formato moderno di Xcode (un solo 1024 universale) + elenco classico per compatibilità
images.insert(0, {"idiom": "universal", "platform": "ios", "size": "1024x1024", "filename": "AppIcon-1024.png"})
with open(os.path.join(ios, "Contents.json"), "w") as f:
    json.dump({"images": images, "info": {"version": 1, "author": "xcode"}}, f, indent=2)
# sorgente per @capacitor/assets (npx @capacitor/assets generate)
save(size(master, 1024), os.path.join(ROOT, "assets/icon-only.png"))

# ---------- web / PWA ----------
icons = os.path.join(ROOT, "public/icons")
save(size(master, 512), os.path.join(icons, "icon-512.png"))
save(size(master, 192), os.path.join(icons, "icon-192.png"))
save(size(master, 180), os.path.join(icons, "apple-touch-icon.png"))
save(size(master, 512), os.path.join(icons, "icon-maskable-512.png"))  # il buco nero sta nella zona sicura
f32 = size(tight(master), 32, sharpen=True); f16 = size(tight(master, 0.6), 16, sharpen=True)
save(f32, os.path.join(icons, "favicon-32.png")); save(f16, os.path.join(icons, "favicon-16.png"))
f48 = size(tight(master), 48, sharpen=True); f64 = size(tight(master, 0.8), 64, sharpen=True)
# favicon.ico multi-risoluzione nella radice pubblica
f64.save(os.path.join(ROOT, "public/favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
         append_images=[f16, f32, f48])
print("ok", len(done), "icone iOS")
