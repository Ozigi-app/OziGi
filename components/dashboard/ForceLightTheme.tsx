"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Locks the dashboard + long-form routes to the landing-page palette
 * (light theme) regardless of any user preference set elsewhere.
 */
export default function ForceLightTheme() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  return null;
}
