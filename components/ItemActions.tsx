'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveTrackedItem, deleteTrackedItem } from '@/app/actions/tracked-item-actions';

export function ItemActions({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-3 text-xs">
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await archiveTrackedItem(itemId, true);
            router.push('/dashboard');
          })
        }
        className="text-slate-500 hover:underline disabled:opacity-50"
      >
        Archive
      </button>
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm('Delete this tracked item and all its price history? This cannot be undone.')) return;
          startTransition(async () => {
            await deleteTrackedItem(itemId);
            router.push('/dashboard');
          });
        }}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
