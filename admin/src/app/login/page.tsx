'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={action} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="mb-1 inline-block rounded-lg bg-brand px-2 py-1 text-xs font-bold">GEETZY</div>
          <h1 className="text-2xl font-extrabold tracking-tight">Admin sign in</h1>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
