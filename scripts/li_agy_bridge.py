#!/usr/bin/env python3
"""
「荔 / LI」双核心吉祥物 (A 荔小卫 & D 荔小星) - AGY CLI 后台大脑桥接服务
复用 境 App (moye_agy_bridge.py) 的沙箱进程管理与合同注入模式，
为 Three.js 前端和语音系统提供低延迟、带动作情绪标签的角色对话支持。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

DEFAULT_PORT = 8768
DEFAULT_AGY = Path.home() / ".local/bin/agy"
PROJECT_DIR = Path(__file__).resolve().parent.parent
CONTRACT_HOODIE = PROJECT_DIR / "contracts/li_hoodie_a.contract.md"
CONTRACT_ASTRO = PROJECT_DIR / "contracts/li_astro_d.contract.md"

FALLBACK_REPLIES = {
    "hoodie": [
        "[action:retract_shell] 哎呀，我先缩进荔枝壳里压压惊！不过我听到你说话啦~",
        "[action:pop_out] [emotion:happy] 本荔枝随时在！今天卫衣兜帽特别舒服呢。",
        "[action:nod] 收到收到！荔小卫正在思考中...",
    ],
    "astro": [
        "[action:zero_g_float] [action:visor_hud_pulse] 坐标校准完毕！荔小星正在星轨待命，指挥官请讲！",
        "[action:antenna_beacon] 天线接收到高频灵感信号！宇宙深度跃迁中...",
        "[action:salute] 收到探险指令！本荔星航天引擎运转正常！",
    ]
}


def load_contract(role: str) -> str:
    path = CONTRACT_ASTRO if role == "astro" else CONTRACT_HOODIE
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "你是一个可爱的荔枝吉祥物伴侣，请用简明温和的口吻回答。"


def extract_tags(text: str) -> tuple[str, list[str], list[str]]:
    actions = re.findall(r"\[action:([a-zA-Z0-9_\-]+)\]", text)
    emotions = re.findall(r"\[emotion:([a-zA-Z0-9_\-]+)\]", text)
    clean_text = re.sub(r"\[(action|emotion):[a-zA-Z0-9_\-]+\]", "", text).strip()
    return clean_text, actions, emotions


class MascotAgyBridge:
    def __init__(self, agy_path: Path = DEFAULT_AGY, timeout: int = 65) -> None:
        self.agy_path = agy_path
        self.timeout = timeout
        self.lock = threading.Lock()
        self._cached_models: list[str] = []
        self._last_models_fetch = 0

    def is_agy_available(self) -> bool:
        return self.agy_path.is_file() and os.access(self.agy_path, os.X_OK)

    def get_models(self) -> list[str]:
        if time.time() - self._last_models_fetch < 120 and self._cached_models:
            return self._cached_models
        if not self.is_agy_available():
            return ["gemini-3.6-flash-high", "claude-sonnet-4-6"]
        try:
            res = subprocess.run(
                [str(self.agy_path), "models"],
                text=True,
                capture_output=True,
                timeout=15,
                check=False
            )
            models = []
            for line in res.stdout.splitlines():
                m = line.strip().lstrip("•*- ").strip()
                if m and "available model" not in m.lower():
                    models.append(m)
            if models:
                self._cached_models = models
                self._last_models_fetch = time.time()
                return models
        except Exception:
            pass
        return ["gemini-3.6-flash-high", "claude-sonnet-4-6"]

    def chat(self, role: str, message: str, model: str = "") -> dict[str, Any]:
        role = "astro" if role == "astro" else "hoodie"
        contract = load_contract(role)
        selected_model = model or "gemini-3.6-flash-high"

        if not self.is_agy_available():
            fallback = FALLBACK_REPLIES[role][int(time.time()) % len(FALLBACK_REPLIES[role])]
            clean, actions, emotions = extract_tags(fallback)
            return {
                "status": "fallback",
                "role": role,
                "raw_text": fallback,
                "clean_speech": clean,
                "actions": actions,
                "emotions": emotions,
                "model": "offline-fallback",
                "notice": f"AGY CLI not found at {self.agy_path}, used local brain."
            }

        prompt = (
            f"<contract>\n{contract}\n</contract>\n\n"
            f"用户对你说：\"{message}\"\n\n"
            "请严格以本吉祥物人设回复。严格控制在1~3句话，可包含动作标签如 [action:...] 或 [emotion:...]。只返回回复文本，不输出其他任何分析或代码。"
        )

        args = [
            str(self.agy_path),
            "-p", prompt,
            "--sandbox",
            "--print-timeout", f"{self.timeout}s"
        ]
        if selected_model:
            args += ["--model", selected_model]

        try:
            start_time = time.time()
            proc = subprocess.run(
                args,
                text=True,
                capture_output=True,
                timeout=self.timeout + 5,
                check=False,
                cwd=str(PROJECT_DIR)
            )
            duration = round(time.time() - start_time, 2)
            if proc.returncode != 0:
                err = proc.stderr.strip() or f"AGY exit code {proc.returncode}"
                fallback = FALLBACK_REPLIES[role][0]
                clean, actions, emotions = extract_tags(fallback)
                return {
                    "status": "partial_error",
                    "role": role,
                    "raw_text": fallback,
                    "clean_speech": clean,
                    "actions": actions,
                    "emotions": emotions,
                    "model": selected_model,
                    "error": err
                }

            raw_reply = proc.stdout.strip()
            if not raw_reply:
                raw_reply = FALLBACK_REPLIES[role][1]

            clean, actions, emotions = extract_tags(raw_reply)
            return {
                "status": "success",
                "role": role,
                "raw_text": raw_reply,
                "clean_speech": clean,
                "actions": actions,
                "emotions": emotions,
                "model": selected_model,
                "duration_seconds": duration
            }
        except subprocess.TimeoutExpired:
            fallback = "[action:retract_shell] 思考跃迁超时啦，本荔枝先歇一口气！" if role == "hoodie" else "[action:zero_g_float] 信号穿透星云延迟超时，请指挥官重呼！"
            clean, actions, emotions = extract_tags(fallback)
            return {
                "status": "timeout",
                "role": role,
                "raw_text": fallback,
                "clean_speech": clean,
                "actions": actions,
                "emotions": emotions,
                "model": selected_model
            }
        except Exception as e:
            fallback = FALLBACK_REPLIES[role][0]
            clean, actions, emotions = extract_tags(fallback)
            return {
                "status": "error",
                "role": role,
                "raw_text": fallback,
                "clean_speech": clean,
                "actions": actions,
                "emotions": emotions,
                "model": selected_model,
                "error": str(e)
            }


class BridgeRequestHandler(BaseHTTPRequestHandler):
    server: ThreadingHTTPServer

    def _set_cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_GET(self) -> None:
        bridge: MascotAgyBridge = self.server.bridge  # type: ignore
        if self.path == "/status" or self.path == "/":
            data = {
                "service": "li-agy-bridge",
                "version": "1.0",
                "status": "running",
                "agy_available": bridge.is_agy_available(),
                "agy_path": str(bridge.agy_path),
                "roles": ["hoodie", "astro"]
            }
            self._send_json(200, data)
        elif self.path == "/v1/models":
            models = bridge.get_models()
            self._send_json(200, {"models": models})
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self) -> None:
        bridge: MascotAgyBridge = self.server.bridge  # type: ignore
        if self.path == "/v1/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body) if body else {}
            except Exception:
                self._send_json(400, {"error": "Invalid JSON"})
                return

            role = payload.get("role", "hoodie")
            message = payload.get("message", "")
            model = payload.get("model", "gemini-3.6-flash-high")

            if not message:
                self._send_json(400, {"error": "Message is required"})
                return

            result = bridge.chat(role=role, message=message, model=model)
            self._send_json(200, result)
        else:
            self._send_json(404, {"error": "Not Found"})

    def _send_json(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        pass


def run_server(port: int = DEFAULT_PORT, agy_path: Path = DEFAULT_AGY) -> None:
    bridge = MascotAgyBridge(agy_path=agy_path)
    server = ThreadingHTTPServer(("0.0.0.0", port), BridgeRequestHandler)
    server.bridge = bridge  # type: ignore
    print(f"🚀 [li_agy_bridge] Server listening on http://127.0.0.1:{port}")
    print(f"   AGY executable: {agy_path} (exists={bridge.is_agy_available()})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 [li_agy_bridge] Shutting down.")
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mascot AGY Bridge Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on")
    parser.add_argument("--agy", type=Path, default=DEFAULT_AGY, help="Path to agy binary")
    parser.add_argument("--test", action="store_true", help="Run local smoke test")
    args = parser.parse_args()

    if args.test:
        print("🧪 Running smoke test for MascotAgyBridge...")
        b = MascotAgyBridge(agy_path=args.agy)
        print(f"AGY Available: {b.is_agy_available()}")
        res_a = b.chat("hoodie", "你好荔小卫，今天天气怎么样？")
        print(f"Hoodie Response: {json.dumps(res_a, ensure_ascii=False, indent=2)}")
        res_d = b.chat("astro", "荔小星呼叫，请报告你的任务状态！")
        print(f"Astro Response: {json.dumps(res_d, ensure_ascii=False, indent=2)}")
        sys.exit(0)

    run_server(port=args.port, agy_path=args.agy)
