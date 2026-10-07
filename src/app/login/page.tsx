'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function LoginPage() {
  // useSearchParams 는 Suspense 경계가 있어야 정적 렌더가 깨지지 않는다.
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 미들웨어가 붙여 준 원래 경로로 돌려보낸다. 외부 URL 로의 오픈 리다이렉트를 막기 위해 '/' 로 시작하는 내부 경로만 허용.
  const raw = params.get('callbackUrl') ?? '/';
  const callbackUrl = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false });
      if (r?.error) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      toast.success('로그인 성공');
      router.push(callbackUrl);
      router.refresh();
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
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-ink text-slate-50 text-[22px] font-bold leading-none mb-3">코</span>
          <h1 className="text-[34px] font-bold text-ink tracking-[-0.022em] leading-[1.1]">로그인</h1>
          <p className="text-sm text-ink-muted mt-1">코아스템켐온 비임상시험 견적 시스템</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <label className="block">
            <span className="label">이메일</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="you@csco.co.kr" autoComplete="email" />
          </label>
          <label className="block">
            <span className="label">비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" autoComplete="current-password" />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            로그인
          </button>
          <p className="text-center text-xs text-ink-muted pt-1">계정이 없으면 관리자에게 발급을 요청해 주세요.</p>
        </form>
      </div>
    </div>
  );
}
