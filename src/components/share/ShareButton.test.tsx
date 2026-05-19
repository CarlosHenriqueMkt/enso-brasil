/**
 * Tests for ShareButton — first "use client" component in the repo.
 *
 * No @testing-library dependency — drives `react-dom/client` directly
 * against jsdom (matches repo test idioms).
 *
 * Coverage:
 *   - wa.me anchor renders with the encoded share-text template
 *   - clipboard button copies the bare URL and shows + dismisses a toast
 *   - Web Share API is NEVER referenced (UI-SPEC anti-feature)
 *   - rel="noopener noreferrer" on the anchor (security)
 *   - "use client" header is present (lint hard rule for this file only)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { messages } from "@/lib/messages";

const componentPath = resolve(__dirname, "ShareButton.tsx");

const PROPS = {
  stateName: "São Paulo",
  level: "orange" as const,
  explanation: "Risco de enchentes na região metropolitana",
  url: "https://ensobrasil.com.br/estado/sp",
};

type Mounted = { container: HTMLDivElement; root: Root };

function mount(node: React.ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { container, root };
}

function unmount({ container, root }: Mounted) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("ShareButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.skipIf(!existsSync(componentPath))("renders wa.me anchor with encoded text", async () => {
    const { ShareButton } = await import("./ShareButton");
    const m = mount(<ShareButton {...PROPS} />);
    const link = m.container.querySelector("a") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe(messages.cta.share_whatsapp);
    const href = link!.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toBe(
      "São Paulo: Alerta — Risco de enchentes na região metropolitana. Veja em https://ensobrasil.com.br/estado/sp.",
    );
    unmount(m);
  });

  it.skipIf(!existsSync(componentPath))(
    "anchor has target=_blank and rel=noopener noreferrer",
    async () => {
      const { ShareButton } = await import("./ShareButton");
      const m = mount(<ShareButton {...PROPS} />);
      const link = m.container.querySelector("a")!;
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      unmount(m);
    },
  );

  it.skipIf(!existsSync(componentPath))("renders clipboard button after hydration", async () => {
    const { ShareButton } = await import("./ShareButton");
    const m = mount(<ShareButton {...PROPS} />);
    // useEffect runs after mount under act().
    const btn = m.container.querySelector("button") as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe(messages.cta.share_clipboard);
    expect(btn!.getAttribute("type")).toBe("button");
    unmount(m);
  });

  it.skipIf(!existsSync(componentPath))(
    "clipboard button copies the URL and shows + dismisses toast",
    async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const { ShareButton } = await import("./ShareButton");
      const m = mount(<ShareButton {...PROPS} />);
      const btn = m.container.querySelector("button")!;

      await act(async () => {
        btn.click();
      });
      expect(writeText).toHaveBeenCalledWith(PROPS.url);

      const live = m.container.querySelector('[aria-live="polite"]')!;
      expect(live.textContent).toBe(messages.cta.share_clipboard_confirm);

      // Toast auto-dismisses after 2s.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
      expect(live.textContent).toBe("");
      unmount(m);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "toast region uses aria-live=polite (screen-reader friendly)",
    async () => {
      const { ShareButton } = await import("./ShareButton");
      const m = mount(<ShareButton {...PROPS} />);
      const region = m.container.querySelector('[aria-live="polite"]');
      expect(region).not.toBeNull();
      unmount(m);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "source file does NOT reference navigator.share in code (Web Share API banned)",
    () => {
      const src = readFileSync(componentPath, "utf8");
      // Strip JSDoc/line comments before scanning — the file header references
      // the API name as an anti-feature callout, which is allowed.
      const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(codeOnly).not.toMatch(/navigator\.share\b/);
    },
  );

  it.skipIf(!existsSync(componentPath))('source file declares "use client" on first line', () => {
    const src = readFileSync(componentPath, "utf8");
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });
});
