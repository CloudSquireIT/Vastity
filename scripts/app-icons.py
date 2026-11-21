# Icona ufficiale di Vastity: Saturno a linea continua su fondo notte, in più stili.
# Disegno originale: pianeta, un solo anello inclinato con lo stacco dove passa dietro il pianeta,
# un riflesso, una piccola luna e scintille a quattro punte.
# Uso: python3 scripts/app-icons.py → brand/icons/<stile>.svg (poi scripts/app-icons-png.cjs per i PNG)
import os
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'brand', 'icons')
os.makedirs(OUT, exist_ok=True)

STYLES = {
  # nome: (sfondo esterno, sfondo centro, tratto (colore o 'grad'), colori del gradiente, scintille)
  'night':   ('#030714', '#13235a', '#f4f7ff', None, '#cfe0ff'),
  'aurora':  ('#05040f', '#1a1240', 'grad', ['#b98cff', '#ff7a8a', '#7fe3d4'], '#ffd6e8'),
  'gold':    ('#04060f', '#17203f', '#f3d39a', None, '#ffe7b8'),
  'minimal': ('#000000', '#000000', '#ffffff', None, '#ffffff'),
}

def star(cx, cy, r, color):
    k = r * 0.22
    return (f'<path d="M{cx} {cy-r} Q{cx+k} {cy-k} {cx+r} {cy} Q{cx+k} {cy+k} {cx} {cy+r} Q{cx-k} {cy+k} {cx-r} {cy} Q{cx-k} {cy-k} {cx} {cy-r}Z" fill="{color}"/>')

def icon(name, bg0, bg1, stroke, grad, spark):
    W = 1024; sw = 30
    defs = f'<radialGradient id="bg" cx="38%" cy="30%" r="85%"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg0}"/></radialGradient>'
    paint = stroke
    if stroke == 'grad':
        stops = ''.join(f'<stop offset="{i/(len(grad)-1):.2f}" stop-color="{c}"/>' for i, c in enumerate(grad))
        defs += f'<linearGradient id="st" x1="0.15" y1="0.15" x2="0.85" y2="0.85">{stops}</linearGradient>'
        paint = 'url(#st)'
    bgc = bg1 if name != 'minimal' else bg0
    # pianeta e anello in un riferimento ruotato di −22°
    rx, ry, R = 372, 108, 186
    ring_back = f'<ellipse cx="0" cy="0" rx="{rx}" ry="{ry}" fill="none" stroke="{paint}" stroke-width="{sw}"/>'
    planet = (f'<circle cx="0" cy="0" r="{R}" fill="url(#bg)" stroke="none"/>'
              f'<circle cx="0" cy="0" r="{R}" fill="none" stroke="{paint}" stroke-width="{sw}"/>')
    # metà anteriore dell'anello sopra il pianeta, con un bordo "vuoto" che crea lo stacco
    front = f'M{-rx} 0 A{rx} {ry} 0 0 0 {rx} 0'
    ring_front = (f'<path d="{front}" fill="none" stroke="url(#bg)" stroke-width="{sw + 34}" stroke-linecap="round" clip-path="url(#inP)"/>'
                  f'<path d="{front}" fill="none" stroke="{paint}" stroke-width="{sw}" stroke-linecap="round"/>')
    defs += f'<clipPath id="inP"><circle cx="0" cy="0" r="{R + 20}"/></clipPath>'
    highlight = f'<path d="M{-R*0.62:.0f} {-R*0.52:.0f} A{R*0.8:.0f} {R*0.8:.0f} 0 0 1 {-R*0.05:.0f} {-R*0.8:.0f}" fill="none" stroke="{paint}" stroke-width="{sw*0.8:.0f}" stroke-linecap="round" opacity=".9"/>'
    moon = f'<circle cx="{rx*0.78:.0f}" cy="{-ry*1.9:.0f}" r="22" fill="{paint}"/>'
    sat = f'<g transform="translate(512 528) rotate(-22)">{ring_back}{planet}{ring_front}{highlight}{moon}</g>'
    sparks = star(232, 250, 34, spark) + star(810, 214, 26, spark) + star(842, 742, 30, spark) + star(214, 790, 22, spark)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}"><defs>{defs}</defs>'
           f'<rect width="{W}" height="{W}" fill="url(#bg)"/>{sparks}{sat}</svg>')
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(svg)
    # livelli separati per l'icona adattiva di Android: fondo e disegno (trasparente)
    open(os.path.join(OUT, f'{name}-bg.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}"><defs>{defs}</defs><rect width="{W}" height="{W}" fill="url(#bg)"/></svg>')
    open(os.path.join(OUT, f'{name}-fg.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}"><defs>{defs}</defs>{sparks}{sat}</svg>')

for n, s in STYLES.items(): icon(n, *s)
print('ok', list(STYLES))
