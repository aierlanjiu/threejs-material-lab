#!/usr/bin/env python3
"""
Produce 9:16 vertical promotional video for 『 律 』LÜ 3D Kinetic Lyrics Lab.
Showcases 5 One Piece 9:16 poster wallpapers, physical anti-gravity lyrics engine,
controlled drop & magnetic liftoff, 446-cube avatar mountain, and aligned mobile deck UI.
BGM: 《海鸥》- 逃跑计划.
"""

import time
import os
import subprocess
import glob
import shutil
from playwright.sync_api import sync_playwright

PORT = 8000
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_RAW_DIR = '/tmp/haiou_promo_raw'
FINAL_OUTPUT_MP4 = os.path.join(ROOT_DIR, 'output', 'kinetic_lyrics_haiou_9x16.mp4')
ARTIFACT_DIR = '/Users/papazed/.gemini/antigravity/brain/cf4bc01d-7392-4249-95e1-9e0dd62022d2'
BGM_PATH = os.path.join(ROOT_DIR, 'audio', 'haiou.mp3')

CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = None

def main():
    print(f"[*] Starting 9:16 promotional video production for 『 律 』with BGM 《海鸥》...")
    os.makedirs(os.path.join(ROOT_DIR, 'output'), exist_ok=True)
    os.makedirs(OUTPUT_RAW_DIR, exist_ok=True)
    for f in glob.glob(f"{OUTPUT_RAW_DIR}/*"):
        try: os.remove(f)
        except: pass

    with sync_playwright() as p:
        launch_args = {
            'headless': True,
            'args': [
                '--enable-webgl',
                '--use-gl=angle',
                '--use-angle=metal',
                '--hide-scrollbars',
                '--disable-notifications'
            ]
        }
        if CHROME_PATH:
            launch_args['executable_path'] = CHROME_PATH

        browser = p.chromium.launch(**launch_args)
        context = browser.new_context(
            record_video_dir=OUTPUT_RAW_DIR,
            record_video_size={'width': 720, 'height': 1280},
            viewport={'width': 720, 'height': 1280}
        )
        page = context.new_page()
        page_open_wall_time = time.time()

        print(f"[*] Navigating to http://127.0.0.1:{PORT}/index.html...")
        page.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='domcontentloaded', timeout=20000)
        page.wait_for_timeout(2000)
        page.evaluate("() => document.fonts.ready")

        print("[*] Collapsing inspector and initializing 3D Gravity Engine...")
        page.evaluate("""
            () => {
                // Ensure inspector is strictly collapsed for clean stage
                const inspector = document.querySelector('.modular-inspector');
                if (inspector) inspector.classList.add('collapsed');
                const handle = document.getElementById('workbenchHandle');
                if (handle) handle.classList.remove('active');
                document.body.classList.remove('workbench-open');

                window.setWallpaper('images/wallpapers/op_luffy_kaido.jpg');
                window.kineticLyricsManager.setMode('gravity');
                const sel = document.getElementById('playlistSelect');
                if (sel) {
                    sel.value = 'track_5';
                    sel.dispatchEvent(new Event('change'));
                }
                const nowPlaying = document.getElementById('nowPlayingText');
                if (nowPlaying) nowPlaying.textContent = '当前：《海鸥》- 逃跑计划';
            }
        """)
        page.wait_for_timeout(1000)

        # Inject sleek modern floating promotional banner
        page.add_style_tag(content='''
            #promo-banner {
                position: fixed;
                bottom: 22px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                background: rgba(15, 23, 42, 0.78);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1.5px solid rgba(255, 255, 255, 0.22);
                border-radius: 20px;
                padding: 10px 24px;
                box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
                pointer-events: none;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                max-width: 90vw;
                text-align: center;
            }
            #promo-badge-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .promo-tag-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #38bdf8;
                box-shadow: 0 0 10px #38bdf8;
                animation: promo-pulse 1.4s infinite;
            }
            @keyframes promo-pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.6; }
            }
            #promo-title {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 15px;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: 0.8px;
            }
            #promo-desc {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11.5px;
                font-weight: 400;
                color: rgba(226, 232, 240, 0.88);
                letter-spacing: 0.5px;
            }
        ''')

        page.evaluate("""
            () => {
                const banner = document.createElement('div');
                banner.id = 'promo-banner';
                banner.innerHTML = `
                    <div id="promo-badge-row">
                        <span class="promo-tag-dot"></span>
                        <span id="promo-title">『 律 』3D 物理反重力歌词矩阵</span>
                    </div>
                    <div id="promo-desc">海鸥 - 逃跑计划 · 9:16 移动端旗舰视觉</div>
                `;
                document.body.appendChild(banner);
                
                // Helper to update banner
                window.updatePromoBanner = (title, desc, color='#38bdf8') => {
                    const t = document.getElementById('promo-title');
                    const d = document.getElementById('promo-desc');
                    const dot = document.querySelector('.promo-tag-dot');
                    if (t) t.textContent = title;
                    if (d) d.textContent = desc;
                    if (dot && color) {
                        dot.style.background = color;
                        dot.style.boxShadow = `0 0 10px ${color}`;
                    }
                };

                // Continuous ticker for rich physical dynamics
                window.__tickerActive = true;
                window.__currentLyric = { active: '但愿那海风再起', prev: '也明白有些遗憾会永远留在心里', next: '海鸥落在那礁石' };
                let tickCount = 0;
                function runPromoTick() {
                    if (!window.__tickerActive) return;
                    tickCount++;
                    const beat = tickCount % 30 < 4;
                    const bassEnergy = beat ? 0.95 : 0.45;
                    window.kineticLyricsManager.update({
                        activeText: window.__currentLyric.active,
                        prevText: window.__currentLyric.prev,
                        nextText: window.__currentLyric.next,
                        beatPeriod: 0.5,
                        progressInLine: 0.5 + Math.sin(tickCount * 0.05) * 0.4,
                        bassEnergy: bassEnergy,
                        isKick: beat,
                        dt: 0.016
                    });
                    requestAnimationFrame(runPromoTick);
                }
                requestAnimationFrame(runPromoTick);
            }
        """)

        def set_stage(wallpaper, title, desc, active_lyric, prev_lyric, next_lyric, dot_color='#38bdf8'):
            page.evaluate("""
                ({ wallpaper, title, desc, active_lyric, prev_lyric, next_lyric, dot_color }) => {
                    window.setWallpaper(wallpaper);
                    window.updatePromoBanner(title, desc, dot_color);
                    window.__currentLyric = { active: active_lyric, prev: prev_lyric, next: next_lyric };
                    // Trigger dynamic phrase transition
                    window.kineticLyricsManager.gravityEngine.handlePhraseTransition(active_lyric, 0.5);
                }
            """, {
                'wallpaper': wallpaper,
                'title': title,
                'desc': desc,
                'active_lyric': active_lyric,
                'prev_lyric': prev_lyric,
                'next_lyric': next_lyric,
                'dot_color': dot_color
            })

        print("[*] Stage 1: Luffy vs Kaido · 但愿那海风再起")
        t_start = time.time()
        start_offset = t_start - page_open_wall_time
        set_stage(
            'images/wallpapers/op_luffy_kaido.jpg',
            '01 · 物理反重力歌词引擎',
            'Hi-Res 无损母带驱动 · 动态声学微幅重塑与浪涌',
            '但愿那海风再起',
            '也明白有些遗憾会永远留在心里',
            '海鸥落在那礁石',
            '#ef4444'
        )
        time.sleep(4.8)

        print("[*] Stage 2: Zoro vs Mihawk · 海鸥落在那礁石")
        set_stage(
            'images/wallpapers/op_zoro_mihawk.jpg',
            '02 · 强磁吸附升空 & 物理坠落融入',
            '旧词有控制翻滚下坠融入山体 · 新词自母体拔地升空突变汉字',
            '海鸥落在那礁石',
            '但愿那海风再起',
            '我终于对着大海放声喊出你的名字',
            '#10b981'
        )
        time.sleep(4.8)

        print("[*] Stage 3: Shanks vs Blackbeard · 我终于对着大海放声喊出你的名字")
        set_stage(
            'images/wallpapers/op_shanks_blackbeard.jpg',
            '03 · 446 枚动漫表情方块涌动山体',
            '9 层致密架构贴合屏幕底边 · 18% 高弹活跃魔方随节拍飞跃',
            '我终于对着大海放声喊出你的名字',
            '海鸥落在那礁石',
            '熟悉的城市',
            '#a855f7'
        )
        time.sleep(6.2)

        print("[*] Stage 4: Law vs Doflamingo · 归来的渔民叫卖着刚刚经历的风雨")
        set_stage(
            'images/wallpapers/op_law_doflamingo.jpg',
            '04 · 移动端居中美学 & 磨砂玻璃HUD',
            '播放核心按钮数学绝对居中 · 仓耳今楷定制字形高透水晶材质',
            '归来的渔民叫卖着刚刚经历的风雨',
            '今晨已褪去',
            '教堂里举行着婚礼',
            '#f59e0b'
        )
        time.sleep(5.0)

        print("[*] Stage 5: Luffy vs Crocodile · 昨夜的潮汐 & 开源上线")
        set_stage(
            'images/wallpapers/op_luffy_crocodile.jpg',
            '05 · 纯前端 WebGL · GitHub Pages 开源',
            '手机/桌面全端自适应 · 网页即开即玩即听',
            '昨夜的潮汐',
            '《海鸥》- 逃跑计划',
            '今晨已褪去',
            '#38bdf8'
        )
        time.sleep(5.4)

        t_end = time.time()
        video_duration = t_end - t_start
        print(f"[+] Recording finished! Captured duration: {video_duration:.2f}s")

        page.evaluate("() => { window.__tickerActive = false; }")
        page.close()
        context.close()
        browser.close()

    webm_files = glob.glob(f"{OUTPUT_RAW_DIR}/*.webm")
    if not webm_files:
        raise RuntimeError("No recorded webm video found in output directory!")
    raw_webm = webm_files[0]
    print(f"[+] Found raw recorded video: {raw_webm}")

    # BGM alignment: chorus "但愿那海风再起" is at 110.0s (00:01:50.0)
    bgm_start_sec = "00:01:49.8"
    fade_out_start = max(1.0, video_duration - 1.5)

    print(f"[*] Muxing with FFmpeg:")
    print(f"    Video: {raw_webm}")
    print(f"    Audio: {BGM_PATH} (starting at {bgm_start_sec})")
    print(f"    Target: {FINAL_OUTPUT_MP4}")

    mux_cmd = [
        '/opt/homebrew/bin/ffmpeg', '-y',
        '-ss', f"{start_offset:.2f}",
        '-t', f"{video_duration:.2f}",
        '-i', raw_webm,
        '-ss', bgm_start_sec,
        '-t', f"{video_duration:.2f}",
        '-i', BGM_PATH,
        '-filter_complex',
        f"[0:v]fps=30,scale=720:1280:flags=lanczos,format=yuv420p[v];"
        f"[1:a]afade=t=in:ss=0:d=0.6,afade=t=out:st={fade_out_start:.2f}:d=1.5,volume=1.05[a]",
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '19',
        '-c:a', 'aac',
        '-b:a', '256k',
        '-movflags', '+faststart',
        FINAL_OUTPUT_MP4
    ]

    res = subprocess.run(mux_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("[!] FFmpeg muxing error:", res.stderr)
        raise RuntimeError("FFmpeg muxing failed!")

    print(f"🎉 Promotional video successfully created at: {FINAL_OUTPUT_MP4}")

    # Copy to artifact directory
    artifact_mp4 = os.path.join(ARTIFACT_DIR, 'kinetic_lyrics_haiou_9x16.mp4')
    shutil.copyfile(FINAL_OUTPUT_MP4, artifact_mp4)
    print(f"🎉 Copied promo video to artifact: {artifact_mp4}")

    # Probe final output
    subprocess.run(['/opt/homebrew/bin/ffprobe', FINAL_OUTPUT_MP4])

if __name__ == '__main__':
    main()
