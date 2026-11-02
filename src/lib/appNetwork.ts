// The website keeps relative API URLs. The bundled app calls the deployed service.
export const MOBILE_API_ORIGIN = process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN || 'https://life-atlas-eight-five.vercel.app';
export function appServiceUrl(value: string): string {
  if (process.env.NEXT_PUBLIC_OFFLINE_APP === 'true' && value.startsWith('/api/')) return new URL(value, MOBILE_API_ORIGIN).href;
  return value;
}
