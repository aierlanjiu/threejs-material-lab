// Decorative motion samples the song clock; no frame history or audio ownership.
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
export function sampleConcertMotion(time,lighting={}, {effectsMode='auto',reduced=false,phase=0}={}){
 const moving=!reduced&&effectsMode!=='off',t=moving?Math.max(0,Number(time)||0):0;
 const beat=moving?unit(lighting.beat):0,downbeat=moving?unit(lighting.downbeat):0;
 const focus=moving?Math.max(unit(lighting.wingPower),unit(lighting.focusMix)):0;
 return {float:moving?Math.sin(t*.8+phase)*.065:0,yaw:moving?Math.sin(t*.28+phase)*.035:0,
  crystalYaw:moving?Math.sin(t*.19+phase)*.12:0,
  emission:(.14+(moving?(.025+.025*Math.sin(t*.7+phase))+beat*.10+downbeat*.23+unit(lighting.bass)*.05:0))*(1-focus*.35)};
}
export function concertIslandSlots(narrow=false){
 return [-1,1].map((side,i)=>({side,phase:i*2.1,position:[side*(narrow?4.45:11.65),narrow?7.45:3.75,narrow?-4.75:-4.55],width:narrow?1.75:2.8,plantHeight:narrow?1.15:1.65}));
}
