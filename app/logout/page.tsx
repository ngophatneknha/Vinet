'use client';
import {useState} from 'react';
import {logout} from '@netlify/identity';
import {Button} from '@/components/ui/button';
export default function Logout(){const [busy,setBusy]=useState(false);return <main className="onboarding"><h1>Đăng xuất</h1><p>Lưu bản nháp trước khi kết thúc phiên làm việc.</p><Button disabled={busy} onClick={async()=>{setBusy(true);try{await logout()}finally{window.location.assign('/login')}}}>Đăng xuất tài khoản</Button> <a href="/studio">Quay lại</a></main>}
