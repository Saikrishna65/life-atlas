/** Sensitive cloud/server resources remain quarantined. Local unlock is not server identity. */
export interface Principal {id: string; subject: string;}
export class AuthorizationError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function assertResourceOwner(principal: Principal, ownerPrincipalId: unknown) {
  if (typeof ownerPrincipalId !== 'string' || ownerPrincipalId !== principal.id) throw new AuthorizationError('Resource access denied.', 403);
}
export async function sensitiveApiDenial(request: Request): Promise<Response | null> {
  void request;
  return Response.json({error: 'Sensitive online operations are unavailable. Local device unlock does not authorize server resources.'}, {status: 403, headers: {'Cache-Control': 'no-store'}});
}
