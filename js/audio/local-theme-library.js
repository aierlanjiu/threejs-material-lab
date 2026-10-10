const DATABASE = 'lu-local-theme-audio-v1';
const STORE = 'tracks';

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'type' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLocalThemeAudio() {
  const database = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveLocalThemeAudio(type, file, lyrics = null, lrcText = '') {
  const database = await openLibrary();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const record = { type, name: file.name, file, updatedAt: Date.now() };
      if (lyrics) record.lyrics = lyrics;
      if (lrcText) record.lrcText = lrcText;
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveLocalThemeLyrics(type, lyrics, lrcText) {
  const database = await openLibrary();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = store.get(type);
      request.onsuccess = () => {
        store.put({ ...request.result, type, lyrics, lrcText, updatedAt: Date.now() });
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function deleteLocalThemeAudio(type) {
  const database = await openLibrary();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(type);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function discoverLocalThemeTrack(type) {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('localAudio') === '0') {
    return null;
  }
  const audioPath = `output/audio/${type}.mp3`;
  const lrcPath = `output/audio/${type}.lrc`;
  try {
    const headRes = await fetch(audioPath, { method: 'HEAD' });
    if (!headRes.ok) return null;
    let lrcText = '';
    try {
      const lrcRes = await fetch(lrcPath);
      if (lrcRes.ok) lrcText = await lrcRes.text();
    } catch {}
    return {
      type,
      src: audioPath,
      lrcText
    };
  } catch {
    return null;
  }
}

export async function loadLocalThemeTranslation(type, sourceText) {
  if (!sourceText || !/^anime_[a-z_]+$/.test(type)) return '';
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('localAudio') === '0') return '';
  try {
    const response = await fetch(`output/audio/${type}.zh.lrc`);
    if (!response.ok) return '';
    const text = await response.text();
    const expected = text.match(/\[source-sha256:([a-f0-9]{64})\]/)?.[1];
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceText));
    const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return expected === actual ? text : '';
  } catch {
    return '';
  }
}
