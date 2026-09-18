#!/usr/bin/env python3
"""
Dedicated Batch Generator for Xuemu Quirky-Sketch 1:1 UI Icons & CMF Swatches.
Connects to live Chrome via CDP (http://127.0.0.1:9333), mounts reference images,
submits 1:1 quirky doodle prompts, and extracts pixel-perfect PNG assets.
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

WORKSPACE_ROOT = Path("/Users/papazed/dev/threejs-material-lab")
MORPHOLOGY_DIR = WORKSPACE_ROOT / "assets" / "icons" / "morphology"
CMF_DIR = WORKSPACE_ROOT / "assets" / "icons" / "cmf"

MORPHOLOGY_DIR.mkdir(parents=True, exist_ok=True)
CMF_DIR.mkdir(parents=True, exist_ok=True)

TASKS = [
    # ── 1. Morphology Space (3 items) ─────────────────────────────────────────
    {
        "id": "badge_hoodie_open",
        "category": "形态空间",
        "label": "萌颜日常态 · 荔小卫 (Hoodie Open)",
        "dest_path": MORPHOLOGY_DIR / "badge_hoodie_open.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "canonical_hoodie_hoodon.png",
        "brain_name": "quirky_badge_hoodie_open.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: The cute mascot character peeking out happily from an oversized red textured lychee peel hoodie (100% hood on).\n"
            "Round translucent jade-white face with big glossy round black eyes, subtle pink blush, cheerful healing smile.\n"
            "Hands holding two fresh green fruit-stem drawstrings in front of chest. Single curved green leaf on top of the hoodie head.\n"
            "Minimalist hand-drawn doodle lines, soft red lychee peel color accent, soft green accents on drawstrings and leaf, strictly matching the attached reference character.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading, no PPT infographic.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "badge_hoodie_closed",
        "category": "形态空间",
        "label": "锁进果实态 · 荔小卫 (Hoodie Closed)",
        "dest_path": MORPHOLOGY_DIR / "badge_hoodie_closed.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "closed_fruit_front_clean.png",
        "brain_name": "quirky_badge_hoodie_closed.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: The cute mascot character completely curled up and cocooned inside a round red textured lychee fruit, resting and asleep in closed fruit state.\n"
            "The hoodie is completely zipped and closed into a full plump lychee fruit sphere. Two cute little hands tightly gripping two green drawstrings at the front seam. Single curved green leaf standing on top stem.\n"
            "Expressive rough sketch, wobbly black ink contours, soft red lychee shell texture accent, quiet peaceful sleeping vibe, strictly matching the attached reference image.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading, no PPT infographic.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "badge_astro",
        "category": "形态空间",
        "label": "探索宇航态 · 荔小星 (Astro Explorer)",
        "dest_path": MORPHOLOGY_DIR / "badge_astro.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "canonical_astro_front.png",
        "brain_name": "quirky_badge_astro.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: The cute astronaut mascot character wearing a round panoramic space exploration helmet visor.\n"
            "Cute smiling jade face visible through the clear bubble helmet, communication antenna beacon on top, compact explorer life-support backpack.\n"
            "Wobbly hand-drawn black ink linework, soft cyan/blue accent on visor reflection, subtle star doodle accents in whitespace, strictly matching the attached reference astronaut mascot.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading, no PPT infographic.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },

    # ── 2. CMF Material Workshop (6 items) ────────────────────────────────────
    {
        "id": "swatch_rind_jade",
        "category": "材质工坊",
        "label": "01 果壳白玉 · Rind & Jade",
        "dest_path": CMF_DIR / "swatch_rind_jade.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "01_white_jade.png",
        "brain_name": "quirky_swatch_rind_jade.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: Material swatch concept representing 'Rind & White Jade' (果壳白玉).\n"
            "A charmingly simplified, hand-drawn peeled lychee fruit: a wobbly red bumpy textured outer shell opening to reveal a warm, smooth, translucent mutton-fat white jade fruit core, with gentle hand-drawn ink texture dots.\n"
            "Expressive doodle sketch, wobbly lines, soft muted red rind accent and warm jade white tone, strictly referencing the attached CMF material.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "swatch_corduroy",
        "category": "材质工坊",
        "label": "02 暖绒灯芯 · Wool Corduroy",
        "dest_path": CMF_DIR / "swatch_corduroy.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "cmf_materials" / "01_hoodie_wool_corduroy.png",
        "brain_name": "quirky_swatch_corduroy.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: Material swatch concept representing 'Wool Corduroy' (暖绒灯芯).\n"
            "A cozy hand-drawn textile swatch block showing warm vintage terracotta brick-red corduroy fabric with distinct vertical wales (ribbed ridges) and soft needle-punched wool felt fuzzy edges.\n"
            "Expressive sketch lines depicting tactile fabric ribs, soft warm brick-red fill with warm white paper contrast, strictly referencing the attached CMF material.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "swatch_cinnabar",
        "category": "材质工坊",
        "label": "03 朱砂凝玉 · Cinnabar Lacquer",
        "dest_path": CMF_DIR / "swatch_cinnabar.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "cmf_materials" / "02_hoodie_cinnabar_jade.png",
        "brain_name": "quirky_swatch_cinnabar.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: Material swatch concept representing 'Cinnabar Carved Lacquer & Jade' (朱砂凝玉).\n"
            "A hand-drawn artistic oriental lacquer medallion or swatch: deep cinnabar vermilion red carved lacquer with delicate wobbly scrollwork wave patterns, adorned with tiny flecks of 24K gold foil flakes and a warm translucent jade accent.\n"
            "Expressive black ink doodle lines, rich cinnabar red accent, subtle gold glint speckles, strictly referencing the attached CMF material.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "swatch_titanium",
        "category": "材质工坊",
        "label": "04 全息钛银 · Holographic Titanium",
        "dest_path": CMF_DIR / "swatch_titanium.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "cmf_materials" / "03_astro_holographic_titanium.png",
        "brain_name": "quirky_swatch_titanium.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: Material swatch concept representing 'Holographic Brushed Titanium' (全息钛银).\n"
            "A hand-drawn aerospace metallic plate with fine wobbly brushed metal hatchings, shimmering with subtle iridescent rainbow spectral highlights (soft cyan, purple, yellow sheen) from thin-film interference.\n"
            "Minimalist black ink line art, metallic brush texture hatching, delicate iridescent chromatic pastel rainbow touches, strictly referencing the attached CMF material.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "swatch_crystal",
        "category": "材质工坊",
        "label": "05 光学水晶 · Optic Crystal",
        "dest_path": CMF_DIR / "swatch_crystal.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "cmf_materials" / "04_astro_optic_crystal.png",
        "brain_name": "quirky_swatch_crystal.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: Material swatch concept representing 'Optic Crystal & Ice Glass' (光学水晶).\n"
            "A hand-drawn faceted geometric optical crystal glass sphere or prism, transparent and pure, with crisp angular wobbly ink facets refracting subtle light rays and a gentle ice-blue translucent tint.\n"
            "Clean minimalist ink lines, clear refractive geometric angles, soft ice-blue highlight, strictly referencing the attached CMF material.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    },
    {
        "id": "swatch_obsidian",
        "category": "材质工坊",
        "label": "06 曜石黑金 · Obsidian Gold",
        "dest_path": CMF_DIR / "swatch_obsidian.png",
        "ref_image": WORKSPACE_ROOT / "design_sheets" / "cmf_materials" / "05_hermit_amber_leather.png",
        "brain_name": "quirky_swatch_obsidian.png",
        "prompt": (
            "Quirky hand-drawn doodle illustration, Xuemu quirky-sketch style, 1:1 square aspect ratio.\n"
            "Clean pure white paper background, wobbly black ink outline, generous whitespace, minimalist editorial doodle aesthetic.\n"
            "Subject: Material swatch concept representing 'Obsidian Mirror & Imperial Gold' (曜石黑金).\n"
            "A hand-drawn volcanic obsidian stone tablet or cabochon with deep glossy black ink body, sharp mirror-edge facets, framed by a noble rim of 24K imperial gold hand-drawn linework and glints.\n"
            "Striking contrast between deep black ink and elegant gold metallic accent lines on pure white paper, strictly referencing the attached CMF material.\n"
            "No photorealism, no 3D render, no glossy CGI, no dark background, no complex gradient shading.\n\n"
            "Canvas requirement: generate exactly one image in native 1:1 aspect ratio. Do not add borders, blurred margins, vignette, or padding."
        )
    }
]

async def generate_task(playwright, task, force=False):
    dest_path = task["dest_path"]
    brain_path = BRAIN_IMAGES_DIR / task["brain_name"]

    # We only skip if it's a freshly generated file that's already in the brain directory
    if not force and dest_path.exists() and brain_path.exists() and dest_path.stat().st_size > 100_000:
        print(f"⏩ [{task['category']} - {task['label']}] 目标已就绪 ({dest_path.stat().st_size // 1024} KB)，跳过。", flush=True)
        return True

    print("\n" + "=" * 75, flush=True)
    print(f"🚀 开始生成 1:1 怪诞手绘 UI 资产: [{task['category']}] {task['label']}", flush=True)
    print(f"   目标落盘: {dest_path}", flush=True)
    print(f"   📎 垫图母本: {task['ref_image'].name} ({task['ref_image'].stat().st_size // 1024} KB)", flush=True)
    print("=" * 75, flush=True)

    browser = await playwright.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0]

    # Find or open ChatGPT tab
    chat_pages = [p for p in context.pages if "chatgpt" in p.url]
    if chat_pages:
        page = chat_pages[0]
        await page.bring_to_front()
    else:
        page = await context.new_page()
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)

    try:
        # Open clean chat session
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

        # 1. Mount Reference Image (图生图垫图)
        if task["ref_image"].exists():
            upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
            await upload_input.set_input_files(str(task["ref_image"]))
            print(f"   📤 已挂载垫图母本: {task['ref_image'].name}，等待上传解析...", flush=True)
            await asyncio.sleep(6)
            for wait_i in range(14):
                busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                if busy == 0:
                    print(f"   ✅ 垫图稳定就绪 (耗时 {wait_i + 6}s)", flush=True)
                    break
                await asyncio.sleep(1)
            await asyncio.sleep(2)

        # 2. Fill in the Prompt
        composer = page.locator("#prompt-textarea, textarea[tabindex='0'], div[contenteditable='true']").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(task["prompt"])
        print("   ⏳ 提示词已注入输入框，等待发送按钮就绪...", flush=True)
        await asyncio.sleep(2)

        # 3. Submit
        send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
        submitted = False
        for _ in range(12):
            if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
                await send_btn.click()
                submitted = True
                print("   📨 发送按钮就绪并点击提交！", flush=True)
                break
            await asyncio.sleep(1)

        if not submitted:
            await composer.press("Enter")
            print("   📨 回车提交！", flush=True)
            await asyncio.sleep(2)

        # Record pre-existing image sources
        known_srcs = set()
        for pre_img in await page.locator("img").all():
            try:
                s = await pre_img.get_attribute("src")
                if s:
                    known_srcs.add(s)
            except Exception:
                pass

        print("   ⏳ 任务已提交，进入 1:1 怪诞手绘渲染监听流水线...", flush=True)

        # 4. Wait for generation & extract full-res image
        start = time.time()
        timeout = 260
        found = False
        last_log = start

        while time.time() - start < timeout:
            if time.time() - start < 15:
                await asyncio.sleep(3)
                continue

            if time.time() - last_log > 15:
                last_log = time.time()
                print(f"   ⏳ 正在渲染中... ({int(time.time() - start)}s/{timeout}s)", flush=True)

            # Auto-retry button check
            err_count = await page.locator("button:has-text('重试'), button:has-text('Retry')").count()
            if err_count > 0:
                print("   ⚠️ 检测到重试按钮，自动点击重新触发...", flush=True)
                await page.locator("button:has-text('重试'), button:has-text('Retry')").first.click()
                await asyncio.sleep(5)

            imgs = await page.locator("img[src*='estuary'], img[src*='oaiusercontent'], img[alt*='已生成'], img[alt*='Generated'], article img").all()
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
                    if w and w >= 800:
                        b64 = await img.evaluate('''async (el) => {
                            const resp = await fetch(el.src);
                            const blob = await resp.blob();
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        }''')
                        raw = base64.b64decode(b64)

                        if task["ref_image"].exists():
                            new_hash = hashlib.md5(raw).hexdigest()
                            ref_hash = hashlib.md5(task["ref_image"].read_bytes()).hexdigest()
                            if new_hash == ref_hash:
                                print("   ⚠️ 抓到垫图原图回显，跳过并继续等待生成模型大图...", flush=True)
                                known_srcs.add(src)
                                continue

                        print(f"   ✅ 捕获到全新 1:1 怪诞手绘图: {w}x{h} ({time.time() - start:.1f}s)", flush=True)
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        dest_path.write_bytes(raw)
                        file_kb = len(raw) // 1024
                        print(f"   💾 成功落盘: {dest_path} ({file_kb} KB, MD5: {hashlib.md5(raw).hexdigest()[:10]})", flush=True)

                        shutil.copy2(dest_path, brain_path)
                        print(f"   📋 镜像至 Brain 归档: {brain_path.name}", flush=True)
                        found = True
                        break
                except Exception as eval_err:
                    pass

            if found:
                break
            await asyncio.sleep(3)

        if not found:
            print(f"❌ [{task['label']}] 绘图超时，未捕获到 1:1 大图。", flush=True)
            return False

        # Brief cooling delay between jobs
        print("   ❄️ 任务完成，冷却缓冲 10s...", flush=True)
        await asyncio.sleep(10)
        return True

    except Exception as e:
        print(f"❌ 运行异常: {e}", flush=True)
        return False

async def main():
    parser = argparse.ArgumentParser(description="Batch generate Xuemu Quirky-Sketch 1:1 UI assets")
    parser.add_argument("--single", help="Run a specific task ID (e.g. badge_hoodie_open)")
    parser.add_argument("--force", action="store_true", help="Force overwrite existing files")
    args = parser.parse_args()

    async with async_playwright() as p:
        tasks_to_run = TASKS
        if args.single:
            tasks_to_run = [t for t in TASKS if t["id"] == args.single]
            if not tasks_to_run:
                print(f"❌ 找不到指定任务: {args.single}")
                print(f"可用任务: {[t['id'] for t in TASKS]}")
                return

        total = len(tasks_to_run)
        success_count = 0
        print(f"🎯 开始执行怪诞手绘 UI 资产生成流水线，共 {total} 项任务。")

        for idx, t in enumerate(tasks_to_run, 1):
            print(f"\n[{idx}/{total}] 进度准备: {t['label']}")
            ok = await generate_task(p, t, force=args.force)
            if ok:
                success_count += 1
            else:
                print(f"⚠️ 任务 {t['id']} 未成功，继续后续任务...")

        print("\n" + "=" * 75)
        print(f"🎉 流水线执行完毕！成功: {success_count}/{total}")
        print("=" * 75)

if __name__ == "__main__":
    asyncio.run(main())
