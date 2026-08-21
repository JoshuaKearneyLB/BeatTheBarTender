"use client";

import { useEffect } from "react";

/** Registers the minimal offline-shell service worker (public/sw.js). */
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app still works as a plain website.
      });
    }
  }, []);
  return null;
}
