"use client";

import { PenLine } from "lucide-react";

export function BrandBadge() {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/35 ring-2 ring-white/20 dark:ring-white/10"
      aria-hidden
    >
      <PenLine className="h-5 w-5" strokeWidth={2.25} />
    </div>
  );
}
