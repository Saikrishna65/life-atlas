/** Staged contract only. Activation must remain disabled until Android recovery tests pass. */
export const KEYSTORE_ACTIVATION_ENABLED = false;
export interface KeyWrapper {wrap(key:Uint8Array):Promise<Uint8Array>;unwrap(wrapped:Uint8Array):Promise<Uint8Array>;}
export async function verifyStagedWrapper(key:Uint8Array,wrapper:KeyWrapper,verifyCiphertext:(recovered:Uint8Array)=>Promise<boolean>){
 const candidate=await wrapper.wrap(key.slice());
 const recovered=await wrapper.unwrap(candidate);
 try {
  if(recovered.length!==key.length||!recovered.every((byte,i)=>byte===key[i])||!await verifyCiphertext(recovered))throw new Error('Wrapper recovery verification failed. Passphrase encryption remains unchanged.');
  return {candidate,activationAllowed:KEYSTORE_ACTIVATION_ENABLED};
 }finally{recovered.fill(0);}
}
