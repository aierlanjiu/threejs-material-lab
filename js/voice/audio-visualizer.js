/**
 * 音频分析与语音播报可视化器 (Web Audio API)
 * 提供实时麦克风音频采集、FFT 频谱分析与自然语音 TTS 合成播报
 */

export class AudioVisualizer {
  constructor(options = {}) {
    this.audioCtx = null;
    this.analyser = null;
    this.micStream = null;
    this.sourceNode = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.fftData = null;
    this.speechSource = null;
    this.speechAnalyser = null;
    this.speechMode = 'none';
    this.speechRequest = 0;
    this.onLevelChange = options.onLevelChange || null;
  }

  async initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.fftData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  async startMic() {
    await this.initAudioContext();
    if (this.isListening) return true;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.sourceNode.connect(this.analyser);
      this.isListening = true;
      console.log("[AudioVisualizer] Microphone active.");
      return true;
    } catch (err) {
      console.warn("[AudioVisualizer] Microphone access error:", err);
      this.isListening = false;
      return false;
    }
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    this.isListening = false;
    console.log("[AudioVisualizer] Microphone stopped.");
  }

  getAudioLevel() {
    if (!this.analyser || (!this.isListening && !this.isSpeaking)) return 0;
    this.analyser.getByteFrequencyData(this.fftData);
    let sum = 0;
    for (let i = 0; i < this.fftData.length; i++) {
      sum += this.fftData[i];
    }
    const avg = sum / this.fftData.length;
    let voice = 0;
    if (this.isSpeaking && this.speechMode === 'pcm' && this.speechAnalyser) {
      this.speechAnalyser.getFloatTimeDomainData(this.speechSamples);
      voice = Math.sqrt(this.speechSamples.reduce((sum, v) => sum + v * v, 0) / this.speechSamples.length) * 6;
    }
    return Math.min(1.0, Math.max(avg / 128.0, voice));
  }

  stopSpeech() {
    ++this.speechRequest;
    this.speechAbort?.abort();
    if (this.speechSource) { this.speechSource.onended = null; try { this.speechSource.stop(); } catch {} this.speechSource.disconnect(); this.speechSource = null; }
    window.speechSynthesis?.cancel();
    this.isSpeaking = false;
    this.speechMode = 'none';
  }

  /**
   * 使用浏览器内置 Web Speech API 朗读文本（无外部 TTS 依赖时的优雅本地播报）
   * @param {string} text - 待朗读纯文本
   * @param {"hoodie"|"astro"} role - 角色
   * @param {Function} onStart - 开始朗读回调
   * @param {Function} onEnd - 朗读完毕回调
   */
  async speak(text, role = "hoodie", onStart = null, onEnd = null) {
    this.stopSpeech();
    const request = this.speechRequest;
    const clean = text.replace(/\[(action|emotion):[a-zA-Z0-9_\-]+\]/g, '').trim();
    if (!clean) { onEnd?.(); return; }
    try {
      await this.initAudioContext();
      const abort = new AbortController(); this.speechAbort = abort;
      const timeout = setTimeout(() => abort.abort(), 45000);
      let response;
      try { response = await fetch('/api/mascot/tts', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:clean.slice(0,800),role}),signal:this.speechAbort.signal}); }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`Local TTS ${response.status}`);
      const buffer = await this.audioCtx.decodeAudioData(await response.arrayBuffer());
      if (request !== this.speechRequest) return;
      if (!this.speechAnalyser) { this.speechAnalyser = this.audioCtx.createAnalyser(); this.speechAnalyser.fftSize = 512; this.speechSamples = new Float32Array(512); this.speechAnalyser.connect(this.audioCtx.destination); }
      const source = this.audioCtx.createBufferSource(); source.buffer = buffer; source.connect(this.speechAnalyser);
      source.onended = () => { if (request !== this.speechRequest) return; this.isSpeaking = false; this.speechMode = 'none'; this.speechSource = null; source.disconnect(); onEnd?.(); };
      this.speechSource = source; this.speechMode = 'pcm'; this.isSpeaking = true; source.start(); onStart?.(); return;
    } catch (error) {
      if (request !== this.speechRequest) return;
      console.warn('[AudioVisualizer] Local PCM speech unavailable; using browser voice.', error.message);
    }
    this.speechMode = 'browser';
    if (!("speechSynthesis" in window)) {
      console.warn("[AudioVisualizer] Web Speech API not supported.");
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\[(action|emotion):[a-zA-Z0-9_\-]+\]/g, "").trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "zh-CN";

    // 针对角色微调音调与语速
    if (role === "astro") {
      utterance.pitch = 1.25; // 稍微清脆清亮的少年探险者声
      utterance.rate = 1.1;   // 稍快速、机敏
    } else {
      utterance.pitch = 1.05; // 温暖偏呆萌
      utterance.rate = 1.0;   // 稳重治愈
    }

    utterance.onstart = () => {
      if (request !== this.speechRequest) return;
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (request !== this.speechRequest) return;
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      if (request !== this.speechRequest) return;
      console.warn("[AudioVisualizer] Speech synthesis error:", e);
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }
}
