"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-lg px-4 py-2 text-sm font-semibold text-white"
      style={{ background: "#0E3F30" }}
    >
      Imprimer / Enregistrer en PDF
    </button>
  );
}
