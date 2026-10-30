#!/usr/bin/env python3
"""
Produce & package promotional videos for 『 律 』(LÜ) Interactive Band Mode (excluding 荔 & 弈).
Outputs:
1. output/lu_band_promo_9x16.mp4          (1080x1920, 30fps, 45s vertical master)
2. output/lu_band_promo_cover_9x16.jpg    (1080x1920 vertical cover)
3. output/lu_band_promo_16x9.mp4          (1920x1080, 30fps, 45s widescreen master)
4. output/lu_band_promo_cover_16x9.jpg    (1920x1080 widescreen cover)
Preserves all existing assets in output/edit/codex-20261016-lu-band-promo/.
"""

from pathlib import Path
import json
import math
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PROMO_DIR = ROOT / 'output/edit/codex-20261016-lu-band-promo'
OUT_DIR = ROOT / 'output'
WORK_DIR = Path('/tmp/lu_band_promo_16x9_work')
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'

W, H, FPS = 1920, 1080, 30
STAGE_W, STAGE_H = 567, 1008  # 9:16 stage viewport embedded at right (x=1240, y=36)
STAGE_X, STAGE_Y = 1240, 36

WHITE = (247, 241, 226, 255)
MUTE = (188, 196, 199, 255)
CYAN = (155, 238, 236, 255)
GOLD = (251, 191, 36, 255)
DARK = (8, 15, 20, 255)

FONT_CN = '/System/Library/Fonts/Hiragino Sans GB.ttc'
FONT_EN = '/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf'


def font(size, latin=False):
    return ImageFont.truetype(FONT_EN if latin else FONT_CN, size, index=0)


def txt(draw, xy, text, size, color=WHITE, latin=False, spacing=None):
    f = font(size, latin)
    if spacing is None:
        draw.text(xy, text, font=f, fill=color)
    else:
        x, y = xy
        for c in text:
            draw.text((x, y), c, font=f, fill=color)
            x += draw.textlength(c, font=f) + spacing


def run(args):
    res = subprocess.run([str(x) for x in args], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr[-4000:])
    return res.stdout


SHOTS = [
    {
        'id': '01-hero',
        'duration': 6,
        'label': '01 / YOUR FAVORITE CAST',
        'title': ['把喜欢的角色，', '组成一支乐队。'],
        'sub': '29 位角色 · 3 大动漫主题 · 16 首全曲原曲优先混音',
        'bullets': ['海贼王 10 人全员登台，各自执掌专属乐器', '原曲高保真垫底 + 角色独立声部实时合奏'],
        'theme': '海贼王 / ONE PIECE',
        'wing_img': ROOT / 'output/playwright/band-front-wings/one-piece-1440.png',
    },
    {
        'id': '02-dragon',
        'duration': 5,
        'label': '02 / A NEW UNIVERSE',
        'title': ['下一站，', '龙珠现场。'],
        'sub': '一键切换主题编制，舞台布景与配器同步流变',
        'bullets': ['悟空领衔主唱，贝吉塔与布尔玛前排共振', '五种舞台队形（阶梯 / 弧形 / 展翼 / 环绕 / 独奏）自由切换'],
        'theme': '龙珠 / DRAGON BALL',
        'wing_img': ROOT / 'output/playwright/band-front-wings/dragon-ball-1440.png',
    },
    {
        'id': '03-naruto',
        'duration': 5,
        'label': '03 / ANOTHER ENSEMBLE',
        'title': ['再换一队，', '火影开演。'],
        'sub': '熟悉的木叶伙伴，带着专属乐器与追光登场',
        'bullets': ['鸣人、佐助、小樱等 9 位角色独立动作与眼神跟随', '同一首歌曲连续流转，切镜不断歌'],
        'theme': '火影忍者 / NARUTO',
        'wing_img': ROOT / 'output/playwright/band-front-wings/naruto-1440.png',
    },
    {
        'id': '04-tap',
        'duration': 7,
        'label': '04 / YOU ARE THE CONDUCTOR',
        'title': ['点按进退，', '声音也跟着变。'],
        'sub': '点按主唱：对应人声立即减弱；再点一下，回到合奏',
        'bullets': ['基于 Web Audio 分离轨差分控制，保留自然底轨余韵', '合拍响应与四小节自动接回，你就是现场指挥'],
        'theme': '点按交互 / TAP TO MUTE & RESTORE',
        'touch': 'tap',
        'wing_img': ROOT / 'output/playwright/band-front-wings/one-piece-1440.png',
    },
    {
        'id': '05-solo',
        'duration': 6,
        'label': '05 / GIVE THEM THE SPOTLIGHT',
        'title': ['按住吉他，', '把主场交给他。'],
        'sub': '长按乌索普触发吉他独奏，原曲轻声伴奏，松手恢复合奏',
        'bullets': ['角色独立音频总线实时抬升，舞台追光同步聚焦', '真实声画联动，非后期假动作配音'],
        'theme': '长按独奏 / HOLD TO SOLO',
        'touch': 'solo',
        'wing_img': ROOT / 'output/playwright/band-front-wings/one-piece-1440.png',
    },
    {
        'id': '06-climax',
        'duration': 9,
        'label': '06 / FEEL THE CLIMAX',
        'title': ['当音乐抵达高潮，', '舞台随之绽放。'],
        'sub': '前排三人纯粒子能量翼 · 360° 舞台喷泉焰火 · 高空礼花',
        'bullets': ['主唱与前排两位搭档肩部展开高密纯粒子羽翼', '智能角色遮挡保护面部细节，合成焰火音效同步迸发'],
        'theme': '高潮绽放 / WINGS & PYRO CLIMAX',
        'wing_img': ROOT / 'output/playwright/band-front-wings/one-piece-1440.png',
    },
    {
        'id': '07-outro',
        'duration': 7,
        'label': 'LÜ / THE STAGE IS YOURS',
        'title': ['现在，', '轮到你指挥。'],
        'sub': '纯前端 WebGL 即开即玩 · 扫码或访问网页开启你的乐队合奏',
        'bullets': ['在线体验：aierlanjiu.github.io/threejs-material-lab', '支持 60FPS 母带级横竖屏音视频直出导出'],
        'theme': '即刻体验 / PLAY NOW',
        'outro': True,
        'wing_img': ROOT / 'output/playwright/band-front-wings/naruto-1440.png',
    },
]


def rounded_mask(size, radius):
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def make_16x9_overlay(shot, qr_img):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Smooth left-to-right obsidian gradient veil so left editorial panel is super legible
    for x in range(W):
        if x < 1050:
            alpha = int(238 - (x / 1050) * 45)
        elif x < 1240:
            t = (x - 1050) / 190
            alpha = int(193 * (1 - t) + 75 * t)
        else:
            alpha = 65
        d.line((x, 0, x, H), fill=(7, 13, 19, alpha))

    # Top brand header
    txt(d, (88, 64), '律', 58, WHITE)
    txt(d, (166, 82), 'LÜ', 34, WHITE, latin=True)
    d.line((232, 86, 232, 116), fill=(*CYAN[:3], 160), width=2)
    txt(d, (254, 84), '互动乐队模式 · INTERACTIVE ENSEMBLE', 23, CYAN)

    # Theme pill badge
    pill_box = (88, 154, 540, 198)
    d.rounded_rectangle(pill_box, radius=22, fill=(18, 32, 44, 210), outline=(*CYAN[:3], 120), width=2)
    d.ellipse((108, 170, 120, 182), fill=CYAN)
    txt(d, (134, 162), shot['theme'], 21, WHITE)

    # Shot label & main title
    txt(d, (88, 238), shot['label'], 22, CYAN, latin=True, spacing=1.4)
    for i, line in enumerate(shot['title']):
        txt(d, (84, 282 + i * 96), line, 74, WHITE)

    # Subtitle
    txt(d, (88, 492), shot['sub'], 27, (225, 233, 238, 255))

    # Bullet points
    for idx, b in enumerate(shot.get('bullets', [])):
        by = 556 + idx * 44
        d.ellipse((92, by + 11, 102, by + 21), fill=GOLD)
        txt(d, (118, by), b, 22, MUTE)

    # Bottom showcase card: either Front-Three Particle Wings widescreen card OR QR card on outro
    if shot.get('outro'):
        card_box = (88, 676, 1080, 948)
        d.rounded_rectangle(card_box, radius=24, fill=(14, 25, 36, 230), outline=(*CYAN[:3], 150), width=2)
        q = qr_img.resize((216, 216), Image.Resampling.NEAREST).convert('RGBA')
        im.alpha_composite(q, (118, 704))
        txt(d, (368, 716), '手机扫码 · 即刻登台指挥', 34, WHITE)
        txt(d, (368, 772), '体验地址：https://aierlanjiu.github.io/threejs-material-lab/', 22, CYAN)
        txt(d, (368, 816), '点按角色控制声部进退 · 长按角色开启独奏 · 拖动自由换位', 21, MUTE)
        txt(d, (368, 856), '16 首全曲原曲优先混音 · 三大动漫主题 29 位角色全员集结', 21, GOLD)
    else:
        # Show widescreen 1440x900 stage preview card (highlighting the front-three particle wings!)
        wing_path = shot.get('wing_img')
        if wing_path and Path(wing_path).exists():
            card_w, card_h = 460, 260
            cx, cy = 88, 678
            raw_w = Image.open(wing_path).convert('RGBA')
            # Crop central stage region (around characters and particle wings)
            rw, rh = raw_w.size
            crop_box = (int(rw * 0.12), int(rh * 0.14), int(rw * 0.88), int(rh * 0.86))
            cropped = raw_w.crop(crop_box).resize((card_w, card_h), Image.Resampling.LANCZOS)
            mask = rounded_mask((card_w, card_h), 20)
            card_im = Image.new('RGBA', (card_w, card_h), (0, 0, 0, 0))
            card_im.paste(cropped, (0, 0), mask)
            im.alpha_composite(card_im, (cx, cy))
            d.rounded_rectangle((cx, cy, cx + card_w, cy + card_h), radius=20, outline=(*CYAN[:3], 160), width=2)
            # Caption beside the widescreen card
            txt(d, (578, 706), 'STAGE HIGHLIGHT · 舞台实景焦点', 20, CYAN, latin=True, spacing=1.0)
            txt(d, (578, 744), '前排三人纯粒子能量翼', 32, WHITE)
            txt(d, (578, 796), '主唱与两位前排搭档肩部展开高密粒子羽翼', 22, MUTE)
            txt(d, (578, 832), '随副歌高潮与 360° 舞台喷泉焰火同步绽放', 22, MUTE)
            txt(d, (578, 874), '右側视窗：9:16 竖屏实机录制实时同步画面 →', 20, GOLD)

    # Bottom footer line
    d.line((88, 992, 1160, 992), fill=(255, 255, 255, 45), width=2)
    txt(d, (88, 1012), 'LÜ / 3D PHYSICAL MATERIAL & SONIC RESONANCE WORKBENCH', 19, MUTE, latin=True, spacing=1.1)
    txt(d, (960, 1012), '60FPS NATIVE EXPORT', 19, CYAN, latin=True, spacing=1.0)

    # Right stage frame border around (STAGE_X, STAGE_Y, STAGE_W, STAGE_H)
    d.rounded_rectangle(
        (STAGE_X - 4, STAGE_Y - 4, STAGE_X + STAGE_W + 4, STAGE_Y + STAGE_H + 4),
        radius=28,
        outline=(*CYAN[:3], 185),
        width=3,
    )

    out_path = WORK_DIR / f"{shot['id']}-overlay-16x9.png"
    im.save(out_path)
    return out_path


def render_16x9_shot(shot, qr_img):
    source = PROMO_DIR / f"sources-v2/{shot['id']}.mp4"
    meta = json.loads(source.with_suffix('.json').read_text())
    dur = shot['duration']
    out = WORK_DIR / f"{shot['id']}-16x9.mp4"

    overlay_png = make_16x9_overlay(shot, qr_img)
    rec = next(e for e in meta['events'] if e['type'] == 'recorder-start')
    play = next(e for e in meta['events'] if e['type'] == 'playback-start')
    start = max(0.0, (play['wall'] - rec['wall']) / 1000.0 + meta['start'] - meta['begin'])

    args = [
        FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
        '-i', source,
        '-loop', '1', '-framerate', str(FPS), '-i', overlay_png,
    ]

    # Build filter graph:
    # 1. Extract trimmed 1080x1920 source stream
    # 2. Split into blurred 1920x1080 background and scaled 567x1008 foreground stage
    graph = [
        f"[0:v]trim=start={start:.4f},setpts=PTS-STARTPTS,fps={FPS},tpad=stop_mode=clone:stop_duration=0.3,trim=duration={dur},setsar=1,split=2[src_bg][src_fg]",
        f"[src_bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=40:4[bg]",
        f"[src_fg]scale={STAGE_W}:{STAGE_H}:flags=lanczos[fg]",
        f"[bg][1:v]overlay=0:0:shortest=1[bg_ui]",
        f"[bg_ui][fg]overlay={STAGE_X}:{STAGE_Y}:shortest=1[staged]",
    ]
    last = 'staged'

    # If touch indicator exists in PROMO_DIR/graphics, scale and overlay on top of the right stage
    if shot.get('touch'):
        touch_mov = PROMO_DIR / f"graphics/{shot['id']}-touch.mov"
        if touch_mov.exists():
            role = 'one-piece/luffy' if shot['touch'] == 'tap' else 'one-piece/usopp'
            event_type = 'voice-muted' if shot['touch'] == 'tap' else 'guitar-solo'
            event = next(e for e in meta['events'] if e['type'] == event_type)
            bounds = next(m['bounds'] for m in event['band']['members'] if m['id'] == role)
            cx_norm = (1.0 + (bounds['left'] + bounds['right']) / 2.0) / 2.0
            cy_norm = (1.0 - (bounds['top'] + bounds['bottom']) / 2.0) / 2.0
            touch_side = round(244 * (STAGE_W / 1080.0))
            tx = STAGE_X + round(cx_norm * STAGE_W - touch_side / 2.0)
            ty = STAGE_Y + round(cy_norm * STAGE_H - touch_side / 2.0)
            args += ['-i', touch_mov]
            graph += [
                f"[2:v]setpts=PTS-STARTPTS,scale={touch_side}:{touch_side}[touch]",
                f"[{last}][touch]overlay={tx}:{ty}:shortest=1[with_touch]",
            ]
            last = 'with_touch'

    graph += [f"[{last}]format=yuv420p[out]"]

    args += [
        '-filter_complex', ';'.join(graph),
        '-map', '[out]', '-an', '-t', str(dur),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
        '-video_track_timescale', '15360', '-movflags', '+faststart',
        out,
    ]
    print(f"[*] Rendering 16:9 shot: {shot['id']} ({dur}s)...", flush=True)
    run(args)
    return out


def make_16x9_cover(qr_img):
    wing_path = ROOT / 'output/playwright/band-front-wings/one-piece-1440.png'
    raw = Image.open(wing_path).convert('RGBA').resize((W, H), Image.Resampling.LANCZOS)
    veil = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(veil)
    for x in range(W):
        a = int(235 * max(0.0, 1.0 - (x / 1180.0) ** 1.3))
        if x >= 1180:
            a = int(60 * ((x - 1180) / (W - 1180)))
        d.line((x, 0, x, H), fill=(7, 14, 21, a))
    im = Image.alpha_composite(raw, veil)
    d = ImageDraw.Draw(im)
    txt(d, (88, 76), '律', 72, WHITE)
    txt(d, (186, 94), 'LÜ', 52, WHITE, latin=True)
    txt(d, (88, 178), 'INTERACTIVE BAND · 3D 互动乐队模式', 26, CYAN)
    txt(d, (84, 310), '喜欢的角色，', 88, WHITE)
    txt(d, (84, 422), '都来开演。', 88, WHITE)
    txt(d, (88, 558), '29 位角色 · 3 大动漫主题 · 16 首全曲原曲优先混音', 30, MUTE)
    txt(d, (88, 610), '点按控制声部进退 · 长按吉他独奏 · 前排三人粒子翼与焰火', 26, GOLD)
    q = qr_img.resize((168, 168), Image.Resampling.NEAREST).convert('RGBA')
    im.alpha_composite(q, (88, 720))
    txt(d, (282, 756), '扫码即刻登台指挥', 30, WHITE)
    txt(d, (282, 804), 'aierlanjiu.github.io/threejs-material-lab', 22, CYAN, latin=True)
    d.line((88, 960, 1832, 960), fill=(*CYAN[:3], 140), width=2)
    txt(d, (88, 985), 'XUEMU LAB / LÜ · BAND MODE SHOWCASE', 22, MUTE, latin=True, spacing=1.5)
    cover_out = OUT_DIR / 'lu_band_promo_cover_16x9.jpg'
    im.convert('RGB').save(cover_out, quality=95)
    return cover_out


def main():
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Sync 9:16 vertical deliverables to top-level output/ (without altering existing files in PROMO_DIR)
    src_9x16 = PROMO_DIR / 'lu-band-promo-45s-9x16-final.mp4'
    dst_9x16 = OUT_DIR / 'lu_band_promo_9x16.mp4'
    shutil.copy2(src_9x16, dst_9x16)

    src_cover_9x16 = PROMO_DIR / 'lu-band-promo-cover.jpg'
    dst_cover_9x16 = OUT_DIR / 'lu_band_promo_cover_9x16.jpg'
    shutil.copy2(src_cover_9x16, dst_cover_9x16)
    print(f"[+] Synced 9:16 master -> {dst_9x16}")

    # 2. Load QR code
    qr_img = Image.open(PROMO_DIR / 'graphics/experience-qr.png').convert('RGB')

    # 3. Render 16:9 widescreen shots
    clip_paths = [render_16x9_shot(s, qr_img) for s in SHOTS]
    concat_file = WORK_DIR / 'concat.txt'
    concat_file.write_text(''.join(f"file '{p.as_posix()}'\n" for p in clip_paths))

    pic_master = WORK_DIR / 'picture-master-16x9.mp4'
    run([FFMPEG, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concat_file, '-c', 'copy', '-movflags', '+faststart', pic_master])

    # 4. Mux with continuous live performance audio master (08-audio-master.mp4)
    master_meta = json.loads((PROMO_DIR / 'sources-v2/08-audio-master.json').read_text())
    rec = next(e for e in master_meta['events'] if e['type'] == 'recorder-start')
    play = next(e for e in master_meta['events'] if e['type'] == 'playback-start')
    audio_start = max(0.0, (play['wall'] - rec['wall']) / 1000.0 + master_meta['start'] - master_meta['begin'])

    final_16x9 = OUT_DIR / 'lu_band_promo_16x9.mp4'
    af = f"atrim=start={audio_start:.4f}:duration=45,asetpts=PTS-STARTPTS,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.03,afade=t=out:st=43.6:d=1.4"
    run([
        FFMPEG, '-v', 'error', '-y',
        '-i', pic_master,
        '-i', PROMO_DIR / 'sources-v2/08-audio-master.mp4',
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy',
        '-af', af,
        '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
        '-t', '45', '-movflags', '+faststart',
        final_16x9,
    ])
    print(f"[+] Created 16:9 widescreen master -> {final_16x9}")

    # 5. Create 16:9 cover
    cover_16x9 = make_16x9_cover(qr_img)
    print(f"[+] Created 16:9 cover -> {cover_16x9}")


if __name__ == '__main__':
    main()
