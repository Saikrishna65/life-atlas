export type CategoryCardLayout='regular'|'wide'|'tall';
const block:CategoryCardLayout[]=['wide','tall','regular','regular','wide','regular','tall','regular'];
const tails:CategoryCardLayout[][]=[[],['wide'],['regular','regular'],['wide','regular','regular'],['wide','tall','regular','regular'],['wide','tall','regular','regular','wide'],['wide','tall','regular','regular','wide','wide'],['wide','tall','regular','regular','wide','regular','regular']];
/** Two-column editorial composition with complete rows and stable reading order. */
export function categoryCardLayouts(count:number):CategoryCardLayout[]{const result:CategoryCardLayout[]=[];for(let i=0;i<Math.floor(count/8);i++)result.push(...block);return [...result,...tails[count%8]];}
