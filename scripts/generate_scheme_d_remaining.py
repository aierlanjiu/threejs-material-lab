#!/usr/bin/env python3
"""
Dedicated Runner for Scheme D Tasks 2 & 3 in the active warm session.
Handles ephemeral image-gen retry and robust canvas capture.
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

TASKS = [
    {
        "id": "sd_ortho_02_side_90",
        "filename": "02_ortho_side_90.png",
        "label": "方案 D · 荔小星 | 纯正 90 度侧立面轮廓正交图 (True 90° Lateral Profile)",
        "prompt_file": "sd_ortho_02_side_90.txt",
        "brain_name": "sd_ortho_02_side_90.png",
    },
    {
        "id": "sd_ortho_03_isometric_cad",
        "filename": "03_isometric_cad_breakdown.png",
        "label": "方案 D · 荔小星 | 等轴测 3D 结构分件装配图 (Isometric CAD Breakdown)",
        "prompt_file": "sd_ortho_03_isometric_cad.txt",
        "brain_name": "sd_ortho_03_isometric_cad.png",
    },
]

async def send_and_capture(page, prompt_text, dest_path, brain_path, label):
    print(f"\n🎯 准备执行: {label}", flush=True)
    
    # 1. Snapshot known estuary image URLs
    known_estuary_srcs = set()
    for img in await page.locator("img").all():
        src = await img.get_attribute("src")
        if src and "estuary" in src:
            known_estuary_srcs.add(src)
    print(f"   已记录现有产物图源: {len(known_estuary_srcs)} 个", flush=True)

    # 2. Fill composer
    full_prompt = f"Based on the exact character generated above, {prompt_text}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
    composer = page.locator("#prompt-textarea").first
    await composer.wait_for(state="visible", timeout=20000)
    await composer.click()
    await composer.fill(full_prompt)
    await asyncio.sleep(2)

    # 3. Send
    send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
    for _ in range(10):
        if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
            await send_btn.click()
            print("   📨 已提交任务！", flush=True)
            break
        await asyncio.sleep(1)

    # 4. Monitor generation
    print("   ⏳ 正在渲染监控中...", flush=True)
    start = time.time()
    while time.time() - start < 240:
        await asyncio.sleep(4)
        
        # Check if error message appeared
        last_msgs = await page.locator("[data-message-author-role='assistant']").all()
        if last_msgs:
            last_text = await last_msgs[-1].inner_text()
            if any(err_kw in last_text for err_kw in ["returned an error", "unable to generate", "wasn't able to", "生成失败"]):
                print(f"   ⚠️ 检测到平台重试提示: {last_text[:80]}... 准备重试一次...", flush=True)
                await asyncio.sleep(5)
                return await send_and_capture(page, prompt_text, dest_path, brain_path, label)

        # Check if stop button is active
        stop_btn = page.locator("button[data-testid='stop-button'], button[aria-label*='停止'], button[aria-label*='Stop']")
        if await stop_btn.count() > 0 and await stop_btn.first.is_visible():
            continue

        # Inspect all images
        imgs = await page.locator("img").all()
        for img in reversed(imgs):
            src = await img.get_attribute("src")
            if not src or "estuary" not in src or src in known_estuary_srcs:
                continue

            try:
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
                    if len(raw) < 500_000:
                        continue  # Placeholder
                    print(f"   ✅ 成功捕获高清蓝图: {w}x{h} ({len(raw)//1024} KB)", flush=True)
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    dest_path.write_bytes(raw)
                    shutil.copy2(dest_path, brain_path)
                    print(f"   💾 本地落盘并同步 Brain 成功: {dest_path.name}", flush=True)
                    return True
            except Exception as e:
                # e.g. tainted canvas or transient error
                pass

    print(f"   ❌ 渲染监控超时 (240s): {label}", flush=True)
    return False

async def main():
    print("🚀 启动方案 D 剩余蓝图自动化流程 (Task 2 & 3)...", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        page = [p_obj for p_obj in context.pages if "chatgpt" in p_obj.url][0]
        await page.bring_to_front()

        for idx, task in enumerate(TASKS):
            dest_path = OUT_DIR / task["filename"]
            brain_path = BRAIN_DIR / task["brain_name"]
            
            if dest_path.exists() and dest_path.stat().st_size > 500_000:
                print(f"⏩ [{task['filename']}] 已存在 ({dest_path.stat().st_size//1024} KB)，跳过。", flush=True)
                if not brain_path.exists():
                    shutil.copy2(dest_path, brain_path)
                continue

            prompt_text = (PROMPTS_DIR / task["prompt_file"]).read_text(encoding="utf-8").strip()
            ok = await send_and_capture(page, prompt_text, dest_path, brain_path, task["label"])
            if not ok:
                print("❌ 流程中断！", flush=True)
                return

            if idx < len(TASKS) - 1:
                print("⏳ 冷却 25 秒防风控延时...", flush=True)
                await asyncio.sleep(25)

        print("\n🎉 方案 D 荔小星所有正交蓝图已全部生成落盘完毕！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
