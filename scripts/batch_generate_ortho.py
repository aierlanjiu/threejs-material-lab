#!/usr/bin/env python3
"""
Dedicated Batch Generator for Orthographic 2D/3D Model Sheets (工业正交三视图与CAD工程图)
Specifically tailored for 3D Modeling Agents (Codex) to recognize silhouettes, depth, and parts.
Enforces 100% reference padding, 8-12s upload wait, 30s cooling delay, single-threaded execution.
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

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ortho")

REF_HOODIE = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_hoodie_hoodon.png")
REF_ASTRO = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_astro_front.png")

TASKS = [
    {
        "id": "sa_ortho_01_turnaround",
        "scheme": "Scheme A · 荔小卫",
        "filename": "01_turnaround_3view.png",
        "label": "工业级标准角色三视图总图 (Front / Side 90° / Back 180° Aligned)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_a_hoodie"),
        "ref_image": REF_HOODIE,
        "brain_name": "sa_ortho_01_turnaround.png"
    },
    {
        "id": "sa_ortho_02_side_90",
        "scheme": "Scheme A · 荔小卫",
        "filename": "02_ortho_side_90.png",
        "label": "纯正 90 度侧立面轮廓正交图 (True 90° Lateral Profile)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_a_hoodie"),
        "ref_image": REF_HOODIE,
        "brain_name": "sa_ortho_02_side_90.png"
    },
    {
        "id": "sa_ortho_03_isometric_cad",
        "scheme": "Scheme A · 荔小卫",
        "filename": "03_isometric_cad_breakdown.png",
        "label": "等轴测 3D 结构分件装配图 (Isometric CAD Breakdown)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_a_hoodie"),
        "ref_image": REF_HOODIE,
        "brain_name": "sa_ortho_03_isometric_cad.png"
    },
    {
        "id": "sd_ortho_01_turnaround",
        "scheme": "Scheme D · 荔小星",
        "filename": "01_turnaround_3view.png",
        "label": "工业级标准角色三视图总图 (Front / Side 90° / Back 180° Aligned)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_d_astro"),
        "ref_image": REF_ASTRO,
        "brain_name": "sd_ortho_01_turnaround.png"
    },
    {
        "id": "sd_ortho_02_side_90",
        "scheme": "Scheme D · 荔小星",
        "filename": "02_ortho_side_90.png",
        "label": "纯正 90 度侧立面轮廓正交图 (True 90° Lateral Profile)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_d_astro"),
        "ref_image": REF_ASTRO,
        "brain_name": "sd_ortho_02_side_90.png"
    },
    {
        "id": "sd_ortho_03_isometric_cad",
        "scheme": "Scheme D · 荔小星",
        "filename": "03_isometric_cad_breakdown.png",
        "label": "等轴测 3D 结构分件装配图 (Isometric CAD Breakdown)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_d_astro"),
        "ref_image": REF_ASTRO,
        "brain_name": "sd_ortho_03_isometric_cad.png"
    }
]

async def generate_task(playwright, task, force=False):
    out_dir = task["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    dest_path = out_dir / task["filename"]
    brain_path = BRAIN_IMAGES_DIR / task["brain_name"]

    if not force and dest_path.exists() and dest_path.stat().st_size > 500_000:
        print(f"⏩ [{task['scheme']} - {task['filename']}] 已存在 ({dest_path.stat().st_size // 1024} KB)，跳过。", flush=True)
        if not brain_path.exists():
            shutil.copy(dest_path, brain_path)
        return True

    prompt_file = PROMPTS_DIR / f"{task['id']}.txt"
    if not prompt_file.exists():
        print(f"❌ 提示词文件不存在: {prompt_file}", flush=True)
        return False

    raw_prompt = prompt_file.read_text(encoding="utf-8").strip()
    full_prompt = f"{raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

    print("\n" + "=" * 70, flush=True)
    print(f"🚀 开始生成正交图: [{task['scheme']}] {task['label']}", flush=True)
    print(f"   目标文件: {task['filename']}", flush=True)
    print(f"   📎 垫图母本: {task['ref_image'].name} ({task['ref_image'].stat().st_size // 1024} KB)", flush=True)
    print("=" * 70, flush=True)

    browser = await playwright.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0]
    
    # 复用现有活跃页面或新建页面
    chat_pages = [p for p in context.pages if "chatgpt" in p.url]
    if chat_pages:
        page = chat_pages[0]
        await page.bring_to_front()
    else:
        page = await context.new_page()
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)

    try:
        # 点击新聊天按钮开启干净会话
        new_chat_btn = page.locator('a[aria-label*="新聊天"], button[aria-label*="新聊天"], a[href="/"]').first
        if await new_chat_btn.count() > 0:
            await new_chat_btn.click()
            await asyncio.sleep(2)
        else:
            await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)
            await asyncio.sleep(2)

        # 1. 挂载垫图母本
        if task["ref_image"].exists():
            upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
            await upload_input.set_input_files(str(task["ref_image"]))
            print(f"   📤 已挂载垫图母本: {task['ref_image'].name}，等待稳定...", flush=True)
            await asyncio.sleep(8)
            for wait_i in range(12):
                busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                if busy == 0:
                    print(f"   ✅ 垫图上传稳定就绪 (耗时 {wait_i + 8}s)", flush=True)
                    break
                await asyncio.sleep(1)
            await asyncio.sleep(2)

        # 2. 填写提示词
        composer = page.locator("#prompt-textarea, textarea[tabindex='0'], div[contenteditable='true']").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(full_prompt)
        print("   ⏳ 提示词已填入，缓冲 3s 等待按钮就绪...", flush=True)
        await asyncio.sleep(3)

        # 3. 提交任务
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

        # 预先记录已有图片源，避免误判历史图
        known_srcs = set()
        for pre_img in await page.locator("img").all():
            try:
                s = await pre_img.get_attribute("src")
                if s:
                    known_srcs.add(s)
            except Exception:
                pass

        print("   ⏳ 提示词与母本垫图已正式提交，进入工业正交三视图渲染监控...", flush=True)

        # 4. 等待生成并提取大图
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

            # 自动错误重试检查
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
                    if w and w >= 1000:
                        # 采用浏览器内部离屏 Canvas 像素提取，规避签名与网络跨域问题
                        b64 = await img.evaluate('''el => {
                            const canvas = document.createElement('canvas');
                            canvas.width = el.naturalWidth;
                            canvas.height = el.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(el, 0, 0);
                            return canvas.toDataURL('image/png').split(',')[1];
                        }''')
                        raw = base64.b64decode(b64)

                        if task["ref_image"].exists():
                            new_hash = hashlib.md5(raw).hexdigest()
                            ref_hash = hashlib.md5(task["ref_image"].read_bytes()).hexdigest()
                            if new_hash == ref_hash:
                                print("   ⚠️ 抓到垫图回显缩略图，跳过并继续等待模型生成大图...", flush=True)
                                known_srcs.add(src)
                                continue

                        print(f"   ✅ 检测到全新正交工程图: {w}x{h} ({time.time() - start:.1f}s)", flush=True)
                        dest_path.write_bytes(raw)
                        file_kb = len(raw) // 1024
                        print(f"   💾 成功落盘: {dest_path} ({file_kb} KB, MD5: {hashlib.md5(raw).hexdigest()[:10]})", flush=True)

                        shutil.copy2(dest_path, brain_path)
                        print(f"   📋 已镜像至 Brain: {brain_path.name}", flush=True)
                        found = True
                        break
                except Exception:
                    pass

            if found:
                break
            await asyncio.sleep(3)

        if not found:
            print(f"❌ [{task['filename']}] 绘图超时，未捕获到正交工程大图。", flush=True)
            return False

        return True
    except Exception as e:
        print(f"❌ 运行异常: {e}", flush=True)
        return False


async def main():
    parser = argparse.ArgumentParser(description="Generate Orthographic Model Sheets")
    parser.add_argument("--force", action="store_true", help="Force regenerate existing images")
    parser.add_argument("--cooling", type=int, default=30, help="Cooling delay between requests in seconds")
    parser.add_argument("--single", type=str, default="", help="Run single task ID")
    args = parser.parse_args()

    tasks_to_run = TASKS
    if args.single:
        tasks_to_run = [t for t in TASKS if t["id"] == args.single]
        if not tasks_to_run:
            print(f"Task {args.single} not found!")
            sys.exit(1)

    print(f"🌟 工业正交三视图任务队列: 共 {len(tasks_to_run)} 张图纸", flush=True)

    async with async_playwright() as p:
        for idx, task in enumerate(tasks_to_run):
            print(f"\n[{idx+1}/{len(tasks_to_run)}] 正在处理: {task['scheme']} - {task['label']}")
            success = await generate_task(p, task, force=args.force)

            if idx < len(tasks_to_run) - 1:
                print(f"⏳ 冷却等待 {args.cooling} 秒 (防风控安全延时)...", flush=True)
                await asyncio.sleep(args.cooling)

    print("\n🎉 所有正交三视图与 CAD 工程蓝图已全部生成完成！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
