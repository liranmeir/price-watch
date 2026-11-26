'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addLink } from '@/app/actions/link-actions';

export function AddLinkForm({ trackedItemId }: { trackedItemId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const url = String(formData.get('url') ?? '').trim();
    const storeName = String(formData.get('storeName') ?? '').trim();

    startTransition(async () => {
      const result = await addLink({ trackedItemId, url, storeName: storeName || undefined });
      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="url"
        type="url"
        required
        placeholder="Another store's URL for the same product"
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="storeName"
        type="text"
        placeholder="Store name (optional)"
        className="sm:w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add link'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
