#!/usr/bin/env python3
import time
import json
import urllib.request
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.resolve()))
from hunyuan3d_generator import query_job, API_KEY


JOBS = {
    "scheme_a_hoodie": {
        "job_id": "1491574035447808000",
        "output_dir": "assets/mascots/hunyuan3d/scheme_a_hoodie",
        "name": "Scheme A · 荔小卫 (Hoodie Lychee)",
        "done": False
    },
    "scheme_d_astro": {
        "job_id": "1491574038740221952",
        "output_dir": "assets/mascots/hunyuan3d/scheme_d_astro",
        "name": "Scheme D · 荔小星 (Astro-Lychee)",
        "done": False
    }
}

def download_assets(job_info, response):
    out_path = Path(job_info["output_dir"])
    out_path.mkdir(parents=True, exist_ok=True)
    
    with open(out_path / "job_meta.json", "w", encoding="utf-8") as f:
        json.dump(response, f, indent=2, ensure_ascii=False)
        
    files = response.get("ResultFile3Ds", [])
    print(f"[{job_info['name']}] Received {len(files)} asset file(s)", flush=True)
    
    for f_info in files:
        url = f_info.get("Url") or f_info.get("FileUrl")
        file_type = f_info.get("Type") or f_info.get("FileType", "model")
        if not url:
            continue
        url_clean = url.split("?")[0]
        ext = Path(url_clean).suffix or ".glb"
        target_filename = f"model_{file_type.lower()}{ext}"
        target_file = out_path / target_filename
        
        print(f"[{job_info['name']}] Downloading {file_type} -> {target_file}", flush=True)
        urllib.request.urlretrieve(url, str(target_file))
        print(f"[{job_info['name']}] Saved {target_file.name} ({target_file.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)

def main():
    start = time.time()
    print("=== Monitoring Hunyuan 3D Generation for Scheme A and Scheme D ===", flush=True)
    
    while True:
        all_done = True
        elapsed = int(time.time() - start)
        
        for key, info in JOBS.items():
            if info["done"]:
                continue
                
            try:
                resp = query_job(info["job_id"])
            except Exception as e:
                print(f"[{info['name']}] Query error: {e}", flush=True)
                all_done = False
                continue
                
            status = resp.get("Status")
            print(f"[+{elapsed}s] {info['name']} (Job {info['job_id']}): Status = {status}", flush=True)
            
            if status in ("DONE", "SUCCEED", "SUCCESS"):
                print(f"[{info['name']}] GENERATION COMPLETED! Downloading...", flush=True)
                download_assets(info, resp)
                info["done"] = True
            elif status in ("FAIL", "FAILED"):
                print(f"[{info['name']}] FAILED: {resp.get('ErrorMessage')}", flush=True)
                info["done"] = True
            else:
                all_done = False
                
        if all_done:
            print("=== All mascot 3D models processed successfully! ===", flush=True)
            break
            
        if elapsed > 600:
            print("=== Timeout reached (600s) ===", flush=True)
            break
            
        time.sleep(10)

if __name__ == "__main__":
    main()
