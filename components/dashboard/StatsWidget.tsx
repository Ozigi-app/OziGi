"use client";
import { useRouter } from "next/navigation";

interface StatsWidgetProps {
  stats: { campaignsGenerated: number; scheduledCount: number; personasSaved: number };
  isLoadingStats: boolean;
  isSidebarCollapsed: boolean;
  planStatus?: any;
}

export default function StatsWidget({
  stats,
  isLoadingStats,
  isSidebarCollapsed,
  planStatus,
}: StatsWidgetProps) {
  const router = useRouter();

  const showUpgradePrompt = planStatus?.plan === 'free' || planStatus?.plan === 'starter';

  return (
    <div className={`p-5 border-t border-slate-100 bg-slate-50/50 ${isSidebarCollapsed ? 'text-center' : ''}`}>
      {!isSidebarCollapsed && (
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Your Impact</h3>
      )}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-sm flex flex-col justify-center">
          {isLoadingStats ? (
            <div className="h-6 w-10 bg-slate-200 animate-pulse mx-auto rounded" />
          ) : (
            <span className="block text-2xl font-black text-brand-navy">{stats.campaignsGenerated}</span>
          )}
          {!isSidebarCollapsed && (
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">
              Campaigns
            </span>
          )}
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-sm flex flex-col justify-center">
          {isLoadingStats ? (
            <div className="h-6 w-10 bg-slate-200 animate-pulse mx-auto rounded" />
          ) : (
            <span className="block text-2xl font-black text-brand-navy">{stats.scheduledCount}</span>
          )}
          {!isSidebarCollapsed && (
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">
              Scheduled
            </span>
          )}
        </div>
      </div>
      {!isSidebarCollapsed && planStatus && planStatus.generationsLimit !== -1 && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1">
            <span>Generations used</span>
            <span>
              {planStatus.generationsUsed} / {planStatus.generationsLimit}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-brand-red h-1.5 rounded-full"
              style={{
                width: `${Math.min(
                  (planStatus.generationsUsed / planStatus.generationsLimit) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
      {!isSidebarCollapsed && showUpgradePrompt && (
  <div className="mt-4">
    <button
      onClick={() => router.push('/pricing')}
      className="w-full bg-brand-red text-white py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-opacity-90 transition"
    >
      Upgrade →
    </button>
  </div>
)}
      {!isLoadingStats && !isSidebarCollapsed && planStatus === null && (
  <div className="mt-4 h-16 bg-slate-100 animate-pulse rounded-xl" />
)}
    </div>
  );
}