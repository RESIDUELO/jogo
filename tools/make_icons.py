"""Gera os ícones do app (PWA e Android) e as telas de abertura (splash) do Android.
Uso: python3 tools/make_icons.py   (requer Pillow)"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLORS = ['#ec4899', '#3b82f6', '#f97316', '#22c55e', '#eab308']
BG_A, BG_B = '#6d28d9', '#12102e'


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def gradient(S):
    a, b = hexc(BG_A), hexc(BG_B)
    g = Image.new('RGBA', (S, S))
    px = g.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            px[x, y] = tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3)) + (255,)
    return g


def wheel(d, S, cx, cy, r):
    d.ellipse([cx - r - S * 0.018, cy - r - S * 0.018, cx + r + S * 0.018, cy + r + S * 0.018], fill=(255, 255, 255, 255))
    for i, c in enumerate(COLORS):
        d.pieslice([cx - r, cy - r, cx + r, cy + r], start=-90 + i * 72, end=-90 + (i + 1) * 72, fill=hexc(c) + (255,))
    for i in range(5):
        a = math.radians(-90 + i * 72)
        d.line([cx, cy, cx + r * math.cos(a), cy + r * math.sin(a)], fill=(255, 255, 255, 255), width=max(1, int(S * 0.014)))
    cr = r * 0.30
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=hexc('#1b1842') + (255,), outline=(255, 255, 255, 255), width=max(1, int(S * 0.018)))
    w, l = cr * 0.34, cr * 0.62
    d.rectangle([cx - w / 2, cy - l, cx + w / 2, cy + l], fill=(255, 255, 255, 255))
    d.rectangle([cx - l, cy - w / 2, cx + l, cy + w / 2], fill=(255, 255, 255, 255))
    pw, top = r * 0.16, cy - r - S * 0.07
    d.polygon([(cx - pw, top), (cx + pw, top), (cx, cy - r + S * 0.05)], fill=(255, 255, 255, 255), outline=hexc('#1b1842'))


def icon(size, shape='rounded', scale=0.74, background=True):
    """shape: rounded | square | circle."""
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if background:
        mask = Image.new('L', (S, S), 0)
        md = ImageDraw.Draw(mask)
        if shape == 'square':
            md.rectangle([0, 0, S, S], fill=255)
        elif shape == 'circle':
            md.ellipse([0, 0, S - 1, S - 1], fill=255)
        else:
            md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        img.paste(gradient(S), (0, 0), mask)
    d = ImageDraw.Draw(img)
    wheel(d, S, S / 2, S / 2 + S * 0.02, S * scale / 2)
    return img.resize((size, size), Image.LANCZOS)


def splash(w, h):
    S = 4
    img = Image.new('RGB', (w * S, h * S), hexc('#0b0a1f'))
    d = ImageDraw.Draw(img)
    side = min(w, h) * S
    wheel(d, side, w * S / 2, h * S / 2, side * 0.22)
    return img.resize((w, h), Image.LANCZOS)


def main():
    icons = os.path.join(ROOT, 'public', 'icons')
    os.makedirs(icons, exist_ok=True)
    icon(192).save(os.path.join(icons, 'icon-192.png'))
    icon(512).save(os.path.join(icons, 'icon-512.png'))
    icon(512, 'square', 0.56).save(os.path.join(icons, 'maskable-512.png'))
    icon(180, 'square').convert('RGB').save(os.path.join(icons, 'apple-touch-icon.png'))
    icon(64).save(os.path.join(icons, 'favicon-64.png'))

    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        return
    dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    for name, f in dens.items():
        folder = os.path.join(res, f'mipmap-{name}')
        os.makedirs(folder, exist_ok=True)
        icon(round(48 * f), 'rounded').save(os.path.join(folder, 'ic_launcher.png'))
        icon(round(48 * f), 'circle').save(os.path.join(folder, 'ic_launcher_round.png'))
        # ícone adaptativo: primeiro plano transparente (fundo vem de ic_launcher_background)
        icon(round(108 * f), scale=0.5, background=False).save(os.path.join(folder, 'ic_launcher_foreground.png'))
    with open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w') as fh:
        fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#3B1A7A</color>\n</resources>\n')
    # telas de abertura: mantém o tamanho de cada splash.png existente
    for dirpath, _, files in os.walk(res):
        if 'splash.png' in files:
            p = os.path.join(dirpath, 'splash.png')
            w, h = Image.open(p).size
            splash(w, h).save(p)


if __name__ == '__main__':
    main()
