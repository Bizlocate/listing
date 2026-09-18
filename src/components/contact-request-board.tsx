"use client";

import { useState } from "react";
import { Badge } from "@/components/badge";
import type { ContactRequestStatus, MockContactRequest } from "@/lib/mock/contact-requests";

const STATUS_LABEL: Record<ContactRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  expired: "Expired",
};

const STATUS_TONE: Record<ContactRequestStatus, "warn" | "ok" | "neutral"> = {
  pending: "warn",
  approved: "ok",
  expired: "neutral",
};

export function ContactRequestBoard({ requests }: { requests: MockContactRequest[] }) {
  const [selectedId, setSelectedId] = useState(requests[0]?.id);
  const selected = requests.find((r) => r.id === selectedId) ?? requests[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_330px]">
      <div className="min-w-0 rounded-2xl border border-sky-100 bg-white shadow-sm">
        {requests.map((request, i) => (
          <button
            key={request.id}
            type="button"
            onClick={() => setSelectedId(request.id)}
            className={`flex w-full items-center gap-4 px-5 py-3.5 text-left ${
              i === requests.length - 1 ? "" : "border-b border-sky-100"
            } ${request.id === selected?.id ? "bg-sky-50" : "hover:bg-sky-50/60"}`}
          >
            <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
              {request.requesterName
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{request.requesterName}</p>
              <p className="text-sm text-slate-600">
                {request.listingAddress} · {request.submittedAgo}
              </p>
            </div>
            <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="h-fit rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Request
          </div>
          <div className="mb-4 text-base font-semibold text-slate-900">{selected.requesterName}</div>

          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </dt>
              <dd className="text-slate-900">{selected.reason}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tenant
              </dt>
              <dd className="text-slate-900">{selected.tenantOrCompany}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Budget
              </dt>
              <dd className="text-slate-900">{selected.budget}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="mt-5 w-full rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Approve 48h
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
