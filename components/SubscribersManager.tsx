"use client";
import { useState, useEffect } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { usePlanStatus } from "@/components/hooks/usePlanStatus";
import ConfirmDialog from "@/components/ConfirmDialog";

interface SubscribersManagerProps {
  session: any;
  onOpenUpgradeModal?: () => void;
}

export default function SubscribersManager({ session, onOpenUpgradeModal }: SubscribersManagerProps) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [newEmails, setNewEmails] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const { planStatus, loading: planLoading } = usePlanStatus();
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/subscribers');
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
      }
    } catch (error) {
      console.error("Failed to fetch subscribers", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubscribers = async () => {
    const emailList = newEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));

    if (emailList.length === 0) return;

    // Check per-upload limit for plans with a newsletter send cap
    if (planStatus?.emailSendsLimit !== -1 && planStatus?.emailSendsLimit !== undefined && emailList.length > planStatus.emailSendsLimit) {
      toast.error(`Your plan allows max ${planStatus.emailSendsLimit} subscribers. Upgrade to Pro for unlimited.`);
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailList })
      });
      if (res.ok) {
        setNewEmails('');
        await fetchSubscribers();
        toast.success(`Added ${emailList.length} subscribers!`);
      } else {
        const data = await res.json();
        toast.error(`Failed to add: ${data.error}`);
      }
    } catch (error) {
      console.error("Error adding subscribers", error);
      toast.error("Failed to add subscribers. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      const res = await fetch(`/api/subscribers/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubscribers(subscribers.filter(s => s.id !== deleteConfirm.id));
        toast.success("Subscriber removed.");
      } else {
        toast.error("Failed to remove subscriber. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting subscriber", error);
      toast.error("An error occurred. Please try again.");
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        // Extract emails – assume first column is email
        const emails: string[] = [];
        for (const row of results.data as any[]) {
          const email = row[0]?.trim();
          if (email && email.includes('@')) {
            emails.push(email);
          }
        }

        if (emails.length === 0) {
          toast.error("No valid emails found in CSV.");
          setIsUploadingCSV(false);
          return;
        }

        // Check per-upload limit for plans with a newsletter send cap
        if (planStatus?.emailSendsLimit !== -1 && planStatus?.emailSendsLimit !== undefined && emails.length > planStatus.emailSendsLimit) {
          toast.error(`Your plan allows max ${planStatus.emailSendsLimit} subscribers. Upgrade to Pro for unlimited.`);
          setIsUploadingCSV(false);
          return;
        }

        try {
          const res = await fetch('/api/subscribers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails }),
          });
          if (res.ok) {
            await fetchSubscribers();
            toast.success(`Successfully added ${emails.length} subscribers!`);
          } else {
            const data = await res.json();
            toast.error(`Failed to add: ${data.error}`);
          }
        } catch (error) {
          console.error("Error adding subscribers via CSV", error);
          toast.error("Failed to upload CSV. Please try again.");
        } finally {
          setIsUploadingCSV(false);
          // Clear file input
          event.target.value = '';
        }
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        toast.error("Failed to parse CSV file. Please check the format.");
        setIsUploadingCSV(false);
      },
    });
  };

  const subscriberLimit = planStatus?.emailSendsLimit === -1 ? "unlimited" : planStatus?.emailSendsLimit;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black italic uppercase text-brand-red tracking-tighter mb-2">Email Subscribers</h2>
        <p className="text-slate-500 text-sm">Manage your email list. Subscribers will receive your generated newsletters.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
          Add emails (one per line)
        </label>
        <textarea
          rows={4}
          className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 text-sm font-medium text-slate-900"
          placeholder="user@example.com&#10;friend@domain.com"
          value={newEmails}
          onChange={(e) => setNewEmails(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            onClick={handleAddSubscribers}
            disabled={isAdding || !newEmails.trim()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Add Emails"}
          </button>
          <label className="cursor-pointer bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors">
            {isUploadingCSV ? "Uploading..." : "📁 Upload CSV"}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
              disabled={isUploadingCSV}
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-400">
          CSV file should have one email per row (first column). Team plan: max 500 emails per upload. Upgrade for unlimited.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Your Subscribers</h3>
          <span className="text-xs text-slate-400">{subscribers.length} total</span>
        </div>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No subscribers yet. Add some above.
          </div>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {subscribers.map((sub) => (
              <li
                key={sub.id}
                className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{sub.email}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{sub.status}</p>
                </div>
                <button
                  onClick={() => handleDeleteClick(sub.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-black px-2 py-1"
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {planStatus?.emailSendsLimit !== -1 && (
          <p className="text-xs text-slate-500 mt-4">
            Your plan includes up to {subscriberLimit} subscribers. Upgrade to Pro for unlimited.
          </p>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Remove Subscriber"
        message="Are you sure you want to remove this subscriber from your list?"
        confirmLabel="Remove"
        variant="warning"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
}
