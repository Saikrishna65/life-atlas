/** Keep prior approved media when adding a place; incoming metadata wins by stable ID. */
export function mergeTripPublication(previous:unknown,incoming:unknown[],append:boolean):unknown[]{
 const prior=append&&Array.isArray(previous)?previous:[];
 const items=[...new Map([...prior,...incoming].filter((item):item is Record<string,unknown>&{id:string}=>!!item&&typeof item==='object'&&'id' in item&&typeof item.id==='string').map(item=>[item.id,item])).values()];
 if(items.length>250)throw new RangeError('PUBLIC_MEDIA_LIMIT');return items;
}
