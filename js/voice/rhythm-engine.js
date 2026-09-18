/**
 * 『 律 』LÜ - 音乐播放与实时律动共振引擎
 * 复用 index.html (『 律 』3D 全变量声波共振工作台) 核心算法：
 * 1. Web Audio API 毫秒级多频带解耦 (Bass / Mid / Treble) 与指数平滑衰减
 * 2. 动态起音检测 (Onset Detection) 与自适应节拍时钟 (Beat Phase & Pulse)
 * 3. 本地无损音频播放列表与自定义音频上传通道
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.1/+esm";

export class RhythmEngine {
  constructor(options = {}) {
    this.audioCtx = null;
    this.analyser = null;
    this.currentAudioSource = null;
    this.audioDataArray = null;

    this.isPlaying = false;
    this.audioReady = false;
    this.playbackStartTime = 0;
    this.playbackOffset = 0;

    // 预置曲库清单 (直接复用项目 audio/ 目录)
    this.playlist = [
      { title: "《烂泥》- 草东没有派对", src: "audio/lanni.mp3", bpm: 118 },
      { title: "《游京》- 星火社", src: "audio/youjing.mp3", bpm: 124 },
      { title: "《秋意浓》- 张学友", src: "audio/qiuyinong.mp3", bpm: 78 },
      { title: "《偏爱》- 张芸京", src: "audio/pianai.mp3", bpm: 104 },
      { title: "《海鸥》- 逃跑计划", src: "audio/haiou.mp3", bpm: 128 },
      { title: "《鬼》- 草东没有派对", src: "audio/gui.mp3", bpm: 130 },
    ];
    this.currentTrackIndex = 0;

    // 节拍与频带能量状态 (直接复用『 律 』算法)
    this.bassEnergy = 0.0;
    this.midEnergy = 0.0;
    this.trebleEnergy = 0.0;
    this.lastBassEnergy = 0.0;
    this.lastMidEnergy = 0.0;

    this.beatPulse = 0.0;
    this.beatPhase = 0.0;
    this.beatPeriod = 60 / 120; // 默认 120 BPM
    this.nextBeatTime = 0;
    this.beatOrigin = 0;
    this.beatCount = 0;
    this.onsetTimes = [];

    this.audioBuffers = new Map();
    this.playRequest = 0;
    this.onError = options.onError || null;
    this.onTrackChange = options.onTrackChange || null;
    this.onPlayStateChange = options.onPlayStateChange || null;
  }

  initAudio() {
    if (this.audioCtx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioCtx();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.audioCtx.destination);
    this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  async playTrack(index = 0, resume = false) {
    const request = ++this.playRequest;
    if (this.currentAudioSource) {
      this.currentAudioSource.onended = null;
      try { this.currentAudioSource.stop(); } catch {}
      this.currentAudioSource.disconnect();
      this.currentAudioSource = null;
    }
    if (index >= 0 && index < this.playlist.length) this.currentTrackIndex = index;
    const track = this.playlist[this.currentTrackIndex];
    this.audioReady = false;
    this.isPlaying = true;
    if (!resume) this.playbackOffset = 0;
    this.beatCount = 0;
    this.onsetTimes = [];
    this.beatPeriod = 60 / (track.bpm || 120);
    this.onTrackChange?.(track);
    this.onPlayStateChange?.(true);
    try {
      this.initAudio();
      if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
      let buffer = this.audioBuffers.get(track.src);
      if (!buffer) {
        const res = await fetch(track.src, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = await this.audioCtx.decodeAudioData(await res.arrayBuffer());
        this.audioBuffers.set(track.src, buffer);
      }
      // A paused or superseded load must never start an old track later.
      if (request !== this.playRequest || !this.isPlaying) return;
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.analyser);
      source.loop = true;
      this.currentAudioSource = source;
      this.playbackOffset %= buffer.duration;
      this.playbackStartTime = this.audioCtx.currentTime;
      // update() uses track-relative time, not AudioContext absolute time.
      this.nextBeatTime = this.playbackOffset;
      this.beatOrigin = this.playbackOffset;
      source.start(0, this.playbackOffset);
      this.audioReady = true;
      this.onPlayStateChange?.(true);
    } catch (err) {
      if (request !== this.playRequest) return;
      console.warn("[RhythmEngine] Playback error:", err);
      this.isPlaying = false;
      this.audioReady = false;
      this.onPlayStateChange?.(false);
      this.onError?.(err);
    }
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else return this.playTrack(this.currentTrackIndex, true);
  }

  pause() {
    ++this.playRequest;
    if (this.audioReady && this.audioCtx) this.playbackOffset += this.audioCtx.currentTime - this.playbackStartTime;
    this.isPlaying = false;
    this.audioReady = false;
    if (this.currentAudioSource) {
      this.currentAudioSource.onended = null;
      try { this.currentAudioSource.stop(); } catch {}
      this.currentAudioSource.disconnect();
      this.currentAudioSource = null;
    }
    this.onPlayStateChange?.(false);
  }

  nextTrack() {
    const nextIdx = (this.currentTrackIndex + 1) % this.playlist.length;
    this.playTrack(nextIdx);
  }

  prevTrack() {
    const prevIdx = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playTrack(prevIdx);
  }

  /**
   * 加载用户自定义音频文件
   */
  async loadCustomFile(file) {
    this.initAudio();
    const ab = await file.arrayBuffer();
    const buffer = await this.audioCtx.decodeAudioData(ab);
    const customTrack = {
      title: file.name.replace(/\.[^/.]+$/, ""),
      src: URL.createObjectURL(file),
      bpm: 120,
    };
    this.playlist.unshift(customTrack);
    this.audioBuffers.set(customTrack.src, buffer);
    return this.playTrack(0);
  }

  /**
   * 逐帧计算音频频带与节拍律动 (复用『 律 』index.html 核心数学模型)
   * @param {number} dt - 帧时间步长 (秒)
   */
  update(dt = 0.016) {
    if (this.analyser && this.audioDataArray && this.isPlaying && this.audioReady) {
      this.analyser.getByteFrequencyData(this.audioDataArray);

      // 1. 三频带加权积分：Bass(0~4), Mid(4~20), Treble(20~48)
      let bassSum = 0, midSum = 0, trebleSum = 0;
      for (let i = 0; i < 4; i++) bassSum += this.audioDataArray[i];
      for (let i = 4; i < 20; i++) midSum += this.audioDataArray[i];
      for (let i = 20; i < 48; i++) trebleSum += this.audioDataArray[i];

      const rawBass = bassSum / 4 / 255;
      const rawMid = midSum / 16 / 255;
      const rawTreble = trebleSum / 28 / 255;

      // 2. 指数衰减 (dt 无关平滑)
      const decayFactor = Math.exp(-7.67 * dt);
      this.bassEnergy = Math.max(rawBass, this.bassEnergy * decayFactor);
      this.midEnergy = Math.max(rawMid, this.midEnergy * decayFactor);
      this.trebleEnergy = Math.max(rawTreble, this.trebleEnergy * decayFactor);

      // 3. 自适应起音 (Onset) 与节拍脉冲估计
      const audioTime = this.playbackOffset + this.audioCtx.currentTime - this.playbackStartTime;
      const isPeak = (rawBass > 0.28 && rawBass - this.lastBassEnergy > 0.045) ||
                     (rawMid > 0.38 && rawMid - this.lastMidEnergy > 0.065);

      const lastOnset = this.onsetTimes.at(-1);
      if (isPeak && (lastOnset === undefined || audioTime - lastOnset > 0.26)) {
        const spacing = audioTime - lastOnset;
        if (spacing >= 0.32 && spacing <= 0.9) {
          this.onsetTimes.push(audioTime);
          if (this.onsetTimes.length > 9) this.onsetTimes.shift();
          const intervals = this.onsetTimes.slice(1).map((t, i) => t - this.onsetTimes[i]).sort((a, b) => a - b);
          if (intervals.length >= 3) {
            const median = intervals[Math.floor(intervals.length / 2)];
            this.beatPeriod += (median - this.beatPeriod) * 0.15;
          }
        } else {
          this.onsetTimes = [audioTime];
        }
        const error = audioTime - this.nextBeatTime;
        if (Math.abs(error) < this.beatPeriod * 0.28) this.nextBeatTime += error * 0.35;
        this.beatPulse = Math.max(this.beatPulse, Math.min(1, rawBass + rawMid * 0.45));
      }

      if (audioTime >= this.nextBeatTime) {
        const elapsedBeats = 1 + Math.floor((audioTime - this.nextBeatTime) / this.beatPeriod);
        this.beatCount += elapsedBeats;
        this.beatOrigin = this.nextBeatTime + (elapsedBeats - 1) * this.beatPeriod;
        this.nextBeatTime += elapsedBeats * this.beatPeriod;
        this.beatPulse = Math.max(this.beatPulse, Math.min(1, rawBass * 1.4 + rawMid * 0.4));
      }

      this.beatPhase = THREE.MathUtils.clamp((audioTime - this.beatOrigin) / this.beatPeriod, 0, 1);
      this.lastBassEnergy = rawBass;
      this.lastMidEnergy = rawMid;
    } else {
      // 待机指数衰减
      const idleDecay = Math.exp(-6.0 * dt);
      this.bassEnergy *= idleDecay;
      this.midEnergy *= idleDecay;
      this.trebleEnergy *= idleDecay;
      this.beatPulse *= idleDecay;
    }

    this.beatPulse *= Math.exp(-dt * 4.5);

    return {
      isPlaying: this.isPlaying && this.audioReady,
      audioReady: this.audioReady,
      bass: this.bassEnergy,
      mid: this.midEnergy,
      treble: this.trebleEnergy,
      beatPulse: this.beatPulse,
      beatPhase: this.beatPhase,
      beatPeriod: this.beatPeriod,
      currentTrack: this.playlist[this.currentTrackIndex]?.title || "",
    };
  }
}
