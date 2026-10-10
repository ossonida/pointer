// A small curated starter list, not the complete or live BGG database.
export const starterGames = [
 {id:'420087',name:'Flip 7',year:'2024',aliases:['플립 7','플립7']},
 {id:'463441',name:'Flip 7: With A Vengeance',year:'2026',aliases:['플립7 위드 어 벤전스']},
 {id:'13',name:'CATAN',aliases:['카탄']},
 {id:'822',name:'Carcassonne',aliases:['카르카손']},
 {id:'9209',name:'Ticket to Ride',aliases:['티켓 투 라이드','티켓투라이드']},
 {id:'230802',name:'Azul',aliases:['아줄']},
 {id:'266192',name:'Wingspan',aliases:['윙스팬']},
 {id:'167791',name:'Terraforming Mars',aliases:['테라포밍 마스','테라포밍마스']},
 {id:'342942',name:'Ark Nova',aliases:['아크 노바','아크노바']},
 {id:'316554',name:'Dune: Imperium',aliases:['듄 임페리움']},
 {id:'397598',name:'Dune: Imperium – Uprising',aliases:['듄 업라이징','듄 임페리움 업라이징']},
 {id:'182874',name:'Grand Austria Hotel',aliases:['그랜드 오스트리아 호텔']},
 {id:'68448',name:'7 Wonders',aliases:['세븐 원더스','세븐원더스']},
 {id:'173346',name:'7 Wonders Duel',aliases:['세븐 원더스 듀얼']},
 {id:'148228',name:'Splendor',aliases:['스플렌더']},
 {id:'36218',name:'Dominion',aliases:['도미니언']},
 {id:'30549',name:'Pandemic',aliases:['팬데믹']},
 {id:'295947',name:'Cascadia',aliases:['캐스캐디아']},
 {id:'291453',name:'SCOUT',aliases:['스카우트']},
 {id:'366013',name:'Heat: Pedal to the Metal',aliases:['히트','히트 페달 투 더 메탈']},
 {id:'224517',name:'Brass: Birmingham',aliases:['브라스 버밍엄']},
 {id:'84876',name:'The Castles of Burgundy',aliases:['버건디의 성','버건디']}
];
export function normalizeGameQuery(value){return String(value).normalize('NFKC').toLocaleLowerCase().replace(/[\s:–—-]+/g,'');}
export function searchLocalGames(query,plays=[]){
 const q=normalizeGameQuery(query);if(!q)return [];
 const map=new Map();
 for(const play of plays){const game=play.game;if(!normalizeGameQuery(game.name).includes(q))continue;const key=game.bggId?`bgg:${game.bggId}`:`name:${normalizeGameQuery(game.name)}`;map.set(key,{id:game.bggId||'',name:game.name,source:'저장 게임'});}
 for(const game of starterGames){if(![game.name,...game.aliases].some(name=>normalizeGameQuery(name).includes(q)))continue;const key=`bgg:${game.id}`;if(!map.has(key))map.set(key,{...game,source:'기본 목록'});}
 return [...map.values()].slice(0,40);
}
