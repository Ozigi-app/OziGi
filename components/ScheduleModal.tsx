"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PLATFORMS } from "@/lib/platforms"; 

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: string, email?: string | null) => Promise<void>; // 👈 added email
  postText: string;
  platform: string;
  day: number;          // 👈 prop for the campaign day
  imageUrl?: string;
  userEmail?: string | null;
  profileEmail?: string | null;

}

export default function ScheduleModal({
  isOpen,
  onClose,
  onSchedule,
  postText,
  platform,
  day,
  imageUrl,
  userEmail,
  profileEmail,

}: ScheduleModalProps) {
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Prefer the reminder email configured in Settings over the account login email
  const emailToUse = profileEmail || userEmail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledFor) return;
    setLoading(true);
    try {
      const localDate = new Date(scheduledFor + ":00");
      const utcString = localDate.toISOString();
      await onSchedule(utcString, emailToUse); // pass email to parent
      toast.success("Post successfully scheduled! 🚀"); // 👈 Trigger toast on success
      onClose();
    } catch (error) {
      console.error("Schedule failed:", error);
      toast.error("Failed to schedule post. Please try again."); // 👈 Error toast
    } finally {
      setLoading(false);
    }
  };
  

  // Minimum datetime (local) for the picker – rename local variable to avoid conflict
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const minDateTime = `${year}-${month}-${dayOfMonth}T${hours}:${minutes}`;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border-4 border-slate-900 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-red-600 font-black text-2xl transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-brand-red mb-2">
          Schedule Post
        </h2>
        <p className="text-slate-500 text-sm font-medium mb-6">
          {platform} · Day {day}
        </p>

        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 max-h-32 overflow-y-auto">
          {postText}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="datetime" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Date & Time (your local time)
            </label>
            <input
              type="datetime-local"
              id="datetime"
              required
              min={minDateTime}
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-red-500/50 text-sm font-medium text-slate-900"
            />
          </div>

  {platform.toLowerCase() === PLATFORMS.X && (
    <div className="space-y-3">
      {!emailToUse ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800 font-medium mb-2">
            ⚠️ Email reminders require an email address.
          </p>
          <a
            href="/dashboard?openSettings=true"
            className="text-xs font-black uppercase tracking-widest text-amber-700 hover:text-amber-900 underline"
          >
            Add your email in Settings
          </a>
        </div>
      ) : (
        <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
          📧 Reminders will be sent to {emailToUse}
        </p>
      )}
    </div>
  )}

  {platform.toLowerCase() === PLATFORMS.EMAIL && (
  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
    <p className="text-xs text-indigo-800 font-medium">
      📧 This email will be sent to all your active subscribers.
    </p>
  </div>
)}


          <button
            type="submit"
            disabled={loading || !scheduledFor}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:bg-indigo-300 text-xs shadow-lg"
          >
            {loading ? "Scheduling..." : "Schedule Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
