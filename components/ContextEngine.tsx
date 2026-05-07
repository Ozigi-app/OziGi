"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Paperclip, ChevronDown, ArrowLeftRight, X } from "lucide-react";
import SkeletonGrid from "./SkeletonGrid";
import { uploadLargeAsset } from "@/lib/utils";
import { PLATFORM_METADATA } from "@/lib/platforms";

const ALL_PLATFORMS = Object.values(PLATFORM_METADATA);

interface DistilleryProps {
  session?: any;
  userPersonas?: { id: string; name: string; prompt?: string }[];
  onOpenSettings?: () => void;
  onOpenPersonas?: () => void;
  demoMode?: boolean;
  inputs: {
    url: string;
    text: string;
    files: File[];
    fileUrls: string[];
    platforms: string[];
    campaignName?: string;
    tweetFormat: "single" | "thread";
    additionalInfo?: string;
    personaId?: string;
  };
  setInputs: (val: any) => void;
  onGenerate: () => void;
  loading: boolean;
}

export default function Distillery({
  session,
  userPersonas = [],
  onOpenSettings,
  onOpenPersonas,
  demoMode = false,
  inputs,
  setInputs,
  onGenerate,
  loading,
}: DistilleryProps) {
  const [fileUploadOpen, setFileUploadOpen] = useState(false);
  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const personaPopoverRef = useRef<HTMLDivElement>(null);

  // Close persona popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (personaPopoverRef.current && !personaPopoverRef.current.contains(event.target as Node)) {
        setPersonaPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    if (newFiles.length === 0) return;

    setInputs({ ...inputs, files: [...inputs.files, ...newFiles] });
    setIsUploading(true);
    try {
      const authToken = session?.access_token;
      const uploadPromises = newFiles.map(file => uploadLargeAsset(file, authToken));
      const newUrls = await Promise.all(uploadPromises);
      setInputs((prev: any) => ({ 
        ...prev, 
        fileUrls: [...(prev.fileUrls || []), ...newUrls] 
      }));
    } catch (error) {
      console.error("R2 Upload error:", error);
      toast.error("Failed to upload some files. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = inputs.files.filter((_, i) => i !== index);
    const updatedUrls = inputs.fileUrls.filter((_, i) => i !== index);
    setInputs({ ...inputs, files: updatedFiles, fileUrls: updatedUrls });
  };

  const togglePlatform = (platformId: string) => {
    const active = inputs.platforms.includes(platformId);
    if (active) {
      setInputs({ ...inputs, platforms: inputs.platforms.filter(p => p !== platformId) });
    } else {
      setInputs({ ...inputs, platforms: [...inputs.platforms, platformId] });
    }
  };

  const handlePersonaSelect = (personaId: string) => {
    if (personaId === "create_new") {
      setPersonaPopoverOpen(false);
      onOpenPersonas?.();
    } else {
      setInputs({ ...inputs, personaId });
      setPersonaPopoverOpen(false);
    }
  };

  // Get selected persona name for display
  const selectedPersona = inputs.personaId === "default"
    ? "Default"
    : userPersonas.find(p => p.id === inputs.personaId)?.name || "Default";

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[400px]">
        <SkeletonGrid />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 p-2 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100">
      <div className="px-4 pt-5 pb-4">
        <div className="space-y-6">
          {/* Text input area */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
              Paste URL, notes, or raw context
            </label>
            <textarea
              data-tour="distillery-textarea"
              className="w-full bg-slate-50 rounded-xl px-5 py-4 border border-slate-200 focus:border-brand-red/50 transition-colors text-sm font-medium text-slate-900 min-h-[120px] resize-y"
              placeholder="Paste a URL, meeting notes, or any text context here..."
              value={inputs.text}
              onChange={(e) => setInputs({ ...inputs, text: e.target.value })}
            />
          </div>

          {/* File upload toggle link */}
          <div>
            <button
              onClick={() => setFileUploadOpen(!fileUploadOpen)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <Paperclip size={12} />
              {fileUploadOpen ? "Remove attachment" : "Attach a file (PDF, image, video, audio)"}
            </button>
          </div>

          {/* File upload dropzone (collapsible) */}
          <AnimatePresence>
            {fileUploadOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div
                  data-tour="file-upload-zone"
                  ref={dropZoneRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-8 border-2 border-dashed transition-all ${
                    isDragOver ? "border-brand-red bg-brand-red/5" : "border-slate-200"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf,.txt,.csv,image/*,video/*,audio/*"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <span className="text-3xl mb-3">📁</span>
                  <p className="text-sm font-bold text-slate-900 mb-1">
                    Drop files here or click to upload
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-4">
                    PDFs, images, videos, audio – up to 100MB
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition"
                  >
                    Browse Files
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File list */}
          {inputs.files.length > 0 && (
            <div className="space-y-2">
              <ul className="space-y-2">
                {inputs.files.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                    <span className="truncate flex-1">{file.name}</span>
                    <button onClick={() => removeFile(idx)} className="text-red-500 hover:text-red-700 font-bold ml-4">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                <span className="mt-px">⚠️</span>
                <span>Larger files take longer to process. For fastest results, keep files small and limit to 1–2 at a time.</span>
              </p>
            </div>
          )}

          {/* Config row: Persona + Platforms + X Format — hidden in demo mode */}
          {!demoMode && (
            <div className="flex items-center gap-4 flex-wrap py-2 border-t border-b border-slate-100">
              {/* Persona selector */}
              <div className="relative" ref={personaPopoverRef} data-tour="persona-selector">
                <button
                  onClick={() => setPersonaPopoverOpen(!personaPopoverOpen)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">Persona</span>
                  <span className="font-medium text-slate-800">{selectedPersona}</span>
                  <ChevronDown size={12} />
                </button>
                {personaPopoverOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-48 py-1">
                    <button
                      onClick={() => handlePersonaSelect("default")}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Default
                    </button>
                    {userPersonas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePersonaSelect(p.id)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {p.name}
                      </button>
                    ))}
                    <button
                      onClick={() => handlePersonaSelect("create_new")}
                      className="w-full text-left px-4 py-2 text-sm text-brand-red font-bold hover:bg-slate-50 transition-colors border-t border-slate-100 mt-1"
                    >
                      + Create New Persona
                    </button>
                  </div>
                )}
              </div>

              <span className="text-slate-200 text-sm">|</span>

              {/* Platforms inline multi-select */}
              <div className="flex items-center gap-1.5 flex-wrap" data-tour="platform-selector">
                <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">Platforms</span>
                {ALL_PLATFORMS.map((platform) => {
                  const isActive = inputs.platforms.includes(platform.id);
                  return (
                    <div key={platform.id} className="relative group">
                      <button
                        onClick={() => togglePlatform(platform.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                          isActive
                            ? "bg-brand-navy text-white border-brand-navy"
                            : "bg-white text-slate-400 border-slate-200 line-through"
                        }`}
                      >
                        {platform.shortLabel}
                      </button>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 shadow-lg">
                        {platform.tooltip}
                      </span>
                    </div>
                  );
                })}
              </div>

              <span className="text-slate-200 text-sm">|</span>

              {/* X format inline toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">X</span>
                <button
                  onClick={() => setInputs({ ...inputs, tweetFormat: inputs.tweetFormat === "single" ? "thread" : "single" })}
                  className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  {inputs.tweetFormat === "single" ? "Single tweet" : "Full thread"}
                  <ArrowLeftRight size={10} className="text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            id="demo-generate-btn"
            data-tour="generate-button"
            onClick={onGenerate}
            disabled={(!inputs.text && inputs.files.length === 0) || isUploading}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all
              bg-brand-red text-white hover:bg-[#C5280A] active:scale-[0.99]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-red"
          >
            {isUploading ? "Uploading Assets to R2... ⏳" : "Generate Content"}
          </button>

          {/* Demo hint: 3-day campaign output */}
          {demoMode && (
            <p className="text-center text-[10px] text-slate-400 leading-relaxed">
              You'll get a 3-day content campaign — posts for X, LinkedIn & Discord, ready to publish.
            </p>
          )}

          {/* Advanced directives toggle — hidden in demo mode */}
          {!demoMode && (
            <div className="text-center">
              <button
                data-tour="advanced-toggle"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                ⚙ Advanced directives {advancedOpen ? "▲" : "▼"}
              </button>
              <AnimatePresence>
                {advancedOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="mt-4"
                  >
                    {/* Campaign Directives */}
                    <div className="mt-2 p-5 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-2 flex items-center gap-2">
                        Campaign Directives
                      </label>
                      <input
                        type="text"
                        value={inputs.additionalInfo || ""}
                        onChange={(e) => setInputs({ ...inputs, additionalInfo: e.target.value })}
                        placeholder="e.g., Target junior devs. (No tone instructions here)"
                        className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>
                    {/* Campaign Name */}
                    <div className="mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-2 flex items-center gap-2">
                        Campaign Name (optional)
                      </label>
                      <input
                        type="text"
                        value={inputs.campaignName || ""}
                        onChange={(e) => setInputs({ ...inputs, campaignName: e.target.value })}
                        placeholder="e.g., Product Launch Week"
                        className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
