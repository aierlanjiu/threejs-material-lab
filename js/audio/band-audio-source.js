export function createBandAudioSources({fetcher=fetch,locationHost=location.hostname,urlApi=URL}={}){
 const blobs=new Map(),support=new Map(),pending=new Map();let disposed=false,mode='native';
 const local=/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/.test(locationHost);
 async function nativeRange(src){
  if(!local)return true;
  if(!support.has(src))support.set(src,fetcher(src,{method:'HEAD',signal:AbortSignal.timeout(8000)}).then(r=>{
   if(r.status===405||r.status===501)return false;
   if(!r.ok)throw new Error('音频无法读取');return /bytes/i.test(r.headers.get('Accept-Ranges')||'');
  }));
  try{return await support.get(src);}catch(error){support.delete(src);throw error;}
 }
 async function resolve(src){
  if(disposed)throw new Error('试听已关闭');
  if(await nativeRange(src)){mode='native';return src;}
  mode='blob-fallback';
  if(blobs.has(src)){const value=blobs.get(src);blobs.delete(src);blobs.set(src,value);return value;}
  if(!pending.has(src))pending.set(src,(async()=>{const r=await fetcher(src,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('声部音频无法读取');const blob=await r.blob();if(disposed)throw new Error('试听已关闭');const value=urlApi.createObjectURL(blob);blobs.set(src,value);
   while(blobs.size>3){const oldest=blobs.keys().next().value;urlApi.revokeObjectURL(blobs.get(oldest));blobs.delete(oldest);}return value;
  })().finally(()=>pending.delete(src)));
  return pending.get(src);
 }
 return {resolve,get mode(){return mode;},dispose(){disposed=true;for(const value of blobs.values())urlApi.revokeObjectURL(value);blobs.clear();support.clear();}};
}
