import {connectCloud,cloudConfigured,idToken,loadBggProfile,saveBggProfile,loadBggData,saveBggData} from './cloud-records.js?v=7';
import {bggSearchUrl} from './firebase-config.js';
const $=id=>document.getElementById(id);
let user=null,epoch=0,busy=false,collection=[],plays=[];
function key(part){return `score.bgg.${user.uid}.${part}`;}
function cached(part,fallback){try{return JSON.parse(localStorage.getItem(key(part)))??fallback;}catch{return fallback;}}
function status(text){$('bggAccountStatus').textContent=text;}
function render(){
 $('bggAccountSection').hidden=!user;
 $('bggRegister').disabled=!user||busy;$('bggImport').disabled=!user||busy||!$('bggUsername').value.trim()||!bggSearchUrl;
 $('bggServerHint').hidden=!!bggSearchUrl;
 const box=$('bggAccountData');box.replaceChildren();
 for(const [title,items] of [['보유 게임',collection],['BGG 플레이 기록',plays]]){
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`${title} · ${items.length}개`;details.append(summary);
  for(const item of items){const row=document.createElement('p'),link=document.createElement('a');link.textContent=item.name;link.href=`https://boardgamegeek.com/boardgame/${item.gameId}`;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
   if(item.date){const text=document.createElement('span');text.textContent=` · ${item.date} · ${item.quantity}회${item.players?.length?' · '+item.players.map(p=>`${p.name}${p.score!==null?' '+p.score+'점':''}`).join(', '):''}`;row.append(text);}details.append(row);
  }box.append(details);
 }
}
$('bggUsername').addEventListener('input',render);
$('bggRegister').onclick=async()=>{
 if(!user||busy)return;const username=$('bggUsername').value.trim();if(!username||username.length>64||/[\u0000-\u001f]/.test(username)){status('BGG 사용자명을 64자 이내로 입력해주세요.');return;}
 const uid=user.uid,version=epoch;busy=true;render();try{
 const previous=cached('profile',{});localStorage.setItem(key('profile'),JSON.stringify({username}));
 if(previous.username?.toLowerCase()!==username.toLowerCase()){collection=[];plays=[];localStorage.removeItem(key('collection'));localStorage.removeItem(key('plays'));}
 await saveBggProfile({username},uid);if(version===epoch)status('BGG 사용자명을 저장했습니다. 공개 정보 가져오기를 눌러주세요.');
 }catch(e){if(version===epoch)status('이 기기에 사용자명을 저장했습니다. 계정 저장은 실패했습니다. '+e.message);}finally{if(version===epoch){busy=false;render();}}
};
$('bggImport').onclick=async()=>{
 if(!user||busy||!bggSearchUrl)return;
 const username=$('bggUsername').value.trim(),uid=user.uid,version=epoch;
 if(username!==cached('profile',{}).username){status('먼저 변경한 사용자명을 등록해주세요.');return;}
 busy=true;render();let imported=0;
 try{
  for(const action of ['collection','plays']){
   let page=1,total=Infinity,items=[];
   do{
    status(`${action==='collection'?'보유 게임':'플레이 기록'} 가져오는 중 · ${page}페이지`);
    const url=new URL(bggSearchUrl);url.searchParams.set('action',action);url.searchParams.set('username',username);url.searchParams.set('page',page);
    const response=await fetch(url,{headers:{Authorization:`Bearer ${await idToken()}`},signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error(response.status===202||response.status===429?'BGG가 정보를 준비 중입니다. 잠시 후 다시 가져오기를 눌러주세요.':'BGG 공개 정보를 가져오지 못했습니다. 사용자명과 서버 설정을 확인해주세요.');
    const data=await response.json();if(version!==epoch)return;
    if(!Array.isArray(data.items))throw Error('BGG 응답 형식을 확인해주세요.');const rows=data.items;
    if(rows.some(r=>!r.id||!r.name||!/^\d+$/.test(String(r.gameId))))throw Error('BGG 응답 형식을 확인해주세요.');
    items.push(...rows);total=Number(data.total)||items.length;page++;
    if(action==='collection'||!rows.length)break;
   }while(items.length<total&&page<=10);
   items=[...new Map(items.map(p=>[p.id,p])).values()];
   await saveBggData(action,username,items,uid);if(version!==epoch)return;
   if(action==='collection')collection=items;else plays=items;
   localStorage.setItem(key(action),JSON.stringify(items));imported+=items.length;render();
   if(action==='plays'&&items.length<total)status('최근 플레이 기록 최대 1,000개를 가져왔습니다.');
  }
  status(`공개 정보 ${imported}개를 계정에 저장했습니다. 플레이 기록은 최대 1,000개까지 가져옵니다.`);
 }catch(e){if(version===epoch)status(e.message);}finally{if(version===epoch){busy=false;render();}}
};
render();
if(cloudConfigured())connectCloud(async next=>{
 const version=++epoch;user=next;busy=false;collection=[];plays=[];$('bggUsername').value='';status('');
 if(!user){render();return;}
 const uid=user.uid;$('bggUsername').value=cached('profile',{}).username||'';collection=cached('collection',[]);plays=cached('plays',[]);render();
 try{const profile=await loadBggProfile(uid);if(version!==epoch)return;if(profile){$('bggUsername').value=profile.username;localStorage.setItem(key('profile'),JSON.stringify(profile));const data=await loadBggData(profile.username,uid);if(version!==epoch)return;collection=data.collection;plays=data.plays;render();}}
 catch{if(version===epoch)status('계정의 BGG 정보를 불러오지 못해 이 기기에 저장된 내용을 표시합니다.');}
}).catch(()=>{});
