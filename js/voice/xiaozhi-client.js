/**
 * XiaoZhi 语音对话客户端 (浏览器原生 ES 模块)
 * 复用并适配四足机器人项目中的 xiaozhi-proxy.js 协议逻辑，
 * 支持 WebSocket 握手、流式语音识别事件、LLM 文本接收与本地仿真兜底。
 */

export class XiaoZhiClient {
  constructor(options = {}) {
    this.host = options.host || "127.0.0.1";
    this.port = Number(options.port || 8010);
    this.token = options.token || "local-dev-token";
    this.deviceId = options.deviceId || "li-mascot-01";
    this.clientId = options.clientId || "web-studio-01";
    this.url = options.url || `ws://${this.host}:${this.port}/xiaozhi/v1/`;

    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.listeners = {
      open: [],
      close: [],
      error: [],
      message: [],
      tts: [],
      llm: [],
      state: [],
    };
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try { cb(data); } catch (e) { console.error(`[XiaoZhiClient] Error in ${event} callback:`, e); }
      });
    }
  }

  connect() {
    if (this.isConnected || this.isConnecting) return Promise.resolve(true);

    this.isConnecting = true;
    return new Promise((resolve) => {
      try {
        console.log(`[XiaoZhi] Connecting to ${this.url}...`);
        this.socket = new WebSocket(this.url);

        const connectTimeout = setTimeout(() => {
          if (this.isConnecting && !this.isConnected) {
            console.warn("[XiaoZhi] Connection timeout, falling back to mock mode");
            this.isConnecting = false;
            this.emit("state", { connected: false, mock: true, error: "timeout" });
            resolve(false);
          }
        }, 3500);

        this.socket.onopen = () => {
          clearTimeout(connectTimeout);
          this.isConnected = true;
          this.isConnecting = false;
          console.log("[XiaoZhi] WebSocket open. Sending hello handshake...");
          this.socket.send(JSON.stringify({
            type: "hello",
            version: 1,
            transport: "websocket",
            device_id: this.deviceId,
            client_id: this.clientId,
            protocol: "xiaozhi-v1",
            audio_params: {
              format: "pcm",
              sample_rate: 16000,
              channels: 1,
              frame_duration: 60,
            },
          }));
          this.emit("open", { url: this.url });
          this.emit("state", { connected: true, mock: false });
          resolve(true);
        };

        this.socket.onclose = () => {
          clearTimeout(connectTimeout);
          this.isConnected = false;
          this.isConnecting = false;
          console.log("[XiaoZhi] Socket closed.");
          this.emit("close");
          this.emit("state", { connected: false, mock: true });
          resolve(false);
        };

        this.socket.onerror = (err) => {
          clearTimeout(connectTimeout);
          console.warn("[XiaoZhi] Socket error (will use mock if offline):", err);
          this.emit("error", err);
          this.isConnected = false;
          this.isConnecting = false;
          this.emit("state", { connected: false, mock: true });
          resolve(false);
        };

        this.socket.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const msg = JSON.parse(event.data);
              this.handleServerMessage(msg);
            } catch (e) {
              // 兼容服务器返回的纯文本欢迎语或探活消息
              console.log("[XiaoZhi] Received server text message:", event.data);
              this.emit("message", { type: "text", text: event.data });
            }
          }
        };
      } catch (err) {
        console.warn("[XiaoZhi] Connection init failed:", err);
        this.isConnecting = false;
        this.emit("state", { connected: false, mock: true, error: err.message });
        resolve(false);
      }
    });
  }

  handleServerMessage(msg) {
    this.emit("message", msg);
    if (msg.type === "welcome" || msg.type === "hello") {
      console.log("[XiaoZhi] Handshake accepted by server!");
    } else if (msg.type === "llm" || msg.type === "text") {
      this.emit("llm", {
        text: msg.text || msg.data?.text || "",
        emotion: msg.emotion || msg.data?.emotion || "",
        commands: msg.commands || msg.data?.commands || [],
      });
    } else if (msg.type === "tts") {
      this.emit("tts", {
        text: msg.text || msg.data?.text || "",
      });
    }
  }

  sendText(text) {
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(`[XiaoZhi] Sending text to backend: "${text}"`);
      this.socket.send(JSON.stringify({
        type: "listen",
        state: "detect",
        text: text.trim(),
      }));
      return true;
    }
    return false;
  }

  disconnect() {
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
      this.socket = null;
    }
    this.isConnected = false;
  }
}
