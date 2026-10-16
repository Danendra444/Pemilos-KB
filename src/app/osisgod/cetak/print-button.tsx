"use client";

export default function PrintButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={disabled}
      className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
    >
      Cetak
    </button>
  );
}
