#!/usr/bin/env python3
"""
Tencent Hunyuan 3D (混元生3D) Client & Batch Generator
Author: Antigravity Agent
Date: 2026-09-16

Features:
- Image normalization & preparation (centered square 1024x1024 with clean border padding)
- Job submission via OpenAI-compatible endpoint (https://api.ai3d.cloud.tencent.com/v1/ai3d/submit)
- Asynchronous task polling via https://api.ai3d.cloud.tencent.com/v1/ai3d/query
- Automatic artifact download (.glb, .obj, textures) into assets/mascots/hunyuan3d/
"""

import os
import sys
import time
import json
import base64
import urllib.request
import urllib.error
from pathlib import Path
from PIL import Image
import numpy as np

API_KEY = os.environ.get("HUNYUAN3D_API_KEY", "sk-0Lnrw2CHTtcmksB6HSMiPplz5xIpH6HG4CLZDcuOz1XpFfIA")
SUBMIT_URL = "https://api.ai3d.cloud.tencent.com/v1/ai3d/submit"
QUERY_URL = "https://api.ai3d.cloud.tencent.com/v1/ai3d/query"

def prepare_image_square(input_path: str, output_path: str = None, target_size: int = 1024, padding_ratio: float = 0.08) -> str:
    """
    Crop background and center subject on clean white 1024x1024 square with proper padding.
    """
    im = Image.open(input_path).convert("RGB")
    arr = np.array(im)
    bg = arr[0, 0]
    
    diff = np.abs(arr.astype(int) - bg.astype(int)).max(axis=2)
    mask = diff > 25
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    
    if not np.any(rows) or not np.any(cols):
        # Fallback if detection fails
        cropped = im
    else:
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        cropped = im.crop((xmin, ymin, xmax + 1, ymax + 1))
        
    cw, ch = cropped.size
    max_dim = int(target_size * (1 - 2 * padding_ratio))
    scale = min(max_dim / cw, max_dim / ch)
    new_w, new_h = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGB", (target_size, target_size), (255, 255, 255))
    paste_x = (target_size - new_w) // 2
    paste_y = (target_size - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y))
    
    if output_path is None:
        p = Path(input_path)
        output_path = str(p.parent / f"{p.stem}_prepared.png")
        
    canvas.save(output_path, format="PNG", quality=95)
    print(f"[ImagePrep] Prepared {input_path} -> {output_path} ({target_size}x{target_size})")
    return output_path

def image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def submit_image_job(image_path: str, model: str = "3.1") -> str:
    """
    Submits an image-to-3d task to Hunyuan 3D Pro API.
    Returns JobId.
    """
    b64_str = image_to_base64(image_path)
    payload = {
        "Model": model,
        "ImageBase64": b64_str
    }
    
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        SUBMIT_URL,
        data=req_data,
        headers={
            "Authorization": API_KEY,
            "Content-Type": "application/json"
        }
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            data = json.loads(resp_body)
            response = data.get("Response", {})
            if "Error" in response:
                raise RuntimeError(f"API Error: {response['Error']}")
            job_id = response.get("JobId")
            if not job_id:
                raise RuntimeError(f"Unexpected response format: {resp_body}")
            print(f"[Submit] Success! JobId: {job_id}")
            return job_id
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code} Error: {err_msg}")

def query_job(job_id: str) -> dict:
    """
    Queries status of a task by JobId.
    """
    payload = {"JobId": job_id}
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        QUERY_URL,
        data=req_data,
        headers={
            "Authorization": API_KEY,
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        resp_body = resp.read().decode("utf-8")
        data = json.loads(resp_body)
        return data.get("Response", {})

def poll_and_download(job_id: str, output_dir: str, poll_interval: int = 8, max_timeout: int = 900) -> dict:
    """
    Polls task status until completion and downloads all 3D files.
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    start_time = time.time()
    print(f"[Poll] Starting poll for JobId {job_id}, saving to {output_dir}")
    
    while True:
        elapsed = int(time.time() - start_time)
        if elapsed > max_timeout:
            raise TimeoutError(f"Job {job_id} timed out after {max_timeout} seconds")
            
        try:
            resp = query_job(job_id)
        except Exception as e:
            print(f"[Poll] Query transient error: {e}, retrying...")
            time.sleep(poll_interval)
            continue
            
        status = resp.get("Status")
        error_msg = resp.get("ErrorMessage")
        
        print(f"[Poll +{elapsed}s] JobId: {job_id} | Status: {status}")
        
        if status in ("DONE", "SUCCEED", "SUCCESS"):
            files = resp.get("ResultFile3Ds", [])
            print(f"[Success] Job finished! Received {len(files)} asset file(s).")
            
            # Save metadata
            with open(out_path / "job_meta.json", "w", encoding="utf-8") as f:
                json.dump(resp, f, indent=2, ensure_ascii=False)
                
            downloaded = []
            for i, f_info in enumerate(files):
                url = f_info.get("Url") or f_info.get("FileUrl")
                file_type = f_info.get("Type") or f_info.get("FileType", "model")
                if not url:
                    continue
                # Determine extension
                url_clean = url.split("?")[0]
                ext = Path(url_clean).suffix or ".glb"
                target_filename = f"model_{file_type.lower()}{ext}"
                target_file = out_path / target_filename
                
                print(f"[Download] Fetching {file_type} from {url[:60]}... -> {target_file}")
                urllib.request.urlretrieve(url, str(target_file))
                downloaded.append(str(target_file))
                print(f"[Download] Saved: {target_file} ({target_file.stat().st_size / 1024 / 1024:.2f} MB)")
                
            resp["downloaded_files"] = downloaded
            return resp
            
        elif status in ("FAIL", "FAILED"):
            raise RuntimeError(f"Job failed! ErrorCode: {resp.get('ErrorCode')}, Message: {error_msg}")
            
        time.sleep(poll_interval)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python hunyuan3d_generator.py [query <job_id> | generate <image_path> <output_dir> [model_ver]]")
        sys.exit(1)
        
    cmd = sys.argv[1]
    if cmd == "query":
        job_id = sys.argv[2]
        res = query_job(job_id)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    elif cmd == "generate":
        img_in = sys.argv[2]
        out_dir = sys.argv[3]
        model_v = sys.argv[4] if len(sys.argv) > 4 else "3.1"
        
        prep_img = prepare_image_square(img_in)
        job_id = submit_image_job(prep_img, model=model_v)
        poll_and_download(job_id, out_dir)
