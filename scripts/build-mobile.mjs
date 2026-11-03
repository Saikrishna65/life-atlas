import {build} from 'esbuild';
import {compile} from '@tailwindcss/node';
import {Scanner} from '@tailwindcss/oxide';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root,'mobile-dist');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
const aliases = {'next/navigation':'navigation.tsx','next/link':'link.tsx','next/image':'image.tsx','next/dynamic':'dynamic.tsx'};
const result = await build({
 entryPoints:['mobile/bootstrap.ts'],bundle:true,splitting:true,format:'esm',jsx:'automatic',outdir:output,
 target:['chrome89'],minify:true,metafile:true,chunkNames:'chunks/[name]-[hash]',
 define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_OFFLINE_APP':'"true"','process.env.npm_lifecycle_event':'""','process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN':JSON.stringify(process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN || 'https://life-atlas-eight-five.vercel.app')},
 plugins:[{name:'mobile-adapters',setup(build){
   build.onResolve({filter:/^next\/(navigation|link|image|dynamic)$/},args => ({path:path.join(root,'mobile',aliases[args.path])}));
   build.onResolve({filter:/^\.\/actions$/},args => args.importer.replace(/\\/g, '/').endsWith('/app/admin/Studio.tsx') ? {path:path.join(root,'mobile/studio-storage.ts')} : null);
   build.onLoad({filter:/[/\\]src[/\\]app[/\\]globals\.css$/},async args => {
     const css = await fs.readFile(args.path,'utf8');
     const compiler = await compile(css,{base:path.dirname(args.path),onDependency:()=>{}});
     const scanner = new Scanner({sources:[{base:path.join(root,'src'),pattern:'**/*.{ts,tsx}',negated:false},{base:path.join(root,'mobile'),pattern:'**/*.{ts,tsx}',negated:false}]});
     return {contents:compiler.build(scanner.scan()),loader:'css',resolveDir:path.dirname(args.path)};
   });
 }}],
});
await fs.writeFile(path.join(output,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05070a"><title>Atlas Vault</title>'+Object.keys(result.metafile.outputs).filter(f=>f.endsWith('.css')).map(f=>`<link rel="stylesheet" href="/${path.relative(output,path.resolve(f))}">`).join('')+'<style>:root{--font-display:Georgia;--font-sans:Arial;--font-body:Arial}body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/bootstrap.js"></script></body></html>');
await fs.copyFile(path.join(output,'index.html'),path.join(output,'offline.html'));
await fs.cp('public/finance',path.join(output,'finance'),{recursive:true});
await fs.copyFile('public/placeholder-image.jpg',path.join(output,'placeholder-image.jpg'));
const routes = (await fs.readdir('src/app/secret',{recursive:true})).filter(p=>p.endsWith('page.tsx'));
if(Object.keys(result.metafile.inputs).some(p=>/finance\/demo(?:Transactions)?\.ts$/.test(p)))throw new Error('Finance demo code must not be included in the APK.');
await fs.writeFile(path.join(output,'build-info.json'),JSON.stringify({mode:'bundled-offline',builtAt:new Date().toISOString(),screens:routes.length}));
console.log(`Bundled offline app: ${Object.keys(result.metafile.outputs).length} assets`);
