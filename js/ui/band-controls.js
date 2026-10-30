import {bandRoster,BAND_TECHNIQUES} from '../audio/band-parts.js';
import {BAND_FORMATIONS} from '../audio/band-layout.js';
import {BAND_PRESETS,BAND_FIELDS,normalizeBandSettings,settingsForMember,saveBandSettings} from './band-settings.js';
import {songBindingSummary} from '../audio/band-song-parts.js';

export function createPyroSoundToggle(host,{settings,onChange,storageKey='lu_band_v2'}) {
 const button=document.createElement('button');button.type='button';button.className='lu-band-pyro-toggle';
 button.setAttribute('aria-label','焰火音效');
 button.innerHTML=`<svg class="lu-pyro-sound-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <g fill="none" stroke-linecap="round" stroke-width="2.2">
   <path d="M13 3v4m0 14v4M2 14h4m14 0h4" stroke="#e8a545"/>
   <path d="m5 6 3 3m10 10 3 3M5 22l3-3M18 9l3-3" stroke="#b695eb"/>
   <path d="m8 3 1 3m8-3-1 3M2 9l3 1m-3 8 3-1" stroke="#64cbd0"/>
  </g>
  <circle cx="13" cy="14" r="3.2" fill="#ffbf5e"/>
  <path d="M20 21h3l4-3v12l-4-3h-3z" fill="#78b7e9" stroke="#527da9" stroke-width="1" stroke-linejoin="round"/>
  <path class="lu-pyro-sound-on" d="M29 21q3 3 0 6" fill="none" stroke="#64cbd0" stroke-width="1.6" stroke-linecap="round"/>
  <path class="lu-pyro-sound-off" d="m20 19 10 11" fill="none" stroke="#df7f86" stroke-width="2" stroke-linecap="round"/>
 </svg>`;host.append(button);
 const styles=document.createElement('div');styles.className='lu-festival-switch';styles.setAttribute('role','group');styles.setAttribute('aria-label','舞台风格');
 styles.innerHTML=`<button type="button" data-look="cream" aria-label="奶油棱镜" title="奶油棱镜">
  <svg class="lu-stage-look-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
   <path d="m4 20 12-6 12 6v5l-12 6-12-6z" fill="#b9dedb" stroke="#548f94" stroke-width="1.2" stroke-linejoin="round"/>
   <path d="m4 20 12 6 12-6-12-6z" fill="#eef7ed"/>
   <path d="M16 3 6 20l10 5 10-5z" fill="#f5dfb5" stroke="#bb9b69" stroke-width="1.3" stroke-linejoin="round"/>
   <path d="M16 3v22l10-5z" fill="#c4c2ed"/>
   <path d="m16 3-5 18 5 4" fill="#fff7e5"/>
   <path d="M23 4v5m-2.5-2.5h5" fill="none" stroke="#7fc6cf" stroke-width="1.4" stroke-linecap="round"/>
  </svg><span class="lu-sr-only">奶油棱镜</span>
 </button><button type="button" data-look="island" aria-label="日落海岛" title="日落海岛">
  <svg class="lu-stage-look-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
   <circle cx="22" cy="10" r="6" fill="#ffb56b"/>
   <path d="M3 25q6-6 13-4t13 4v4H3z" fill="#efd29d"/>
   <path d="M3 28q4-2 8 0t8 0 10 0" fill="none" stroke="#58bfcf" stroke-width="2.6" stroke-linecap="round"/>
   <path d="M12 23q3-7 2-15" fill="none" stroke="#b98057" stroke-width="2.7" stroke-linecap="round"/>
   <path d="M14 9Q6 2 3 11q5-3 11-2Zm0 0q4-9 11-3-6 0-11 3Zm0 0q-6 2-7 8 5-2 7-8Zm0 0q7 0 9 7-7-2-9-7Z" fill="#4fae8b" stroke="#357e69" stroke-width=".8" stroke-linejoin="round"/>
  </svg><span class="lu-sr-only">日落海岛</span>
 </button><button type="button" data-look="shell" aria-label="珍珠贝壳" title="珍珠贝壳">
  <svg class="lu-stage-look-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
   <path d="M16 5C10 5 5 11 5 18c0 6 5 10 11 10s11-4 11-10c0-7-5-13-11-13z" fill="#f8f4ed" stroke="#d8a46c" stroke-width="1.2"/>
   <path d="M16 5v23M16 5c-3.8 4.5-6.5 11-6.5 18.5M16 5c3.8 4.5 6.5 11 6.5 18.5M16 5C8 9 6 16 6 22M16 5c8 4 10 11 10 17" fill="none" stroke="#5daaa0" stroke-width="1.1" stroke-linecap="round"/>
   <ellipse cx="16" cy="20.5" rx="3.6" ry="3.6" fill="#ffffff" stroke="#e29e58" stroke-width="1.2"/>
   <circle cx="16" cy="20.5" r="1.6" fill="#fedeba"/>
  </svg><span class="lu-sr-only">珍珠贝壳</span>
 </button>`;(document.getElementById('luAppleCapsuleBody')||host).append(styles);
 for(const option of styles.querySelectorAll('button'))option.addEventListener('click',()=>{settings.stageLook=option.dataset.look;saveBandSettings(settings,storageKey);render();onChange?.();});

 function render(){const look=settings.stageLook||'cream';document.body.dataset.festivalLook=look;for(const option of styles.querySelectorAll('button'))option.setAttribute('aria-pressed',String(option.dataset.look===look));const value=String(settings.pyroSound!==false);if(button.getAttribute('aria-pressed')!==value){button.setAttribute('aria-pressed',value);button.title=`焰火音效：${value==='true'?'开，点击关闭':'关，点击开启'}`;}}
 button.addEventListener('click',()=>{settings.pyroSound=settings.pyroSound===false;saveBandSettings(settings,storageKey);render();onChange?.();});render();
 return {button,render,dispose(){button.remove();styles.remove();delete document.body.dataset.festivalLook;}};
}

export function createBandControls(host,{settings,getTheme,getScore,onChange,onFocus,onListen=null,storageKey='lu_band_v2'}){
 host.classList.add('band-v2-controls');
 host.innerHTML=`<div class="lu-band-controls band-quick-controls">
  <label>队形<select data-control="formation" aria-label="乐队队形"><option value="auto">自动编排</option></select></label>
  <label>灯光<select data-control="lightMode" aria-label="乐队聚光调度"><option value="follow">单灯主奏</option><option value="move">人入光 · 追光</option><option value="multi">多灯合奏</option></select></label>
  <label>高潮点缀<select data-control="effects" aria-label="高潮点缀"><option value="auto">随音乐</option><option value="off">关闭</option><option value="preview">预览气泡与烟花</option></select></label>
  <label data-listen-controls hidden>声部校验试听<select data-control="listen" aria-label="声部试听"><option value="mix">完整混音</option></select><small data-listen-status aria-live="polite"></small></label>
  <a href="./band-review.html">逐曲声部校验 ↗</a>
  <a href="./band-study.html">独立预览 ↗</a></div>
 <div class="lu-band-members" data-members aria-label="乐队成员视觉聚焦"></div>
 <p class="lu-band-detail" data-part-detail></p>
 <details class="band-adjustments"><summary>角色与动作 <span data-adjustment-summary>舞台合奏</span></summary>
  <div class="lu-band-controls"><label>调整对象<select data-control="target" aria-label="乐队调整对象"><option value="">全队</option></select></label>
   <label>组合预设<select data-control="preset" aria-label="乐队组合预设"></select></label>
   <label><input type="checkbox" data-control="contrast">突出正在演奏</label></div>
  <div class="band-parameter-grid" data-fields></div>
  <div class="lu-band-controls" data-source-controls><label>音轨来源<select data-control="stem" aria-label="成员音轨来源"></select></label>
   <label>奏法<select data-control="technique" aria-label="成员奏法"><option value="">按乐器</option></select></label></div>
  <p class="lu-band-detail" data-edit-note>成员微调会覆盖全队设置；更换全队预设保留成员微调。</p>
  <div class="lu-band-controls"><button type="button" data-action="reset">还原全队预设</button><button type="button" data-action="export">保存编排</button></div>
 </details>`;
 const find=key=>host.querySelector(`[data-control="${key}"]`),membersHost=host.querySelector('[data-members]');
 let focus=null,target='',parts=[],theme='',lastSourceKey='',disabled=false,listenRevision=0;
 host.querySelector('[data-listen-controls]').hidden=!onListen;
 find('listen').addEventListener('change',async()=>{const select=find('listen'),value=select.value,revision=++listenRevision;select.disabled=true;host.querySelector('[data-listen-status]').textContent='加载中';
  try{await onListen?.(value);if(revision===listenRevision)host.querySelector('[data-listen-status]').textContent='';}catch(error){if(revision===listenRevision){select.value='mix';host.querySelector('[data-listen-status]').textContent=error.message||'试听无法读取';}}finally{if(revision===listenRevision)select.disabled=disabled||getScore()?.source!=='analysis';}
 });
 for(const f of BAND_FORMATIONS)find('formation').append(new Option(f.label,f.id));
 for(const [id,preset] of Object.entries(BAND_PRESETS))find('preset').append(new Option(preset.label,id));
 for(const technique of BAND_TECHNIQUES)find('technique').append(new Option(technique.label,technique.id));
 for(const field of BAND_FIELDS){
  const label=document.createElement('label');label.className='band-parameter';
  const name=document.createElement('span');name.textContent=field.label;
  const input=document.createElement('input');input.type='range';input.min=field.min;input.max=field.max;input.step=field.step;input.dataset.field=field.id;input.setAttribute('aria-label',`乐队${field.label}`);
  const output=document.createElement('output');label.append(name,input,output);host.querySelector('[data-fields]').append(label);
 }
 function changed(rebuild=false){Object.assign(settings,normalizeBandSettings(settings));saveBandSettings(settings,storageKey);renderEditor();onChange(settings,{rebuildParts:rebuild});}
 function renderEditor(){
  const values=target?settingsForMember(settings,target):settings;
  for(const f of BAND_FIELDS){const input=host.querySelector(`[data-field="${f.id}"]`);input.value=values[f.id];
   input.nextElementSibling.textContent=f.id.includes('Rotation')?`${values[f.id]}°`:f.id==='gap'?`${values[f.id].toFixed(2)}D`:`${values[f.id].toFixed(2)}×`;}
  for(const key of ['formation','lightMode','effects','preset'])find(key).value=settings[key];find('contrast').checked=settings.contrast;find('target').value=target;
  const custom=settings.overrides[target]||{};find('stem').value=custom.stem||'';find('technique').value=custom.technique||'';
  host.querySelector('[data-source-controls]').hidden=!target;
  find('stem').disabled=disabled||getScore()?.source!=='demo';find('technique').disabled=disabled||getScore()?.source!=='demo';
  host.querySelector('[data-edit-note]').textContent=getScore()?.source==='demo'?'演示可自由编配；成员微调覆盖全队设置。':'实际歌曲按逐曲核验绑定声部；成员微调只改变外观和动作幅度。';
  host.querySelector('[data-action="reset"]').textContent=target?'还原此成员':'还原全队预设';
  const name=bandRoster(getTheme()).find(r=>r.id===target)?.name;
  host.querySelector('[data-adjustment-summary]').textContent=name?`${name}${Object.keys(custom).length?' · 已微调':''}`:BAND_PRESETS[settings.preset].label;
  find('preset').disabled=disabled||!!target;
 }
 function renderDetail(){
  const part=parts.find(p=>p.id===focus),role=bandRoster(getTheme()).find(r=>r.id===focus);
  host.querySelector('[data-part-detail]').textContent=part?
   `${role.name} · ${getScore()?.source==='demo'?role.instrument:part.label} · ${part.sourceLabel}${part.shared&&part.stemId!=='other'?' · 共享音轨':''} · 视觉聚焦不改变音频`:
   `${bandRoster(getTheme()).length} 位成员 · ${getScore()?.source==='demo'?'演示编配':songBindingSummary(getScore()).reason}`;
 }
 function rebuildMembers(){
  const roster=bandRoster(getTheme());theme=getTheme();membersHost.replaceChildren();find('target').replaceChildren(new Option('全队',''));
  for(const role of roster){const button=document.createElement('button');button.type='button';button.dataset.member=role.id;button.title=role.instrument;
   const img=document.createElement('img');img.src=`./assets/live-avatars/${role.id}/still.png`;img.alt='';img.width=24;img.height=24;
   const label=document.createElement('span');label.textContent=role.name;const dot=document.createElement('i');dot.className='band-member-indicator';dot.setAttribute('aria-hidden','true');button.append(img,label,dot);membersHost.append(button);find('target').append(new Option(role.name,role.id));}
  const all=document.createElement('button');all.type='button';all.dataset.member='';all.textContent='全队';membersHost.append(all);
  setFocus(focus&&roster.some(r=>r.id===focus)?focus:null,false);
 }
 function setFocus(id,notify=true){focus=id||null;target=focus||'';
  for(const button of membersHost.querySelectorAll('button'))button.setAttribute('aria-pressed',String((button.dataset.member||null)===focus));
  renderEditor();renderDetail();if(notify)onFocus(focus);
 }
 function setParts(next){parts=next;if(theme!==getTheme())rebuildMembers();
  const score=getScore(),sourceKey=(score?.trackId||score?.source||'pending')+'|'+getTheme()+'|'+(score?.stems.map(s=>s.id).join(',')||'');
  if(lastSourceKey!==sourceKey){lastSourceKey=sourceKey;++listenRevision;host.querySelector('[data-listen-status]').textContent='';find('stem').replaceChildren(new Option('按乐器编配',''));
   find('listen').replaceChildren(new Option('完整混音','mix'));for(const stem of score?.stems||[]){find('stem').append(new Option(stem.label,stem.id));if(stem.audio)find('listen').append(new Option(stem.label,stem.id));}}
 find('listen').disabled=disabled||score?.source!=='analysis';
 for(const button of membersHost.querySelectorAll('[data-member]')){
  const part=parts.find(p=>p.id===button.dataset.member);if(part)button.title=getScore()?.source==='demo'?part.instrument:`${part.label} · ${part.sourceLabel}`;
 }
  renderEditor();renderDetail();
 }
 membersHost.addEventListener('click',event=>{const button=event.target.closest('button[data-member]');if(button&&!disabled)setFocus(button.dataset.member);});
 find('target').addEventListener('change',()=>setFocus(find('target').value));
 for(const key of ['formation','lightMode','effects','contrast'])find(key).addEventListener('change',()=>{settings[key]=key==='contrast'?find(key).checked:find(key).value;changed();});
 find('preset').addEventListener('change',()=>{settings.preset=find('preset').value;Object.assign(settings,BAND_PRESETS[settings.preset]);changed();});
 for(const key of ['stem','technique'])find(key).addEventListener('change',()=>{if(!target)return;settings.overrides[target]||={};const value=find(key).value;if(value)settings.overrides[target][key]=value;else delete settings.overrides[target][key];changed(true);});
 host.querySelector('[data-fields]').addEventListener('input',event=>{const id=event.target.dataset.field;if(!id)return;
  if(target){settings.overrides[target]||={};settings.overrides[target][id]=Number(event.target.value);}else settings[id]=Number(event.target.value);changed();});
 host.querySelector('[data-action="reset"]').addEventListener('click',()=>{if(target)delete settings.overrides[target];else Object.assign(settings,BAND_PRESETS[settings.preset]);changed(true);});
 host.querySelector('[data-action="export"]').addEventListener('click',()=>{const data={version:2,theme:getTheme(),trackId:getScore()?.trackId||null,settings:normalizeBandSettings(settings)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`lu-band-${getTheme()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 rebuildMembers();renderEditor();
 return {setParts,setFocus,setListening(value='mix'){find('listen').value=value;},setDisabled(value){disabled=value;host.querySelectorAll('input,select,button').forEach(e=>e.disabled=value);renderEditor();find('listen').disabled=value||getScore()?.source!=='analysis';},
  updateSamples(frame){for(const sample of frame.parts){const button=[...membersHost.children].find(b=>b.dataset.member===sample.id);if(button){button.dataset.playing=sample.activity>.18?'true':'false';button.style.setProperty('--activity',sample.activity);}}}};
}
