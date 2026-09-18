#!/usr/bin/env python3
"""
Rock-solid Batch Generator for 3D Modeling Angle Views.
Opens a clean new tab per generation, uses div#prompt-textarea,
and extracts the final full-resolution 1536x1024 estuary PNG.
"""
import asyncio
import argparse
import base64
import os
import shutil
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = os.environ.get("GPT_IMAGE_CDP_URL", "http://127.0.0.1:9333")
BRAIN_IMAGES_DIR = Path("/Users/papazed/.gemini/antigravity/brain/095f0e24-6f5a-4ad7-b980-db9809fbc7c9/images")
BRAIN_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

SCHEMES = {
    "s01": {
        "name": "Scheme 01 · 壳甲小旅人 (Hermit Lychee)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_01_hermit"),
        "views": [
            ("s01_01_front", "01_front.png", "正视图 (Front Orthographic)"),
            ("s01_02_side", "02_side_three_quarter.png", "45度侧景透视 (Side & 3/4 View)"),
            ("s01_03_back", "03_back.png", "正背视图 (Back View)"),
            ("s01_04_macro", "04_macro_joint.png", "壳肉咬合微距 (Macro & CMF Joint)"),
            ("s01_05_retracted", "05_transform_retracted.png", "完全缩壳状态 (Full Retraction Transform)"),
        ]
    },
    "s02": {
        "name": "Scheme 02 · 双开甲翼 (Winged Sprite)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_02_wings"),
        "views": [
            ("s02_01_front", "01_front.png", "正视图 (Front Orthographic - Wings Closed)"),
            ("s02_02_side", "02_side_profile.png", "45度侧视图与转轴结构 (Side & Pivot View)"),
            ("s02_03_back", "03_back_closed.png", "背面翅鞘闭合 (Back View - Closed Wings)"),
            ("s02_04_flight", "04_wings_spread_flight.png", "双翼展开飞行姿态 (Spread Wings Flight)"),
            ("s02_05_macro", "05_wing_joint_macro.png", "翅轴微距与材质拆解 (Wing Joint Macro & CMF)"),
        ]
    },
    "s04": {
        "name": "Scheme 04 · 东方仙童 (Celestial Spirit)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_04_celestial"),
        "views": [
            ("s04_01_front", "01_front.png", "正立姿视图 (Front Orthographic)"),
            ("s04_02_side", "02_side_three_quarter.png", "45度侧景透视 (Side & 3/4 View)"),
            ("s04_03_back", "03_back.png", "背面云肩图腾 (Back View)"),
            ("s04_04_seated", "04_seated_lotus.png", "盘坐持枝定妆照 (Seated Lotus Meditation)"),
            ("s04_05_macro", "05_crown_cloud_macro.png", "冠冕云肩微距 (Crown & Collar Macro)"),
        ]
    }
}

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_3d_angles")

async def generate_single(playwright, scheme_key, prompt_id, filename, label, out_dir):
    dest_path = out_dir / filename
    if dest_path.exists() and dest_path.stat().st_size > 500_000:
        print(f"⏩ [{scheme_key} - {filename}] 已存在 ({dest_path.stat().st_size // 1024} KB)，跳过。")
        return True

    prompt_file = PROMPTS_DIR / f"{prompt_id}.txt"
    if not prompt_file.exists():
        print(f"❌ 提示词文件不存在：{prompt_file}")
        return False

    raw_prompt = prompt_file.read_text(encoding="utf-8").strip()
    full_prompt = f"{raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

    print(f"\n{'='*70}")
    print(f"🚀 开始生成: [{scheme_key}] {label} -> {filename}")
    print(f"{'='*70}")

    browser = await playwright.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0]
    page = await context.new_page()

    try:
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(2)

        # Wait for composer
        composer = page.locator("#prompt-textarea").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(full_prompt)
        await asyncio.sleep(1)

        # Click send or press Enter
        await asyncio.sleep(1)
        send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
        submitted = False
        if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
            await send_btn.click()
            submitted = True
        
        if not submitted:
            await composer.press("Enter")
            await asyncio.sleep(1)

        # Check if submit succeeded by checking if stop button appears or prompt is cleared
        stop_btn = page.locator("button[aria-label*='停止'], button[aria-label*='Stop'], button[data-testid='stop-button']")
        for _ in range(5):
            if await stop_btn.count() > 0 and await stop_btn.is_visible():
                submitted = True
                break
            await asyncio.sleep(1)

        if not submitted:
            # Try Enter once more
            await composer.press("Enter")

        print("   ⏳ 提示词已提交，等待大图生成...")

        start = time.time()
        timeout = 240
        found = False
        last_log = start
        while time.time() - start < timeout:
            if time.time() - last_log > 15:
                last_log = time.time()
                print(f"   ⏳ 正在渲染中... ({int(time.time() - start)}s/{timeout}s)")

            imgs = await page.locator("img[src*='estuary'], img[src*='oaiusercontent'], img[alt*='已生成'], img[alt*='Generated']").all()
            for img in imgs:
                try:
                    w = await img.evaluate("el => el.naturalWidth")
                    h = await img.evaluate("el => el.naturalHeight")
                    src = await img.get_attribute("src")
                    if w and w > 1000 and src:
                        print(f"   ✅ 检测到高保真原图: {w}x{h} ({time.time() - start:.1f}s)")
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
                        dest_path.write_bytes(raw)
                        print(f"   💾 保存成功: {dest_path} ({len(raw) // 1024} KB)")

                        brain_dest = BRAIN_IMAGES_DIR / f"{scheme_key}_{filename}"
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
        return True

    finally:
        try:
            await page.close()
        except Exception:
            pass

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scheme", choices=["s01", "s02", "s04", "all"], default="all", help="要生成的方案")
    args = parser.parse_args()

    schemes_to_run = ["s01", "s02", "s04"] if args.scheme == "all" else [args.scheme]

    async with async_playwright() as p:
        for s_key in schemes_to_run:
            s_data = SCHEMES[s_key]
            out_dir = s_data["out_dir"]
            out_dir.mkdir(parents=True, exist_ok=True)
            print(f"\n=======================================================")
            print(f"🌟 方案处理: {s_data['name']}")
            print(f"=======================================================")
            for prompt_id, filename, label in s_data["views"]:
                ok = await generate_single(p, s_key, prompt_id, filename, label, out_dir)
                if not ok:
                    print(f"⚠️ 生成未成功: {filename}")
                await asyncio.sleep(4)

if __name__ == "__main__":
    asyncio.run(main())
