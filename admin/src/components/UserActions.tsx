'use client';

import { useActionState } from 'react';
import {
  blockAction, deleteUserAction, grantAction, resetGrantAction, type ActionState,
} from '@/app/(dash)/users/[id]/actions';

const init: ActionState = {};

function Msg({ s }: { s: ActionState }) {
  if (s.error) return <p className="text-sm text-danger">{s.error}</p>;
  if (s.message) return <p className="text-sm text-ok">{s.message}</p>;
  return null;
}

export function GrantForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(grantAction, init);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h3 className="text-sm font-semibold">Grant free videos</h3>
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Type</label>
          <select name="kind" className="input">
            <option value="credits">Free videos (count)</option>
            <option value="unlimited">Unlimited (days)</option>
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <input name="amount" type="number" min={1} max={100000} defaultValue={1} className="input" required />
        </div>
      </div>
      <div>
        <label className="label">Note (optional)</label>
        <input name="note" maxLength={200} className="input" placeholder="Why? e.g. support refund" />
      </div>
      <Msg s={state} />
      <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Grant'}</button>
    </form>
  );
}

export function BlockForm({ userId, blocked }: { userId: string; blocked: boolean }) {
  const [state, action, pending] = useActionState(blockAction, init);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="block" value={blocked ? '0' : '1'} />
      <Msg s={state} />
      <button className={blocked ? 'btn-glass' : 'btn-danger'} disabled={pending}>
        {blocked ? 'Unblock user' : 'Block user'}
      </button>
    </form>
  );
}

export function ClearCreditsForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetGrantAction, init);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <Msg s={state} />
      <button className="btn-glass" disabled={pending}>Clear all credits</button>
    </form>
  );
}

export function DeleteForm({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(deleteUserAction, init);
  return (
    <form action={action} className="card space-y-3 border-danger/40 p-4">
      <h3 className="text-sm font-semibold text-danger">Delete user permanently</h3>
      <p className="text-xs text-ink-muted">
        Deletes the account, all videos, photos, songs, payments and files. This cannot be undone.
        Type <b className="text-ink">{email || userId}</b> to confirm.
      </p>
      <input type="hidden" name="userId" value={userId} />
      <input name="confirm" className="input" autoComplete="off" required />
      <Msg s={state} />
      <button className="btn-danger" disabled={pending}>{pending ? 'Deleting…' : 'Delete forever'}</button>
    </form>
  );
}
