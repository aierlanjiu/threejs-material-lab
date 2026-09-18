#!/usr/bin/env python3
"""
Dedicated Batch Generator for Xuemu Quirky-Sketch UI Icons & Decorations.
Submits 1:1 master sprite sheets on pure isolated white background to live ChatGPT CDP (port 9333),
captures high-resolution generated images, and saves to assets/icons/quirky/raw/.
"""

import asyncio
import argparse
import base64
import hashlib
import os
import shutil
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = os.environ.get("GPT_IMAGE_CDP_URL", "http://127.0.0.1:9333")
WORKSPACE_ROOT = Path("/Users/papazed/dev/threejs-material-lab")
RAW_DIR = WORKSPACE_ROOT / "assets" / "icons" / "quirky" / "raw"
OUTPUT_DIR = WORKSPACE_ROOT / "assets" / "icons" / "quirky"
DECOR_DIR = WORKSPACE_ROOT / "assets" / "decorations" / "quirky"

RAW_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DECOR_DIR.mkdir(parents=True, exist_ok=True)

SHEET_TASKS = [
    {
        "id": "quirky_actions_sheet",
        "label": "雪沐怪诞手绘 · 12姿态动作图标大图 (Actions Sprite Sheet)",
        "dest_path": RAW_DIR / "quirky_actions_sheet.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "canonical_hoodie_hoodon.png",
        "prompt": (
            "Quirky hand-drawn doodle sprite sheet, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "A clean 3x4 grid of 12 distinct small mascot action doodle icons, perfectly spaced out with wide generous whitespace on a pure solid isolated white background (#ffffff).\n"
            "Each icon is a separate, minimalist hand-drawn ink line doodle with charming wobbly contours and subtle soft watercolor accents (soft lychee red, leaf green, warm blush pink):\n"
            "1. Closed fruit pod sleeping with green drawstrings (lock fruit)\n"
            "2. Joyful character bouncing up with energy spring lines and sparkles\n"
            "3. Cheerful cute hand waving hello with motion lines\n"
            "4. Enthusiastic nodding head with a little thumbs-up doodle\n"
            "5. Playful character shaking head side to side with wavy wobble lines\n"
            "6. Shy blushing character covering cheeks with tiny hands and rosy pink blush\n"
            "7. Sleeping peaceful face with floating 'Zzz' dream bubbles\n"
            "8. Grooving dancing character with whimsical bouncy music notes\n"
            "9. Peeking head popping out of a peeled lychee shell\n"
            "10. Floating zero-g astronaut helmet with orbit rings and tiny stars\n"
            "11. Space rocket thruster blasting tiny energetic doodle flames\n"
            "12. Crisp cute astronaut hand making a salute gesture\n"
            "Style: Minimalist black ink brush doodle, wobbly lines, charming editorial illustrations, pure white isolated background, wide space between icons for easy cutout.\n"
            "No realistic 3D, no dark background, no gray bounding boxes, no complex gradients.\n"
            "Canvas: Exactly one native 1:1 square image. Pure white background."
        )
    },
    {
        "id": "quirky_controls_sheet",
        "label": "雪沐怪诞手绘 · 核心按钮与背景修饰大图 (Controls & Decor Sprite Sheet)",
        "dest_path": RAW_DIR / "quirky_controls_sheet.png",
        "ref_image": WORKSPACE_ROOT / "assets" / "icons" / "cmf" / "swatch_rind_jade.png",
        "prompt": (
            "Quirky hand-drawn doodle UI elements and decorative flourishes, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "A clean collection of hand-drawn UI elements arranged with generous whitespace on a pure solid isolated white background (#ffffff):\n"
            "1. Send button: Dynamic quirky paper-airplane / energetic ink arrow darting diagonally upward with cute dashed speed trails (accented with soft vermilion red).\n"
            "2. Speech chat bubble: Whimsical hand-drawn dialogue bubble with a cute green lychee sprout leaf at the corner.\n"
            "3. Microphone: Charming vintage retro hand-drawn microphone with wavy acoustic sound ripples.\n"
            "4. Corner frames: 4 whimsical hand-drawn corner framing brackets (L-shaped organic doodle brackets with dots).\n"
            "5. Sparkle stars: Set of 6 whimsical wobbly hand-drawn 4-pointed stars and ink speckles.\n"
            "6. Botanic branch: Delicate hand-drawn lychee twig with a leafy curved stem and two tiny hanging berries.\n"
            "7. Seal stamp: Circular hand-drawn traditional cinnabar red ink seal stamp with playful Chinese calligraphy '荔'.\n"
            "Style: Minimalist black ink doodle linework, soft watercolor red and green accents, generous clean whitespace, pure solid white background for transparency cropping.\n"
            "No 3D render, no photorealism, no dark background, no gradient borders.\n"
            "Canvas: Exactly one native 1:1 square image. Pure white background."
        )
    }
]

async def generate_task(playwright, task, force=False):
    dest_path = task["dest_path"]
    if dest_path.exists() and dest_path.stat().st_size > 10000 and not force:
        print(f"⏩ [已存在且有效] {task['label']} -> {dest_path.name} ({dest_path.stat().st_size // 1024} KB)")
        return True

    print(f"\n🚀 开始请求生成怪诞手绘母图: {task['label']}", flush=True)
    print(f"   目标路径: {dest_path}", flush=True)
    print("=" * 70, flush=True)

    browser = await playwright.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0]

    chat_pages = [p for p in context.pages if "chatgpt" in p.url]
    if chat_pages:
        page = chat_pages[0]
        await page.bring_to_front()
    else:
        page = await context.new_page()
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)

    try:
        # Start new chat session
        try:
            new_chat_btn = page.locator('a[data-testid="create-new-chat-button"], button[aria-label*="新聊天"], a[href="/"]').first
            if await new_chat_btn.count() > 0:
                await new_chat_btn.click(force=True, timeout=3000)
                await asyncio.sleep(2)
            else:
                await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)
                await asyncio.sleep(2)
        except Exception:
            await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)
            await asyncio.sleep(2)

        # 1. Mount Reference Image if available
        if task.get("ref_image") and task["ref_image"].exists():
            upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
            await upload_input.set_input_files(str(task["ref_image"]))
            print(f"   📤 已挂载母本垫图: {task['ref_image'].name}...", flush=True)
            await asyncio.sleep(6)
            for wait_i in range(12):
                busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                if busy == 0:
                    print(f"   ✅ 垫图解析完毕 ({wait_i + 6}s)", flush=True)
                    break
                await asyncio.sleep(1)
            await asyncio.sleep(1)

        # 2. Fill prompt
        composer = page.locator("#prompt-textarea, textarea[tabindex='0'], div[contenteditable='true']").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(task["prompt"])
        print("   ⏳ 提示词填充完成，提交中...", flush=True)
        await asyncio.sleep(1)

        # 3. Submit
        send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
        submitted = False
        for _ in range(10):
            if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
                await send_btn.click()
                submitted = True
                print("   📨 提交成功！", flush=True)
                break
            await asyncio.sleep(1)

        if not submitted:
            await composer.press("Enter")
            print("   📨 回车提交！", flush=True)
            await asyncio.sleep(2)

        known_srcs = set()
        for pre_img in await page.locator("img").all():
            try:
                s = await pre_img.get_attribute("src")
                if s: known_srcs.add(s)
            except Exception: pass

        # 4. Wait for output
        start = time.time()
        timeout = 260
        found = False
        print("   ⏳ 等待模型渲染与下载...", flush=True)

        while time.time() - start < timeout:
            if time.time() - start < 15:
                await asyncio.sleep(3)
                continue

            # Check retry button if errored
            retry = await page.locator("button:has-text('重试'), button:has-text('Retry')").count()
            if retry > 0:
                print("   ⚠️ 触发重试...", flush=True)
                await page.locator("button:has-text('重试'), button:has-text('Retry')").first.click()
                await asyncio.sleep(5)

            imgs = await page.locator("img[src*='estuary'], img[src*='oaiusercontent'], img[alt*='已生成'], img[alt*='Generated'], article img").all()
            for img in imgs:
                try:
                    src = await img.get_attribute("src")
                    if not src or src in known_srcs:
                        continue

                    in_user = await img.evaluate("el => !!el.closest('[data-message-author-role=\"user\"], form, [data-testid*=\"attachment\"]')")
                    if in_user: continue

                    w = await img.evaluate("el => el.naturalWidth")
                    h = await img.evaluate("el => el.naturalHeight")
                    if w and w >= 800:
                        b64 = await img.evaluate('''async (el) => {
                            const resp = await fetch(el.src);
                            const blob = await resp.blob();
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                                reader.onerror = reject;
                            });
                        }''')
                        raw = base64.b64decode(b64)

                        if task.get("ref_image") and task["ref_image"].exists():
                            new_hash = hashlib.md5(raw).hexdigest()
                            ref_hash = hashlib.md5(task["ref_image"].read_bytes()).hexdigest()
                            if new_hash == ref_hash:
                                known_srcs.add(src)
                                continue

                        print(f"   ✅ 成功捕获 1:1 母图: {w}x{h} ({time.time() - start:.1f}s)", flush=True)
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        dest_path.write_bytes(raw)
                        file_kb = len(raw) // 1024
                        print(f"   💾 写入落盘: {dest_path} ({file_kb} KB)", flush=True)
                        found = True
                        break
                except Exception:
                    pass

            if found:
                break
            await asyncio.sleep(3)

        if not found:
            print(f"❌ [{task['label']}] 超时未捕获到大图。")
            return False

        print("   ❄️ 冷却缓冲 8s...", flush=True)
        await asyncio.sleep(8)
        return True

    except Exception as e:
        print(f"❌ 运行异常: {e}", flush=True)
        return False

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--single")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    async with async_playwright() as p:
        tasks = SHEET_TASKS
        if args.single:
            tasks = [t for t in tasks if t["id"] == args.single]
        for t in tasks:
            await generate_task(p, t, force=args.force)

if __name__ == "__main__":
    asyncio.run(main())
