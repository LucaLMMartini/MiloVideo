"use client";

import { useEffect } from "react";

export function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[92vw] max-h-[92vh]"
      >
        <div className="absolute top-2 right-2 flex gap-2">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-white/90 text-neutral-900 text-xs px-2 py-1 hover:bg-white shadow"
          >
            In Tab öffnen ↗
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded bg-white/90 text-neutral-900 text-sm px-2 py-1 hover:bg-white shadow"
          >
            ✕
          </button>
        </div>
        <img
          src={src}
          alt={alt}
          className="max-w-[92vw] max-h-[92vh] object-contain rounded shadow-lg"
        />
      </div>
    </div>
  );
}
