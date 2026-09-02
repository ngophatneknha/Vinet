'use client';
import {useEffect,useRef,useState} from 'react';
import {acceptInvite,getUser,handleAuthCallback,updateUser} from '@netlify/identity';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function AuthCallback({children}:{children:React.ReactNode}){
 const started=useRef(false),[mode,setMode]=useState(''),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(started.current)return;started.current=true;
  if(!/^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/.test(window.location.hash)){getUser().catch(()=>{});return}
  setMode('processing');
  handleAuthCallback().then(r=>{
   if(!r){setMode('');return}
   if(r.type==='invite'){setToken(r.token||'');setMode('invite')}
   else if(r.type==='recovery')setMode('recovery');
   else window.location.assign('/studio');
  }).catch(()=>{setError('Liên kết đăng nhập đã hết hạn hoặc không hợp lệ. Hãy yêu cầu lại.');setMode('error')});
 },[]);
 if(!mode)return children;
 return <main className="onboarding"><h1>{mode==='processing'?'Đang xác nhận…':'Thiết lập tài khoản'}</h1>{error&&<p className="error">{error}</p>}{['invite','recovery'].includes(mode)&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const password=String(new FormData(e.currentTarget).get('password'));try{if(mode==='invite')await acceptInvite(token,password);else await updateUser({password});window.location.assign('/studio')}catch{setError('Không thể lưu mật khẩu. Kiểm tra liên kết và thử lại.')}finally{setBusy(false)}}}><label className="field">Mật khẩu mới<Input name="password" type="password" autoComplete="new-password" minLength={12} required/></label><Button type="submit" disabled={busy}>Lưu và tiếp tục</Button></form>}{mode==='error'&&<a href="/login">Về trang đăng nhập</a>}</main>;
}
