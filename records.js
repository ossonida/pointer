import {searchLocalGames} from './game-catalog.js';
import {createPlay,isPlay,gameKey,winnerIds,gameStats} from './records-core.js';
import {cloudConfigured,connectCloud,login,logout,loadCloud,saveCloud,deleteCloud,idToken} from './cloud-records.js';
import {bggSearchUrl} from './firebase-config.js';
const $=id=>document.getElementById(id), api=window.ScoreCounter;
let currentUser=null,records=[],pending=new Set(),mode='history',accountEpoch=0,searchController=null,searchSerial=0,snapshot=[],syncing=false,searchTimer=null;
const guestKey='score.plays.v1.guest';
function key(){return currentUser?`score.plays.v1.user.${currentUser.uid}`:guestKey;}
function read(keyName){try{const data=JSON.parse(localStorage.getItem(keyName)||'{}');return {records:Array.isArray(data.records)?data.records.filter(isPlay):[],pending:Array.isArray(data.pending)?data.pending:[]};}catch{return {records:[],pending:[]};}}
function persist(){localStorage.setItem(key(),JSON.stringify({records,pending:[...pending]}));}
function loadLocal(){const data=read(key());records=data.records;pending=new Set(data.pending);}
function notify(text){$('recordMessage').textContent=text;}
function message(id,error){$(id).textContent=typeof error==='string'?error:(error?.message||'처리하지 못했습니다. 다시 시도해주세요.');}
function friendly(error){if(error?.code==='auth/popup-blocked')return '팝업이 차단됐어요. 브라우저에서 팝업을 허용한 뒤 다시 로그인해주세요.';if(error?.code==='auth/popup-closed-by-user')return '로그인이 취소됐습니다.';return error?.message||'연결하지 못했습니다. 기록은 이 브라우저에 보관됩니다.';}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function close(id){$(id).close();}
function show(id){$(id).showModal();}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function updateButtons(){ $('savePlay').hidden=!currentUser;$('historyLink').hidden=!currentUser;$('recordLoginHint').hidden=!!currentUser; $('savePlay').disabled=!api.getPlayers().length;$('accountLink').textContent=currentUser?'내 계정':'Google 로그인';$('accountName').textContent=currentUser?(currentUser.displayName||currentUser.email||'로그인됨'):'Google 로그인으로 다른 기기에서도 기록을 확인하세요.';$('accountLogin').hidden=!!currentUser;$('accountLogout').hidden=!currentUser;$('guestUpload').hidden=!currentUser||!read(guestKey).records.length;$('cloudSync').hidden=!currentUser;$('accountStorage').textContent=currentUser?(pending.size?`${pending.size}개 기록이 클라우드 저장 대기 중입니다.`:'이 계정의 기록을 클라우드에 저장합니다.'):'현재 기록은 이 브라우저에 저장됩니다.';}
function updateGameOptions(){const groups=gameStats(records);$('savedGames').replaceChildren(...groups.map(g=>{const o=node('option');o.value=g.game.name;return o;}));}
function openSave(){snapshot=api.getPlayers();if(!snapshot.length){notify('먼저 플레이어를 추가해주세요.');return;}$('playGame').value='';$('playBggId').value='';$('playDate').value=today();$('playRule').value='highest';$('playError').textContent='';$('bggResults').replaceChildren();$('selectedGameInfo').textContent='';$('gameSearchStatus').textContent=bggSearchUrl?'게임명을 입력하면 검색 결과를 선택할 수 있어요.':'저장 게임과 기본 목록 검색 · BGG 전체 검색은 아직 연결되지 않았습니다.';$('playSnapshot').replaceChildren(...snapshot.map(p=>node('span',`${p.name} ${p.score.toLocaleString('ko-KR')}점`,'record-chip')));updateGameOptions();show('savePlayDialog');$('playGame').focus({preventScroll:true});}
function selectedGame(){const name=$('playGame').value.trim();const known=records.find(p=>p.game.name.normalize('NFKC').toLocaleLowerCase()===name.normalize('NFKC').toLocaleLowerCase());return {name,bggId:$('playBggId').value.trim()||known?.game.bggId||''};}
$('playGame').addEventListener('input',()=>{$('playBggId').value='';$('selectedGameInfo').textContent='';searchSerial++;searchController?.abort();clearTimeout(searchTimer);$('searchBgg').disabled=false;renderGameResults(searchLocalGames($('playGame').value,records));if(bggSearchUrl)searchTimer=setTimeout(searchGames,500);});
$('savePlayForm').onsubmit=async event=>{event.preventDefault();const button=$('commitPlay');button.disabled=true;try{
 const play=createPlay({game:selectedGame(),date:$('playDate').value,rule:$('playRule').value,players:snapshot});
 const before=records;const oldPending=new Set(pending);records=[play,...records];if(currentUser)pending.add(play.id);
 try{persist();}catch(e){records=before;pending=oldPending;throw Error('브라우저 저장 공간을 사용할 수 없습니다. 기록을 저장하지 못했어요.');}
 close('savePlayDialog');notify(`${play.game.name} 기록을 ${currentUser?'이 기기에 저장했습니다. 클라우드에 동기화합니다.':'이 브라우저에 저장했습니다.'}`);updateButtons();renderHistory();if(currentUser)void sync();
}catch(error){message('playError',error);}finally{button.disabled=false;}};
function renderGameResults(games){
 const box=$('bggResults');box.replaceChildren();
 for(const game of games){
 if(typeof game.name!=='string'||(game.id&&!/^[1-9][0-9]{0,9}$/.test(String(game.id))))continue;
 const row=node('div',undefined,'game-result-row'),button=node('button',undefined,'game-result-choice');button.type='button';
 button.append(node('span','♟','game-result-cover'));
 const info=node('span',undefined,'game-result-info');info.append(node('strong',game.name),node('small',[game.year,game.id?'#'+game.id:'',game.source||'BGG'].filter(Boolean).join(' · ')));button.append(info);
 button.onclick=()=>{searchController?.abort();clearTimeout(searchTimer);searchSerial++;$('searchBgg').disabled=false;$('playGame').value=game.name;$('playBggId').value=String(game.id||'');$('selectedGameInfo').textContent='선택됨: '+game.name+(game.id?' · BGG #'+game.id:'');box.replaceChildren();$('playError').textContent='';$('gameSearchStatus').textContent='선택한 게임으로 현재 이름과 점수를 저장합니다.';};
 row.append(button);
 if(game.id){const link=node('a','ⓘ','game-result-detail');link.href='https://boardgamegeek.com/boardgame/'+game.id;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',game.name+' BGG 상세 보기');row.append(link);}
 box.append(row);
 }
}
async function searchGames(){
 clearTimeout(searchTimer);
 const query=$('playGame').value.trim();if(!query){$('bggResults').replaceChildren();$('gameSearchStatus').textContent='검색할 게임명을 입력해주세요.';return;}
 $('playError').textContent='';const local=searchLocalGames(query,records);renderGameResults(local);
 if(!bggSearchUrl){$('gameSearchStatus').textContent=local.length?local.length+'개 결과 · 저장 게임 / 기본 목록':'기본 목록에 없는 게임입니다. 이름을 직접 입력해 저장하거나 BGG 웹 검색을 이용해주세요.';return;}
 searchController?.abort();searchController=new AbortController();const controller=searchController,serial=++searchSerial,button=$('searchBgg');button.disabled=true;$('gameSearchStatus').textContent='BGG 검색 중…';
 try{
 const token=await idToken();const url=new URL(bggSearchUrl);url.searchParams.set('query',query);const response=await fetch(url,{signal:controller.signal,headers:{Authorization:'Bearer '+token}});
 if(!response.ok)throw Error(response.status===202||response.status===429?'BGG가 검색을 준비 중입니다. 잠시 후 다시 검색해주세요.':'BGG에 연결하지 못했습니다. 아래 결과를 선택하거나 게임명을 직접 입력할 수 있어요.');
 const data=await response.json();if(serial!==searchSerial)return;const merged=new Map(local.map(g=>[g.id?'bgg:'+g.id:'name:'+g.name,g]));
 for(const game of Array.isArray(data.games)?data.games:[])if(/^[1-9][0-9]{0,9}$/.test(String(game.id))&&typeof game.name==='string')merged.set('bgg:'+game.id,{...game,source:'BGG'});
 const games=[...merged.values()];renderGameResults(games);$('gameSearchStatus').textContent=games.length?games.length+'개 결과 · 원하는 게임을 선택해주세요.':'결과가 없습니다. 게임명을 직접 입력해 저장할 수 있어요.';
 }catch(error){if(error.name!=='AbortError'&&serial===searchSerial)$('gameSearchStatus').textContent=error.message;}
 finally{if(serial===searchSerial)button.disabled=false;}
}
$('openBggWebsite').onclick=()=>{const query=$('playGame').value.trim();if(query)window.open('https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q='+encodeURIComponent(query),'_blank','noopener,noreferrer');};
$('searchBgg').onclick=searchGames;
function renderHistory(){const groups=gameStats(records),select=$('recordFilter'),selected=select.value;select.replaceChildren(node('option','모든 게임'));select.firstChild.value='';for(const g of groups){const o=node('option',`${g.game.name} (${g.count}회)`);o.value=g.key;select.append(o);}if(groups.some(g=>g.key===selected))select.value=selected;
const filtered=records.filter(p=>!select.value||gameKey(p.game)===select.value).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));const box=$('recordList');box.replaceChildren();$('historyTab').classList.toggle('active',mode==='history');$('statsTab').classList.toggle('active',mode==='stats');
if(!filtered.length){box.append(node('p','저장된 기록이 없습니다. 점수를 입력한 뒤 게임 기록 저장을 눌러주세요.','record-note'));return;}
if(mode==='stats'){for(const g of gameStats(filtered)){const article=node('article',undefined,'record-item');article.append(node('h3',g.game.name),node('p',`${g.count}회 플레이 · 경쟁 ${g.competitive}회 · 협력 ${g.cooperative}회`));const wrap=node('div',undefined,'record-table-wrap'),table=node('table',undefined,'record-table'),head=node('thead'),row=node('tr');for(const label of ['플레이어','횟수','승리','승률','평균','최고','최저'])row.append(node('th',label));head.append(row);table.append(head);const body=node('tbody');for(const p of g.players){const tr=node('tr');for(const v of [p.name,p.count,p.wins,p.winRate===null?'—':`${Math.round(p.winRate*100)}%`,p.average.toLocaleString('ko-KR',{maximumFractionDigits:1}),p.highest,p.lowest])tr.append(node('td',String(v)));body.append(tr);}table.append(body);wrap.append(table);article.append(wrap,node('p','동점은 공동 승리로 계산합니다. 협력 게임은 승률 계산에서 제외합니다. 같은 이름은 같은 플레이어로 집계합니다.'));box.append(article);}return;}
for(const p of filtered){const article=node('article',undefined,'record-item');article.append(node('h3',p.game.name),node('p',`${p.date} · ${p.rule==='highest'?'높은 점수 승리':p.rule==='lowest'?'낮은 점수 승리':'협력 게임'}${currentUser&&pending.has(p.id)?' · 저장 대기':''}`));const wins=winnerIds(p),list=node('ul');for(const person of [...p.players].sort((a,b)=>p.rule==='lowest'?a.score-b.score:b.score-a.score))list.append(node('li',`${person.name} · ${person.score.toLocaleString('ko-KR')}점${wins.includes(person.id)?' · 승리':''}`));article.append(list);const actions=node('div',undefined,'record-actions'),restore=node('button','점수 불러오기','secondary'),remove=node('button','기록 삭제','record-danger');restore.type=remove.type='button';restore.onclick=()=>api.confirm('점수 불러오기','현재 플레이어와 점수를 이 기록으로 바꿀까요?',()=>{api.restorePlayers(p.players);close('historyDialog');notify('기록의 플레이어와 점수를 불러왔습니다.');});remove.onclick=()=>api.confirm('기록 삭제',`${p.game.name}의 ${p.date} 기록을 삭제할까요?`,async()=>{remove.disabled=true;const epoch=accountEpoch;try{if(currentUser)await deleteCloud(p.id,currentUser.uid);if(epoch!==accountEpoch)return;const old=records,oldPending=new Set(pending);records=records.filter(r=>r.id!==p.id);pending.delete(p.id);try{persist();}catch(e){records=old;pending=oldPending;throw e;}renderHistory();updateButtons();notify('기록을 삭제했습니다.');}catch(error){notify('기록을 삭제하지 못했습니다. '+friendly(error));remove.disabled=false;}});actions.append(restore,remove);article.append(actions);box.append(article);}}
$('recordFilter').onchange=renderHistory;$('historyTab').onclick=()=>{mode='history';renderHistory();};$('statsTab').onclick=()=>{mode='stats';renderHistory();};
$('savePlay').onclick=openSave;$('historyLink').onclick=()=>{renderHistory();show('historyDialog');};$('accountLink').onclick=async event=>{event?.preventDefault();updateButtons();$('accountError').textContent='';if(currentUser){show('accountDialog');return;}const link=$('accountLink');link.textContent='로그인 중…';link.setAttribute('aria-busy','true');try{await login();}catch(error){message('accountError',cloudConfigured()?friendly(error):'Google 로그인 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.');show('accountDialog');}finally{link.removeAttribute('aria-busy');updateButtons();}};
async function sync(){if(!currentUser||syncing)return;syncing=true;const uid=currentUser.uid,epoch=accountEpoch;try{for(const id of [...pending]){if(epoch!==accountEpoch)return;const play=records.find(p=>p.id===id);if(play)await saveCloud(play,uid);if(epoch!==accountEpoch)return;pending.delete(id);persist();}notify('기록을 클라우드에 저장했습니다.');}catch(error){if(epoch===accountEpoch)notify('클라우드 저장 대기 중입니다. '+friendly(error));}finally{syncing=false;updateButtons();}}
async function refreshCloud(){if(!currentUser)return;const uid=currentUser.uid,epoch=accountEpoch;try{const remote=(await loadCloud(uid)).filter(isPlay);if(epoch!==accountEpoch)return;const map=new Map(remote.map(p=>[p.id,p]));for(const p of records)if(pending.has(p.id))map.set(p.id,p);records=[...map.values()];persist();await sync();if(epoch===accountEpoch)renderHistory();}catch(error){if(epoch===accountEpoch)notify('클라우드 기록을 불러오지 못했습니다. 기기 기록은 유지됩니다. '+friendly(error));}updateButtons();}
$('accountLogin').onclick=async()=>{const button=$('accountLogin');button.disabled=true;try{await login();close('accountDialog');}catch(e){message('accountError',friendly(e));}finally{button.disabled=false;}};
$('accountLogout').onclick=async()=>{try{await logout();close('accountDialog');notify('로그아웃했습니다.');}catch(e){message('accountError',friendly(e));}};
$('cloudSync').onclick=refreshCloud;
$('guestUpload').onclick=()=>api.confirm('기기 기록을 계정에 저장','비로그인 상태에서 저장한 이 기기의 기록을 현재 계정에 복사할까요?',async()=>{const guest=read(guestKey).records;const old=records,oldPending=new Set(pending);try{const known=new Set(records.map(p=>p.id));for(const p of guest)if(!known.has(p.id)){records.push(p);pending.add(p.id);}persist();updateButtons();await sync();renderHistory();}catch(e){records=old;pending=oldPending;message('accountError',e);}});
for(const button of document.querySelectorAll('[data-record-close]'))button.onclick=()=>close(button.dataset.recordClose);
window.addEventListener('scorecounter:changed',updateButtons);window.addEventListener('online',()=>{if(currentUser)refreshCloud();});
loadLocal();updateButtons();
if(cloudConfigured())connectCloud(async user=>{accountEpoch++;currentUser=user;if(!user){close('savePlayDialog');close('historyDialog');}loadLocal();updateButtons();renderHistory();if(user)await refreshCloud();}).catch(error=>notify('로그인 서비스를 연결하지 못했습니다. '+friendly(error)));
