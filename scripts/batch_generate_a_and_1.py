#!/usr/bin/env python3
"""
Robust Batch Generator for Schemes A (Hoodie) & Scheme 1 (Hermit).
Employs battle-tested upload and wait pipelines from batch_generate_cmf.py.
Maintains strict 100% visual consistency via reference image padding.
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
BRAIN_IMAGES_DIR = Path("/Users/papazed/.gemini/antigravity/brain/095f0e24-6f5a-4ad7-b980-db9809fbc7c9/images")
BRAIN_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

REF_HOODIE = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_hoodie_hoodon.png")
REF_HERMIT = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_hermit_traveler.png")

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ad")

SCHEMES = {
    "sa": {
        "name": "Scheme A · 荔小卫 (Hoodie Lychee)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_a_hoodie"),
        "ref_image": REF_HOODIE,
        "brain_prefix": "sa",
        "views": [
            ("sa_01_front", "01_front.png", "正平视基准视图 (Front Orthographic)"),
            ("sa_02_side", "02_side_three_quarter.png", "45度侧景立体透视 (Side & 3/4 View)"),
            ("sa_03_back", "03_back.png", "正背部结构拓扑 (Back View)"),
            ("sa_04_macro", "04_macro_joint.png", "材质分件与边缘微距拆解 (Macro Joint & CMF)"),
            ("sa_05_action", "05_action.png", "招牌变身：抽绳收口变身荔枝 (Signature Action)"),
        ]
    },
    "s01": {
        "name": "Scheme 1 · 壳甲小旅人 (Hermit Lychee)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_01_hermit"),
        "ref_image": REF_HERMIT,
        "brain_prefix": "s01",
        "views": [
            ("s01_01_front", "01_front.png", "正平视基准视图 (Front Orthographic)"),
            ("s01_02_side", "02_side_three_quarter.png", "45度侧景行进透视 (Side Walking View)"),
            ("s01_03_back", "03_back.png", "背部果壳结构拓扑 (Back View)"),
            ("s01_04_macro", "04_macro_joint.png", "材质分件与咬合微距拆解 (Macro Joint & CMF)"),
        ]
    }
}

# Hashes of known freshly generated valid views to avoid unnecessary re-renders
DONE_HASHES = {
    "sa_01_front.png": "b4ef46f8cd",
    "sa_02_side_three_quarter.png": "7189c80d78",
    "sa_03_back.png": "66985c2169",
    "sa_04_macro_joint.png": "f742dd3410",
    "sa_05_action.png": "352e9358db",
    "s01_01_front.png": "22eee60dbf",
    "s01_02_side_three_quarter.png": "18ba507001",
    "s01_03_back.png": "0969ed1d38",
}

async def generate_view_robust(playwright, scheme_key, prompt_id, filename, label, out_dir, ref_image, brain_prefix, force=False):
    dest_path = out_dir / filename
    done_key = f"{scheme_key}_{filename}"

    if not force and dest_path.exists() and dest_path.stat().st_size > 500_000:
        cur_hash = hashlib.md5(dest_path.read_bytes()).hexdigest()
        if done_key in DONE_HASHES and cur_hash.startswith(DONE_HASHES[done_key]):
            print(f"⏩ [{scheme_key} - {filename}] 今日已生成就绪 ({dest_path.stat().st_size // 1024} KB)，跳过。", flush=True)
            return True

    prompt_file = PROMPTS_DIR / f"{prompt_id}.txt"
    if not prompt_file.exists():
        print(f"❌ 提示词文件不存在: {prompt_file}", flush=True)
        return False

    raw_prompt = prompt_file.read_text(encoding="utf-8").strip()
    full_prompt = f"{raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

    print(f"\n{'='*70}", flush=True)
    print(f"🚀 开始生成: [{scheme_key}] {label} -> {filename}", flush=True)
    print(f"   📎 [垫图绝对锚定] 挂载母本: {ref_image.name} ({ref_image.stat().st_size // 1024} KB)", flush=True)
    print(f"{'='*70}", flush=True)

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
            print(f"   📤 已挂载垫图母本: {ref_image.name}，等待 8s 稳定...", flush=True)
            await asyncio.sleep(8)
            for wait_i in range(12):
                busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                if busy == 0:
                    print(f"   ✅ 垫图上传稳定就绪 (耗时 {wait_i + 8}s)", flush=True)
                    break
                await asyncio.sleep(1)
            await asyncio.sleep(2)

        # Wait for composer and fill prompt
        composer = page.locator("#prompt-textarea").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(full_prompt)
        print("   ⏳ 提示词已填入，缓冲 3s 等待按钮就绪...", flush=True)
        await asyncio.sleep(3)

        # Submit
        send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
        submitted = False
        for _ in range(12):
            if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
                await send_btn.click()
                submitted = True
                print("   📨 确认发送按钮激活并点击提交！", flush=True)
                break
            await asyncio.sleep(1)

        if not submitted:
            await composer.press("Enter")
            print("   📨 回车提交！", flush=True)
            await asyncio.sleep(2)

        # Snapshot known image sources to avoid false positives
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

        print("   ⏳ 提示词与母本垫图已正式提交，进入高保真渲染监控...", flush=True)

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
                print(f"   ⏳ 正在渲染中... ({int(time.time() - start)}s/{timeout}s)", flush=True)

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
                                print("   ⚠️ 抓到垫图回显缩略图，跳过并继续等待模型生成大图...", flush=True)
                                known_srcs.add(src)
                                continue

                        print(f"   ✅ 检测到全新高保真原图: {w}x{h} ({time.time() - start:.1f}s)", flush=True)
                        dest_path.write_bytes(raw)
                        print(f"   💾 保存成功: {dest_path} ({len(raw) // 1024} KB, MD5: {hashlib.md5(raw).hexdigest()[:10]})", flush=True)

                        brain_dest = BRAIN_IMAGES_DIR / f"{brain_prefix}_{filename}"
                        shutil.copy2(dest_path, brain_dest)
                        print(f"   📋 已镜像至 Brain: {brain_dest.name}", flush=True)
                        found = True
                        break
                except Exception:
                    pass

            if found:
                break
            await asyncio.sleep(3)

        if not found:
            print(f"❌ [{filename}] 绘图超时，未捕获到大图。", flush=True)
            return False

        return True

    except Exception as e:
        print(f"❌ 运行异常: {e}", flush=True)
        return False
    finally:
        await page.close()

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scheme", choices=["sa", "s01", "all"], default="all")
    parser.add_argument("--view", type=str, default=None)
    parser.add_argument("--force", action="store_true", default=False)
    args = parser.parse_args()

    schemes_to_run = [args.scheme] if args.scheme != "all" else ["sa", "s01"]

    async with async_playwright() as playwright:
        for s_key in schemes_to_run:
            conf = SCHEMES[s_key]
            print(f"\n{'#'*70}", flush=True)
            print(f"🔥 正在处理方案: {conf['name']}", flush=True)
            print(f"{'#'*70}", flush=True)

            for prompt_id, filename, label in conf["views"]:
                if args.view and args.view not in filename:
                    continue

                success = await generate_view_robust(
                    playwright,
                    s_key,
                    prompt_id,
                    filename,
                    label,
                    conf["out_dir"],
                    conf["ref_image"],
                    conf["brain_prefix"],
                    force=args.force
                )

                if success:
                    print(f"⏳ 遵照防风控规范，强制安全冷却 30 秒 (Single-thread cool down)...", flush=True)
                    await asyncio.sleep(30)
                else:
                    print(f"⚠️ 生成未完成，冷却 15 秒后继续...", flush=True)
                    await asyncio.sleep(15)

if __name__ == "__main__":
    asyncio.run(main())
