import {Review} from '@/components/review';
export default async function Page({params}:{params:Promise<{sessionId:string}>}){return <Review id={(await params).sessionId}/>;}
