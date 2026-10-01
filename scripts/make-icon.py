#!/usr/bin/env python3
"""生成「迦哥闯天下」图标：扁平绿底 + 白色「迦」字（冬青黑体 W6）+ 右上角白底绿字 K 徽章。
参考风格：纯色圆角块 + 居中大字 + 右上角小徽章（如蓝底迦字+D）。
导出：PWA icon-512/192、apple-touch-icon(180)、Electron icon.png(512)、build/icon-src.png(1024)。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024                      # 主画布
GREEN = (88, 204, 2, 255)     # 多邻国绿
GREEN_DARK = (70, 163, 2, 255)
WHITE = (255, 255, 255, 255)

def make_master():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # 扁平绿色圆角方块
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(base).rounded_rectangle([0, 0, S - 1, S - 1], 230, fill=GREEN)
    img.alpha_composite(base)

    # 白色「迦」字：冬青黑体 W6，留出四周呼吸空间
    font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 500, index=2)
    bbox = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), '迦', font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (S - tw) / 2 - bbox[0]
    ty = (S - th) / 2 - bbox[1] + 30   # 略下移，让字视觉上居中（顶部留给徽章一点空间）
    # 极轻的字影，增加层次
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((tx, ty + 10), '迦', font=font, fill=(0, 70, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(shadow)
    tl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(tl).text((tx, ty), '迦', font=font, fill=WHITE)
    img.alpha_composite(tl)

    # K 徽章：白底绿字，贴在迦字右上角（字框的右上角外侧一点点）
    gx0, gy0 = tx + bbox[0], ty + bbox[1]          # 字实际墨水左上角
    cx, cy = gx0 + tw + 75, gy0 - 45
    r = 118
    badge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(badge)
    bdraw.ellipse([cx - r + 8, cy - r + 12, cx + r + 8, cy + r + 12], fill=(0, 60, 0, 90))
    badge = badge.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(badge)
    bdraw = ImageDraw.Draw(img)
    bdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=(255, 224, 130, 255), width=6)
    kfont = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 168)
    kb = bdraw.textbbox((0, 0), 'K', font=kfont)
    bdraw.text((cx - (kb[2] - kb[0]) / 2 - kb[0], cy - (kb[3] - kb[1]) / 2 - kb[1] - 4),
               'K', font=kfont, fill=(212, 142, 0, 255))
    return img

def export(img, size, path, opaque=False):
    out = img.resize((size, size), Image.LANCZOS)
    if opaque:  # apple-touch-icon 不要透明
        bg = Image.new('RGBA', (size, size), GREEN)
        bg.alpha_composite(out)
        out = bg
    out.save(path)
    print('saved', path)

if __name__ == '__main__':
    master = make_master()
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    export(master, 1024, os.path.join(ROOT, 'build', 'icon-src.png'))
    export(master, 512, os.path.join(ROOT, 'build', 'icon.png'))
    # 全新文件名：逼 iPad 重新下载并重新处理图标
    export(master, 512, os.path.join(ROOT, 'public', 'icon-512-v12.png'))
    export(master, 192, os.path.join(ROOT, 'public', 'icon-192-v12.png'))
    export(master, 180, os.path.join(ROOT, 'public', 'apple-touch-icon-v12.png'), opaque=True)
    export(master, 180, os.path.join(ROOT, 'public', 'apple-touch-icon.png'), opaque=True)
    export(master, 180, os.path.join(ROOT, 'public', 'apple-touch-icon-precomposed.png'), opaque=True)
