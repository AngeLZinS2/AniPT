/** Four SVG points for an infinite strip, including horizontal/vertical angles. */
export function ribbonPoints(x:number,y:number,width:number,height:number,angle:number,thickness:number){
  if(![x,y,width,height,angle,thickness].every(Number.isFinite)||width<=0||height<=0)return '0,0 0,0 0,0 0,0';
  const length=Math.hypot(width,height)*1.5,radians=angle*Math.PI/180,dx=Math.cos(radians)*length,dy=Math.sin(radians)*length;
  const nx=-Math.sin(radians)*Math.max(0,thickness)/2,ny=Math.cos(radians)*Math.max(0,thickness)/2;
  return [[x-dx+nx,y-dy+ny],[x+dx+nx,y+dy+ny],[x+dx-nx,y+dy-ny],[x-dx-nx,y-dy-ny]].map(([a,b])=>`${a.toFixed(2)},${b.toFixed(2)}`).join(' ');
}
