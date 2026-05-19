"use client";

/**
 * ShareButton — wa.me primary anchor + clipboard secondary button.
 *
 * FIRST `"use client"` component in the repo (flagged net-new in 05-PATTERNS.md).
 * Gated to this leaf only; the parent <StateCard /> stays a Server Component.
 *
 * Anti-features (UI-SPEC hard rules):
 *   - NO Web Share API (`navigator.share`)
 *   - NO portal, NO third-party toast lib (zero deps)
 *
 * No-JS behaviour: the wa.me anchor works without JS. The clipboard button
 * is hidden when JS is off via the `share-clipboard` CSS class (consumer
 * stylesheet hides it by default; this component reveals it on mount).
 */
import { useEffect, useState } from "react";
// Progressive enhancement is CSS-driven via the `share-button-secondary` class
// and `@media (scripting: none)` in globals.css — no `jsReady` state needed.
// Avoids React 19's react-hooks/set-state-in-effect lint rule.
import { messages } from "@/lib/messages";
import type { RiskLevel } from "@/lib/risk/types";
import { buildShareText, buildWaMeHref } from "@/lib/share/url";

type Props = {
  stateName: string;
  level: RiskLevel;
  explanation: string;
  url: string;
};

/** Toast auto-dismiss window. UI-SPEC: 2 seconds, polite live region. */
const TOAST_MS = 2000;

export function ShareButton({ stateName, level, explanation, url }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const text = buildShareText({
    estado: stateName,
    nivel: messages.severity[level],
    explicacao: explanation,
    url,
  });
  const waHref = buildWaMeHref(text);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setToast(messages.cta.share_clipboard_confirm);
    } catch {
      // Clipboard failure is non-fatal — the wa.me anchor remains the
      // canonical share path. Surface nothing rather than misleading text.
    }
  }

  return (
    <span className="share-button inline-flex items-center gap-s-2">
      <a href={waHref} target="_blank" rel="noopener noreferrer" className="share-button-primary">
        {messages.cta.share_whatsapp}
      </a>
      <button type="button" onClick={copyLink} className="share-button-secondary share-clipboard">
        {messages.cta.share_clipboard}
      </button>
      <span aria-live="polite" className="share-button-toast">
        {toast ?? ""}
      </span>
    </span>
  );
}
