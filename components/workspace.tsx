'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Header} from './header';
import {useLanguage} from './language-provider';
import {loadSession} from '@/lib/storage';
import type {Session} from '@/lib/schema';
import {t} from '@/lib/i18n';
export function Workspace({id}:{id:string}){const [session,setSession]=useState<Session|null>();const {language}=useLanguage();useEffect(()=>setSession(loadSession(id)),[id]);return <div className="shell"><Header/><main id="main">{session===undefined?<p aria-live="polite">{t(language,'loading')}</p>:!session?<section className="panel"><h1>{t(language,'noSession')}</h1><Link href="/">{t(language,'home')}</Link></section>:<section className="panel form-overview"><p className="eyebrow">{session.schema.pages.length} {t(language,'pages')} · {session.schema.fields.length} {t(language,'fields')}</p><h1>{session.schema.title}</h1><p className="muted">{t(language,'saved')}</p>{session.schema.sections.map(section=><div key={section.id}><h2>{section.title}</h2><p>{section.fieldIds.map(id=>session.schema.fields.find(f=>f.id===id)?.label).join(' · ')}</p></div>)}</section>}</main></div>;}
