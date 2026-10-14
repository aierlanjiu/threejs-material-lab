// The score stays available without occupying the mobile stage's backdrop.
export function setupBandScoreDisclosure(panel){
 const heading=panel.querySelector('.lu-band-score-heading'),button=document.createElement('button');
 button.type='button';button.className='lu-band-score-toggle';button.setAttribute('aria-label','展开或收起声部谱面');
 const arrow=document.createElement('span');arrow.className='band-score-arrow';arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');
 button.append(heading,arrow);panel.prepend(button);
 const stage=panel.parentElement;let manual=null,lastNarrow=null;
 function refresh(){const narrow=stage.clientWidth/stage.clientHeight<.85;if(narrow!==lastNarrow){manual=null;lastNarrow=narrow;}
  const expanded=manual??!narrow;panel.dataset.compact=String(!expanded);button.setAttribute('aria-expanded',String(expanded));
  panel.querySelector('canvas').hidden=!expanded;
 }
 button.addEventListener('click',()=>{manual=button.getAttribute('aria-expanded')!=='true';refresh();});
 const observer=new ResizeObserver(refresh);observer.observe(stage);refresh();
 return {get expanded(){return button.getAttribute('aria-expanded')==='true';},dispose(){observer.disconnect();}};
}
