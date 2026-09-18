"use client";

import { useState } from "react";
import { Badge } from "@/components/badge";
import type { MockOwnerSearchTask, OwnerSearchStatus } from "@/lib/mock/owner-search";

const STATUS_LABEL: Record<OwnerSearchStatus, string> = {
  need_search: "Need search",
  contacting: "Contacting",
  follow_up_later: "Follow up",
  wrong_number: "Wrong number",
};

const STATUS_TONE: Record<OwnerSearchStatus, "accent" | "neutral" | "warn"> = {
  need_search: "neutral",
  contacting: "accent",
  follow_up_later: "warn",
  wrong_number: "neutral",
};

export function OwnerSearchBoard({ tasks }: { tasks: MockOwnerSearchTask[] }) {
  const [selectedId, setSelectedId] = useState(tasks[0]?.id);
  const selected = tasks.find((t) => t.id === selectedId) ?? tasks[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_330px]">
      <div className="min-w-0 rounded-2xl border border-sky-100 bg-white shadow-sm">
        {tasks.map((task, i) => (
          <button
            key={task.id}
            type="button"
            onClick={() => setSelectedId(task.id)}
            className={`flex w-full items-center gap-4 px-5 py-3.5 text-left ${
              i === tasks.length - 1 ? "" : "border-b border-sky-100"
            } ${task.id === selected?.id ? "bg-sky-50" : "hover:bg-sky-50/60"}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{task.address}</p>
              <p className="text-sm text-slate-600">{task.note}</p>
            </div>
            <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="h-fit rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Working on
          </div>
          <div className="text-base font-semibold text-slate-900">{selected.address}</div>
          <div className="mb-4 text-sm text-slate-600">{STATUS_LABEL[selected.status]}</div>

          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Contact
          </div>
          <input
            className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={selected.foundContact ?? ""}
            placeholder="No number yet"
            readOnly
          />

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Outcome
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:border-sky-400 hover:bg-sky-50"
            >
              Owner confirmed
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:border-sky-400 hover:bg-sky-50"
            >
              Follow up later
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:border-sky-400 hover:bg-sky-50"
            >
              Wrong number
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
