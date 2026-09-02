import type { Metadata } from 'next';
import './globals.css';
import AuthCallback from '@/components/auth-callback';

const baseMetadata: Metadata = {title:'ViNews Studio | Kiểm duyệt & gán nhãn',description:'Không gian làm việc của nhóm ViNewsCLIPpings: duyệt raw, gán nhãn độc lập và kiểm định.',robots:{index:false,follow:false}};
export function generateMetadata():Metadata {
 const origin=process.env.SITE_ORIGIN || process.env.URL;
 if(!origin)return baseMetadata;
 const image=new URL('/og.png',origin).href;
 return {...baseMetadata,metadataBase:new URL(origin),openGraph:{title:'ViNews Studio',description:'Kiểm duyệt · Gán nhãn · Kiểm định',type:'website',url:origin,images:[{url:image,width:1731,height:909,alt:'ViNews Studio — Kiểm duyệt · Gán nhãn · Kiểm định'}]},twitter:{card:'summary_large_image',title:'ViNews Studio',images:[image]}};
}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body><AuthCallback>{children}</AuthCallback></body></html>}
