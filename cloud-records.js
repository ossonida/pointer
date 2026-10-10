import {firebaseConfig} from './firebase-config.js';
let connection;
export function cloudConfigured(){return !!(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.authDomain);}
export async function connectCloud(onUser){
  if(!cloudConfigured())throw Error('Google 로그인 연결을 준비 중입니다. 지금은 이 브라우저에 기록을 저장할 수 있습니다.');
  if(!connection){
    connection=(async()=>{
      const base='https://www.gstatic.com/firebasejs/12.4.0/';
      const [app,auth,store]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
      const firebase=app.initializeApp(firebaseConfig);
      const session=auth.getAuth(firebase),db=store.getFirestore(firebase);
      await auth.setPersistence(session,auth.browserLocalPersistence);
      return {auth,store,session,db};
    })().catch(e=>{connection=null;throw e;});
  }
  const c=await connection;
  if(onUser)c.auth.onAuthStateChanged(c.session,onUser);
  return c;
}
export async function login(){const c=await connectCloud();await c.auth.signInWithPopup(c.session,new c.auth.GoogleAuthProvider());}
export async function logout(){const c=await connectCloud();await c.auth.signOut(c.session);}
function userId(c,expected){if(!c.session.currentUser)throw Error('로그인이 필요합니다.');if(expected&&c.session.currentUser.uid!==expected)throw Error('계정이 변경됐습니다. 다시 시도해주세요.');return c.session.currentUser.uid;}
export async function loadCloud(uid){const c=await connectCloud();const result=await c.store.getDocs(c.store.collection(c.db,'users',userId(c,uid),'plays'));return result.docs.map(d=>({...d.data(),id:d.id}));}
export async function saveCloud(play,uid){const c=await connectCloud();await c.store.setDoc(c.store.doc(c.db,'users',userId(c,uid),'plays',play.id),play);}
export async function deleteCloud(id,uid){const c=await connectCloud();await c.store.deleteDoc(c.store.doc(c.db,'users',userId(c,uid),'plays',id));}
export async function idToken(){const c=await connectCloud();if(!c.session.currentUser)throw Error('BGG 검색을 사용하려면 로그인해주세요.');return c.session.currentUser.getIdToken();}
export async function loadBggProfile(uid){const c=await connectCloud();const snap=await c.store.getDoc(c.store.doc(c.db,'users',userId(c,uid),'settings','bgg'));return snap.exists()?snap.data():null;}
export async function saveBggProfile(profile,uid){const c=await connectCloud();await c.store.setDoc(c.store.doc(c.db,'users',userId(c,uid),'settings','bgg'),profile);}
export async function saveBggData(kind,username,items,uid){const c=await connectCloud(),owner=userId(c,uid),name=kind==='collection'?'bggCollection':'bggPlays';const existing=await c.store.getDocs(c.store.query(c.store.collection(c.db,'users',owner,name),c.store.where('username','==',username)));const ids=new Set(items.map(p=>p.id));const operations=[...items.map(item=>({item})),...existing.docs.filter(d=>!ids.has(d.id)).map(d=>({ref:d.ref}))];for(let offset=0;offset<operations.length;offset+=400){userId(c,uid);const batch=c.store.writeBatch(c.db);for(const op of operations.slice(offset,offset+400)){if(op.ref)batch.delete(op.ref);else batch.set(c.store.doc(c.db,'users',owner,name,op.item.id),{...op.item,username});}await batch.commit();}}
export async function loadBggData(username,uid){const c=await connectCloud(),owner=userId(c,uid);const result=await Promise.all(['bggCollection','bggPlays'].map(name=>c.store.getDocs(c.store.query(c.store.collection(c.db,'users',owner,name),c.store.where('username','==',username)))));return {collection:result[0].docs.map(d=>d.data()),plays:result[1].docs.map(d=>d.data()).sort((a,b)=>b.date.localeCompare(a.date))};}
