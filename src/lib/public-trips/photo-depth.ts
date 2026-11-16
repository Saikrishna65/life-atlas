import type { ScrapbookFrame } from './scrapbook';

/** Licensed local samples; real public trip photos take precedence. */
export const depthSamples: ScrapbookFrame[] = [
  ['/images/stock/wall-peaks.webp','Above the clouds'],
  ['/images/stock/phone-mountain.webp','Across the next ridge'],
  ['/images/stock/wall-starry.webp','A mountain beneath the stars'],
  ['/images/world/ocean.webp','The open water'],
  ['/images/world/mountains.webp','Mountains in the mist'],
  ['/images/world/ridge.webp','A distant ridgeline'],
  ['/images/world/mist.webp','Low cloud across the landscape'],
].map(([src,title],index) => ({id:`depth-sample-${index}`,tripId:'sample-landscapes',tripTitle:'Landscape studies',src,preview:src,title,kind:'photo',sample:true}));

export function selectDepthPhotos(media: ScrapbookFrame[]): ScrapbookFrame[] {
  const photos = media.filter(frame => frame.kind === 'photo' && frame.src);
  const real = photos.filter(frame => !frame.sample);
  const pool = real.length ? real : depthSamples;
  return [...new Map(pool.map(frame => [frame.src,frame])).values()].slice(0,24);
}

const clamp = (n:number) => Math.min(1,Math.max(0,n));
const smooth = (n:number) => { const t=clamp(n);return t*t*(3-2*t); };
export interface DepthPose { x:number; y:number; z:number; rx:number; ry:number; rz:number; opacity:number; scale:number }
/** Deterministic three-dimensional choreography, independent of layout/React. */
export function depthPose(index:number,progress:number,width:number,height:number,mobile:boolean): DepthPose {
  const p=clamp(progress),reveal=smooth(p/.28),finish=smooth((p-.78)/.22);
  const layer=Math.floor(index/9),column=index%3-1,row=Math.floor(index%9/3)-1;
  const spacing=Math.min(width*(mobile?.53:.28),430);
  const vertical=Math.min(height*.34,280);
  const intro=index<3;
  const introX=(index-1)*Math.min(width*.29,390);
  const cloudX=column*spacing+(layer%2?.16:-.16)*spacing;
  const cloudY=row*vertical+(layer-1)*vertical*.18;
  const travel=smooth((p-.2)/.58);
  const cloudZ=-layer*480-180+travel*960;
  let x=(intro?introX:cloudX)*(1-reveal)+cloudX*reveal;
  let y=(intro?(index===1?-20:30):cloudY)*(1-reveal)+cloudY*reveal;
  let z=(intro?0:-1100)*(1-reveal)+cloudZ*reveal;
  const anchor=index===13;
  x*=1-finish;y*=1-finish;
  z=z*(1-finish)+(anchor?0:-1800)*finish;
  const nearFade=1-smooth((z-360)/420);
  const farFade=.38+.62*clamp((z+1500)/1500);
  return {x,y,z,rx:(row*9+(layer-1)*14+Math.sin(p*Math.PI*2)*18)*reveal*(1-finish),ry:(column*-13+(layer-1)*28+Math.sin(p*Math.PI*2-.5)*32)*reveal*(1-finish),rz:Math.sin(p*Math.PI*2)*-12*reveal*(1-finish),opacity:(intro?1:reveal)*nearFade*farFade*(anchor?1:1-finish),scale:anchor?1+finish*.7:1};
}
