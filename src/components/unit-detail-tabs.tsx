"use client";

import { useState } from "react";

const TABS = ["overview", "spaces", "owner"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  spaces: "Spaces",
  owner: "Owner",
};

export function UnitDetailTabs({
  overview,
  spaces,
  owner,
}: {
  overview: React.ReactNode;
  spaces: React.ReactNode;
  owner: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const panels: Record<Tab, React.ReactNode> = { overview, spaces, owner };

  return (
    <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
      <div className="flex border-b border-sky-100 px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-3 py-3 text-sm font-semibold ${
              tab === t ? "text-sky-800" : "text-slate-500"
            }`}
          >
            {TAB_LABELS[t]}
            {tab === t ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sky-600" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="p-5">{panels[tab]}</div>
    </div>
  );
}
