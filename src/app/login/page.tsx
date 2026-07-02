'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Beaker, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const r = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, name, password }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? '가입 실패');
        toast.success(data.role === 'admin' ? '관리자 계정 생성 — 로그인하세요.' : '가입 완료. 로그인해 주세요.');
        setMode('signin');
      } else {
        const r = await signIn('credentials', { email, password, redirect: false });
        if (r?.error) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        toast.success('로그인 성공');
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg mb-3">
            <Beaker className="w-6 h-6" />
          </span>
          <h1 className="text-[34px] font-bold tracking-[-0.022em] leading-[1.1]">{mode === 'signin' ? '로그인' : '계정 만들기'}</h1>
          <p className="text-sm text-ink-muted mt-1">코아스템켐온 비임상시험 견적 시스템</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          {mode === 'signup' && (
            <label className="block">
              <span className="label">이름</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input" placeholder="홍길동" />
            </label>
          )}
          <label className="block">
            <span className="label">이메일</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="you@chemon.co.kr" autoComplete="email" />
          </label>
          <label className="block">
            <span className="label">비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="input" placeholder="6자 이상" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
            {mode === 'signin' ? '로그인' : '가입하기'}
          </button>
          <div className="text-center text-xs text-ink-muted pt-1">
            {mode === 'signin' ? (
              <>아직 계정이 없으신가요? <button type="button" onClick={() => setMode('signup')} className="text-brand-600 hover:underline font-medium">가입</button></>
            ) : (
              <>이미 계정이 있으신가요? <button type="button" onClick={() => setMode('signin')} className="text-brand-600 hover:underline font-medium">로그인</button></>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
