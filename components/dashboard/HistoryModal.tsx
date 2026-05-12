"use client";

import { useEffect } from "react";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pastCampaigns: any[];
  onRestore: (record: any) => void;
  onOpen?: () => void;
}

export default function HistoryModal({ isOpen, onClose, pastCampaigns, onRestore, onOpen }: HistoryModalProps) {
  useEffect(() => {
    if (isOpen && onOpen) onOpen();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl border-4 border-slate-900 relative max-h-[80vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-red-600 font-black text-xl"
        >
          ×
        </button>
        <h2 className="text-2xl font-black text-brand-red italic uppercase tracking-tighter mb-6">Strategy History</h2>
        <div className="overflow-y-auto space-y-4">
          {pastCampaigns.map((record) => (
            <div className="border border-slate-200 p-4 rounded-xl flex justify-between items-center group hover:bg-red-50/20">
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
                className="bg-slate-900 text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}