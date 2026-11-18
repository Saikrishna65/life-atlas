/** Keep unknown custom media hosts direct; only configured public image hosts use Next resizing. */
export function optimizeJournalImage(src:string){
 if(src.startsWith('/')&&!src.startsWith('//'))return true;
 try{const url=new URL(src);return url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname==='images.unsplash.com'||/^[a-z0-9-]+\.r2\.dev$/i.test(url.hostname));}catch{return false;}
}
