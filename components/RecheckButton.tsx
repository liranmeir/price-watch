'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recheckLink } from '@/app/actions/link-actions';

export function RecheckButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await recheckLink(linkId);
          router.refresh();
        })
      }
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {isPending ? 'Checking…' : 'Check now'}
    </button>
  );
}
