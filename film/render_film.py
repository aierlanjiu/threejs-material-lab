#!/usr/bin/env python3
"""
Master Film Production Pipeline for 『 律 』 Band Mode Commercial Film.
- Renders 900 frames @ 30fps (exactly 30.000s).
- Streams lossless PNG frames via pipe directly into FFmpeg libx264 (yuv420p, CRF 17).
- Combines with mastered stereo AAC 48kHz audio (-14.0 LUFS, TP <= -1.0 dBTP).
- Outputs to <Project Root>/video.mp4 and verifies all criteria.
"""

import asyncio
import os
import subprocess
import time
from pathlib import Path
from playwright.async_api import async_playwright
import json

ROOT = Path(__file__).resolve().parent.parent
CHROME_PATH = '/Users/papazed/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
TARGET_MP4 = ROOT / 'video.mp4'
BACKUP_MP4 = ROOT / 'output/film/video.mp4'
AUDIO_PATH = ROOT / 'output/film/film_master_final.m4a'

TOTAL_FRAMES = 900
FPS = 30.0
WIDTH = 1920
HEIGHT = 1080

def measure_final_video(mp4_path):
    """Measures exact duration, frames, resolution, LUFS, and True Peak on the final video."""
    # 1. ffprobe stream and format info
    probe_cmd = [
        'ffprobe', '-v', 'error',
        '-count_frames',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,duration:format=duration',
        '-of', 'json', str(mp4_path)
    ]
    res = subprocess.run(probe_cmd, capture_output=True, text=True)
    probe_data = json.loads(res.stdout)
    
    stream = probe_data['streams'][0]
    fmt = probe_data['format']
    
    width = int(stream['width'])
    height = int(stream['height'])
    nb_frames = int(stream['nb_read_frames'])
    duration_sec = float(fmt['duration'])
    
    # 2. ebur128 scanner on the video's audio track
    ebur_cmd = [
        'ffmpeg', '-nostats', '-i', str(mp4_path),
        '-filter_complex', 'ebur128=peak=true',
        '-f', 'null', '-'
    ]
    ebur_res = subprocess.run(ebur_cmd, capture_output=True, text=True)
    lines = ebur_res.stderr.splitlines()
    lufs = None
    true_peak = None
    for i, line in enumerate(lines):
        if 'Integrated loudness:' in line and i + 1 < len(lines):
            lufs = float(lines[i+1].split('I:')[1].replace('LUFS', '').strip())
        if 'True peak:' in line and i + 1 < len(lines):
            true_peak = float(lines[i+1].split('Peak:')[1].replace('dBFS', '').replace('dBTP', '').strip())
            
    return {
        'path': str(mp4_path),
        'width': width,
        'height': height,
        'frames': nb_frames,
        'duration': duration_sec,
        'lufs': lufs,
        'true_peak': true_peak
    }

async def render():
    print(f"============================================================")
    print(f"[*] Starting Film Master Render: 『 律 』 Band Mode Commercial")
    print(f"    Resolution: {WIDTH}x{HEIGHT} @ {FPS} fps")
    print(f"    Target:     {TOTAL_FRAMES} frames (exactly 30.000s)")
    print(f"    Output:     {TARGET_MP4}")
    print(f"============================================================")
    
    # Ensure audio exists
    if not AUDIO_PATH.exists():
        print("[*] Generating master audio track first...")
        subprocess.run(['/opt/homebrew/opt/python@3.14/bin/python3.14', str(ROOT / 'film/save_final_audio.py')], check=True)
    
    # Start FFmpeg subprocess with stdin pipe
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-f', 'image2pipe',
        '-vcodec', 'png',
        '-r', str(FPS),
        '-i', '-', # stdin pipe for raw png frames
        '-i', str(AUDIO_PATH), # audio master
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '17',
        '-c:a', 'copy',
        '-shortest',
        str(TARGET_MP4)
    ]
    
    ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    
    t_start = time.time()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                '--use-gl=angle',
                '--use-angle=metal',
                '--disable-gpu-vsync',
                '--disable-background-timer-throttling'
            ]
        )
        page = await browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        
        url = 'http://127.0.0.1:8000/film/film_stage.html'
        print(f"[*] Navigating to {url} ...")
        await page.goto(url, wait_until='networkidle')
        await page.wait_for_function('() => window.__stageReady === true', timeout=20000)
        print("[+] Stage environment ready. Starting frame capture loop...")
        
        for frame in range(TOTAL_FRAMES):
            # Render frame state
            await page.evaluate(f'() => window.renderFilmFrame({frame})')
            # Capture lossless PNG bytes
            png_bytes = await page.screenshot(type='png')
            # Stream to FFmpeg
            ffmpeg_proc.stdin.write(png_bytes)
            
            if (frame + 1) % 60 == 0 or frame == TOTAL_FRAMES - 1:
                elapsed = time.time() - t_start
                fps_actual = (frame + 1) / elapsed
                rem_sec = (TOTAL_FRAMES - (frame + 1)) / fps_actual if fps_actual > 0 else 0
                print(f" -> Frame {frame+1:3d}/{TOTAL_FRAMES} ({(frame+1)/30:5.2f}s) | Speed: {fps_actual:4.1f} fps | ETA: {rem_sec:4.1f}s")
        
        await browser.close()
    
    print("[*] All frames captured. Closing FFmpeg pipe and finalizing MP4...")
    ffmpeg_proc.stdin.close()
    ffmpeg_proc.wait()
    
    if ffmpeg_proc.returncode != 0:
        err = ffmpeg_proc.stderr.read().decode()
        raise RuntimeError(f"FFmpeg encoding failed: {err[:600]}")
    
    # Copy to backup location
    BACKUP_MP4.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['cp', str(TARGET_MP4), str(BACKUP_MP4)], check=True)
    
    print("[*] Measuring final video.mp4 metrics...")
    metrics = measure_final_video(TARGET_MP4)
    
    print("============================================================")
    print("                FINAL MASTER VIDEO VERIFICATION             ")
    print("============================================================")
    print(f" File Path:           {metrics['path']}")
    print(f" Resolution:          {metrics['width']} x {metrics['height']}")
    print(f" Total Frames:        {metrics['frames']} (Expected: {TOTAL_FRAMES})")
    print(f" Duration:            {metrics['duration']:.4f} s (Expected: 30.000s)")
    print(f" Integrated Loudness: {metrics['lufs']:.2f} LUFS (Spec: -14.0 +- 0.5)")
    print(f" True Peak:           {metrics['true_peak']:.2f} dBTP (Spec: <= -1.0 dBTP)")
    print("============================================================")
    
    assert metrics['frames'] == TOTAL_FRAMES, f"Frame count mismatch: {metrics['frames']}"
    assert abs(metrics['duration'] - 30.0) < 0.05, f"Duration mismatch: {metrics['duration']}"
    assert -14.5 <= metrics['lufs'] <= -13.5, f"LUFS out of tolerance: {metrics['lufs']}"
    assert metrics['true_peak'] <= -1.0, f"True Peak exceeded: {metrics['true_peak']}"
    print("[SUCCESS] Film master perfectly meets all specifications and criteria!")

if __name__ == '__main__':
    asyncio.run(render())