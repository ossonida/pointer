import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {XMLParser} from 'fast-xml-parser';
import {collectionData,playsData} from './bgg-data.js';
initializeApp();
const token=defineSecret('BGG_API_TOKEN');
export const bggSearch=onRequest({region:'asia-northeast3',cors:['https://ossonida.github.io'],secrets:[token],maxInstances:2,timeoutSeconds:20},async(req,res)=>{
  res.set('Cache-Control','private, no-store');
  if(req.method!=='GET'){res.status(405).json({error:'GET only'});return;}
  const authorization=req.get('Authorization')||'';
  try{await getAuth().verifyIdToken(authorization.replace(/^Bearer\s+/i,''));}catch{res.status(401).json({error:'Sign in required'});return;}
  const action=typeof req.query.action==='string'?req.query.action:'search';
  if(!['search','collection','plays'].includes(action)){res.status(400).json({error:'Invalid action'});return;}
  if(action!=='search'){
    const username=typeof req.query.username==='string'?req.query.username.trim():'';
    const page=Number(req.query.page||1);
    if(!username||username.length>64||/[\u0000-\u001f]/.test(username)||!Number.isInteger(page)||page<1||page>10){res.status(400).json({error:'Invalid username or page'});return;}
    try{
      const url=new URL('https://boardgamegeek.com/xmlapi2/'+action);url.searchParams.set('username',username);
      if(action==='collection'){url.searchParams.set('own','1');url.searchParams.set('subtype','boardgame');url.searchParams.set('brief','1');}else url.searchParams.set('page',String(page));
      const response=await fetch(url,{headers:{Authorization:`Bearer ${token.value()}`},signal:AbortSignal.timeout(12000)});
      if(response.status===202||response.status===429){res.status(response.status).json({error:'BGG temporarily busy'});return;}
      if(!response.ok){res.status(502).json({error:'BGG request failed'});return;}
      const xml=await response.text();if(xml.length>2_000_000)throw Error('Response too large');
      const parsed=new XMLParser({ignoreAttributes:false,processEntities:false,parseAttributeValue:false,isArray:name=>['item','play','player'].includes(name)}).parse(xml);
      if(parsed.errors||parsed.error||(action==='collection'?!parsed.items:!parsed.plays))throw Error('BGG user unavailable');
      // Item nodes must be scalar within each play, but arrays in collections.
      if(action==='plays')for(const play of parsed.plays?.play||[])if(Array.isArray(play.item))play.item=play.item[0];
      res.json(action==='collection'?collectionData(parsed):playsData(parsed));
    }catch{res.status(502).json({error:'BGG public data unavailable'});}return;
  }
  const query=typeof req.query.query==='string'?req.query.query.trim():'';
  if(query.length<2||query.length>120){res.status(400).json({error:'Query must be 2–120 characters'});return;}
  try{
    const url=new URL('https://boardgamegeek.com/xmlapi2/search');url.searchParams.set('query',query);url.searchParams.set('type','boardgame');
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token.value()}`},signal:AbortSignal.timeout(12000)});
    if(response.status===202||response.status===429){res.status(response.status).json({error:'BGG temporarily busy'});return;}
    if(!response.ok){res.status(502).json({error:'BGG request failed'});return;}
    const xml=await response.text();if(xml.length>2_000_000)throw Error('Response too large');
    const parsed=new XMLParser({ignoreAttributes:false,processEntities:false,isArray:name=>name==='item'}).parse(xml);
    const games=(parsed.items?.item||[]).slice(0,40).map(item=>{const names=Array.isArray(item.name)?item.name:[item.name];const name=names.find(n=>n?.['@_type']==='primary')||names[0];return {id:String(item['@_id']),name:String(name?.['@_value']||''),year:String(item.yearpublished?.['@_value']||'')};}).filter(game=>/^[1-9][0-9]{0,9}$/.test(game.id)&&game.name);
    res.json({games});
  }catch{res.status(502).json({error:'BGG search unavailable'});}
});
