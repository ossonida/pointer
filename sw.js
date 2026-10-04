'use strict';
const CACHE='score-counter-shell-v1';
const BASE=new URL('./',self.location.href);
const INDEX=new URL('index.html',BASE).href;
const ASSETS=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'].map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('score-counter-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
const request=event.request,url=new URL(request.url);
if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
if(request.mode==='navigate'){
event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(INDEX,copy)));}return response;}catch{const cached=await caches.match(INDEX)||await caches.match(request);return cached||new Response('인터넷에 연결한 뒤 다시 열어주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
}else if(ASSETS.includes(url.href)){
event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}catch{const cached=await caches.match(request);return cached||Response.error();}})());
}
});
