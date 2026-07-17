"use client";

import { useState } from "react";
import { createTask } from "./actions";

const TTYPES = ["Rappel client", "Envoyer le devis", "Relance", "Préparer démo", "Administratif", "Autre"];

export function NewTaskDrawer({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(TTYPES[0]);
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Indiquez un titre");
      return;
    }
    setPending(true);
    const r = await createTask({ title: title.trim(), type, due: due || null, note, ownerId });
    setPending(false);
    if (!r.ok) {
      setError(r.error ?? "Échec de création");
      return;
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[200]" style={{ background: "rgba(14,20,17,.35)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-[201] flex h-full w-[380px] max-w-[92vw] flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b p-5" style={{ borderColor: "var(--line)" }}>
          <button onClick={onClose} className="absolute right-5 top-5 text-lg">
            ✕
          </button>
          <h2 className="font-display text-lg font-semibold">Nouvelle tâche</h2>
        </div>

        <div className="flex-1 space-y-3 p-5">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Titre
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="ex. Rappeler le client" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TTYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Échéance
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input" placeholder="Contexte, prochaine action…" />
          </label>
          {error && <div className="text-[12.5px] font-semibold text-[var(--red)]">{error}</div>}
        </div>

        <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
          <button onClick={handleCreate} disabled={pending} className="btn-primary w-full">
            Créer la tâche
          </button>
        </div>
      </div>
    </>
  );
}
