export function bandRecordingLayout(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid recording frame');
 const narrow=width/height<.85,referenceWidth=narrow?390:1280,scale=width/referenceWidth;
 const scoreWidth=(narrow?referenceWidth-24:360)*scale;
 return {narrow,scale,logicalWidth:referenceWidth,logicalHeight:height/scale,
  score:{x:narrow?12*scale:width-16*scale-scoreWidth,y:(narrow?12:16)*scale,width:scoreWidth,height:112*scale},
  footerHeight:48*scale,lyricY:height-62*scale};
}
