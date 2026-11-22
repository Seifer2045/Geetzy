'use client';

import { useActionState } from 'react';
import { checkKey, rotateKey, type KeyState } from '@/app/(dash)/api-keys/actions';

export function RotateKeyForm({ provider }: { provider: string }) {
  const [rot, rotate, rotating] = useActionState<KeyState, FormData>(rotateKey, {});
  const [chk, check, checking] = useActionState<KeyState, FormData>(checkKey, {});
  const msg = rot.error || rot.message ? rot : chk;
  return (
    <form className="space-y-2">
      <input type="hidden" name="provider" value={provider} />
      <input
        name="key" type="password" autoComplete="off" placeholder="Paste new key" className="input font-mono"
      />
      <div className="flex flex-wrap gap-2">
        <button formAction={check} className="btn-glass" disabled={checking || rotating}>{checking ? 'Testing…' : 'Test key'}</button>
        <button
          formAction={rotate} className="btn-primary" disabled={rotating || checking}
        >{rotating ? 'Rotating…' : 'Rotate key'}</button>
      </div>
      {msg.error && <p className="text-sm text-danger">{msg.error}</p>}
      {msg.message && <p className="text-sm text-ok">{msg.message}</p>}
    </form>
  );
}
