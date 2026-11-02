import assert from 'node:assert/strict';
import {test} from 'node:test';
import {allowAtlasMutation} from '../../src/lib/mobileRequest';
import {rewriteServiceLinks,installMobileNetwork} from '../../mobile/network';
import {appServiceUrl} from '../../src/lib/appNetwork';
const service='https://life-atlas-eight-five.vercel.app';
test('rewrites only API links and preserves blob, public and external URLs',()=>{
 assert.deepEqual(rewriteServiceLinks({audioUrl:'/api/music/stream/a',art:'blob:local',name:'Track',external:'https://example.com/audio',list:['/api/control-room/file?bucket=music']}),{audioUrl:service+'/api/music/stream/a',art:'blob:local',name:'Track',external:'https://example.com/audio',list:[service+'/api/control-room/file?bucket=music']});
 assert.equal(appServiceUrl('/api/music'),'/api/music');
});
test('native mutation boundary accepts only known app origins with the platform header',()=>{
 const request=(origin:string,extra:Record<string,string>={})=>new Request(service+'/api/control-room',{method:'POST',headers:{origin,'x-atlas-control':'1',...extra}});
 assert.equal(allowAtlasMutation(request(service),'x-atlas-control'),true);
 assert.equal(allowAtlasMutation(request('https://localhost',{'x-capacitor-platform':'android'}),'x-atlas-control'),true);
 assert.equal(allowAtlasMutation(request('capacitor://localhost',{'x-capacitor-platform':'android'}),'x-atlas-control'),true);
 for(const req of [request('https://evil.example',{'x-capacitor-platform':'android'}),request('https://localhost'),request(service,{'sec-fetch-site':'cross-site'}),request('https://localhost',{'x-capacitor-platform':'android','sec-fetch-site':'cross-site'})])assert.equal(allowAtlasMutation(req,'x-atlas-control'),false);
});
test('forwards online requests with multipart bodies and provides a bounded offline response',async()=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),originalOnline=Object.getOwnPropertyDescriptor(navigator,'onLine');
 const win={fetch:globalThis.fetch};Object.defineProperty(globalThis,'window',{configurable:true,value:win});Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://localhost/secret',origin:'https://localhost'}});Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
 const calls:{input:any;init:any}[]=[];
 try{
 installMobileNetwork(async(input:any,init:any)=>{calls.push({input,init});return Response.json({audioUrl:'/api/music/stream/a'},{status:201})});
 const form=new FormData();form.append('file',new Blob(['audio']),'track.mp3');
 const response=await win.fetch('/api/music',{method:'POST',body:form});assert.equal(response.status,201);assert.equal((await response.json()).audioUrl,service+'/api/music/stream/a');assert.equal(calls[0].input,service+'/api/music');assert.equal(calls[0].init.body,form);
 Object.defineProperty(navigator,'onLine',{configurable:true,value:false});assert.equal((await win.fetch('/api/music')).status,503);assert.equal(calls.length,1);
 await win.fetch('blob:local');assert.equal(calls[1].input,'blob:local');
 }finally{for(const [key,value]of [['window',originalWindow],['location',originalLocation]] as const){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key)}if(originalOnline)Object.defineProperty(navigator,'onLine',originalOnline);else Reflect.deleteProperty(navigator,'onLine');}
});
