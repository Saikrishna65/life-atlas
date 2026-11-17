import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {allowAtlasMutation} from '@/lib/mobileRequest';
import {readSections,saveSection,studioLibrary,SectionConflict} from '@/lib/studio/server';
import {StudioInputError,sectionKey,validateSection} from '@/lib/studio/sections';
export const runtime='nodejs';
export async function GET(){try{return NextResponse.json({sections:await readSections(),...await studioLibrary()},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'The website library is unavailable. Your local drafts are safe.'},{status:503});}}
export async function POST(request:Request){
 if(!allowAtlasMutation(request,'x-atlas-studio'))return NextResponse.json({error:'Open Creator Studio to publish this selection.'},{status:403});
 try{
  const raw=await request.text();if(raw.length>128000)return NextResponse.json({error:'Use public media links instead of embedding original files.'},{status:413});
  const input=JSON.parse(raw),key=sectionKey(input.key),content=validateSection(key,input.content);
  if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new StudioInputError('Refresh the current section revision.');
  const saved=await saveSection(key,content,input.revision);revalidatePath('/');return NextResponse.json({success:true,section:saved},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof SectionConflict?error.message:error instanceof StudioInputError?error.message:'Website publishing is temporarily unavailable. Your draft and original media are safe.'},{status:error instanceof SectionConflict?409:error instanceof StudioInputError||error instanceof SyntaxError?400:503});}
}
