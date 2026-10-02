"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  MAX_WRITING_SAMPLES_CHARS,
  MAX_STYLE_GUIDE_CHARS,
  splitWritingSamples,
} from "@/lib/prompts/voice";

interface PersonasManagerProps {
  session: any;
}

export default function PersonasManager({ session }: PersonasManagerProps) {
  const [personas, setPersonas] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newSamples, setNewSamples] = useState("");
  const [newStyleGuide, setNewStyleGuide] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_personas")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (!error && data) setPersonas(data);
    } catch {
      // Supabase client error (e.g. network timeout) — don't leave spinner forever
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewPrompt("");
    setNewSamples("");
    setNewStyleGuide("");
    setEditing(null);
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setNewName(p.name ?? "");
    setNewPrompt(p.prompt ?? "");
    setNewSamples(p.writing_samples ?? "");
    setNewStyleGuide(p.style_guide ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    setIsSaving(true);

    const fields: Record<string, string | null> = {
      name: newName.trim(),
      prompt: newPrompt.trim(),
    };
    // Only send the voice columns when there's something to write (or to clear
    // on an edit), so saving a plain persona still works before the
    // writing_samples / style_guide migration has been applied.
    const samples = newSamples.trim();
    const guide = newStyleGuide.trim();
    if (samples || (editing && "writing_samples" in editing)) fields.writing_samples = samples || null;
    if (guide || (editing && "style_guide" in editing)) fields.style_guide = guide || null;
    if (editing && "updated_at" in editing) fields.updated_at = new Date().toISOString();

    const { error } = editing
      ? await supabase
          .from("user_personas")
          .update(fields)
          .eq("id", editing.id)
          .eq("user_id", session.user.id)
      : await supabase.from("user_personas").insert({ user_id: session.user.id, ...fields });

    setIsSaving(false);
    if (!error) {
      toast.success(editing ? "Persona updated!" : "Persona created!");
      resetForm();
      fetchPersonas();
      window.dispatchEvent(new Event("refreshPersonas"));
    } else {
      toast.error(`Failed to save persona: ${error.message}`);
    }
  };

  const sampleCount = splitWritingSamples(newSamples).length;

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    const { error } = await supabase.from("user_personas").delete().eq("id", deleteConfirm.id);
    if (!error) {
      setPersonas(personas.filter(p => p.id !== deleteConfirm.id));
      window.dispatchEvent(new Event("refreshPersonas"));
      toast.success("Persona deleted");
    } else {
      toast.error("Failed to delete persona");
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black italic text-brand-red uppercase tracking-tighter mb-2">Your Personas</h2>
        <p className="text-slate-500 text-sm">Create and manage custom voices for your campaigns. Add writing samples and your style guide so everything Ozigi writes sounds like you.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">
          {editing ? `Edit Persona: ${editing.name}` : "Create New Persona"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-250 rounded-xl px-4 py-3 border border-slate-200 text-sm font-medium"
              placeholder="e.g., Expert DevRel"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Persona Details</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={4}
              className="w-full bg-slate-250 rounded-xl px-4 py-3 border border-slate-200 text-sm font-medium"
              placeholder="You are a developer educator who hates corporate buzzwords..."
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Writing Samples <span className="normal-case tracking-normal font-medium">(optional, strongest voice signal)</span>
            </label>
            <textarea
              value={newSamples}
              onChange={(e) => setNewSamples(e.target.value)}
              rows={8}
              maxLength={MAX_WRITING_SAMPLES_CHARS}
              className="w-full bg-slate-250 rounded-xl px-4 py-3 border border-slate-200 text-sm font-medium font-mono"
              placeholder={"Paste 3–10 posts, emails or paragraphs you wrote yourself.\nPut a line with --- between each one.\n\nFirst post...\n---\nSecond post..."}
            />
            <p className="text-xs text-slate-400 mt-1">
              {sampleCount} sample{sampleCount === 1 ? "" : "s"} · {newSamples.length.toLocaleString()}/
              {MAX_WRITING_SAMPLES_CHARS.toLocaleString()} characters. Ozigi copies how you write, never what you wrote.
            </p>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Style Guide <span className="normal-case tracking-normal font-medium">(optional)</span>
            </label>
            <textarea
              value={newStyleGuide}
              onChange={(e) => setNewStyleGuide(e.target.value)}
              rows={5}
              maxLength={MAX_STYLE_GUIDE_CHARS}
              className="w-full bg-slate-250 rounded-xl px-4 py-3 border border-slate-200 text-sm font-medium"
              placeholder={'Paste your brand or editorial style guide.\ne.g. Always "open source", never "open-source". UK spelling. No exclamation marks. Say "customers", not "users".'}
            />
            <p className="text-xs text-slate-400 mt-1">
              {newStyleGuide.length.toLocaleString()}/{MAX_STYLE_GUIDE_CHARS.toLocaleString()} characters
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !newName.trim() || !newPrompt.trim()}
              className="bg-red-700 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editing ? "Save Changes" : "Create Persona"}
            </button>
            {editing && (
              <button
                onClick={resetForm}
                className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-slate-500 border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="bg-brand-red/5 border border-brand-red/20 rounded-xl p-3">
            <p className="text-xs text-slate-600">
              <span className="font-black text-brand-red">💡 Tip:</span> Browse the <a href="/dashboard/personas/marketplace" className="font-bold text-brand-red hover:underline">Persona Marketplace</a> for pre-built voices from industry experts. You can import any persona and customize it to your needs.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">Existing Personas</h3>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : personas.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No personas yet. Create one above.
          </div>
        ) : (
          <ul className="space-y-3">
            {personas.map((p) => (
              <li key={p.id} className="flex items-start justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">{p.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.prompt}</p>
                  {(p.writing_samples || p.style_guide) && (
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-red mt-2">
                      {[
                        p.writing_samples && `${splitWritingSamples(p.writing_samples).length} writing samples`,
                        p.style_guide && "style guide",
                      ].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleEdit(p)}
                  className="text-slate-500 hover:text-slate-900 text-xs font-black uppercase tracking-widest px-2 py-1 ml-4"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(p.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-black px-2 py-1 ml-4"
                  title="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Persona"
        message="Are you sure you want to delete this persona? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
}
