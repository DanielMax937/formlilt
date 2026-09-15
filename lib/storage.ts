import { get, set, del, keys } from 'idb-keyval';
import { Session, type FormSchema, type UILanguage } from './schema';
const prefix = 'fillflow:session:';
export function saveSession(session: Session) { localStorage.setItem(prefix+session.id,JSON.stringify(Session.parse(session))); }
export function loadSession(id: string): Session | null { try { const raw=localStorage.getItem(prefix+id); if(!raw)return null; const parsed=Session.safeParse(JSON.parse(raw)); return parsed.success?parsed.data:null; } catch{return null;} }
export function listSessions(): Session[] { return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>loadSession(k.slice(prefix.length))).filter((s):s is Session=>!!s).sort((a,b)=>b.createdAt-a.createdAt); }
export async function createSession(schema:FormSchema, file:File, uiLanguage:UILanguage, demoSlug?:Session['demoSlug']) {
 const session=Session.parse({id:crypto.randomUUID(),schema,answers:{},currentFieldId:schema.sections[0]?.fieldIds[0]??null,uiLanguage,state:'asking',fileName:file.name,createdAt:Date.now(),demoSlug});
 await set('fillflow:file:'+session.id,file);
 try{saveSession(session);}catch(error){await del('fillflow:file:'+session.id);throw error;}return session;
}
export const getOriginal=(id:string)=>get<File>('fillflow:file:'+id);
export async function clearSession(id:string){await del('fillflow:file:'+id);localStorage.removeItem(prefix+id);}
export async function clearAllSessions(){for(const key of await keys())if(typeof key==='string'&&key.startsWith('fillflow:file:'))await del(key);for(const key of Object.keys(localStorage))if(key.startsWith('fillflow:'))localStorage.removeItem(key);}
