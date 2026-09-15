'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import { languageFrom } from '@/lib/i18n';
import type { UILanguage } from '@/lib/schema';
const LanguageContext=createContext<{language:UILanguage;setLanguage:(language:UILanguage)=>void}>({language:'en',setLanguage:()=>{}});
export function LanguageProvider({children}:{children:React.ReactNode}){
 const [language,set]=useState<UILanguage>('en');
 useEffect(()=>{try{set(languageFrom(localStorage.getItem('fillflow:language')??navigator.language));}catch{set(languageFrom(navigator.language));}},[]);
 useEffect(()=>{document.documentElement.lang=language;},[language]);
 const setLanguage=(value:UILanguage)=>{set(value);try{localStorage.setItem('fillflow:language',value);}catch{}};
 return <LanguageContext.Provider value={{language,setLanguage}}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
