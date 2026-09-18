#!/usr/bin/env python3
"""
弈律 · 本地 HTTP 服务 (带 SharedArrayBuffer 所需 COOP / COEP 响应头)
"""
import http.server
import socketserver
import os
import sys
import json
import hashlib
import subprocess
import threading
from pathlib import Path

PORT = 8000
SPEECH_LOCK = threading.Lock()

class COOPCOEPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/mascot/tts':
            self.send_error(404)
            return
        origin = self.headers.get('Origin')
        if self.client_address[0] not in ('127.0.0.1', '::1') or (origin and origin not in (f'http://127.0.0.1:{self.server.server_address[1]}', f'http://localhost:{self.server.server_address[1]}')):
            self.send_error(403)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 12000:
                raise ValueError('Invalid request size')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or not isinstance(data.get('text'), str):
                raise ValueError('Invalid speech payload')
            text = data.get('text', '').strip()
            if not text or len(text) > 800:
                raise ValueError('Speech text must contain 1–800 characters')
            rate = '205' if data.get('role') == 'astro' else '185'
            if not Path('/usr/bin/say').is_file():
                self.send_error(503, 'Local speech synthesis unavailable')
                return
            folder = Path(__file__).resolve().parent / 'output' / 'tts'
            folder.mkdir(parents=True, exist_ok=True)
            key = hashlib.sha256((rate + text).encode()).hexdigest()
            path = folder / (key + '.wav')
            with SPEECH_LOCK:
                if not path.exists() or path.stat().st_size < 100:
                    pending = folder / (key + '.pending.wav')
                    subprocess.run(['/usr/bin/say', '-v', 'Tingting', '-r', rate, '-o', str(pending), '--file-format=WAVE', '--data-format=LEI16@22050', '--', text], check=True, timeout=40, capture_output=True)
                    pending.replace(path)
            payload = path.read_bytes()
            if payload[:4] != b'RIFF':
                raise ValueError('Invalid synthesized audio')
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_error(400, 'Invalid speech request')
        except (OSError, subprocess.SubprocessError):
            self.send_error(503, 'Speech synthesis unavailable')

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

def run_server(port=PORT):
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", port), COOPCOEPRequestHandler) as httpd:
        print(f"=========================================================")
        print(f"  弈律 3D 中国象棋 本地服务已启动")
        print(f"  URL: http://localhost:{port}/xiangqi.html")
        print(f"  COOP: same-origin | COEP: require-corp (WASM 多线程已启用)")
        print(f"=========================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务器已停止。")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
