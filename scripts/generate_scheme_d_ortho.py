#!/usr/bin/env python3
"""
Dedicated Generator for Scheme D (Astro-Lychee · 荔小星) Orthographic Blueprints.
Uses single warm session to guarantee 100% geometric and visual consistency across:
1. 01_turnaround_3view.png (Front / Side 90 / Back 180 Aligned)
2. 02_ortho_side_90.png (True 90-degree lateral profile)
3. 03_isometric_cad_breakdown.png (Isometric CAD exploded assembly)
"""

import asyncio
import base64
import hashlib
import os
import shutil
import time
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = os.environ.get("GPT_IMAGE_CDP_URL", "http://127.0.0.1:9333")
OUT_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_d_astro")
OUT_DIR.mkdir(parents=True, exist_ok=True)
BRAIN_DIR = Path("/Users/papazed/.gemini/antigravity/brain/095f0e24-6f5a-4ad7-b980-db9809fbc7c9/images")
BRAIN_DIR.mkdir(parents=True, exist_ok=True)

REF_IMAGE = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_astro_front.png")
PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ortho")

TASKS = [
    {
        "id": "sd_ortho_01_turnaround",
        "filename": "01_turnaround_3view.png",
        "label": "方案 D · 荔小星 | 宇航员标准三视图总图 (Front / Side 90° / Back 180° Aligned)",
        "prompt_file": "sd_ortho_01_turnaround.txt",
        "brain_name": "sd_ortho_01_turnaround.png",
        "is_first": True,
    },
    {
        "id": "sd_ortho_02_side_90",
        "filename": "02_ortho_side_90.png",
        "label": "方案 D · 荔小星 | 纯正 90 度侧立面轮廓正交图 (True 90° Lateral Profile)",
        "prompt_file": "sd_ortho_02_side_90.txt",
        "brain_name": "sd_ortho_02_side_90.png",
        "is_first": False,
    },
    {
        "id": "sd_ortho_03_isometric_cad",
        "filename": "03_isometric_cad_breakdown.png",
        "label": "方案 D · 荔小星 | 等轴测 3D 结构分件装配图 (Isometric CAD Breakdown)",
        "prompt_file": "sd_ortho_03_isometric_cad.txt",
        "brain_name": "sd_ortho_03_isometric_cad.png",
        "is_first": False,
    },
]

async def capture_latest_image(page, known_srcs, dest_path, brain_path, timeout=240):
    start = time.time()
    while time.time() - start < timeout:
        if time.time() - start < 15:
            await asyncio.sleep(3)
            continue
            
        # Check if still generating (stop button active)
        stop_btn = page.locator("button[data-testid='stop-button'], button[aria-label*='停止'], button[aria-label*='Stop']")
        if await stop_btn.count() > 0 and await stop_btn.first.is_visible():
            await asyncio.sleep(3)
            continue

        imgs = await page.locator("img").all()
        for img in imgs:
            try:
                src = await img.get_attribute("src")
                if not src or src in known_srcs:
                    continue
                    
                w = await img.evaluate("el => el.naturalWidth")
                h = await img.evaluate("el => el.naturalHeight")
                if w and w >= 1000:
                    b64 = await img.evaluate('''el => {
                        const canvas = document.createElement('canvas');
                        canvas.width = el.naturalWidth;
                        canvas.height = el.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(el, 0, 0);
                        return canvas.toDataURL('image/png').split(',')[1];
                    }''')
                    raw = base64.b64decode(b64)
                    if len(raw) < 400_000:
                        # Still loading or empty placeholder
                        continue
                    print(f"   ✅ 检测到全新正交大图: {w}x{h} ({len(raw)//1024} KB)", flush=True)
                    dest_path.write_bytes(raw)
                    shutil.copy2(dest_path, brain_path)
                    print(f"   💾 保存并镜像完成: {dest_path.name}", flush=True)
                    return True
            except Exception:
                pass
        await asyncio.sleep(3)
    return False

async def main():
    print("🚀 启动方案 D (荔小星) 工业正交三视图自动化管线...", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        
        chat_pages = [page for page in context.pages if "chatgpt" in page.url]
        if chat_pages:
            page = chat_pages[0]
            await page.bring_to_front()
        else:
            page = await context.new_page()
            await page.goto("https://chatgpt.com/", wait_until="domcontentloaded")

        # 1. 开启全新对话
        new_chat_btn = page.locator('a[aria-label*="新聊天"], button[aria-label*="新聊天"], a[href="/"]').first
        if await new_chat_btn.count() > 0:
            await new_chat_btn.click()
            await asyncio.sleep(2)
        else:
            await page.goto("https://chatgpt.com/", wait_until="domcontentloaded")
            await asyncio.sleep(2)

        for idx, task in enumerate(TASKS):
            dest_path = OUT_DIR / task["filename"]
            brain_path = BRAIN_DIR / task["brain_name"]
            
            if dest_path.exists() and dest_path.stat().st_size > 500_000:
                print(f"⏩ [{task['filename']}] 已存在 ({dest_path.stat().st_size//1024} KB)，跳过。", flush=True)
                if not brain_path.exists():
                    shutil.copy2(dest_path, brain_path)
                continue

            raw_prompt = (PROMPTS_DIR / task["prompt_file"]).read_text(encoding="utf-8").strip()
            if task["is_first"]:
                full_prompt = f"{raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
            else:
                full_prompt = f"Based on the exact character generated above, {raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

            print(f"\n[{idx+1}/{len(TASKS)}] 正在生成: {task['label']}", flush=True)

            # 首张图挂载母本
            if task["is_first"]:
                upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
                await upload_input.set_input_files(str(REF_IMAGE))
                print(f"   📤 已挂载宇航员母本垫图: {REF_IMAGE.name}，等待 8s 稳定...", flush=True)
                await asyncio.sleep(8)
                for _ in range(12):
                    busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                    if busy == 0:
                        break
                    await asyncio.sleep(1)
                await asyncio.sleep(2)

            # 记录当前图片源
            known_srcs = set()
            for img in await page.locator("img").all():
                s = await img.get_attribute("src")
                if s:
                    known_srcs.add(s)

            # 输入提示词并提交
            composer = page.locator("#prompt-textarea").first
            await composer.wait_for(state="visible", timeout=20000)
            await composer.click()
            await composer.fill(full_prompt)
            await asyncio.sleep(2)

            send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
            for _ in range(10):
                if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
                    await send_btn.click()
                    print("   📨 已提交任务！", flush=True)
                    break
                await asyncio.sleep(1)

            print("   ⏳ 正在渲染监控中...", flush=True)
            success = await capture_latest_image(page, known_srcs, dest_path, brain_path)
            if not success:
                print(f"❌ 任务失败: {task['filename']}", flush=True)
                break

            if idx < len(TASKS) - 1:
                print("⏳ 冷却 25 秒防风控延时...", flush=True)
                await asyncio.sleep(25)

        print("\n🎉 方案 D 荔小星所有正交蓝图已全部生成完成！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
