import {NextResponse} from 'next/server';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {accountConfig, cookieValue, FLOW_COOKIE, SESSION_COOKIE, seal, unseal, readSession, mutationAllowed, verifiedOwner} from '@/lib/account/security';
import {accountRecoveryCode} from '@/lib/account/recovery';
import {vaultIdentity} from '@/lib/cloud-vault/codec';
import {cloudVaultAction, VaultRequestError} from '@/lib/cloud-vault/server';
export const runtime = 'nodejs';
export const maxDuration = 60;
const options = {httpOnly:true, secure:true, sameSite:'lax' as const, path:'/'};
const json = (value: unknown, status=200) => NextResponse.json(value, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
type Context = {params: Promise<{action:string}>};
export async function GET(request: Request, context: Context) {
  const {action} = await context.params;
  if (action === 'status') {
    try {accountConfig();} catch {return json({configured:false, account:null});}
    const session = readSession(request);
    return json({configured:true, account:session ? {email:session.email} : null});
  }
  try {
    const config = accountConfig();
    const redirectUri = `${config.origin}/api/account/callback`;
    if (action === 'sign-in') {
      const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({client_id:config.clientId, redirect_uri:redirectUri, response_type:'code', scope:'openid email', state,
        code_challenge:createHash('sha256').update(verifier).digest('base64url'), code_challenge_method:'S256', prompt:'select_account'}).toString();
      const response = NextResponse.redirect(url);
      response.headers.set('Cache-Control','no-store');
      response.cookies.set(FLOW_COOKIE, seal({state, verifier, expires:Date.now()+600000}, 'flow', config.key), {...options,maxAge:600});
      return response;
    }
    if (action === 'callback') {
      const response = NextResponse.redirect(`${config.origin}/secret/account`);
      response.headers.set('Cache-Control','no-store');
      response.headers.set('Referrer-Policy','no-referrer');
      response.cookies.set(FLOW_COOKIE, '', {...options,maxAge:0});
      try {
        const flow = unseal<{state:string; verifier:string; expires:number}>(cookieValue(request,FLOW_COOKIE),'flow',config.key);
        const params = new URL(request.url).searchParams, state = params.get('state') || '', code = params.get('code');
        if (flow.expires <= Date.now() || !code || state.length !== flow.state.length || !timingSafeEqual(Buffer.from(state),Buffer.from(flow.state))) throw new Error('Invalid sign-in.');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,code_verifier:flow.verifier,redirect_uri:redirectUri,grant_type:'authorization_code'}),cache:'no-store'});
        if (!tokenResponse.ok) throw new Error('Sign-in failed.');
        const token = await tokenResponse.json();
        if (typeof token.access_token !== 'string') throw new Error('Sign-in failed.');
        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15000),cache:'no-store'});
        if (!profileResponse.ok) throw new Error('Sign-in failed.');
        const profile = await profileResponse.json();
        if (!verifiedOwner(profile,config.email)) throw new Error('Account not allowed.');
        response.cookies.set(SESSION_COOKIE,seal({sub:profile.sub,email:config.email,expires:Date.now()+30*86400000},'session',config.key),{...options,maxAge:30*86400});
      } catch {response.headers.set('Location',`${config.origin}/secret/account?signin=failed`);}
      return response;
    }
    return json({error:'Not found.'},404);
  } catch {return json({error:'Account sign-in needs server configuration.'},503);}
}
export async function POST(request: Request, context: Context) {
  try {
    if (!mutationAllowed(request)) return json({error:'Open Backup & Restore in Atlas.'},403);
    const {action} = await context.params;
    if (action === 'sign-out') {const response=json({ok:true});response.cookies.set(SESSION_COOKIE,'',{...options,maxAge:0});return response;}
    const session = readSession(request);
    if (!session) return json({error:'Sign in to your Atlas account.'},401);
    if (!['connect','vault'].includes(action)) return json({error:'Not found.'},404);
    const text = await request.text();
    if (text.length > 2*1024*1024) return json({error:'Request too large.'},413);
    const body = text ? JSON.parse(text) : {};
    const code = await accountRecoveryCode(session.sub), identity = await vaultIdentity(code);
    if (action === 'connect') {
      const result = await cloudVaultAction({action:'create',vaultId:identity.id},identity.token);
      return json({code,account:result.account});
    }
    // An authenticated session can operate ONLY on its own vault, never a supplied vault ID.
    if (body.vaultId !== identity.id) return json({error:'This backup belongs to another account.'},403);
    if (!['status','prepare','download','commit'].includes(body.action)) return json({error:'Unsupported backup operation.'},400);
    return json(await cloudVaultAction({...body,vaultId:identity.id},identity.token));
  } catch (error) {return json({error:error instanceof VaultRequestError ? error.message : 'Backup could not finish. Your saved data is unchanged.'},error instanceof VaultRequestError ? error.status : 503);}
}
