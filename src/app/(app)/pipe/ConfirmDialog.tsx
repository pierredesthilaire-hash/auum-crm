"use client";

import { useState } from "react";

export type ConfirmRequest = {
  title: string;
  message: React.ReactNode;
  withComment?: boolean;
  extraCheckboxLabel?: string;
  extraCheckboxDefault?: boolean;
  /** Affiche un unique bouton "Compris" au lieu du couple Annuler/Confirmer — pour les blocages informatifs. */
  alertOnly?: boolean;
  onConfirm: (result: { comment: string; extraChecked: boolean }) => void;
  onCancel: () => void;
};

export function ConfirmDialog({ request }: { request: ConfirmRequest | null }) {
  const [comment, setComment] = useState("");
  const [extraChecked, setExtraChecked] = useState(request?.extraCheckboxDefault ?? true);

  if (!request) return null;

  const close = (confirmed: boolean) => {
    if (confirmed) {
      request.onConfirm({ comment: comment.trim(), extraChecked });
    } else {
      request.onCancel();
    }
    setComment("");
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "rgba(14,20,17,.45)" }}
      onClick={() => close(false)}
    >
      <div
        className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display mb-2 text-[15px] font-semibold">{request.title}</h3>
        <div className="mb-3 text-[13px] leading-relaxed text-[var(--ink)]">{request.message}</div>

        {request.extraCheckboxLabel && (
          <label className="mb-3 flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={extraChecked}
              onChange={(e) => setExtraChecked(e.target.checked)}
            />
            {request.extraCheckboxLabel}
          </label>
        )}

        {request.withComment && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Commentaire (optionnel sauf en cas de recul)…"
            rows={2}
            className="mb-3 w-full rounded-lg border px-3 py-2 text-[12.5px]"
            style={{ borderColor: "var(--line)" }}
          />
        )}

        <div className="flex justify-end gap-2">
          {!request.alertOnly && (
            <button
              onClick={() => close(false)}
              className="rounded-lg border px-4 py-2 text-[12.5px] font-semibold"
              style={{ borderColor: "var(--line)" }}
            >
              Annuler
            </button>
          )}
          <button
            onClick={() => close(!request.alertOnly)}
            className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: request.alertOnly ? "var(--red)" : "var(--teal)" }}
          >
            {request.alertOnly ? "Compris" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
