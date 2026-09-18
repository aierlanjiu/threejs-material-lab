#!/usr/bin/env python3
"""
Reliable pipeline to capture Task 2 (currently generating) and then run & capture Task 3.
"""

import asyncio
import base64
import os
import shutil
import time
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = os.environ.get("GPT_IMAGE_CDP_URL", "http://127.0.0.1:9333")
OUT_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_d_astro")
BRAIN_DIR = Path("/Users/papazed/.gemini/antigravity/brain/095f0e24-6f5a-4ad7-b980-db9809fbc7c9/images")
PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ortho")

async def wait_for_completion_and_capture(page, dest_path, brain_path, label, known_srcs, timeout=240):
    print(f"⏳ 正在监控 [{label}] 渲染...", flush=True)
    start = time.time()
    
    # 1. Wait for stop button to disappear
    while time.time() - start < timeout:
        stop_btn = page.locator("button[data-testid='stop-button'], button[aria-label*='停止'], button[aria-label*='Stop']")
        is_generating = await stop_btn.count() > 0 and await stop_btn.first.is_visible()
        if not is_generating and (time.time() - start > 15):
            # Check if there is an image rendered
            imgs = await page.locator("img").all()
            for img in reversed(imgs):
                try:
                    src = await img.get_attribute("src")
                    if not src or "estuary" not in src or src in known_srcs:
                        continue
                        
                    w = await img.evaluate("el => el.naturalWidth")
                    h = await img.evaluate("el => el.naturalHeight")
                    if w >= 1000:
                        b64 = await img.evaluate('''el => {
                            const canvas = document.createElement('canvas');
                            canvas.width = el.naturalWidth;
                            canvas.height = el.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(el, 0, 0);
                            return canvas.toDataURL('image/png').split(',')[1];
                        }''')
                        raw = base64.b64decode(b64)
                        if len(raw) > 500_000:
                            print(f"   ✅ 成功捕获高清蓝图: {w}x{h} ({len(raw)//1024} KB)", flush=True)
                            dest_path.parent.mkdir(parents=True, exist_ok=True)
                            dest_path.write_bytes(raw)
                            brain_path.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copy2(dest_path, brain_path)
                            print(f"   💾 存储并同步完成: {dest_path.name}", flush=True)
                            known_srcs.add(src)
                            return True
                except Exception:
                    pass
        await asyncio.sleep(4)
        
    print(f"   ❌ 监控超时: {label}", flush=True)
    return False

async def main():
    print("🚀 启动方案 D 渲染监控与串联任务...", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        page = [p_obj for p_obj in context.pages if "chatgpt" in p_obj.url][0]
        await page.bring_to_front()

        # Known sources from turnaround view
        known_srcs = set()
        for img in await page.locator("img").all():
            src = await img.get_attribute("src")
            if src and "estuary" in src:
                known_srcs.add(src)

        # 1. Capture Task 2 (already running in browser)
        dest2 = OUT_DIR / "02_ortho_side_90.png"
        brain2 = BRAIN_DIR / "sd_ortho_02_side_90.png"
        
        ok2 = await wait_for_completion_and_capture(page, dest2, brain2, "方案 D 纯正 90 度侧立面正交图", known_srcs)
        if not ok2:
            print("❌ Task 2 捕获失败，终止管线", flush=True)
            return

        print("⏳ 冷却 25 秒防风控延时...", flush=True)
        await asyncio.sleep(25)

        # 2. Submit and Capture Task 3
        dest3 = OUT_DIR / "03_isometric_cad_breakdown.png"
        brain3 = BRAIN_DIR / "sd_ortho_03_isometric_cad.png"
        prompt3_text = (PROMPTS_DIR / "sd_ortho_03_isometric_cad.txt").read_text(encoding="utf-8").strip()
        full_prompt3 = f"Based on the exact character generated above, {prompt3_text}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

        print("\n🎯 准备提交 Task 3: 方案 D 等轴测 3D 结构分件装配图...", flush=True)
        composer = page.locator("#prompt-textarea").first
        await composer.wait_for(state="visible", timeout=20000)
        await composer.click()
        await composer.fill(full_prompt3)
        await asyncio.sleep(2)

        send_btn = page.locator("button[data-testid='send-button']").first
        await send_btn.click()
        print("   📨 Task 3 提示词已提交！", flush=True)
        await asyncio.sleep(5)

        ok3 = await wait_for_completion_and_capture(page, dest3, brain3, "方案 D 等轴测 3D 结构分件装配图", known_srcs)
        if not ok3:
            print("❌ Task 3 捕获失败", flush=True)
            return

        print("\n🎉🎉🎉 方案 D (荔小星) 所有 3 张正交工程蓝图已全部生成落盘完毕！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
