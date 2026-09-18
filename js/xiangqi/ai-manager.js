// 弈律 AI 引擎统一调度管理器 (双 AI, 五档难度, 真实 WASM 数据, 700ms 延时体验, 自动降级)
import { boardToFen } from './rules.js';
import { searchWukong } from './ai-wukong.js';
import { initPikafish, searchPikafish, isPikafishReady, getPikafishStatus } from './ai-pikafish.js';

export const AI_LEVELS = [
  { level: 1, name: '入门 (Wukong L1)', engine: 'wukong', depth: 1 },
  { level: 2, name: '进阶 (Wukong L2)', engine: 'wukong', depth: 3 },
  { level: 3, name: '专业 (Pikafish L3)', engine: 'pikafish', movetime: 1000 },
  { level: 4, name: '大师 (Pikafish L4)', engine: 'pikafish', movetime: 2000 },
  { level: 5, name: '宗师 (Pikafish L5)', engine: 'pikafish', movetime: 3500 },
];

let isFallbackMode = false;
let fallbackReason = '';

export function getAIEngineStatus() {
  const pStatus = getPikafishStatus();
  return {
    pikafish: pStatus,
    isFallback: isFallbackMode,
    fallbackReason: fallbackReason
  };
}

export async function preheatAI(level) {
  if (level >= 3) {
    try {
      await initPikafish();
    } catch (err) {
      isFallbackMode = true;
      fallbackReason = err.message || 'Pikafish 初始化失败';
      console.warn('[AIManager] Pikafish 预加载失败，将自动降级 Wukong:', err.message);
    }
  }
}

export async function getAIMove(state, level = 1, onInfo = null) {
  const startTime = Date.now();
  const fen = boardToFen(state);
  const levelConfig = AI_LEVELS.find(l => l.level === level) || AI_LEVELS[0];

  let result = null;
  let actualEngine = levelConfig.engine;

  if (levelConfig.engine === 'pikafish' && !isFallbackMode) {
    try {
      if (!isPikafishReady()) {
        await initPikafish();
      }
      result = await searchPikafish(fen, levelConfig.movetime, onInfo);
      actualEngine = 'Pikafish';
    } catch (err) {
      console.warn('[AIManager] Pikafish 搜索遇到异常，已自动降级至 Wukong 引擎:', err.message);
      isFallbackMode = true;
      fallbackReason = err.message || 'Pikafish 搜索失败';
      actualEngine = 'Wukong (降级)';
    }
  }

  if (!result || actualEngine.includes('Wukong')) {
    const searchDepth = levelConfig.engine === 'wukong' ? levelConfig.depth : 4;
    result = await searchWukong(fen, searchDepth);
    actualEngine = isFallbackMode ? 'Wukong (降级模式)' : 'Wukong';

    if (onInfo) {
      onInfo({
        depth: searchDepth,
        score: null,
        nodes: null,
        nps: null,
        pv: result.bestmove,
        engineName: actualEngine
      });
    }
  }

  // 强制 AI 最短表现延迟 700ms
  const elapsed = Date.now() - startTime;
  if (elapsed < 700) {
    await new Promise(resolve => setTimeout(resolve, 700 - elapsed));
  }

  return {
    ...result,
    engineName: actualEngine,
    isFallback: isFallbackMode,
    fallbackReason
  };
}
