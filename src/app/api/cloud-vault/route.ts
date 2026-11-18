import {sensitiveApiDenial} from '@/lib/security/api-authorization';
import {NextResponse} from 'next/server';
import {allowAtlasMutation} from '@/lib/mobileRequest';
import {cloudVaultAction,VaultRequestError} from '@/lib/cloud-vault/server';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 const denial=await sensitiveApiDenial(request);if(denial)return denial;

 if(!allowAtlasMutation(request,'x-atlas-cloud'))return NextResponse.json({error:'Open Cloud in Atlas to manage your data.'},{status:403});
 try{return NextResponse.json(await cloudVaultAction(await request.json(),request.headers.get('x-atlas-vault-token')||''),{headers:{'Cache-Control':'no-store'}});}
 catch(error){return NextResponse.json({error:error instanceof VaultRequestError?error.message:'The cloud operation could not finish. Your local data is unchanged; reconnect and retry.'},{status:error instanceof VaultRequestError?error.status:503});}
}
