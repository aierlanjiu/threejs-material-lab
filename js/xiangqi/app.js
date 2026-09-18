// 弈律 · 3D 中国象棋 主控制器
import {
  RED, BLACK, GLYPH, createInitialState, pieceAt, pseudoMoves, legalMoves, applyMove, undo, gameStatus,
  boardToFen, fenToBoard, moveToString, stringToMove
} from './rules.js';
import { setAudioEnabled, playMoveSound, playCaptureSound, playCheckSound, playVictorySound } from './audio.js';
import { XiangqiBoard3D } from './board3d.js';
import { getAIMove, preheatAI, getAIEngineStatus } from './ai-manager.js';

const STORAGE_KEY = 'lu_xiangqi_state_v1';
const SETTINGS_KEY = 'lu_xiangqi_settings_v1';
const PIECE_VALUES = { soldier: 1, advisor: 2, elephant: 2, horse: 4, cannon: 4, chariot: 9, general: 20 };
const EVENT_PORTRAITS = {
  red: {
    general: 'assets/xiangqi/portraits/red-general.png', advisor: 'assets/xiangqi/portraits/red-advisor.png',
    elephant: 'assets/xiangqi/portraits/red-elephant.png', horse: 'assets/xiangqi/portraits/red-horse.png',
    chariot: 'assets/xiangqi/portraits/red-chariot.png', cannon: 'assets/xiangqi/portraits/red-cannon.png',
    soldier: 'assets/xiangqi/portraits/red-soldier.png',
  },
  black: {
    general: 'assets/xiangqi/portraits/black-general.png', advisor: 'assets/xiangqi/portraits/black-advisor.png',
    elephant: 'assets/xiangqi/portraits/black-elephant.png', horse: 'assets/xiangqi/portraits/black-horse.png',
    chariot: 'assets/xiangqi/portraits/black-chariot.png', cannon: 'assets/xiangqi/portraits/black-cannon.png',
    soldier: 'assets/xiangqi/portraits/black-soldier.png',
  }
};

class XiangqiApp {
  constructor() {
    this.state = createInitialState();
    this.board3D = null;

    // Config
    this.mode = 'pve'; // 'pve', 'pvp', 'eve'
    this.playerColor = RED; // RED or BLACK
    this.level = 5; // 1 ~ 5
    this.challengeMode = false;
    this.reducedMotion = false;
    this.soundEnabled = true;
    this.theme = 'living';
    this.materialSettings = { roughness: 0.24, metalness: 0.18, clearcoat: 0.58, pulse: 0.42 };

    this.undoCountInChallenge = 0;
    this.isAiThinking = false;
    this.eveInterval = null;
    this.lastAIResult = null;
    this.toastTimer = null;
    this.battleEventTimer = null;
    this.captureStreak = { red: 0, black: 0 };

    // Replay step state
    this.replayIndex = -1; // -1 means live latest state

    this.dom = {};
    this.initDOM();
    this.loadSettings();
    this.initBoard();
    this.bindEvents();

    this.preheatEngine();
    this.updateUI();
  }

  initDOM() {
    this.dom = {
      stage: document.getElementById('stage3d'),
      modeSelect: document.getElementById('modeSelect'),
      sideSelect: document.getElementById('sideSelect'),
      levelSelect: document.getElementById('levelSelect'),
      engineStatusBadge: document.getElementById('engineStatusBadge'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      matchPhase: document.getElementById('matchPhase'),
      redScore: document.getElementById('redScore'),
      blackScore: document.getElementById('blackScore'),
      redCaptures: document.getElementById('redCaptures'),
      blackCaptures: document.getElementById('blackCaptures'),
      redState: document.getElementById('redState'),
      blackState: document.getElementById('blackState'),

      newGameBtn: document.getElementById('newGameBtn'),
      undoBtn: document.getElementById('undoBtn'),
      hintBtn: document.getElementById('hintBtn'),
      toggleAnalysisBtn: document.getElementById('toggleAnalysisBtn'),
      fenModalBtn: document.getElementById('fenModalBtn'),
      settingsBtn: document.getElementById('settingsBtn'),

      turnIndicator: document.getElementById('turnIndicator'),
      analysisDrawer: document.getElementById('analysisDrawer'),
      evalEngineName: document.getElementById('evalEngineName'),
      evalBarRed: document.getElementById('evalBarRed'),
      evalScore: document.getElementById('evalScore'),
      evalDepth: document.getElementById('evalDepth'),
      evalNodes: document.getElementById('evalNodes'),
      evalNps: document.getElementById('evalNps'),
      evalPv: document.getElementById('evalPv'),
      aiThinkingSignal: document.getElementById('aiThinkingSignal'),
      battleEvent: document.getElementById('battleEvent'),
      battleEventPortrait: document.getElementById('battleEventPortrait'),
      battleEventKicker: document.getElementById('battleEventKicker'),
      battleEventTitle: document.getElementById('battleEventTitle'),
      battleEventDetail: document.getElementById('battleEventDetail'),

      gameStatusText: document.getElementById('gameStatusText'),
      replayFirstBtn: document.getElementById('replayFirstBtn'),
      replayPrevBtn: document.getElementById('replayPrevBtn'),
      stepCounter: document.getElementById('stepCounter'),
      replayNextBtn: document.getElementById('replayNextBtn'),
      replayLastBtn: document.getElementById('replayLastBtn'),
      moveList: document.getElementById('moveList'),
      railNewGameBtn: document.getElementById('railNewGameBtn'),
      railUndoBtn: document.getElementById('railUndoBtn'),
      railHintBtn: document.getElementById('railHintBtn'),
      railFenBtn: document.getElementById('railFenBtn'),

      fenModal: document.getElementById('fenModal'),
      closeFenModalBtn: document.getElementById('closeFenModalBtn'),
      fenTextarea: document.getElementById('fenTextarea'),
      iccsTextarea: document.getElementById('iccsTextarea'),
      copyFenBtn: document.getElementById('copyFenBtn'),
      applyFenBtn: document.getElementById('applyFenBtn'),
      applyIccsBtn: document.getElementById('applyIccsBtn'),
      exportJsonBtn: document.getElementById('exportJsonBtn'),
      importJsonBtn: document.getElementById('importJsonBtn'),
      jsonFileInput: document.getElementById('jsonFileInput'),
      toast: document.getElementById('toast'),

      settingsModal: document.getElementById('settingsModal'),
      closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
      reducedMotionToggle: document.getElementById('reducedMotionToggle'),
      challengeModeToggle: document.getElementById('challengeModeToggle'),
      soundToggle: document.getElementById('soundToggle'),
      themeSelect: document.getElementById('themeSelect'),
      roughnessRange: document.getElementById('roughnessRange'),
      metalnessRange: document.getElementById('metalnessRange'),
      clearcoatRange: document.getElementById('clearcoatRange'),
      pulseRange: document.getElementById('pulseRange'),
      roughnessValue: document.getElementById('roughnessValue'),
      metalnessValue: document.getElementById('metalnessValue'),
      clearcoatValue: document.getElementById('clearcoatValue'),
      pulseValue: document.getElementById('pulseValue'),
      clearSaveBtn: document.getElementById('clearSaveBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    };
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.mode = parsed.mode || 'pve';
        this.playerColor = parsed.playerColor || RED;
        this.level = parsed.level || 5;
        this.challengeMode = !!parsed.challengeMode;
        this.reducedMotion = !!parsed.reducedMotion;
        this.soundEnabled = parsed.soundEnabled !== false;
        this.theme = parsed.theme === 'epic' ? 'epic' : 'living';
        this.materialSettings = { ...this.materialSettings, ...(parsed.materialSettings || {}) };
      }
    } catch (e) {
      console.warn('[App] Settings load error:', e);
    }

    this.dom.modeSelect.value = this.mode;
    this.dom.sideSelect.value = this.playerColor;
    this.dom.levelSelect.value = this.level.toString();
    this.dom.reducedMotionToggle.checked = this.reducedMotion;
    this.dom.challengeModeToggle.checked = this.challengeMode;
    this.dom.soundToggle.checked = this.soundEnabled;
    this.dom.themeSelect.value = this.theme;
    this.syncMaterialControls();
    document.body.dataset.boardTheme = this.theme;
    this.syncThemeMeta();
    setAudioEnabled(this.soundEnabled);
  }

  saveSettings() {
    const data = {
      mode: this.mode,
      playerColor: this.playerColor,
      level: this.level,
      challengeMode: this.challengeMode,
      reducedMotion: this.reducedMotion,
      soundEnabled: this.soundEnabled,
      theme: this.theme,
      materialSettings: this.materialSettings,
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  initBoard() {
    this.board3D = new XiangqiBoard3D(this.dom.stage, {
      playerColor: this.playerColor,
      reducedMotion: this.reducedMotion,
      theme: this.theme,
      material: this.materialSettings,
      onMakeMove: (piece, to) => this.handleHumanMove(piece, to),
      onSelectPiece: (piece, moves) => this.handlePieceSelection(piece, moves),
    });

    // Try load game state
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.state && Array.isArray(parsed.state.pieces)) {
          this.state = parsed.state;
        } else if (parsed.fen) {
          this.state = fenToBoard(parsed.fen);
        }
      } catch (e) {}
    }

    this.board3D.renderState(this.state);
  }

  async preheatEngine() {
    this.updateStatusBadge('初始化 AI...', 'normal');
    await preheatAI(this.level);
    this.updateEngineBadgeInfo();
  }

  updateEngineBadgeInfo() {
    const status = getAIEngineStatus();
    if (status.isFallback) {
      this.updateStatusBadge('Pikafish 降级 (Wukong)', 'degraded');
    } else if (this.level >= 3) {
      const threads = status.pikafish.threads || 8;
      this.updateStatusBadge(`Pikafish READY (${threads}T)`, 'normal');
    } else {
      this.updateStatusBadge('Wukong READY', 'normal');
    }
  }

  updateStatusBadge(text, stateType) {
    this.dom.statusText.textContent = text;
    this.dom.statusDot.className = 'status-dot';
    if (stateType === 'degraded') this.dom.statusDot.classList.add('degraded');
    else if (stateType === 'error') this.dom.statusDot.classList.add('error');
  }

  bindEvents() {
    this.dom.modeSelect.addEventListener('change', (e) => {
      this.mode = e.target.value;
      this.stopEveAutoPlay();
      this.saveSettings();
      this.checkTurnAndTriggerAI();
    });

    this.dom.sideSelect.addEventListener('change', (e) => {
      this.playerColor = e.target.value;
      this.board3D.setPlayerColor(this.playerColor);
      this.saveSettings();
      this.checkTurnAndTriggerAI();
    });

    this.dom.levelSelect.addEventListener('change', (e) => {
      this.level = parseInt(e.target.value, 10);
      this.saveSettings();
      this.preheatEngine();
    });

    this.dom.newGameBtn.addEventListener('click', () => this.startNewGame());
    this.dom.undoBtn.addEventListener('click', () => this.handleUndo());
    this.dom.hintBtn.addEventListener('click', () => this.handleHint());

    this.dom.toggleAnalysisBtn.addEventListener('click', () => {
      const hidden = this.dom.analysisDrawer.classList.toggle('hidden');
      this.dom.toggleAnalysisBtn.setAttribute('aria-expanded', String(!hidden));
    });

    this.dom.fenModalBtn.addEventListener('click', () => this.openFenModal());
    this.dom.closeFenModalBtn.addEventListener('click', () => this.closeFenModal());
    this.dom.applyFenBtn.addEventListener('click', () => this.applyFenFromModal());
    this.dom.applyIccsBtn.addEventListener('click', () => this.applyIccsFromModal());
    this.dom.exportJsonBtn.addEventListener('click', () => this.exportGameJSON());
    this.dom.importJsonBtn.addEventListener('click', () => this.dom.jsonFileInput.click());
    this.dom.jsonFileInput.addEventListener('change', (e) => this.importGameJSON(e.target.files?.[0]));
    this.dom.copyFenBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(this.dom.fenTextarea.value);
      this.notify('FEN 已复制');
    });

    this.dom.settingsBtn.addEventListener('click', () => {
      this.dom.settingsModal.classList.add('active');
    });
    this.dom.themeSelect.addEventListener('change', (e) => {
      this.theme = e.target.value === 'epic' ? 'epic' : 'living';
      document.body.dataset.boardTheme = this.theme;
      this.board3D.setTheme(this.theme);
      this.syncThemeMeta();
      requestAnimationFrame(() => this.board3D.onResize());
      this.saveSettings();
    });
    for (const key of ['roughness', 'metalness', 'clearcoat', 'pulse']) {
      const input = this.dom[`${key}Range`];
      input.addEventListener('input', () => {
        this.materialSettings[key] = Number(input.value);
        this.dom[`${key}Value`].value = Number(input.value).toFixed(2);
        this.board3D.updateMaterialSettings(this.materialSettings);
      });
      input.addEventListener('change', () => this.saveSettings());
    }
    this.dom.closeSettingsModalBtn.addEventListener('click', () => {
      this.dom.settingsModal.classList.remove('active');
    });
    this.dom.saveSettingsBtn.addEventListener('click', () => {
      this.reducedMotion = this.dom.reducedMotionToggle.checked;
      this.challengeMode = this.dom.challengeModeToggle.checked;
      this.soundEnabled = this.dom.soundToggle.checked;
      this.theme = this.dom.themeSelect.value === 'epic' ? 'epic' : 'living';

      setAudioEnabled(this.soundEnabled);
      this.board3D.setReducedMotion(this.reducedMotion);
      this.board3D.setTheme(this.theme);
      this.board3D.updateMaterialSettings(this.materialSettings);
      document.body.dataset.boardTheme = this.theme;
      this.syncThemeMeta();
      this.saveSettings();
      this.dom.settingsModal.classList.remove('active');
      this.updateUI();
    });

    this.dom.clearSaveBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      this.notify('本地存档已清空');
    });

    // Replay controls
    this.dom.replayFirstBtn.addEventListener('click', () => this.setReplayIndex(0));
    this.dom.replayPrevBtn.addEventListener('click', () => this.stepReplay(-1));
    this.dom.replayNextBtn.addEventListener('click', () => this.stepReplay(1));
    this.dom.replayLastBtn.addEventListener('click', () => this.setReplayIndex(-1));
    this.dom.railNewGameBtn.addEventListener('click', () => this.startNewGame());
    this.dom.railUndoBtn.addEventListener('click', () => this.handleUndo());
    this.dom.railHintBtn.addEventListener('click', () => this.handleHint());
    this.dom.railFenBtn.addEventListener('click', () => this.openFenModal());
  }

  startNewGame(customState = null) {
    this.stopEveAutoPlay();
    this.state = customState || createInitialState();
    this.undoCountInChallenge = 0;
    this.replayIndex = -1;
    this.isAiThinking = false;
    this.captureStreak = { red: 0, black: 0 };
    this.hideBattleEvent();

    this.board3D.renderState(this.state);
    this.saveGameState();
    this.updateUI();
    this.checkTurnAndTriggerAI();
  }

  saveGameState() {
    try {
      const data = {
        fen: boardToFen(this.state),
        state: this.state
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  handleHumanMove(piece, toPos) {
    if (this.isAiThinking || this.replayIndex !== -1) return;
    if (this.mode === 'pve' && this.state.turn !== this.playerColor) return;

    const actor = { ...piece };
    const captured = applyMove(this.state, piece, toPos);
    if (captured) playCaptureSound();
    else playMoveSound();

    this.onMoveApplied(actor, captured);
  }

  handlePieceSelection(piece, moves = []) {
    if (!piece || moves.length > 0) return;
    const candidates = pseudoMoves(this.state.pieces, piece);
    const glyph = GLYPH[piece.color][piece.type];
    if (candidates.length > 0) {
      this.notify(`${glyph}的候选位置会让己方将帅受将，当前不能走`);
    } else {
      this.notify(`${glyph}当前被己方棋子或边界阻挡，没有可走位置`);
    }
  }

  onMoveApplied(actor = null, captured = null) {
    this.board3D.renderState(this.state);
    this.saveGameState();
    this.updateUI();

    const st = gameStatus(this.state);
    this.handleBattleOutcome(actor, captured, st);
    if (st.check && !st.over) playCheckSound();
    if (st.over) {
      playVictorySound();
      this.stopEveAutoPlay();
      return;
    }

    this.checkTurnAndTriggerAI();
  }

  async checkTurnAndTriggerAI() {
    if (this.isAiThinking) return;

    const st = gameStatus(this.state);
    if (st.over) return;

    if (this.mode === 'pve' && this.state.turn !== this.playerColor) {
      await this.runAIMove();
    } else if (this.mode === 'eve') {
      this.startEveAutoPlay();
    }
  }

  async runAIMove() {
    if (this.isAiThinking) return;
    this.isAiThinking = true;
    this.board3D.isInteractable = false;
    this.setThinkingState(true);
    this.updateStatusBadge('AI 思考中...', 'normal');

    let movedActor = null;
    let capturedPiece = null;

    try {
      const res = await getAIMove(this.state, this.level, (info) => this.updateAnalysisUI(info));
      this.lastAIResult = res;
      if (res && res.move) {
        const piece = pieceAt(this.state.pieces, res.move.from.row, res.move.from.col);
        const legal = piece ? legalMoves(this.state.pieces, piece) : [];
        const valid = legal.some(m => m.row === res.move.to.row && m.col === res.move.to.col);
        if (piece && piece.color === this.state.turn && valid) {
          movedActor = { ...piece };
          capturedPiece = applyMove(this.state, piece, res.move.to);
          if (capturedPiece) playCaptureSound();
          else playMoveSound();
          this.board3D.renderState(this.state);
          this.saveGameState();
        }
      }
    } catch (e) {
      console.error('[App] AI move error:', e);
    } finally {
      this.isAiThinking = false;
      this.board3D.isInteractable = true;
      this.setThinkingState(false);
      this.updateEngineBadgeInfo();
      this.updateUI();

      const st = gameStatus(this.state);
      if (movedActor) this.handleBattleOutcome(movedActor, capturedPiece, st);
      if (st.check && !st.over) playCheckSound();
      if (st.over) playVictorySound();
    }
  }

  startEveAutoPlay() {
    if (this.eveInterval) return;
    this.eveInterval = setInterval(async () => {
      const st = gameStatus(this.state);
      if (st.over || this.mode !== 'eve') {
        this.stopEveAutoPlay();
        return;
      }
      if (!this.isAiThinking) {
        await this.runAIMove();
      }
    }, 1200);
  }

  stopEveAutoPlay() {
    if (this.eveInterval) {
      clearInterval(this.eveInterval);
      this.eveInterval = null;
    }
  }

  handleUndo() {
    if (this.isAiThinking || this.state.history.length === 0) return;

    if (this.challengeMode) {
      if (this.undoCountInChallenge >= 3) {
        this.notify('挑战模式下悔棋上限为 3 次');
        return;
      }
      this.undoCountInChallenge++;
    }

    if (this.mode === 'pve') {
      // 悔棋两步 (AI 步 + 玩家步)
      undo(this.state);
      if (this.state.history.length > 0 && this.state.turn !== this.playerColor) {
        undo(this.state);
      }
    } else {
      undo(this.state);
    }

    this.replayIndex = -1;
    this.captureStreak = { red: 0, black: 0 };
    this.hideBattleEvent();
    this.board3D.renderState(this.state);
    this.saveGameState();
    this.updateUI();
  }

  async handleHint() {
    if (this.challengeMode) {
      this.notify('挑战模式已隐藏提示功能');
      return;
    }
    if (this.isAiThinking) return;

    this.updateStatusBadge('计算提示中...', 'normal');
    const res = await getAIMove(this.state, 3, (info) => this.updateAnalysisUI(info));
    this.updateEngineBadgeInfo();

    if (res && res.move) {
      const p = pieceAt(this.state.pieces, res.move.from.row, res.move.from.col);
      if (p) {
        this.board3D.showLegalMoves(p);
        this.notify(`AI 建议：${res.bestmove}`);
      }
    }
  }

  updateAnalysisUI(info) {
    if (!info) return;
    this.dom.evalEngineName.textContent = info.engineName || 'Engine';

    let cp = info.score || 0;
    if (this.state.turn === BLACK) cp = -cp;

    // Convert CP to Win % for bar
    const winProb = 1 / (1 + Math.exp(-cp / 300));
    const redWidth = Math.min(Math.max(winProb * 100, 5), 95);
    this.dom.evalBarRed.style.width = `${redWidth}%`;

    const formattedCp = (cp / 100).toFixed(2);
    this.dom.evalScore.textContent = formattedCp > 0 ? `+${formattedCp}` : `${formattedCp}`;
    this.dom.evalDepth.textContent = info.depth || '-';
    this.dom.evalNodes.textContent = Number.isFinite(info.nodes) ? info.nodes.toLocaleString() : '-';
    this.dom.evalNps.textContent = Number.isFinite(info.nps) ? info.nps.toLocaleString() : '-';
    this.dom.evalPv.textContent = `变例: ${info.pv || '-'}`;
  }

  stepReplay(delta) {
    if (this.state.history.length === 0) return;
    const maxStep = this.state.history.length;
    let target = (this.replayIndex === -1 ? maxStep : this.replayIndex) + delta;
    if (target < 0) target = 0;
    if (target >= maxStep) target = -1;
    this.setReplayIndex(target);
  }

  setReplayIndex(idx) {
    this.replayIndex = idx;
    // Rebuild board from start to replayIndex
    const startState = createInitialState();
    const limit = idx === -1 ? this.state.history.length : idx;

    for (let i = 0; i < limit; i++) {
      const h = this.state.history[i];
      const p = pieceAt(startState.pieces, h.from.row, h.from.col);
      if (p) applyMove(startState, p, h.to);
    }

    this.board3D.renderState(startState);
    this.updateUI();
  }

  updateUI() {
    const isRedTurn = this.state.turn === RED;
    this.dom.turnIndicator.textContent = isRedTurn ? '红方行棋' : '黑方行棋';
    this.dom.turnIndicator.className = `turn-indicator ${isRedTurn ? 'red-turn' : 'black-turn'}`;

    const st = gameStatus(this.state);
    let statusMsg = `${isRedTurn ? '红方行棋' : '黑方行棋'}`;
    if (st.check) statusMsg += ' [将军!]';
    if (st.over) {
      statusMsg = `对局结束 · ${st.winner === RED ? '红方胜!' : '黑方胜!'}`;
    }

    if (this.challengeMode) {
      statusMsg += ` (挑战模式 悔棋: ${this.undoCountInChallenge}/3)`;
      this.dom.hintBtn.disabled = true;
    } else {
      this.dom.hintBtn.disabled = false;
    }

    this.dom.gameStatusText.textContent = statusMsg;
    this.dom.redState.textContent = isRedTurn ? (this.isAiThinking ? 'AI 推演中' : '正在行棋') : '等待行棋';
    this.dom.blackState.textContent = !isRedTurn ? (this.isAiThinking ? 'AI 推演中' : '正在行棋') : '等待行棋';
    document.querySelector('.player-red')?.classList.toggle('active', isRedTurn);
    document.querySelector('.player-black')?.classList.toggle('active', !isRedTurn);

    const ply = this.state.history.length;
    this.dom.matchPhase.textContent = ply < 12 ? '开局' : (ply < 48 ? '中盘' : '残局');
    this.updateScoreUI();
    this.updateMoveList();

    // Step counter
    const currentStep = this.replayIndex === -1 ? this.state.history.length : this.replayIndex;
    this.dom.stepCounter.textContent = `${currentStep} / ${this.state.history.length}`;
  }

  syncThemeMeta() {
    const themeColor = this.theme === 'epic' ? '#172033' : '#e9e1d2';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }

  setThinkingState(active) {
    this.dom.aiThinkingSignal.classList.toggle('active', active);
    document.querySelector('.stage-container')?.classList.toggle('is-thinking', active);
  }

  updateScoreUI() {
    const score = { red: 0, black: 0 };
    const captures = { red: 0, black: 0 };
    for (const move of this.state.history) {
      if (!move.captured) continue;
      const scorer = move.captured.color === RED ? BLACK : RED;
      score[scorer] += PIECE_VALUES[move.captured.type] || 0;
      captures[scorer] += 1;
    }
    this.dom.redScore.textContent = String(score.red);
    this.dom.blackScore.textContent = String(score.black);
    this.dom.redCaptures.textContent = `${captures.red} 枚`;
    this.dom.blackCaptures.textContent = `${captures.black} 枚`;
  }

  updateMoveList() {
    const moves = this.state.history;
    if (!moves.length) {
      this.dom.moveList.innerHTML = '<li class="empty-move">尚未落子</li>';
      return;
    }
    this.dom.moveList.replaceChildren(...moves.map((move, index) => {
      const li = document.createElement('li');
      li.textContent = moveToString(move.from, move.to);
      li.title = `第 ${index + 1} 步${move.captured ? `，吃 ${move.captured.type}` : ''}`;
      return li;
    }));
    this.dom.moveList.scrollTop = this.dom.moveList.scrollHeight;
  }

  handleBattleOutcome(actor, captured, status) {
    if (!actor) return;
    if (captured) this.captureStreak[actor.color] += 1;
    else this.captureStreak[actor.color] = 0;

    const points = captured ? (PIECE_VALUES[captured.type] || 0) : 0;
    const streak = this.captureStreak[actor.color];
    if (status.over) {
      const winner = status.winner || actor.color;
      this.showBattleEvent({
        actor: { color: winner, type: 'general' },
        kind: 'victory', kicker: '终局', title: `${winner === RED ? '红方' : '黑方'}胜`,
        detail: `总战果 ${this.dom[`${winner}Score`]?.textContent || 0} 分`, duration: 4200
      });
      return;
    }
    if (status.check) {
      this.showBattleEvent({
        actor, kind: 'major', kicker: captured ? '破阵将军' : '将军', title: '将军',
        detail: captured ? `+${points}${streak >= 2 ? ` · ${streak} 连破` : ''}` : '王域受压', duration: 1900
      });
      return;
    }
    if (captured) {
      const highValue = points >= 4;
      this.showBattleEvent({
        actor, kind: highValue ? 'major' : 'capture', kicker: streak >= 2 ? `${streak} 连破` : '战果',
        title: `击破 · ${GLYPH[captured.color][captured.type]}`,
        detail: `+${points}${highValue ? ' 高价值目标' : ''}`, duration: highValue ? 1500 : 1050
      });
    }
  }

  showBattleEvent({ actor, kind, kicker, title, detail, duration = 1200 }) {
    clearTimeout(this.battleEventTimer);
    const el = this.dom.battleEvent;
    el.className = `battle-event ${actor.color === BLACK ? 'black ' : ''}${kind === 'major' ? 'major ' : ''}${kind === 'victory' ? 'victory ' : ''}`.trim();
    this.dom.battleEventPortrait.src = EVENT_PORTRAITS[actor.color][actor.type] || EVENT_PORTRAITS[actor.color].general;
    this.dom.battleEventPortrait.alt = `${actor.color === RED ? '红方' : '黑方'}${GLYPH[actor.color][actor.type] || ''}角色插画`;
    this.dom.battleEventKicker.textContent = kicker;
    this.dom.battleEventTitle.textContent = title;
    this.dom.battleEventDetail.textContent = detail;
    requestAnimationFrame(() => el.classList.add('visible'));
    if (!this.reducedMotion) this.board3D.triggerEventPulse(actor.color, kind);
    this.battleEventTimer = setTimeout(() => this.hideBattleEvent(), this.reducedMotion ? 650 : duration);
  }

  hideBattleEvent() {
    clearTimeout(this.battleEventTimer);
    this.dom.battleEvent?.classList.remove('visible');
  }

  openFenModal() {
    this.dom.fenTextarea.value = boardToFen(this.state);
    const moves = this.state.history.map(h => moveToString(h.from, h.to)).join(' ');
    this.dom.iccsTextarea.value = moves || '(暂无历史走法)';
    this.dom.fenModal.classList.add('active');
  }

  closeFenModal() {
    this.dom.fenModal.classList.remove('active');
  }

  applyFenFromModal() {
    const fen = this.dom.fenTextarea.value.trim();
    if (fen) {
      const newBoard = fenToBoard(fen);
      this.startNewGame(newBoard);
      this.closeFenModal();
    }
  }

  applyIccsFromModal() {
    const tokens = this.dom.iccsTextarea.value.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return this.notify('请先输入 ICCS 着法');
    const next = createInitialState();
    for (const token of tokens) {
      if (!/^[a-i][0-9][a-i][0-9]$/i.test(token)) return this.notify(`ICCS 格式错误：${token}`);
      const move = stringToMove(token.toLowerCase());
      const piece = pieceAt(next.pieces, move.from.row, move.from.col);
      const legal = piece && piece.color === next.turn ? legalMoves(next.pieces, piece) : [];
      if (!piece || !legal.some(m => m.row === move.to.row && m.col === move.to.col)) {
        return this.notify(`非法着法：${token}`);
      }
      applyMove(next, piece, move.to);
    }
    this.startNewGame(next);
    this.closeFenModal();
    this.notify(`已载入 ${tokens.length} 步 ICCS 棋谱`);
  }

  exportGameJSON() {
    const payload = {
      schema: 'lu-xiangqi-game',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: this.state,
      fen: boardToFen(this.state),
      iccs: this.state.history.map(h => moveToString(h.from, h.to))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lu-xiangqi-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify('JSON 棋谱已导出');
  }

  async importGameJSON(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.schema !== 'lu-xiangqi-game' || !Array.isArray(payload.state?.pieces)) {
        throw new Error('不是有效的弈律棋谱');
      }
      this.startNewGame(payload.state);
      this.closeFenModal();
      this.notify('JSON 棋谱已载入');
    } catch (error) {
      this.notify(`导入失败：${error.message}`);
    } finally {
      this.dom.jsonFileInput.value = '';
    }
  }

  notify(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.dom.toast.classList.remove('visible'), 2200);
  }

  syncMaterialControls() {
    for (const key of ['roughness', 'metalness', 'clearcoat', 'pulse']) {
      const value = Number(this.materialSettings[key]);
      this.dom[`${key}Range`].value = value;
      this.dom[`${key}Value`].value = value.toFixed(2);
    }
  }
}

// Bootstrap Application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new XiangqiApp();
});
