"use client";

import { useEffect, useRef, useState } from "react";
import { messages } from "@/lib/messages";

export function EmergencyButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="emergency-button-root">
      {open && (
        <ul role="menu" aria-label={messages.emergency.panel_title} className="emergency-panel">
          <li className="emergency-panel-title" aria-hidden="true">
            {messages.emergency.panel_title}
          </li>
          {messages.emergency.entries.map((e) => (
            <li key={e.number} role="none">
              <a role="menuitem" href={`tel:${e.number}`} className="emergency-panel-link">
                <span className="emergency-panel-number">{e.number}</span>
                <span className="emergency-panel-agency">{e.agency}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        aria-label={messages.emergency.button_label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="emergency-button"
      >
        <span aria-hidden="true">⛑</span>
      </button>
    </div>
  );
}
