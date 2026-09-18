#!/usr/bin/env python3
"""
Produce 9:16 vertical promotional video for 『 荔 』LI 3D Mascot Studio.
Records high-fidelity Three.js WebGL rendering, choreographs 8 key interaction stages,
and muxes with synchronized BGM and audio fades into an optimized mobile MP4.
"""

import http.server
import socketserver
import threading
import time
import os
import subprocess
import glob
import re
from playwright.sync_api import sync_playwright

PORT = 8199
CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_RAW_DIR = '/tmp/li_promo_raw_v3'
FINAL_OUTPUT_MP4 = os.path.join(ROOT_DIR, 'output', 'li_promo_9x16.mp4')
BGM_PATH = os.path.join(ROOT_DIR, 'audio', 'youjing.mp3')

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

def main():
    print(f"[*] Starting local HTTP server on port {PORT} (root: {ROOT_DIR})...")
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), QuietHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.5)

    os.makedirs(OUTPUT_RAW_DIR, exist_ok=True)
    for f in glob.glob(f"{OUTPUT_RAW_DIR}/*"):
        try: os.remove(f)
        except: pass

    print("[*] Launching Chromium (Metal WebGL enabled) for 9:16 vertical capture (720x1280)...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                '--enable-webgl',
                '--use-gl=angle',
                '--use-angle=metal',
                '--hide-scrollbars',
                '--disable-notifications'
            ]
        )
        context = browser.new_context(
            record_video_dir=OUTPUT_RAW_DIR,
            record_video_size={'width': 720, 'height': 1280},
            viewport={'width': 720, 'height': 1280}
        )
        page = context.new_page()
        page_open_wall_time = time.time()
        print(f"[*] Navigating to http://127.0.0.1:{PORT}/mascot_studio.html...")
        page.goto(f'http://127.0.0.1:{PORT}/mascot_studio.html')

        print("[*] Waiting for 3D mascots and Three.js engine to fully load...")
        page.wait_for_function(
            "() => window.mascots && window.mascots.hoodie_open && window.mascots.astro",
            timeout=60000
        )
        print("[+] 3D mascots loaded successfully!")

        # Inject clean Promo CSS with calibrated vertical hierarchy
        page.add_style_tag(content='''
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap');
            
            /* Hide non-stage chrome */
            .atelier, .conversation, .studio-header, .stage-heading, .stage-bottom-controls, .stage-watermark, .stage-crosshairs, #toast, .toast {
                display: none !important;
            }
            .studio-layout {
                display: block !important;
                height: 100vh !important;
                width: 100vw !important;
                overflow: hidden !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .stage {
                height: 100vh !important;
                width: 100vw !important;
                max-height: none !important;
                border: none !important;
                background: transparent !important;
            }
            #canvas-container {
                height: 100vh !important;
                width: 100vw !important;
            }

            /* Action dock placed directly above bottom CTA */
            .stage-action-dock {
                position: fixed !important;
                bottom: 48px !important;
                left: 50% !important;
                transform: translateX(-50%) scale(0.98) !important;
                z-index: 900 !important;
                background: rgba(255, 253, 249, 0.92) !important;
                backdrop-filter: blur(16px) !important;
                border: 1px solid rgba(220, 212, 200, 0.8) !important;
                border-radius: 22px !important;
                box-shadow: 0 8px 24px rgba(50, 40, 30, 0.09) !important;
                padding: 5px 12px !important;
            }

            /* Promo HUD Overlay */
            #promo-overlay {
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 999;
                font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Segoe UI", sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding: 30px 22px 14px 22px;
                opacity: 0;
                transition: opacity 0.35s ease;
            }
            #promo-overlay.visible {
                opacity: 1;
            }

            .promo-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .promo-brand {
                display: flex;
                align-items: center;
                gap: 11px;
                background: rgba(255, 253, 249, 0.92);
                backdrop-filter: blur(14px);
                padding: 7px 15px 7px 9px;
                border-radius: 20px;
                border: 1.2px solid rgba(220, 212, 200, 0.8);
                box-shadow: 0 4px 18px rgba(40, 30, 20, 0.08);
            }
            .promo-logo {
                width: 36px;
                height: 38px;
                background: #b74343;
                color: #fff;
                border-radius: 9px;
                display: grid;
                place-items: center;
                font-family: 'Songti SC', serif;
                font-size: 25px;
                font-weight: 700;
                box-shadow: 0 3px 8px rgba(183, 67, 67, 0.35);
            }
            .promo-title {
                font-size: 14.5px;
                font-weight: 700;
                color: #2b2620;
                letter-spacing: 0.5px;
            }
            .promo-sub {
                font-size: 9.5px;
                color: #8c8275;
                letter-spacing: 1.2px;
                font-weight: 500;
            }

            .promo-live-badge {
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(255, 253, 249, 0.92);
                backdrop-filter: blur(14px);
                padding: 7px 13px;
                border-radius: 20px;
                border: 1.2px solid rgba(220, 212, 200, 0.8);
                font-size: 10.5px;
                font-weight: 700;
                color: #524d45;
                letter-spacing: 0.6px;
                box-shadow: 0 4px 18px rgba(40, 30, 20, 0.08);
            }
            .promo-pulse-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
                animation: pulse-green 1.5s infinite;
            }
            @keyframes pulse-green {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.35); opacity: 0.65; }
            }

            /* Subtitle Container sitting in lower third, completely clear of character body */
            .promo-subtitle-container {
                margin-bottom: 105px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 7px;
            }
            .promo-sub-tag {
                background: #b74343;
                color: #fff;
                padding: 3px 13px;
                border-radius: 11px;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.2px;
                box-shadow: 0 3px 10px rgba(183, 67, 67, 0.3);
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .promo-sub-text {
                background: rgba(255, 254, 250, 0.96);
                backdrop-filter: blur(16px);
                padding: 9px 20px;
                border-radius: 18px;
                border: 1.5px solid rgba(225, 218, 208, 0.95);
                box-shadow: 0 8px 28px rgba(50, 40, 30, 0.11);
                font-size: 17px;
                font-weight: 700;
                color: #231f20;
                text-align: center;
                max-width: 90%;
                line-height: 1.35;
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            /* Bottom CTA Pill */
            .promo-footer {
                display: flex;
                justify-content: center;
            }
            .promo-cta-box {
                background: rgba(35, 31, 32, 0.88);
                backdrop-filter: blur(14px);
                color: #fff;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 10.5px;
                display: flex;
                align-items: center;
                gap: 7px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.18);
                letter-spacing: 0.3px;
                border: 1px solid rgba(255, 255, 255, 0.15);
            }
            .promo-cta-box b {
                color: #f7b731;
                font-weight: 600;
            }
        ''')

        # Inject DOM overlay
        page.evaluate('''() => {
            const overlay = document.createElement('div');
            overlay.id = 'promo-overlay';
            overlay.innerHTML = `
                <div class="promo-header">
                    <div class="promo-brand">
                        <span class="promo-logo">荔</span>
                        <div>
                            <div class="promo-title">『 荔 』LI · 3D 陪伴工作室</div>
                            <div class="promo-sub">雪沐视觉实验室 ✦ SPEC 1.0</div>
                        </div>
                    </div>
                    <div class="promo-live-badge">
                        <span class="promo-pulse-dot"></span>
                        <span>3D REALTIME</span>
                    </div>
                </div>

                <div class="promo-subtitle-container">
                    <div class="promo-sub-tag" id="promo-sub-tag">01 · 萌颜日常态</div>
                    <div class="promo-sub-text" id="promo-sub-text">“把心事收进兜帽，把好心情留给你”</div>
                </div>

                <div class="promo-footer">
                    <div class="promo-cta-box">
                        <span>✦ 开源在线畅玩：</span>
                        <b>aierlanjiu.github.io/threejs-material-lab/li.html</b>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            window.setPromoSub = (tag, text) => {
                const tagEl = document.getElementById('promo-sub-tag');
                const textEl = document.getElementById('promo-sub-text');
                if (tagEl) {
                    tagEl.textContent = tag;
                    tagEl.style.transform = 'scale(1.08)';
                    setTimeout(() => tagEl.style.transform = 'scale(1)', 180);
                }
                if (textEl) {
                    textEl.textContent = text;
                    textEl.style.transform = 'scale(1.03)';
                    setTimeout(() => textEl.style.transform = 'scale(1)', 180);
                }
            };
        }''')

        # Allow rendering and shaders to warm up
        page.wait_for_timeout(2000)

        # Reveal overlay right when choreography starts
        print("[*] Starting choreography sequence...")
        page.evaluate("() => document.getElementById('promo-overlay').classList.add('visible')")

        t_start = time.time()
        start_offset = t_start - page_open_wall_time
        print(f"[*] Choreography started! Recorded relative wall time offset: {start_offset:.2f}s")

        def set_sub(tag, text):
            page.evaluate(f"window.setPromoSub({repr(tag)}, {repr(text)})")

        # ================= CHOREOGRAPHY TIMELINE (Total: ~29s) =================
        # Stage 1: Wave & Smile (3.6s)
        set_sub("01 · 萌颜日常态", "“把心事收进兜帽，把好心情留给你”")
        page.evaluate("window.triggerMascotAction('wave')")
        time.sleep(3.6)

        # Stage 2: Pull Drawcord -> Lock into Fruit (3.6s)
        set_sub("02 · 锁进果实态", "累了就拉紧抽绳，一秒躲进荔枝壳里安睡~")
        page.evaluate("window.setHoodieState('closed')")
        time.sleep(1.8)
        page.evaluate("window.triggerMascotAction('sleepy')")
        time.sleep(1.8)

        # Stage 3: Release Cord -> Pop out & Bounce (3.6s)
        set_sub("03 · 探头微笑态", "抽绳松开！荔小卫探出头来啦~")
        page.evaluate("window.setHoodieState('open')")
        time.sleep(1.4)
        page.evaluate("window.triggerMascotAction('bounce')")
        time.sleep(2.2)

        # Stage 4: Switch to Astro (4.0s)
        set_sub("04 · 探索宇航态", "一键变身宇航员「荔小星」· 漫游星际！")
        page.evaluate("window.switchCompanion('astro')")
        time.sleep(1.5)
        page.evaluate("window.triggerMascotAction('zero_g_float')")
        time.sleep(2.5)

        # Stage 5: CMF Materials Showcase - Cinnabar Jade (3.8s)
        set_sub("05 · 工坊朱砂凝玉", "24 款工坊大师 CMF · 故宫剔红雕漆 + 24K 金箔")
        page.evaluate("window.switchCompanion('hoodie')")
        page.evaluate("window.setMascotCMF('cinnabar_jade')")
        page.evaluate("window.triggerMascotAction('shy')")
        time.sleep(3.8)

        # Stage 6: CMF Materials Showcase - Titanium Holographic (3.8s)
        set_sub("06 · 航天全息钛银", "航天级缎面钛银 · PVD 纳米薄膜彩虹干涉光效")
        page.evaluate("window.setMascotCMF('titanium_holographic')")
        page.evaluate("window.triggerMascotAction('groove')")
        time.sleep(3.8)

        # Stage 7: CMF Materials Showcase - Optic Crystal (3.6s)
        set_sub("07 · 光学水晶琉璃", "纯净白水晶 · 清透折射琉璃冰荔光芒")
        page.evaluate("window.setMascotCMF('optic_crystal')")
        page.evaluate("window.triggerMascotAction('bounce')")
        time.sleep(3.6)

        # Stage 8: Finale & Outro (3.5s)
        set_sub("08 · 纯前端开源上线", "手机/电脑浏览器直接打开 · 摸摸你的专属荔枝 ✨")
        page.evaluate("window.setMascotCMF('default')")
        page.evaluate("window.triggerMascotAction('wave')")
        time.sleep(3.5)

        t_end = time.time()
        total_video_dur = t_end - t_start
        print(f"[+] Choreography complete! Measured duration: {total_video_dur:.2f}s")

        print("[*] Closing browser to flush recorded video file...")
        page.close()
        context.close()
        browser.close()

    httpd.shutdown()
    print("[*] HTTP server stopped.")

    webm_files = glob.glob(f"{OUTPUT_RAW_DIR}/*.webm")
    if not webm_files:
        raise RuntimeError("No recorded webm file found in output directory!")
    raw_webm = webm_files[0]
    print(f"[+] Found recorded video: {raw_webm}")

    print(f"[*] Muxing with FFmpeg:")
    print(f"    Trim start: {start_offset:.2f}s, duration: {total_video_dur:.2f}s")
    print(f"    Audio: {BGM_PATH} (starting at beat 00:00:01.2)")

    fade_out_start = max(1.0, total_video_dur - 1.5)
    mux_cmd = [
        '/opt/homebrew/bin/ffmpeg', '-y',
        '-ss', f"{start_offset:.2f}",
        '-t', f"{total_video_dur:.2f}",
        '-i', raw_webm,
        '-ss', '00:00:01.2',
        '-t', f"{total_video_dur:.2f}",
        '-i', BGM_PATH,
        '-filter_complex',
        f"[0:v]fps=30,scale=720:1280:flags=lanczos,format=yuv420p[v];"
        f"[1:a]afade=t=in:ss=0:d=0.4,afade=t=out:st={fade_out_start:.2f}:d=1.5,volume=1.0[a]",
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        FINAL_OUTPUT_MP4
    ]

    res = subprocess.run(mux_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("[!] FFmpeg error:", res.stderr)
        raise RuntimeError("FFmpeg muxing failed!")

    print(f"\n[SUCCESS] Final promotional video created at: {FINAL_OUTPUT_MP4}")
    subprocess.run(['/opt/homebrew/bin/ffprobe', FINAL_OUTPUT_MP4])

if __name__ == '__main__':
    main()
