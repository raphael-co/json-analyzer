"use client";

import * as React from "react";

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2 text-center text-xs dark:border-white/10">
      <div className="opacity-60">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

export function StatSmall({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2 text-center dark:border-white/10">
      <div className="text-[10px] opacity-60">{label}</div>
      <div className="mt-0.5 text-xs font-semibold">{value}</div>
    </div>
  );
}
