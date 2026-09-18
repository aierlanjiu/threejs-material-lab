#!/usr/bin/env python3
"""
Batch Generator for Schemes A & D with Reference Image Padding (垫图)
Ensures 100% character visual consistency across all 5 angle views.
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

SCHEMES = {
    "sa": {
        "name": "Scheme A · 荔小卫 (Hoodie Lychee)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_a_hoodie"),
        "views": [
            ("sa_01_front", "01_front.png", "正平视基准视图 (Front Orthographic)", False),
            ("sa_02_side", "02_side_three_quarter.png", "45度侧景立体透视 (Side & 3/4 View)", True),
            ("sa_03_back", "03_back.png", "背部结构拓扑 (Back View)", True),
            ("sa_04_macro", "04_macro_joint.png", "材质分件与边缘微距拆解 (Macro Joint & CMF)", True),
            ("sa_05_action", "05_action.png", "招牌交互：兜帽脱戴与变身 (Signature Action)", True),
        ]
    },
    "sd": {
        "name": "Scheme D · 荔小星 (Astro-Lychee)",
        "out_dir": Path("/Users/papazed/dev/threejs-material-lab/design_sheets/scheme_d_astro"),
        "views": [
            ("sd_01_front", "01_front.png", "正平视基准视图 (Front Orthographic)", False),
            ("sd_02_side", "02_side_three_quarter.png", "45度侧景立体透视 (Side & 3/4 View)", True),
            ("sd_03_back", "03_back.png", "背部宇航背包拓扑 (Back View)", True),
            ("sd_04_macro", "04_macro_joint.png", "面罩密封圈与果壳微距拆解 (Visor Seal & CMF Macro)", True),
            ("sd_05_action", "05_action.png", "招牌动作：零重力太空漫游 (Zero-G Space Floating)", True),
        ]
    }
}

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ad")
KNOWN_BAD_HASHES = {
    "efe7bea9f65b30b8f28c0f65f030cd95",  # Scheme A 垫图回显哈希
    "40ee59d5046ef551527374a3b0052c6b",  # Scheme D 垫图回显哈希
    "7bca4f0fd056b5b1e6a7b811f0302fc0",  # Scheme A 旧版脱帽动作图（需优化为拉绳闭合变身）
}

async def generate_single(playwright, scheme_key, prompt_id, filename, label, out_dir, needs_padding):
    dest_path = out_dir / filename
    front_ref_path = out_dir / "01_front.png"
    if dest_path.exists() and dest_path.stat().st_size > 500_000:
        if filename == "01_front.png":
            print(f"⏩ [{scheme_key} - {filename}] 基准正视图已就绪 ({dest_path.stat().st_size // 1024} KB)，予以锁定保留。")
            return "skipped"
        elif front_ref_path.exists() and front_ref_path.stat().st_size > 500_000:
            front_hash = hashlib.md5(front_ref_path.read_bytes()).hexdigest()
            dest_hash = hashlib.md5(dest_path.read_bytes()).hexdigest()
            if front_hash == dest_hash or dest_hash in KNOWN_BAD_HASHES:
                print(f"🔄 [{scheme_key} - {filename}] 检测到为基准参考图副本或已知回显缓存，即将重新生成覆盖...")
            else:
                print(f"⏩ [{scheme_key} - {filename}] 已存在独立视角大图 ({dest_path.stat().st_size // 1024} KB)，跳过。")
                return "skipped"
        else:
            return "skipped"

    prompt_file = PROMPTS_DIR / f"{prompt_id}.txt"
    if not prompt_file.exists():
        print(f"❌ 提示词文件不存在：{prompt_file}")
        return False

    raw_prompt = prompt_file.read_text(encoding="utf-8").strip()
    full_prompt = f"{raw_prompt}\n\nCanvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."

    front_ref_path = out_dir / "01_front.png"

    print(f"\n{'='*70}")
    print(f"🚀 开始生成: [{scheme_key}] {label} -> {filename}")
    if needs_padding:
        print(f"   📎 [垫图启用] 绑定基准参考图: {front_ref_path}")
    print(f"{'='*70}")

    browser = await playwright.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0]
    page = await context.new_page()

    try:
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(2)

        # If padding is needed, upload front reference image first
        if needs_padding:
            if not front_ref_path.exists() or front_ref_path.stat().st_size < 500_000:
                print(f"   ⚠️ 警告: 基准参考图 {front_ref_path} 尚未就绪，跳过垫图绑定。")
            else:
                try:
                    upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
                    await upload_input.set_input_files(str(front_ref_path))
                    print(f"   📤 已挂载基准参考图: {front_ref_path.name}")
                    print("   ⏳ 正在等待图像上传并完全稳定 (设置充分延时 8s+ 检测)...")
                    await asyncio.sleep(8)

                    # 动态检测上传加载状态（防止大图处理中未就绪）
                    for wait_i in range(12):
                        busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
                        if busy == 0:
                            print(f"   ✅ 图像上传已就绪并完成渲染准备 (耗时 {wait_i + 8}s)")
                            break
                        await asyncio.sleep(1)
                    await asyncio.sleep(2)  # 额外稳定缓冲
                except Exception as e:
                    print(f"   ⚠️ 上传基准图出错: {e}")

        # Wait for composer
        composer = page.locator("#prompt-textarea").first
        await composer.wait_for(state="visible", timeout=25000)
        await composer.click()
        await composer.fill(full_prompt)
        print("   ⏳ 提示词已填入，等待 3s 缓冲...")
        await asyncio.sleep(3)

        # Wait for send button to be enabled
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

        # Check if submit succeeded by checking if stop button appears or prompt is cleared
        stop_btn = page.locator("button[aria-label*='停止'], button[aria-label*='Stop'], button[data-testid='stop-button']")
        for _ in range(8):
            if await stop_btn.count() > 0 and await stop_btn.is_visible():
                submitted = True
                break
            await asyncio.sleep(1)

        if not submitted:
            # Try Enter once more
            await composer.press("Enter")
            await asyncio.sleep(2)

        # 记录提交前页面上已存在的所有图片 URL（包括垫图预览）
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

        print("   ⏳ 提示词与基准图已成功提交，等待大图渲染生成...")

        start = time.time()
        timeout = 240
        found = False
        last_log = start
        while time.time() - start < timeout:
            # 严格门槛：AI 绘图至少需要 15 秒以上，前 15 秒绝不检查以防抓到本地上传缓冲图
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

                    # 排除位于用户消息或上传表单内的垫图
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

                        # 哈希绝对排重：确保抓取的二进制与基准图或回显图不相同
                        if needs_padding and front_ref_path.exists():
                            new_hash = hashlib.md5(raw).hexdigest()
                            front_hash = hashlib.md5(front_ref_path.read_bytes()).hexdigest()
                            if new_hash == front_hash or new_hash in KNOWN_BAD_HASHES:
                                print("   ⚠️ 抓到基准参考图回显或黑名单缓存，跳过并继续等待模型生成大图...")
                                known_srcs.add(src)
                                continue

                        print(f"   ✅ 检测到全新生成的视角原图: {w}x{h} ({time.time() - start:.1f}s)")
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
        return "generated"

    finally:
        try:
            await page.close()
        except Exception:
            pass

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scheme", choices=["sa", "sd", "all"], default="all")
    args = parser.parse_args()

    targets = []
    if args.scheme == "all":
        targets = ["sa", "sd"]
    else:
        targets = [args.scheme]

    async with async_playwright() as p:
        for s_key in targets:
            scheme = SCHEMES[s_key]
            out_dir = scheme["out_dir"]
            out_dir.mkdir(parents=True, exist_ok=True)
            print(f"\n{'='*55}")
            print(f"🌟 方案处理: {scheme['name']}")
            print(f"{'='*55}")

            for prompt_id, filename, label, needs_padding in scheme["views"]:
                try:
                    res = await generate_single(p, s_key, prompt_id, filename, label, out_dir, needs_padding)
                    if res == "generated":
                        cooldown = 30
                        print(f"\n   ☕ [防风控保护] 冷却休眠 {cooldown} 秒，模拟人类操作自然间歇...")
                        await asyncio.sleep(cooldown)
                    elif res == "skipped":
                        pass
                    else:
                        print(f"⚠️ 处理未成功: {filename}")
                except Exception as e:
                    print(f"❌ 生成失败 [{filename}]: {e}")
                    await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
