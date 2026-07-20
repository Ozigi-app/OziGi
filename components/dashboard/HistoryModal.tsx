"use client";

import { useEffect, useState } from "react";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pastCampaigns: any[];
  onRestore: (record: any) => void;
  onOpen?: () => void;
}

type Tab = "social" | "newsletter";

export default function HistoryModal({ isOpen, onClose, pastCampaigns, onRestore, onOpen }: HistoryModalProps) {
  const [tab, setTab] = useState<Tab>("social");

  useEffect(() => {
    if (isOpen && onOpen) onOpen();
  }, [isOpen]);

  if (!isOpen) return null;

  // Legacy rows without a type are treated as social
  const filtered = pastCampaigns.filter((r) =>
    tab === "social" ? (r.type === "social" || !r.type) : r.type === "newsletter"
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-8 shadow-2xl border-4 border-slate-900 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-red-600 font-black text-xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-black text-brand-red italic uppercase tracking-tighter mb-4">
          Generation History
        </h2>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
          {(["social", "newsletter"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
                tab === t
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "social" ? "Social Posts" : "Newsletters"}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto space-y-3 flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No {tab === "social" ? "social campaigns" : "newsletters"} generated yet.
            </p>
          ) : (
            filtered.map((record) => (
              <div
                key={record.id}
                className="border border-slate-200 p-4 rounded-xl flex justify-between items-center group hover:bg-red-50/20"
              >
                <div className="truncate pr-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    {new Date(record.created_at).toLocaleDateString()}
                  </p>
                  {record.name ? (
                    <p className="text-sm font-bold text-slate-800 truncate">{record.name}</p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {record.source_url || record.source_notes?.substring(0, 50) || "Untitled"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { onRestore(record); onClose(); }}
                  className="bg-slate-900 text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
