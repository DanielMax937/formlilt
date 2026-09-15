'use client';
import {useEffect,useState} from 'react';
import {renderFile} from '@/hooks/use-page-render';
import {t} from '@/lib/i18n';
import type {UILanguage} from '@/lib/schema';
export function DocumentPreview({file,language}:{file:File;language:UILanguage}){
 const [pages,setPages]=useState<string[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let disposed=false;let urls:string[]=[];setPages([]);setError('');renderFile(file).then(result=>{if(disposed)return;urls=result.pages.map(page=>URL.createObjectURL(page));setPages(urls);}).catch(()=>{if(!disposed)setError(t(language,'error'));});return()=>{disposed=true;urls.forEach(URL.revokeObjectURL);};},[file,language]);
 return <div className="document-preview">{!pages.length&&<p role="status">{error||t(language,'loading')}</p>}{pages.map((url,index)=><figure key={url}><img src={url} alt={`${file.name} · ${t(language,'pages')} ${index+1}`} /><figcaption>{index+1} / {pages.length}</figcaption></figure>)}</div>;
}
