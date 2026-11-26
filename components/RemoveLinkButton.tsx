'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeLink } from '@/app/actions/link-actions';

export function RemoveLinkButton({ linkId, trackedItemId }: { linkId: string; trackedItemId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm('Remove this link and its price history?')) return;
        startTransition(async () => {
          await removeLink(linkId, trackedItemId);
          router.refresh();
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      Remove
    </button>
  );
}
