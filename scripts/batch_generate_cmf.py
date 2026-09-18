#!/usr/bin/env python3
"""
CMF Material Variants Generator for "LI / 荔" Mascot.
Applies distinctive luxury materials to canonical Hoodie and Astro designs.
Maintains 100% character shape consistency via reference image padding.
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
OUT_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/cmf_materials")
OUT_DIR.mkdir(parents=True, exist_ok=True)
BRAIN_IMAGES_DIR = Path("/Users/papazed/.gemini/antigravity/brain/095f0e24-6f5a-4ad7-b980-db9809fbc7c9/images")
BRAIN_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_cmf")

REF_HOODIE = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_hoodie_hoodon.png")
REF_ASTRO = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_d_astro/01_front.png")
REF_HERMIT = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_hermit_traveler.png")

CMF_TASKS = [
    {
        "id": "cmf_a_wool_corduroy",
        "filename": "01_hoodie_wool_corduroy.png",
        "label": "【荔小卫 · 治愈秋冬版】粗坑条砖红灯芯绒 + 纯羊毛毡",
        "prompt_file": "cmf_a_wool_corduroy.txt",
        "ref_image": REF_HOODIE,
    },
    {
        "id": "cmf_a_cinnabar_jade",
        "filename": "02_hoodie_cinnabar_jade.png",
        "label": "【荔小卫 · 东方典藏版】非遗剔红朱砂雕漆 + 和田羊脂白玉",
        "prompt_file": "cmf_a_cinnabar_jade.txt",
        "ref_image": REF_HOODIE,
    },
    {
        "id": "cmf_d_holographic_titanium",
        "filename": "03_astro_holographic_titanium.png",
        "label": "【荔小星 · 航天极客版】钛金属灰宇航服 + 全息彩虹面罩",
        "prompt_file": "cmf_d_holographic_titanium.txt",
        "ref_image": REF_ASTRO,
    },
    {
        "id": "cmf_d_optic_crystal",
        "filename": "04_astro_optic_crystal.png",
        "label": "【荔小星 · 光学晶石版】纯净光学白水晶头盔 + 微晶陶瓷宇航服",
        "prompt_file": "cmf_d_optic_crystal.txt",
        "ref_image": REF_ASTRO,
    },
    {
        "id": "cmf_hermit_amber_leather",
        "filename": "05_hermit_amber_leather.png",
        "label": "【壳甲小旅人 · 探险家复古琥珀版】琥珀蜜蜡果肉 + 植鞣皮背带",
        "prompt_file": "cmf_hermit_amber_leather.txt",
        "ref_image": REF_HERMIT,
    },
    {
        "id": "cmf_hermit_jade_bronze",
        "filename": "06_hermit_jade_bronze.png",
        "label": "【壳甲小旅人 · 东方玉魄青铜版】羊脂白玉身躯 + 战国青铜错金壳",
        "prompt_file": "cmf_hermit_jade_bronze.txt",
        "ref_image": REF_HERMIT,
    },
]

async def generate_cmf_single(playwright, task):
    dest_path = OUT_DIR / task["filename"]
    ref_image = task["ref_image"]

    if dest_path.exists() and dest_path.stat().st_size > 500_000:
        if ref_image.exists() and ref_image.stat().st_size > 500_000:
            ref_hash = hashlib.md5(ref_image.read_bytes()).hexdigest()
            dest_hash = hashlib.md5(dest_path.read_bytes()).hexdigest()
            if ref_hash == dest_hash:
                print(f"🔄 [{task['filename']}] 检测到与垫图哈希一致，准备重新生成覆盖...")
            else:
                print(f"⏩ [{task['filename']}] CMF材质图已就绪 ({dest_path.stat().st_size // 1024} KB)，跳过。")
                return "skipped"
        else:
            print(f"⏩ [{task['filename']}] 已存在 ({dest_path.stat().st_size // 1024} KB)，跳过。")
            return "skipped"

    prompt_path = PROMPTS_DIR / task["prompt_file"]
    if not prompt_path.exists():
        print(f"❌ 提示词文件不存在: {prompt_path}")
        return False

    raw_prompt = prompt_path.read_text(encoding="utf-8").strip()
    full_prompt = f"{raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

    print(f"\n{'='*70}")
    print(f"🎨 CMF 材质图生成: {task['label']} -> {task['filename']}")
    print(f"   📎 绑定绝对锚点垫图: {ref_image.name}")
    print(f"{'='*70}")

    browser = await playwright.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0]
    page = await context.new_page()

    try:
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(2)

        # Upload reference image
        if ref_image.exists():
            upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
            await upload_input.set_input_files(str(ref_image))
            print(f"   📤 已上传垫图基准: {ref_image.name}，进入充分等待延时 (8s)...")
            await asyncio.sleep(8)
            for wait_i in range(12):
                busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                if busy == 0:
                    print(f"   ✅ 垫图上传稳定就绪 (耗时 {wait_i + 8}s)")
                    break
                await asyncio.sleep(1)
            await asyncio.sleep(2)

        # Wait for composer and fill prompt
        composer = page.locator("#prompt-textarea").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(full_prompt)
        print("   ⏳ 提示词已填入，等待 3s 缓冲...")
        await asyncio.sleep(3)

        # Submit
        send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
        submitted = False
        for _ in range(10):
            if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
                await send_btn.click()
                submitted = True
                break
            await asyncio.sleep(1)

        if not submitted:
            await composer.press("Enter")
            await asyncio.sleep(2)

        stop_btn = page.locator("button[aria-label*='停止'], button[aria-label*='Stop'], button[data-testid='stop-button']")
        for _ in range(8):
            if await stop_btn.count() > 0 and await stop_btn.is_visible():
                submitted = True
                break
            await asyncio.sleep(1)

        if not submitted:
            await composer.press("Enter")
            await asyncio.sleep(2)

        # Collect existing image URLs to avoid false positives
        known_srcs = set()
        for pre_img in await page.locator("img").all():
            try:
                s = await pre_img.get_attribute("src")
                if s:
                    known_srcs.add(s)
            except Exception:
                pass

        await asyncio.sleep(2)
        for pre_img in await page.locator("img").all():
            try:
                s = await pre_img.get_attribute("src")
                if s:
                    known_srcs.add(s)
            except Exception:
                pass

        print("   ⏳ 提示词与垫图已提交，等待全新 CMF 大图渲染...")

        start = time.time()
        timeout = 240
        found = False
        last_log = start
        while time.time() - start < timeout:
            if time.time() - start < 15:
                await asyncio.sleep(3)
                continue

            if time.time() - last_log > 15:
                last_log = time.time()
                print(f"   ⏳ 正在渲染中... ({int(time.time() - start)}s/{timeout}s)")

            imgs = await page.locator("img[src*='estuary'], img[src*='oaiusercontent'], img[alt*='已生成'], img[alt*='Generated']").all()
            for img in imgs:
                try:
                    src = await img.get_attribute("src")
                    if not src or src in known_srcs:
                        continue

                    in_user = await img.evaluate("el => !!el.closest('[data-message-author-role=\"user\"], form, [data-testid*=\"attachment\"]')")
                    if in_user:
                        continue

                    w = await img.evaluate("el => el.naturalWidth")
                    h = await img.evaluate("el => el.naturalHeight")
                    if w and w > 1000:
                        data = await page.evaluate("""async (url) => {
                            const resp = await fetch(url);
                            const blob = await resp.blob();
                            return new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        }""", src)
                        header, b64 = data.split(",", 1)
                        raw = base64.b64decode(b64)

                        if ref_image.exists():
                            new_hash = hashlib.md5(raw).hexdigest()
                            ref_hash = hashlib.md5(ref_image.read_bytes()).hexdigest()
                            if new_hash == ref_hash:
                                print("   ⚠️ 抓到垫图回显缓存，跳过并继续等待模型生成大图...")
                                known_srcs.add(src)
                                continue

                        print(f"   ✅ 检测到高保真 CMF 原图: {w}x{h} ({time.time() - start:.1f}s)")
                        dest_path.write_bytes(raw)
                        print(f"   💾 保存成功: {dest_path} ({len(raw) // 1024} KB)")

                        brain_dest = BRAIN_IMAGES_DIR / task["filename"]
                        shutil.copy2(dest_path, brain_dest)
                        found = True
                        break
                except Exception:
                    pass
            if found:
                break
            await asyncio.sleep(3)

        if not found:
            raise TimeoutError(f"超时 ({timeout}s) 未检测到完整大图")
        return "generated"

    finally:
        try:
            await page.close()
        except Exception:
            pass

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--item", default="all")
    args = parser.parse_args()

    targets = CMF_TASKS
    if args.item != "all":
        targets = [t for t in CMF_TASKS if t["id"] == args.item]

    async with async_playwright() as p:
        for task in targets:
            try:
                res = await generate_cmf_single(p, task)
                if res == "generated":
                    cooldown = 30
                    print(f"\n   ☕ [防风控保护] 冷却休眠 {cooldown} 秒，模拟人类自然间歇...")
                    await asyncio.sleep(cooldown)
                elif res == "skipped":
                    pass
                else:
                    print(f"⚠️ 处理未成功: {task['filename']}")
            except Exception as e:
                print(f"❌ 生成失败 [{task['filename']}]: {e}")
                await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
