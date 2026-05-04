"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SettingsModal from "./SettingsModal";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "@/lib/supabase/client";

interface HeaderProps {
  session?: any;
  onSignIn?: () => void;
  onOpenMobileSidebar?: () => void;
}

export default function Header({ session: propSession, onSignIn, onOpenMobileSidebar }: HeaderProps) {
  const [session, setSession] = useState<any>(propSession || null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const featuresDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const showNav = pathname !== "/dashboard";

  // Features dropdown items
  const features = [
    { name: "Persona Marketplace", href: "/dashboard/personas/marketplace" },
    { name: "Long-Form Content", href: "/dashboard/long-form" },
    { name: "Multimodal Ingestion", href: "/docs/multimodal-pipeline" },
    { name: "Banned Lexicon", href: "/docs/the-banned-lexicon" },
    { name: "System Personas", href: "/docs/system-personas" },
    { name: "Human‑in‑the‑Loop", href: "/docs/human-in-the-loop" },
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (featuresDropdownRef.current && !featuresDropdownRef.current.contains(event.target as Node)) {
        setIsFeaturesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch session internally if needed
  useEffect(() => {
    if (!propSession) {
      const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      };
      getSession();
    } else {
      setSession(propSession);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [propSession]);

  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener("openSettingsModal", handleOpenSettings);
    return () => window.removeEventListener("openSettingsModal", handleOpenSettings);
  }, []);

  const signOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <>
      <header className={`w-full z-40 transition-all ${isDashboard ? 'bg-transparent' : ''}`}
        style={!isDashboard ? { background: "rgba(7,16,32,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)" } : {}}>
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between ${isDashboard ? 'w-full' : 'max-w-7xl'}`}>

          {/* LEFT SIDE: Brand & Mobile Toggle */}
          <div className="flex items-center gap-4">
            {isDashboard && (
              <button
                onClick={onOpenMobileSidebar}
                className="md:hidden p-2 -ml-2 text-foreground-muted hover:text-foreground focus:outline-none bg-surface rounded-lg shadow-sm border border-border"
                aria-label="Open sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {!isDashboard && (
              <Link href="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="Ozigi" className="h-8 w-auto logo-spin" />
                <span className="text-2xl font-black text-white tracking-tighter">Ozigi</span>
              </Link>
            )}
          </div>

          {/* RIGHT SIDE: Navigation & Profile */}
          <div className="flex items-center gap-4">
            {showNav && (
              <nav className="hidden md:flex items-center gap-6 mr-4">
                <Link href="/docs" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Docs
                </Link>
                <Link href="/tutorials" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Tutorials
                </Link>
                <Link href="https://blog.ozigi.app" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Blog
                </Link>
                <Link href="/changelog" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Changelog
                </Link>
                <Link href="/architecture" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Architecture
                </Link>
                <Link href="/pricing" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Pricing
                </Link>

                {/* Features Dropdown - opens on hover */}
                <div
                  className="relative"
                  ref={featuresDropdownRef}
                  onMouseEnter={() => setIsFeaturesDropdownOpen(true)}
                  onMouseLeave={() => setIsFeaturesDropdownOpen(false)}
                >
                  <button className="text-sm font-semibold text-slate-300 hover:text-white transition flex items-center gap-1">
                    Features
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isFeaturesDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl py-2 z-50"
                      style={{ background: "#0d1e35", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                      {features.map((feature) => (
                        <Link
                          key={feature.href}
                          href={feature.href}
                          className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition"
                          onClick={() => setIsFeaturesDropdownOpen(false)}
                        >
                          {feature.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  href={process.env.NEXT_PUBLIC_CALENDLY_URL || "mailto:hello@ozigi.app"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-300 hover:text-white transition">
                  Contact Sales
                </Link>

                <a
                  href="https://github.com/Ozigi-app/OziGi/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Star us
                </a>
              </nav>
            )}

            {/* Theme toggle — visible on every page */}
            <ThemeToggle />

            {/* User Profile Dropdown (logged in) */}
            {session ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden transition-all focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.2)" }}
                >
                  {session.user.user_metadata?.avatar_url ? (
                    <img
                      src={session.user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-black text-slate-500 uppercase">
                      {session.user.email?.[0] || "U"}
                    </span>
                  )}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2"
                    style={{ background: "#0d1e35", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-sm font-bold text-white truncate">
                        {session.user.user_metadata?.full_name || "Account"}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {session.user.email}
                      </p>
                    </div>

                    {!isDashboard && (
                      <Link
                        href="/dashboard"
                        className="block w-full text-left px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Dashboard
                      </Link>
                    )}

                    <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.07)" }} />

                    <button
                      onClick={signOut}
                      disabled={isLoggingOut}
                      className="block w-full text-left px-4 py-3 text-sm font-bold text-brand-red hover:bg-brand-red/10 transition-colors disabled:opacity-50 flex items-center justify-between group"
                    >
                      {isLoggingOut ? "Logging out..." : "Log Out"}
                      <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={onSignIn}
                  className="hidden md:block text-sm font-bold text-slate-300 hover:text-white transition-colors px-4 py-2"
                >
                  Log in
                </button>
                <button
                  onClick={onSignIn}
                  className="text-white text-sm font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                  style={{ background: "linear-gradient(135deg, #E8320A 0%, #c52000 100%)", boxShadow: "0 4px 16px rgba(232,50,10,0.3)" }}
                >
                  Try Free
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isSettingsOpen && (
        <SettingsModal
          session={session}
          onEmailAdded={() => { }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </>
  );
}
