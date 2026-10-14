const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export function drawBandPulse(ctx,score,time,partId,{x,y,width,height,scale=1}){
 const events=score?.stems.find(s=>s.id===partId)?.events||[],start=time-2,span=2.25;
 ctx.save();ctx.strokeStyle='#b8d6e344';ctx.lineWidth=scale;ctx.beginPath();ctx.moveTo(x,y+height/2);ctx.lineTo(x+width,y+height/2);ctx.stroke();
 for(const event of events){if(event.end<start||event.start>time+.25)continue;const px=x+Math.max(0,(event.start-start)/span)*width,active=event.start<=time&&event.end>time;
  const h=Math.max(2*scale,event.velocity*height*.88),w=Math.max(2*scale,Math.min(width-(px-x),(event.end-event.start)/span*width));
  ctx.fillStyle=active?'#ffe0a5':'#91c5df';ctx.globalAlpha=active?1:.35;ctx.fillRect(px,y+(height-h)/2,w,h);
 }ctx.globalAlpha=1;ctx.strokeStyle='#fff0c9';ctx.beginPath();ctx.moveTo(x+width*2/span,y);ctx.lineTo(x+width*2/span,y+height);ctx.stroke();ctx.restore();
}
export function drawBandScore(canvas,score,time,stemId='vocals',fallbackSize=null){
 let rect=canvas.getBoundingClientRect();if((!rect.width||!rect.height)&&fallbackSize)rect=fallbackSize;if(!rect.width||!rect.height)return;
 const ratio=Math.min(devicePixelRatio,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const w=rect.width,h=rect.height,left=26,right=w-10,top=22;
 const stem=score?.stems.find(s=>s.id===stemId);ctx.font='10px sans-serif';ctx.fillStyle='#cbbb9e';ctx.strokeStyle='#ede2cf44';ctx.lineWidth=1;
 const percussion=stemId==='drums'||stem?.percussion,rows=percussion?3:5,gap=percussion?14:6;
 for(let i=0;i<rows;i++){const y=top+i*gap;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
 if(!stem){ctx.fillText('待接入本曲声部与乐谱',left,h-8);return;}
 const span=8,start=Math.max(0,Math.floor(time/4)*4-2),xFor=t=>left+(t-start)/span*(right-left);
 if(percussion){['高','中','低'].forEach((s,i)=>ctx.fillText(s,5,top+i*gap+4));}
 else{ctx.fillText(stemId==='bass'?'低音':'旋律',0,top+13);}
 const windowNotes=stem.events.filter(e=>e.end>=start&&e.start<start+span);
 if(stem.polyphonic&&!percussion){
  ctx.clearRect(0,0,w,h);const lo=windowNotes.length?Math.floor(Math.min(...windowNotes.map(e=>e.midi))/12)*12:48,hi=Math.max(lo+12,windowNotes.length?Math.ceil(Math.max(...windowNotes.map(e=>e.midi))/12)*12:84);
  const yFor=midi=>h-18-(midi-lo)/(hi-lo)*(h-32);
  ctx.strokeStyle='#ede2cf33';for(let midi=lo;midi<=hi;midi+=12){const y=yFor(midi);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#cbbb9e';ctx.fillText(`C${Math.floor(midi/12)-1}`,0,y+3);}
  for(const event of windowNotes){const x=Math.max(left,xFor(event.start)),end=Math.min(right,xFor(event.end));if(end<=x)continue;ctx.fillStyle=event.start<=time&&time<event.end?'#f7c879':'#c97c64';ctx.globalAlpha=.4+event.velocity*.6;ctx.fillRect(x,yFor(event.midi)-2,Math.max(2,end-x),4);}ctx.globalAlpha=1;
  ctx.strokeStyle='#fff2d2';ctx.beginPath();ctx.moveTo(xFor(time),8);ctx.lineTo(xFor(time),h-14);ctx.stroke();ctx.fillStyle='#cbbb9e';ctx.fillText(`${start.toFixed(0)}—${Math.min(score.duration,start+span).toFixed(0)}s · 音高时轴 · 编配`,left,h-3);return;
 }
 for(const event of windowNotes){
  const x=xFor(event.start),active=event.start<=time&&time<event.end;
  ctx.fillStyle=active?'#f7c879':'#c97c64';ctx.strokeStyle=ctx.fillStyle;
  if(percussion){const row=event.midi===36?2:event.midi===38?1:0;ctx.fillRect(x,top+row*gap-3,Math.max(4,(event.end-event.start)/span*(right-left)),6);}
  else{
   // Octave fold keeps the tiny live window legible; full MIDI/XML retain pitch.
   const semitone=event.midi%12,diatonic=[0,0,1,1,2,3,3,4,4,5,5,6][semitone];
   const y=top+24-(diatonic-2)*3;ctx.beginPath();ctx.ellipse(x,y,3.5,2.5,-.25,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x+3,y);ctx.lineTo(x+3,y-16);ctx.stroke();
   if(names[semitone].includes('♯'))ctx.fillText('♯',x-10,y+2);
   if(active){ctx.fillText(`${names[semitone]}${Math.floor(event.midi/12)-1}`,x-3,h-8);}
  }
 }
 const playhead=xFor(time);ctx.strokeStyle='#fff2d2';ctx.beginPath();ctx.moveTo(playhead,10);ctx.lineTo(playhead,h-4);ctx.stroke();
 ctx.fillStyle='#cbbb9e';ctx.fillText(`${start.toFixed(0)}—${Math.min(score.duration,start+span).toFixed(0)}s${percussion?' · 频段起音估计':' · 八度折叠预览'}`,left,h-7);
}
