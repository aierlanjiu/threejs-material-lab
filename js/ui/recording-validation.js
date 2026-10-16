export async function validateRecordedVideo(blob,{width,height},timeout=12000){
 const url=URL.createObjectURL(blob),video=document.createElement('video');video.preload='metadata';video.muted=true;
 try{return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('视频帧校验超时，未导出无效成片')),timeout);
  video.onloadedmetadata=()=>{clearTimeout(timer);if(video.videoWidth!==width||video.videoHeight!==height)reject(new Error('未捕获到完整视频帧，请重试录制'));else resolve({width:video.videoWidth,height:video.videoHeight});};
  video.onerror=()=>{clearTimeout(timer);reject(new Error('视频无法解码，未导出无效成片'));};
  video.src=url;
 });}finally{video.onloadedmetadata=null;video.onerror=null;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
