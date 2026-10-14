import {bandRoster,BAND_TECHNIQUES} from '../audio/band-parts.js';
import {BAND_FORMATIONS} from '../audio/band-layout.js';
import {BAND_PRESETS,BAND_FIELDS,normalizeBandSettings,settingsForMember,saveBandSettings} from './band-settings.js';

export function createBandControls(host,{settings,getTheme,getScore,onChange,onFocus,onListen=null,storageKey='lu_band_v2'}){
 host.classList.add('band-v2-controls');
 host.innerHTML=`<div class="lu-band-controls band-quick-controls">
  <label>队形<select data-control="formation" aria-label="乐队队形"><option value="auto">自动编排</option></select></label>
  <label>灯光<select data-control="lightMode" aria-label="乐队聚光调度"><option value="follow">单灯主奏</option><option value="move">人入光 · 追光</option><option value="multi">多灯合奏</option></select></label>
  <label>高潮点缀<select data-control="effects" aria-label="高潮点缀"><option value="auto">随音乐</option><option value="off">关闭</option><option value="preview">预览气泡与烟花</option></select></label>
  <label data-listen-controls hidden>声部试听<select data-control="listen" aria-label="声部试听"><option value="mix">完整混音</option></select><small data-listen-status aria-live="polite"></small></label>
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
  host.querySelector('[data-action="reset"]').textContent=target?'还原此成员':'还原全队预设';
  const name=bandRoster(getTheme()).find(r=>r.id===target)?.name;
  host.querySelector('[data-adjustment-summary]').textContent=name?`${name}${Object.keys(custom).length?' · 已微调':''}`:BAND_PRESETS[settings.preset].label;
  find('preset').disabled=disabled||!!target;
 }
 function renderDetail(){
  const part=parts.find(p=>p.id===focus),role=bandRoster(getTheme()).find(r=>r.id===focus);
  host.querySelector('[data-part-detail]').textContent=part?
   `${role.name} · ${role.instrument} · ${part.sourceLabel}${part.shared&&part.stemId!=='other'?' · 共享音轨':''} · 视觉聚焦不改变音频`:
   `${bandRoster(getTheme()).length} 位成员 · 分谱按乐器编配 · 音轨来源保留独立／共享标识`;
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
