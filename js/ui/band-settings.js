export const BAND_PRESETS=Object.freeze({
 concert:{label:'舞台合奏',actorSize:1.1,instrumentSize:.8,gap:.1,actorRotation:-6,instrumentRotation:8,actorMotion:1.2,instrumentMotion:1.4},
 equal:{label:'沉静合奏',actorSize:1,instrumentSize:1,gap:.12,actorRotation:0,instrumentRotation:0,actorMotion:.5,instrumentMotion:.8},
 companion:{label:'轻快伴奏',actorSize:1.05,instrumentSize:.45,gap:-.12,actorRotation:-5,instrumentRotation:12,actorMotion:.9,instrumentMotion:1.4}
});
export const BAND_FIELDS=Object.freeze([
 ['actorSize','宠物大小',.45,1.6,.05],['instrumentSize','演奏幅度',.25,1.6,.05],
 ['gap','站位留白',-.35,.6,.05],['actorRotation','角色朝向',-35,35,1],['instrumentRotation','演奏倾角',-45,45,1],
 ['actorMotion','演员律动',0,2,.1],['instrumentMotion','乐器律动',0,2,.1]
].map(([id,label,min,max,step])=>Object.freeze({id,label,min,max,step})));
export function defaultBandSettings(){return {version:2,stageLook:'cream',preset:'concert',formation:'auto',lightMode:'multi',effects:'auto',pyroSound:true,contrast:true,spread:1,...BAND_PRESETS.concert,overrides:{}};}
const formations=new Set(['auto','arc','terrace','ring','wings','solo']);
export function normalizeBandSettings(input={}){
 const result=defaultBandSettings();
 if(input&&typeof input==='object'){
  if(['cream','island','shell'].includes(input.stageLook))result.stageLook=input.stageLook;
  if(BAND_PRESETS[input.preset])result.preset=input.preset;
  if(formations.has(input.formation))result.formation=input.formation;
  if(['follow','move','multi'].includes(input.lightMode))result.lightMode=input.lightMode;
  if(['auto','off','preview'].includes(input.effects))result.effects=input.effects;
  if(typeof input.pyroSound==='boolean')result.pyroSound=input.pyroSound;
  if(typeof input.contrast==='boolean')result.contrast=input.contrast;
  if(Number.isFinite(input.spread))result.spread=Math.min(1.3,Math.max(.8,input.spread));
  for(const f of BAND_FIELDS)if(Number.isFinite(input[f.id]))result[f.id]=Number((f.min+Math.round((Math.min(f.max,Math.max(f.min,input[f.id]))-f.min)/f.step)*f.step).toFixed(2));
  if(input.overrides&&typeof input.overrides==='object')for(const [id,raw] of Object.entries(input.overrides)){
   if(!/^(one-piece|dragon-ball|naruto)\/[a-z0-9-]+$/.test(id)||!raw||typeof raw!=='object')continue;
   const custom={};for(const f of BAND_FIELDS)if(Number.isFinite(raw[f.id]))custom[f.id]=Number((f.min+Math.round((Math.min(f.max,Math.max(f.min,raw[f.id]))-f.min)/f.step)*f.step).toFixed(2));
   if(typeof raw.stem==='string'&&/^[a-z][a-z0-9_-]{0,30}$/.test(raw.stem))custom.stem=raw.stem;
   if(['voice','pluck','strike','sustain','keys','wind'].includes(raw.technique))custom.technique=raw.technique;
   result.overrides[id]=custom;
  }
 }
 return result;
}
export const settingsForMember=(settings,id)=>({...settings,...settings.overrides[id]});
export function loadBandSettings(key='lu_band_v2'){try{return normalizeBandSettings(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return defaultBandSettings();}}
export function saveBandSettings(settings,key='lu_band_v2'){try{localStorage.setItem(key,JSON.stringify(settings));}catch{}}
