// Wukong AI 引擎包装器
import { stringToMove } from './rules.js';

let wukongInstance = null;

export async function getWukongEngine() {
  if (wukongInstance) return wukongInstance;

  if (typeof window !== 'undefined' && window.Engine) {
    wukongInstance = typeof window.Engine === 'function' ? window.Engine() : window.Engine;
    return wukongInstance;
  }

  // Node 环境或 ES 模块环境尝试
  try {
    if (typeof window === 'undefined') {
      const path = await import('node:path');
      const url = await import('node:url');
      const __filename = url.fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const wukongPath = path.join(__dirname, '../../assets/xiangqi/vendor/wukong/wukong.js');
      const fs = await import('node:fs');
      const code = fs.readFileSync(wukongPath, 'utf8');
      const evalFn = new Function('exports', code + '\nreturn Engine;');
      const exportsObj = {};
      const EngineFn = evalFn(exportsObj);
      if (typeof EngineFn === 'function') {
        wukongInstance = EngineFn();
        return wukongInstance;
      }
    }
  } catch (e) {
    console.warn('[Wukong] Node fallback warning:', e.message);
  }

  if (typeof window !== 'undefined' && window.Engine) {
    wukongInstance = typeof window.Engine === 'function' ? window.Engine() : window.Engine;
    return wukongInstance;
  }

  throw new Error('Wukong 引擎未在全局加载 (Engine missing)');
}

export async function searchWukong(fen, depth = 3) {
  const engine = await getWukongEngine();
  engine.setBoard(fen);
  const moveInt = engine.search(depth);
  const moveStr = engine.moveToString(moveInt);
  return {
    bestmove: moveStr,
    move: stringToMove(moveStr),
    info: {
      depth,
      score: null,
      nodes: null,
      nps: null,
      pv: moveStr,
      engineName: 'Wukong'
    }
  };
}
