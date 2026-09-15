'use client';
import Link from 'next/link';
import { FileCheck2 } from 'lucide-react';
import {useLanguage} from './language-provider';
import {t} from '@/lib/i18n';
import {UILanguage} from '@/lib/schema';
export function Header({children}:{children?:React.ReactNode}){const {language,setLanguage}=useLanguage();return <header className="header"><Link href="/" className="brand"><span className="brand-icon"><FileCheck2 size={22}/></span>FillFlow<span className="brand-dot">.</span></Link><div className="header-actions">{children}<label className="language-label"><span className="sr-only">{t(language,'language')}</span><select aria-label={t(language,'language')} value={language} onChange={e=>setLanguage(UILanguage.parse(e.target.value))}><option value="en">English</option><option value="zh-CN">简体中文</option><option value="es">Español</option><option value="ja">日本語</option></select></label><Link href="/about" className="about-link">{t(language,'privacy')}</Link></div></header>;}
