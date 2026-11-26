'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTrackedItemFromUrl } from '@/app/actions/tracked-item-actions';

export function AddItemForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const url = String(formData.get('url') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const targetPriceRaw = String(formData.get('targetPrice') ?? '').trim();
    const targetPrice = targetPriceRaw ? Number(targetPriceRaw) : undefined;
    const targetCurrency = targetPrice ? String(formData.get('targetCurrency') ?? '') : undefined;

    startTransition(async () => {
      const result = await createTrackedItemFromUrl({
        url,
        name: name || undefined,
        targetPrice,
        targetCurrency,
      });
      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }
      formRef.current?.reset();
      if (result.data) router.push(`/dashboard/${result.data.id}`);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-slate-500">Product URL</label>
        <input
          name="url"
          type="url"
          required
          placeholder="https://www.example.com/product/..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:w-48">
        <label className="mb-1 block text-xs text-slate-500">Name (optional)</label>
        <input name="name" type="text" placeholder="auto-detected" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="sm:w-28">
        <label className="mb-1 block text-xs text-slate-500">Target price</label>
        <input
          name="targetPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="optional"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:w-24">
        <label className="mb-1 block text-xs text-slate-500">Currency</label>
        <select
          name="targetCurrency"
          defaultValue="ILS"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ILS">ILS ₪</option>
          <option value="USD">USD $</option>
          <option value="EUR">EUR €</option>
          <option value="GBP">GBP £</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Fetching…' : 'Track it'}
      </button>
      {error && <p className="text-sm text-red-600 sm:basis-full">{error}</p>}
    </form>
  );
}
