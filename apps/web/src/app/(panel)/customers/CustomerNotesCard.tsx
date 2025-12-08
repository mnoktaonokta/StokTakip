'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-client/client';
import type { CustomerNote } from '@/types/api';

interface CustomerNotesCardProps {
  customerId: string;
  initialNotes: CustomerNote[];
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

export function CustomerNotesCard({ customerId, initialNotes }: CustomerNotesCardProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) return;
    try {
      setIsSubmitting(true);
      const newNote = await apiFetch<CustomerNote>(`/api/customers/${customerId}/notes`, {
        method: 'POST',
        body: {
          content: content.trim(),
        },
      });
      setNotes((prev) => [newNote, ...prev]);
      setContent('');
      toast.success('Not kaydedildi');
    } catch (error) {
      console.error(error);
      toast.error('Not kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-300 shadow-lg shadow-black/30">
      <div className="absolute -right-3 top-10 h-6 w-6 rotate-45 border border-slate-800 bg-slate-900/70" />
      <p className="text-base font-semibold text-white">Bu müşteriyle ilgili not kaydetmek için buraya tıklayın.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Örn. Depodan ürün talep etti, fatura bekliyor..."
          className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{notes.length} kayıtlı not</p>
          <button
            type="submit"
            disabled={isSubmitting || content.trim().length === 0}
            className="rounded-2xl border border-cyan-400/40 bg-cyan-500/80 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <p className="text-xs text-slate-500">Henüz not eklenmemiş.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
              <p className="text-sm text-white">{note.content}</p>
              <p className="text-[11px] text-slate-500">{formatDateTime(note.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


