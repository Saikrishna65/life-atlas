import {createHash} from 'node:crypto';
import sharp from 'sharp';
import prisma from '@/lib/prisma';
export const runtime='nodejs';
/** Compatibility for photographs already explicitly stored in the public database. Never reads a private vault. */
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[a-zA-Z0-9_-]{1,180}$/.test(id))return new Response(null,{status:404});
 const width=new URL(request.url).searchParams.get('width');if(width&&!['320','480','960'].includes(width))return new Response(null,{status:400});
 try{const photo=await prisma.photo.findUnique({where:{id},select:{url:true}});const match=photo?.url.match(/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([a-zA-Z0-9+/=\s]+)$/);
  if(!match||match[2].length>22*1024*1024)return new Response(null,{status:404});
  let data:Buffer<ArrayBufferLike>=Buffer.from(match[2],'base64');let type=match[1];if(width){data=await sharp(data,{limitInputPixels:80_000_000}).rotate().resize({width:Number(width),withoutEnlargement:true}).webp({quality:82}).toBuffer();type='image/webp';}
  const etag=`"${createHash('sha256').update(data).digest('hex')}"`;const headers={'Content-Type':type,'Cache-Control':'public, max-age=300, s-maxage=3600','ETag':etag,'X-Content-Type-Options':'nosniff'};
  if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});return new Response(new Uint8Array(data),{headers});
 }catch{return new Response(null,{status:404});}
}
