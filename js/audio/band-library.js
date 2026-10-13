import { validateBandScore } from './band-timeline.js';
export const BAND_TRACKS=Object.freeze([
 ['anime_op_we_are','We Are!','one-piece'],['anime_op_over_the_top','OVER THE TOP','one-piece'],['anime_op_overtaken','Overtaken','one-piece'],['anime_op_one_day','One day','one-piece'],
 ['anime_db_chala','CHA-LA HEAD-CHA-LA','dragon-ball'],['anime_db_makafushigi','Makafushigi Adventure!','dragon-ball'],['anime_db_dandan','DAN DAN 心魅かれてく','dragon-ball'],
 ['anime_nr_blue_bird','Blue Bird','naruto'],['anime_nr_silhouette','Silhouette','naruto'],['anime_nr_sign','Sign','naruto']
].map(([id,title,theme])=>Object.freeze({id,title,theme})));
export async function loadBandAnalysis(id,{signal}={}){
 if(!BAND_TRACKS.some(t=>t.id===id))return null;
 const response=await fetch(`./output/lu-band/${id}/score.json`,{signal});if(!response.ok)return null;
 const score=await response.json(),checked=validateBandScore(score);
 if(!checked.ok||score.trackId!==id||score.source!=='analysis'||!/^[a-f0-9]{64}$/.test(score.sourceSha256))throw new Error('声部谱面数据未通过校验');
 return score;
}
export async function verifyBandSource(score,src,signal){
 if(!src)return false;const response=await fetch(src,{signal});if(!response.ok)return false;
 const data=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',data);
 const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return hash===score.sourceSha256;
}
