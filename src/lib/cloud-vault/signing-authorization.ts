import {createPublicKey,verify} from 'node:crypto';
const ISSUER='https://token.actions.githubusercontent.com';
export async function authorizeAndroidSigning(request:Request,body:{runId?:unknown;sha?:unknown},http:typeof fetch=fetch){
 try{
  const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer ')||!/^\d{6,20}$/.test(String(body.runId))||typeof body.sha!=='string'||!/^[a-f0-9]{40}$/.test(body.sha))return false;
  const token=authorization.slice(7),parts=token.split('.');if(parts.length!==3)return false;
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString()),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  if(header.alg!=='RS256'||typeof header.kid!=='string')return false;
  const response=await http(ISSUER+'/.well-known/jwks',{cache:'no-store'});if(!response.ok)return false;const set=await response.json(),jwk=set.keys?.find((key:any)=>key.kid===header.kid&&key.kty==='RSA');if(!jwk)return false;
  if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({format:'jwk',key:jwk}),Buffer.from(parts[2],'base64url')))return false;
  const now=Date.now()/1000,ref=String(claims.ref||'');
  return claims.iss===ISSUER&&claims.aud==='atlas-android-signing'&&Number.isFinite(claims.exp)&&claims.exp>now&&claims.exp<=now+600&&claims.iat>=now-600&&claims.iat<=now+30&&(!claims.nbf||claims.nbf<=now+30)&&String(claims.repository_id)==='1388049350'&&String(claims.repository_owner_id)==='151373216'&&String(claims.actor_id)==='151373216'&&String(claims.repository).toLowerCase()==='saikrishna65/life-atlas'&&(claims.event_name==='push'||claims.event_name==='workflow_dispatch')&&(ref.startsWith('refs/heads/build/atlas-offline-online-')||claims.event_name==='workflow_dispatch'&&ref==='refs/heads/main')&&String(claims.workflow_ref).toLowerCase()===`saikrishna65/life-atlas/.github/workflows/offline-online-apk.yml@${ref.toLowerCase()}`&&claims.sha===body.sha&&String(claims.run_id)===String(body.runId);
 }catch{return false;}
}
