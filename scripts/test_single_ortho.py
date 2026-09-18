#!/usr/bin/env python3
import asyncio
import base64
import hashlib
import os
import shutil
import time
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://127.0.0.1:9333"
REF_IMAGE = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/canonical_hoodie_hoodon.png")
OUT_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/ortho_blueprints/scheme_a_hoodie")
OUT_DIR.mkdir(parents=True, exist_ok=True)
DEST_PATH = OUT_DIR / "01_turnaround_3view.png"

PROMPT = """Generate an image: 3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", MODEL TURNAROUND 3-VIEW SHEET (三视图总图). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve 100% of the character identity, proportions, and features from the attached reference image.

Canvas layout: exactly three full-body orthographic views of the SAME mascot character aligned horizontally on the exact same ground plane and baseline:
- Left: Front Orthographic View (0 degrees, looking directly forward, symmetrical standing pose)
- Middle: True Lateral Profile View (pure 90 degrees side view, strictly perpendicular to camera)
- Right: Back Orthographic View (180 degrees, looking directly from behind)

Character specification:
- Oversized cocoon-style textured red lychee peel hoodie (100% Hood-On, fully covering head and body, never takes off hood);
- Hands holding two green fruit stem drawstrings centered in front of chest;
- Round translucent jade-white face peeking out from hood opening, big glossy black round eyes with white specular glints, soft pink blushing cheeks;
- Red rounded boots with flat white rubber soles;
- Single curved fresh green leaf growing from apex stem.

Technical Specifications:
- Absolute orthographic projection (telephoto 200mm flat lens, zero perspective distortion, zero wide-angle distortion);
- Pure solid clean white background (#FFFFFF);
- Crisp, razor-sharp silhouette contour edges specifically optimized for 3D modeling edge detection;
- Neutral, even studio diffuse lighting with subtle rim light, no heavy shadows on background.
Canvas requirement: generate exactly one image in native 3:2 aspect ratio. Do not add borders, blurred margins, vignette, or padding."""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        
        # Use existing chatgpt page or new page
        chat_pages = [page for page in context.pages if "chatgpt" in page.url]
        if chat_pages:
            page = chat_pages[0]
            print(f"Reusing existing page: {page.url}")
            await page.bring_to_front()
        else:
            page = await context.new_page()
            await page.goto("https://chatgpt.com/", wait_until="domcontentloaded")

        # Navigate to fresh chat via clicking New Chat button
        new_chat_btn = page.locator('a[aria-label*="新聊天"], button[aria-label*="新聊天"], a[href="/"]').first
        if await new_chat_btn.count() > 0:
            print("Clicking new chat button...")
            await new_chat_btn.click()
            await asyncio.sleep(2)
        else:
            await page.goto("https://chatgpt.com/", wait_until="domcontentloaded")
            await asyncio.sleep(2)

        # Upload reference image
        upload_input = page.locator("#upload-files, input#upload-photos, input[type='file']").first
        await upload_input.set_input_files(str(REF_IMAGE))
        print(f"Uploaded reference image {REF_IMAGE.name}, waiting for stability...")
        await asyncio.sleep(8)
        for wait_i in range(12):
            busy = await page.locator('[aria-busy="true"], svg[class*="animate-spin"]').count()
            if busy == 0:
                print(f"Upload ready in {wait_i + 8}s")
                break
            await asyncio.sleep(1)
        await asyncio.sleep(2)

        # Fill prompt
        composer = page.locator("#prompt-textarea").first
        await composer.wait_for(state="visible", timeout=20000)
        await composer.click()
        await composer.fill(PROMPT)
        print("Prompt filled. Waiting 3s...")
        await asyncio.sleep(3)

        # Send
        send_btn = page.locator("button[data-testid='send-button'], button[data-testid='composer-send-button'], button[aria-label*='Send'], button[aria-label*='发送']").first
        submitted = False
        for _ in range(10):
            if await send_btn.count() > 0 and await send_btn.is_visible() and await send_btn.is_enabled():
                await send_btn.click()
                submitted = True
                print("Clicked send button!")
                break
            await asyncio.sleep(1)

        if not submitted:
            await composer.press("Enter")
            print("Submitted via Enter key!")

        # Snapshot known image sources
        known_srcs = set()
        for pre_img in await page.locator("img").all():
            try:
                s = await pre_img.get_attribute("src")
                if s:
                    known_srcs.add(s)
            except Exception:
                pass

        print("Monitoring generation...")
        start = time.time()
        timeout = 260
        found = False

        while time.time() - start < timeout:
            if time.time() - start < 15:
                await asyncio.sleep(3)
                continue

            # Check if there is an error message
            err_count = await page.locator("button:has-text('重试'), button:has-text('Retry')").count()
            if err_count > 0:
                print("Detected error with retry button! Clicking retry...")
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
                    if w and w > 800:
                        data = await page.evaluate("""async (url) => {
                            const resp = await fetch(url);
                            const blob = await res.blob();
                            return new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        }""", src)
                        header, b64 = data.split(",", 1)
                        raw = base64.b64decode(b64)

                        new_hash = hashlib.md5(raw).hexdigest()
                        ref_hash = hashlib.md5(REF_IMAGE.read_bytes()).hexdigest()
                        if new_hash == ref_hash:
                            known_srcs.add(src)
                            continue

                        print(f"SUCCESS: Generated image captured! Size: {w}x{h} ({len(raw)//1024} KB)")
                        DEST_PATH.write_bytes(raw)
                        shutil.copy2(DEST_PATH, Path("/Users/papazed/.gemini/antigravity/brain/095f0e24-6f5a-4ad7-b980-db9809fbc7c9/images/sa_ortho_01_turnaround.png"))
                        found = True
                        break
                except Exception as e:
                    pass

            if found:
                break
            await asyncio.sleep(3)

        if not found:
            print("Failed or timed out!")

if __name__ == "__main__":
    asyncio.run(main())
