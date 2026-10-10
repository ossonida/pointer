export function gameKey(game) {
  return game.bggId ? `bgg:${game.bggId}` : `name:${game.name.trim().normalize('NFKC').toLocaleLowerCase()}`;
}
export function winnerIds(play) {
  if (play.rule === 'cooperative') return [];
  const best = (play.rule === 'lowest' ? Math.min : Math.max)(...play.players.map(p => p.score));
  return play.players.filter(p => p.score === best).map(p => p.id);
}
export function createPlay({game, date, rule, players}, id = crypto.randomUUID()) {
  const name = String(game.name || '').trim();
  if (!name || name.length > 120) throw Error('게임명을 120자 이내로 입력해주세요.');
  const bggId = game.bggId ? String(game.bggId) : '';
  if (bggId && !/^[1-9][0-9]{0,9}$/.test(bggId)) throw Error('BGG 게임 ID는 양의 정수여야 합니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date) throw Error('날짜를 확인해주세요.');
  if (!['highest','lowest','cooperative'].includes(rule)) throw Error('승리 조건을 선택해주세요.');
  if (!Array.isArray(players) || !players.length || players.length > 100 || players.some(p => !p.id || !p.name.trim() || !Number.isSafeInteger(p.score) || !/^#[0-9a-f]{6}$/i.test(p.color))) throw Error('플레이어와 점수를 확인해주세요.');
  return {id, game:{name, bggId}, date, rule, createdAt:new Date().toISOString(), players:players.map(p=>({id:p.id,name:p.name.trim(),color:p.color,score:p.score}))};
}
export function isPlay(p) {
  try { return typeof p.id==='string' && p.id.length<=100 && typeof p.createdAt==='string' && !!createPlay(p,p.id); } catch { return false; }
}
export function gameStats(plays) {
  const groups = new Map();
  for (const play of plays) {
    const key=gameKey(play.game);
    if (!groups.has(key)) groups.set(key,{key,game:play.game,count:0,competitive:0,cooperative:0,players:new Map()});
    const group=groups.get(key);group.count++;group[play.rule==='cooperative'?'cooperative':'competitive']++;
    const winners=winnerIds(play);
    for (const p of play.players) {
      const identity=p.name.normalize('NFKC').toLocaleLowerCase();
      if (!group.players.has(identity)) group.players.set(identity,{name:p.name,count:0,competitive:0,wins:0,total:0,highest:-Infinity,lowest:Infinity});
      const row=group.players.get(identity);row.count++;row.total+=p.score;row.highest=Math.max(row.highest,p.score);row.lowest=Math.min(row.lowest,p.score);
      if(play.rule!=='cooperative'){row.competitive++;if(winners.includes(p.id))row.wins++;}
    }
  }
  return [...groups.values()].map(g=>({...g,players:[...g.players.values()].map(p=>({...p,average:p.total/p.count,winRate:p.competitive?p.wins/p.competitive:null})).sort((a,b)=>b.wins-a.wins||b.average-a.average)})).sort((a,b)=>b.count-a.count||a.game.name.localeCompare(b.game.name));
}
