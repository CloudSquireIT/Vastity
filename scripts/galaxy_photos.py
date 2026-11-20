#!/usr/bin/env python3
"""Foto reali delle galassie per i render visti da fuori.

Per ogni galassia del catalogo cerca la foto principale della sua pagina Wikipedia,
la accetta solo se la licenza permette l'uso commerciale senza vincoli di condivisione
(pubblico dominio, CC0, CC BY), toglie le stelle in primo piano, misura orientamento e
schiacciamento e produce:
  - una texture "face" (galassia raddrizzata come vista di fronte) per il disco 3D;
  - oppure, per le galassie di taglio, una texture "edge" (profilo) per lo strato di taglio.
Uscita: public/textures/{1k,2k}/gal_<id>.webp e public/data/galaxy-photos.json (crediti).

Uso: python3 scripts/galaxy_photos.py galaxies.json   (lista {id,name,m} esportata dall'app)
Richiede: Pillow, numpy, curl.
"""
import hashlib, html, io, json, os, re, subprocess, sys, time, urllib.parse
import numpy as np
from PIL import Image, ImageFilter

UA = 'Mozilla/5.0 (compatible; astronomy-app-asset-builder)'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OK_LICENSES = ('public domain', 'pd', 'cc0', 'cc by 4.0', 'cc by 3.0', 'cc by 2.0', 'cc by 2.5', 'cc-by-4.0', 'cc-by-3.0')

PAGES = {
    'lmc': 'Large Magellanic Cloud', 'smc': 'Small Magellanic Cloud', 'cena': 'Centaurus A', 'ngc253': 'Sculptor Galaxy',
    'ngc1300': 'NGC 1300', 'cartwheel': 'Cartwheel Galaxy', 'hoag': "Hoag's Object", 'antennae': 'Antennae Galaxies',
    'ic1101': 'IC 1101', 'm31g': 'Andromeda Galaxy', 'm33g': 'Triangulum Galaxy',
}


# foto scelte a mano (verificate comunque per licenza): le più belle e riconoscibili
OVERRIDE = {
    'm31g': 'Andromeda Galaxy (with h-alpha).jpg',
    'm51g': 'Messier51 sRGB.jpg',
    'm81g': 'Messier 81 HST.jpg',
    'm104g': 'M104 ngc4594 sombrero galaxy hi-res.jpg',
    'm82g': 'M82 HST ACS 2006-14-a-large web.jpg',
    'm101g': 'M101 hires STScI-PRC2006-10a.jpg',
    'm83g': 'The Outskirts of the Southern Pinwheel Galaxy (noirlab2429a).jpg',
    'ngc1300': 'Hubble2005-01-barred-spiral-galaxy-NGC1300.jpg',
    'c38g': 'NGC 4565.jpg',
}
# galassie principali: texture in alta risoluzione (2048 px)
FLAGSHIP = {'m31g', 'm33g', 'm51g', 'm81g', 'm101g', 'm104g', 'lmc', 'smc', 'ngc253', 'cena', 'm82g', 'm87g'}
# foto scartate al controllo visivo (oggetto sbagliato, collage, galassia tagliata)
REJECT = {'Caldwell 45 (50291468631).jpg', 'Messier89 - HST - Potw1902a.tif', 'Caldwell 32.jpg', 'Auv0175.png', 'Messier 65 through the years.jpg', 'NGC 891 Hubble north part.jpg', 'NGC 4631 Hubble mosaic.jpg'}
SKIP_NAME = re.compile(r'(map|chart|diagram|locator|location|finder|sketch|drawing|plot|spectrum|logo|auv\d|stamp|comparison|annotated|labeled|labelled)', re.I)


def get(url, binary=False):
    for k in range(4):
        r = subprocess.run(['curl', '-s', '-L', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True)
        body, _, code = r.stdout.rpartition(b'\n')
        time.sleep(1.2)
        if code == b'200':
            return body if binary else body.decode('utf-8', 'replace')
        if code in (b'404', b'400'):
            return None
        time.sleep(4 * (k + 1))
    return None


def page_title(g, ngc):
    if g['id'] in PAGES: return PAGES[g['id']]
    m = g.get('m') or ''
    if m.startswith('M'): return f'Messier {m[1:]}'
    if m.startswith('C') and ngc.get(m): return ngc[m]
    return g['name']


def candidate_images(title):
    """Immagine dell'infobox e poi tutte le altre immagini dell'articolo, in ordine."""
    for _ in range(3):
        w = get(f'https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(title)}&action=raw')
        if not w: return []
        red = re.match(r'#REDIRECT\s*\[\[([^\]#|]+)', w, re.I)
        if red: title = red.group(1); continue
        out = []
        m = re.search(r'\|\s*image\s*=\s*([^\n]*)', w)
        if m:
            v = re.sub(r'^\[\[(?:File|Image):', '', m.group(1).strip()).split('|')[0].strip(' ]')
            v = re.sub(r'^(?:File|Image):', '', v)
            if v: out.append(v)
        for f in re.findall(r'(?:File|Image):([^|\]\n]+\.(?:jpe?g|png|tiff?|webp))', w, re.I):
            f = f.strip()
            if f not in out: out.append(f)
        # gallerie: righe "Nome.jpg|didascalia"
        for f in re.findall(r'^([^|\n=<>{}\[\]]+\.(?:jpe?g|png|tiff?))\s*\|', w, re.I | re.M):
            f = f.strip()
            if f not in out: out.append(f)
        return out
    return []


def file_info(fname):
    page = get('https://en.wikipedia.org/wiki/File:' + urllib.parse.quote(fname.replace(' ', '_')))
    if not page: return None
    lic = re.search(r'class="licensetpl_short"[^>]*>([^<]*)', page)
    attr = re.search(r'class="licensetpl_attr"[^>]*>([^<]*)', page)
    if not attr or not attr.group(1).strip():
        # autore dalla tabella "Author" della pagina del file
        au = re.search(r'id="fileinfotpl_aut"[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>', page, re.S)
        if au:
            txt = re.sub(r'<[^>]+>', ' ', au.group(1))
            txt = re.sub(r'\s+', ' ', html.unescape(txt)).strip()
            attr = re.match(r'(.*)', txt[:160])
    dims = re.search(r'\(([\d,]+) × ([\d,]+) pixels', page)
    nc = 'noncommercial' in page.lower() or 'non-commercial' in page.lower()
    return {
        'license': html.unescape(lic.group(1).strip()) if lic else '',
        'credit': html.unescape(attr.group(1).strip()) if attr else '',
        'w': int(dims.group(1).replace(',', '')) if dims else 0,
        'h': int(dims.group(2).replace(',', '')) if dims else 0,
        'nc': nc,
    }


def download(fname, w, big=False):
    n = fname.replace(' ', '_')
    h = hashlib.md5(n.encode()).hexdigest()
    q = urllib.parse.quote(n)
    if big and w >= 2560: url = f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/2560px-{q}'
    elif big and w > 1280: url = f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}'
    elif w >= 1280: url = f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/1280px-{q}'
    elif w >= 960: url = f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/960px-{q}'
    else: url = f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}'
    if n.lower().endswith(('.tif', '.tiff')): url += '.jpg' if 'thumb' in url else ''
    cache = os.path.join(ROOT, '.data-src', 'galaxy-cache', hashlib.md5(url.encode()).hexdigest())
    if os.path.exists(cache):
        b = open(cache, 'rb').read()
    else:
        b = get(url, binary=True)
        if b:
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            open(cache, 'wb').write(b)
    if not b: return None
    try:
        return Image.open(io.BytesIO(b)).convert('RGB')
    except Exception:
        return None


def destar(im):
    W = im.size[0]
    a = np.asarray(im).astype(np.float32) / 255
    k = 11 if W > 900 else 7
    med = np.asarray(im.filter(ImageFilter.MedianFilter(k))).astype(np.float32) / 255
    lum, lm = a.mean(2), med.mean(2)
    mask = ((lum - lm) > 0.07) & (lum > lm * 1.5)
    mimg = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
    m = (np.asarray(mimg).astype(np.float32) / 255)[..., None]
    return a * (1 - m) + med * m


def measure(a):
    """Centro, angolo dell'asse maggiore, semiasse maggiore (px) e rapporto assiale,
    misurati sulla regione luminosa connessa che contiene il nucleo."""
    H, W = a.shape[:2]
    S = 320 / max(W, H)
    w, h = max(8, int(W * S)), max(8, int(H * S))
    small = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(2))
    bl = np.asarray(small).astype(np.float32).mean(2) / 255
    bg = np.percentile(bl, 25)
    yy, xx = np.mgrid[0:h, 0:w]
    wcen = np.exp(-(((xx - w / 2) / (0.3 * w)) ** 2 + ((yy - h / 2) / (0.3 * h)) ** 2))
    cy, cx = np.unravel_index(np.argmax((bl - bg) * wcen), bl.shape)
    peak = bl[cy, cx] - bg
    mask = (bl - bg) > 0.09 * peak
    comp = np.zeros_like(mask)
    stack = [(cy, cx)]
    comp[cy, cx] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not comp[ny, nx]:
                comp[ny, nx] = True
                stack.append((ny, nx))
    wgt = np.where(comp, bl - bg, 0)
    s_ = wgt.sum() + 1e-6
    mx, my = (wgt * xx).sum() / s_, (wgt * yy).sum() / s_
    cxx = (wgt * (xx - mx) ** 2).sum() / s_; cyy = (wgt * (yy - my) ** 2).sum() / s_; cxy = (wgt * (xx - mx) * (yy - my)).sum() / s_
    ev, evec = np.linalg.eigh(np.array([[cxx, cxy], [cxy, cyy]]))
    vx, vy = evec[:, 1]
    q = float(np.sqrt(max(ev[0], 1e-6) / max(ev[1], 1e-6)))
    ang = np.degrees(np.arctan2(vy, vx))
    # estensione: proiezione massima della regione sugli assi
    px, py = xx[comp] - mx, yy[comp] - my
    A = np.percentile(np.abs(px * vx + py * vy), 99.5) * 1.12
    B = np.percentile(np.abs(-px * vy + py * vx), 99.5) * 1.12
    q = max(0.08, min(1.0, 0.5 * q + 0.5 * B / max(A, 1e-6)))
    return (mx / S, my / S), float(ang), float(max(A, 6) / S), q


def make(a, centre, ang, A, q, S=1024):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    W, H = img.size
    pad = int(2 * A + 10)
    # il cielo di fondo della foto viene portato a nero prima della rotazione,
    # e una maschera sfumata nasconde i bordi del fotogramma originale
    lum = a.mean(2)
    bgc = np.percentile(a.reshape(-1, 3), 15, axis=0)
    a2 = np.clip((a - bgc) / np.maximum(1e-3, 1 - bgc), 0, 1)
    img = Image.fromarray((a2 * 255).astype(np.uint8))
    valid = Image.new('L', (W, H), 255)
    m = int(max(4, 0.03 * min(W, H)))
    frame = np.pad(np.full((H - 2 * m, W - 2 * m), 255, np.uint8), m)
    # anche i "buchi" neri dei mosaici (zone a zero assoluto) contano come fuori dalla foto
    lumi = Image.fromarray((a.max(2) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    gaps = np.asarray(lumi) <= 1
    frame = np.where(gaps, 0, frame).astype(np.uint8)
    valid = Image.fromarray(frame).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(m * 0.7))
    canvas = Image.new('RGB', (W + 2 * pad, H + 2 * pad))
    canvas.paste(img, (pad, pad))
    vcanvas = Image.new('L', (W + 2 * pad, H + 2 * pad))
    vcanvas.paste(valid, (pad, pad))
    cx, cy = centre[0] + pad, centre[1] + pad
    rot = canvas.rotate(ang, resample=Image.BICUBIC, center=(cx, cy))
    vrot = vcanvas.rotate(ang, resample=Image.BICUBIC, center=(cx, cy))
    rot = Image.fromarray((np.asarray(rot).astype(np.float32) * (np.asarray(vrot).astype(np.float32)[..., None] / 255)).astype(np.uint8))
    if q >= 0.28:
        # vista di fronte: si "raddrizza" l'ellisse in un cerchio (deproiezione)
        b = A * q
        box = (int(cx - A), int(cy - b), int(cx + A), int(cy + b))
        face = rot.crop(box).resize((S, S), Image.LANCZOS)
        val = np.asarray(vrot.crop(box).resize((S, S), Image.BILINEAR)).astype(np.float32) / 255
        t = np.asarray(face).astype(np.float32) / 255
        X, Y = np.meshgrid(np.linspace(-1, 1, S), np.linspace(-1, 1, S))
        r = np.hypot(X, Y)
        # dove la foto originale finisce prima del bordo del cerchio, la galassia sfuma in tempo:
        # per ogni direzione si trova il raggio utile e si sfuma prima di arrivarci (niente tagli netti)
        n_ang = 360
        rl = np.ones(n_ang)
        for k in range(n_ang):
            th = 2 * np.pi * k / n_ang
            for rr in np.linspace(0.02, 1.0, 120):
                x = int((np.cos(th) * rr * 0.5 + 0.5) * (S - 1)); y = int((np.sin(th) * rr * 0.5 + 0.5) * (S - 1))
                if val[y, x] < 0.6: rl[k] = rr; break
        win = 14
        ext = np.concatenate([rl[-win:], rl, rl[:win]])
        er = np.array([ext[i:i + 2 * win + 1].min() for i in range(n_ang)])
        ext = np.concatenate([er[-8:], er, er[:8]])
        sm = np.array([ext[i:i + 17].mean() for i in range(n_ang)])
        ang = (np.arctan2(Y, X) % (2 * np.pi)) / (2 * np.pi) * n_ang
        lim = sm[np.clip(ang.astype(int), 0, n_ang - 1)] * 0.96
        fade = (np.clip((1.0 - r) / 0.3, 0, 1) * np.clip((lim - r) / np.maximum(0.12, 0.3 * lim), 0, 1)) ** 1.6
        kind = 'face'
    else:
        # di taglio: profilo orizzontale 2048×716 (coordinate dello strato di taglio: ±1.2 R × ±0.42 R)
        R = A / 1.05
        box = (int(cx - 1.2 * R), int(cy - 0.42 * R), int(cx + 1.2 * R), int(cy + 0.42 * R))
        face = rot.crop(box).resize((2048, 716), Image.LANCZOS)
        val = vrot.crop(box).resize((2048, 716), Image.BILINEAR)
        # bordo del fotogramma: maschera erosa e molto sfumata
        val = np.asarray(val.filter(ImageFilter.MinFilter(41)).filter(ImageFilter.GaussianBlur(40))).astype(np.float32) / 255
        t = np.asarray(face).astype(np.float32) / 255
        X, Y = np.meshgrid(np.linspace(-1.2, 1.2, 2048), np.linspace(-0.42, 0.42, 716))
        fade = (np.clip((1.18 - np.abs(X)) / 0.3, 0, 1) * np.clip((0.42 - np.abs(Y)) / 0.14, 0, 1)) ** 1.4 * val ** 2
        kind = 'edge'
    t = t * fade[..., None]
    return Image.fromarray((t * 255).astype(np.uint8)), kind


def fix_credits():
    out_json = os.path.join(ROOT, 'public/data/galaxy-photos.json')
    credits = json.load(open(out_json))
    for gid, c in credits.items():
        if c.get('credit'): continue
        info = file_info(c['file'])
        if info: c['credit'] = info['credit']
        print(gid, '→', c['credit'])
    json.dump(credits, open(out_json, 'w'), indent=1, ensure_ascii=False)


def kind_hint(q):
    return q < 0.28


def main():
    if sys.argv[1] == '--credits': return fix_credits()
    gal = json.load(open(sys.argv[1]))
    only = set(sys.argv[2:])
    ds = json.load(open(os.path.join(ROOT, 'public/data/deepsky.json')))
    ngc = {c['id']: c['ngc'].split('&')[0].strip() for c in ds['caldwell']}
    out_json = os.path.join(ROOT, 'public/data/galaxy-photos.json')
    credits = json.load(open(out_json)) if os.path.exists(out_json) else {}
    preview = []
    for g in gal:
        gid = g['id']
        if gid == 'milkyway' or (only and gid not in only): continue
        title = page_title(g, ngc)
        cands = ([OVERRIDE[gid]] if gid in OVERRIDE else []) + candidate_images(title)
        fname, info = None, None
        for f in cands[:8]:
            if SKIP_NAME.search(f) or f in REJECT: continue
            inf = file_info(f)
            if not inf: continue
            lic = inf['license'].lower()
            if inf['nc'] or not lic.startswith(OK_LICENSES) or inf['w'] < 500:
                print('   ', gid, 'scarto', inf['license'] or '?', f); continue
            fname, info = f, inf
            break
        if not fname: print(gid, '— nessuna foto con licenza commerciale libera', title); continue
        im = download(fname, info['w'])
        if im is None: print(gid, '— download fallito', fname); continue
        a = destar(im)
        centre, ang, A, q = measure(a)
        q0 = q
        flagship = gid in FLAGSHIP
        if (q < 0.28 or flagship) and info['w'] > 1400:
            # di taglio: serve più risoluzione sul profilo sottile
            im2 = download(fname, info['w'], big=True)
            if im2 is not None:
                a = destar(im2)
                centre, ang, A, q = measure(a)
        tex, kind = make(a, centre, ang, A, min(q, 0.279) if q0 < 0.28 else max(q, 0.28), 2048 if flagship else 1024)
        for folder, scale in (('2k', 1), ('1k', 0.5)) if kind == 'face' else (('2k', 1), ('1k', 0.5)):
            p = os.path.join(ROOT, 'public/textures', folder, f'gal_{gid}.webp')
            tex.resize((int(tex.size[0] * scale), int(tex.size[1] * scale)), Image.LANCZOS).save(p, quality=84, method=6)
        credits[gid] = {'kind': kind, 'q': round(q, 3), 'file': fname, 'license': info['license'], 'credit': info['credit'],
                        'source': 'https://commons.wikimedia.org/wiki/File:' + fname.replace(' ', '_')}
        preview.append((gid, tex))
        print(gid, kind, f'q={q:.2f}', info['license'], '|', info['credit'][:40], '|', fname)
        json.dump(credits, open(out_json, 'w'), indent=1, ensure_ascii=False)
    # foglio di anteprima per il controllo visivo
    if preview:
        cols = 8
        sheet = Image.new('RGB', (cols * 200, ((len(preview) + cols - 1) // cols) * 200))
        for i, (gid, t) in enumerate(preview):
            sheet.paste(t.resize((200, 200 if t.size[1] == t.size[0] else 70)), ((i % cols) * 200, (i // cols) * 200))
        sheet.save(os.environ.get('PREVIEW', '/tmp/galaxy_sheet.jpg'))


if __name__ == '__main__':
    main()
