import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
class Element{
 constructor(){this.children=[];this.value='';this.textContent='';this.listeners={};this.style={};this.classList={toggle(){}};this.open=false;}
 setAttribute(){}
 removeAttribute(){}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 get firstChild(){return this.children[0];}
 addEventListener(name,fn){this.listeners[name]=fn;}
 showModal(){this.open=true;}close(){this.open=false;}focus(){}
}
async function app(store=new Map(),mockCloud=false){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 let players=[{id:'a',name:'하늘',color:'#52c7ef',score:20},{id:'b',name:'바다',color:'#ffcc00',score:10}];
 const opens=[];const context=vm.createContext({console,setTimeout,clearTimeout,URL,Date,Map,Set,Number,JSON,Error,AbortController,crypto:globalThis.crypto,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},navigator:{},document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>[]},window:{ScoreCounter:{getPlayers:()=>players.map(p=>({...p})),confirm:(_t,_m,callback)=>callback(),restorePlayers:next=>{players=next;}},open:(...args)=>opens.push(args),addEventListener(){}}});
 const modules=new Map();async function load(path){if(modules.has(path))return modules.get(path);const mod=new vm.SourceTextModule(path.endsWith('/firebase-config.js')?"export const firebaseConfig=null; export const bggSearchUrl='';":mockCloud&&path.endsWith('/cloud-records.js')?"export const cloudConfigured=()=>true;export async function connectCloud(cb){globalThis.changeAuth=cb;} export async function login(){} export async function logout(){} export async function loadCloud(){return [];} export async function saveCloud(){} export async function deleteCloud(){} export async function idToken(){return '';}":await fs.readFile(path,'utf8'),{context,identifier:path});modules.set(path,mod);return mod;}
 const main=await load(resolve(root,'records.js'));await main.link((specifier,ref)=>load(resolve(dirname(ref.identifier),specifier)));await main.evaluate();return {get,store,opens,players:()=>players,changeAuth:user=>context.changeAuth(user)};
}
async function save(a,name='카탄',rule='highest'){
 a.get('savePlay').onclick();a.get('playGame').value=name;a.get('playDate').value='2026-10-09';a.get('playRule').value=rule;await a.get('savePlayForm').onsubmit({preventDefault(){}});
}
test('save, reload, stats, restore and delete are usable without Firebase',async()=>{
 const a=await app();await save(a);assert.match(a.get('recordMessage').textContent,/저장했습니다/);assert.equal(JSON.parse(a.store.get('score.plays.v1.guest')).records.length,1);
 const b=await app(a.store);b.get('historyLink').onclick();assert.equal(b.get('recordList').children.length,1);
 b.get('statsTab').onclick();assert.equal(b.get('recordList').children[0].children[2].children[0].children[1].children.length,2);
 b.get('historyTab').onclick();const actions=b.get('recordList').children[0].children.at(-1);actions.children[0].onclick();assert.equal(b.players()[0].score,20);await actions.children[1].onclick();assert.equal(JSON.parse(b.store.get('score.plays.v1.guest')).records.length,0);
});
test('BGG fallback and unavailable login are honest and do not prevent saving',async()=>{const a=await app();a.get('savePlay').onclick();a.get('playGame').value='Catan';await a.get('openBggWebsite').onclick();assert.match(a.opens[0][0],/^https:\/\/boardgamegeek.com\/geeksearch/);await a.get('accountLink').onclick();assert.match(a.get('accountError').textContent,/준비 중/);await save(a,'Catan');assert.equal(JSON.parse(a.store.get('score.plays.v1.guest')).records[0].game.name,'Catan');});
test('untrusted game/player text is inserted as text, not HTML',async()=>{const a=await app();await save(a,'<img src=x onerror=alert(1)>');assert.equal(a.get('recordList').children[0].children[0].textContent,'<img src=x onerror=alert(1)>');});

test('type, select a game and save its BGG ID',async()=>{const a=await app();a.get('savePlay').onclick();a.get('playGame').value='플립7';a.get('playGame').listeners.input();assert.equal(a.get('bggResults').children.length,2);a.get('bggResults').children[0].children[0].onclick();assert.equal(a.get('playGame').value,'Flip 7');assert.equal(a.get('playBggId').value,'420087');a.get('playDate').value='2026-10-10';await a.get('savePlayForm').onsubmit({preventDefault(){}});const play=JSON.parse(a.store.get('score.plays.v1.guest')).records[0];assert.equal(play.game.name,'Flip 7');assert.equal(play.game.bggId,'420087');});

test('signed-out footer shows a login hint and hides record menus',async()=>{const a=await app();assert.equal(a.get('savePlay').hidden,true);assert.equal(a.get('historyLink').hidden,true);assert.equal(a.get('recordLoginHint').hidden,false);assert.equal(a.get('accountLink').textContent,'Google 로그인');});

test('record menus follow sign-in and sign-out and close on sign-out',async()=>{const a=await app(new Map(),true);await a.changeAuth({uid:'test',displayName:'테스트'});assert.equal(a.get('savePlay').hidden,false);assert.equal(a.get('historyLink').hidden,false);assert.equal(a.get('recordLoginHint').hidden,true);assert.equal(a.get('accountLink').textContent,'내 계정');a.get('savePlay').onclick();a.get('historyLink').onclick();await a.changeAuth(null);assert.equal(a.get('savePlay').hidden,true);assert.equal(a.get('historyLink').hidden,true);assert.equal(a.get('recordLoginHint').hidden,false);assert.equal(a.get('savePlayDialog').open,false);assert.equal(a.get('historyDialog').open,false);});

test('page and offline cache request the same versioned records entry',async()=>{const html=await fs.readFile(resolve(root,'index.html'),'utf8');const sw=await fs.readFile(resolve(root,'sw.js'),'utf8');for(const file of ['records.js','records.css']){const version=html.match(new RegExp(file.replace('.',"\\.")+"\\?v=[0-9]+"))?.[0];assert.ok(version);assert.ok(sw.includes("'"+version+"'"));}});
