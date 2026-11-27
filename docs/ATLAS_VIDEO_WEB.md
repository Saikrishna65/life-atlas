# Atlas Video in a browser

The standalone browser address is `/video` on the Atlas website. After publishing
this code to the Vercel production branch, the configured website address is:

`https://life-atlas-eight-five.vercel.app/video`

Atlas Apps' **Open web player** link uses this standalone page in ordinary browsers.
Native Android and the packaged offline web shell retain `/secret/video`, so the
existing mobile router, shared player and optional authentication behavior stay intact.

The standalone route reuses the browser player without mounting the private
workspace layout. Travel navigation, footer, media-readiness loader and Lenis
wrapper are skipped for this exact route. Other public routes, including the
landing hero/globe, retain their existing behavior. Search is a POST to the
existing `/api/video/search` endpoint; video URLs are parsed locally and opened
only through the allowlisted YouTube embed URL. No R2/LLM credentials are needed.
Only the theme preference is persisted by Atlas Video. Embedded YouTube requests
are subject to YouTube's service availability and privacy rules.

## Why it was missing

On 2026-11-27 the remote `main` was verified at
`29c42b67c7d23cf04fe8ebcd83ac5a11a8abc67e`. That revision did not contain
`src/app/secret/video/page.tsx` or the Video feature. The working branch contained
22 commits beyond it. Local source edits do not update Vercel production.
Publishing therefore needs the Video feature and its dependencies, not just the
new standalone wrapper page. Avoid assuming that this local fix is already live.

## Validation

648 unit tests passed, including route-specific loader exclusion and browser vs.
packaged/native link selection. TypeScript and scoped ESLint passed. A Chromium
source fixture at 390px and 1280px checked direct Video UI access, local YouTube
link parsing, POST search with a fixture response, embed URL allowlisting,
theme-only browser storage and cleared query/player state on reload. External
iframe requests were blocked: real YouTube streaming and live search were not
verified. Screenshots are under `work/qa-video-web/`.

The environment's network proxy blocked the live Vercel inspection, so no live
HTTP success is claimed. No production, mobile bundle or APK build was run. This
change has not been pushed or deployed.
