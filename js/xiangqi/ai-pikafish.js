// Pikafish WebAssembly + NNUE AI 引擎适配器
import { stringToMove } from './rules.js';

let worker = null;
let isReady = false;
let isFailed = false;
let failReason = '';
let currentThreads = 1;

let searchResolve = null;
let searchReject = null;
let infoCallback = null;
let initPromise = null;

export function isPikafishReady() {
  return isReady && !isFailed;
}

export function getPikafishStatus() {
  return {
    ready: isReady,
    failed: isFailed,
    reason: failReason,
    threads: currentThreads
  };
}

export function initPikafish() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.Worker === 'undefined') {
      isFailed = true;
      failReason = '当前环境不支持 Web Worker';
      return reject(new Error(failReason));
    }

    try {
      const workerUrl = 'assets/xiangqi/vendor/pikafish/js/worker/pikafish-engine.js';
      worker = new Worker(workerUrl);

      const timeout = setTimeout(() => {
        if (!isReady) {
          isFailed = true;
          failReason = 'Pikafish WASM 加载超时 (可能缺少 COOP/COEP 或 WASM 支持)';
          reject(new Error(failReason));
        }
      }, 90000);

      worker.onmessage = (e) => {
        const data = e.data || {};
        if (data.type === 'READY') {
          clearTimeout(timeout);
          isReady = true;
          isFailed = false;
          currentThreads = data.threads || (navigator.hardwareConcurrency ? Math.max(1, Math.floor(navigator.hardwareConcurrency * 0.9)) : 8);
          resolve({ threads: currentThreads });
        } else if (data.type === 'ERROR' || (data.type === 'info' && data.line && data.line.includes('ERROR'))) {
          clearTimeout(timeout);
          isFailed = true;
          failReason = data.message || 'Pikafish NNUE 权重或 WASM 初始化失败';
          if (searchReject) {
            const err = new Error(failReason);
            searchReject(err);
            searchReject = null;
            searchResolve = null;
          }
          reject(new Error(failReason));
        } else if (data.type === 'INFO') {
          if (infoCallback) infoCallback(data.info);
        } else if (data.type === 'BEST_MOVE') {
          if (searchResolve) {
            const moveStr = data.move;
            const res = {
              bestmove: moveStr,
              move: stringToMove(moveStr),
              info: data.info || {}
            };
            searchResolve(res);
            searchResolve = null;
            searchReject = null;
          }
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        isFailed = true;
        failReason = err.message || 'Pikafish Worker 线程内部报错';
        if (searchReject) {
          searchReject(err);
          searchReject = null;
          searchResolve = null;
        }
        reject(err);
      };

      worker.postMessage({ type: 'INIT' });
    } catch (err) {
      isFailed = true;
      failReason = err.message || '无法创建 Pikafish Worker';
      reject(err);
    }
  });

  return initPromise;
}

export function searchPikafish(fen, movetime = 2000, onInfo = null) {
  return new Promise((resolve, reject) => {
    if (!isReady || isFailed || !worker) {
      return reject(new Error(failReason || 'Pikafish 未就绪'));
    }
    searchResolve = resolve;
    searchReject = reject;
    infoCallback = onInfo;
    worker.postMessage({ type: 'SEARCH', fen, movetime });
  });
}

export function stopPikafish() {
  if (worker && isReady) {
    worker.postMessage({ type: 'STOP' });
  }
}
