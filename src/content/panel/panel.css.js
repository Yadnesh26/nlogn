import { BRAND_GRADIENT, BRAND_TEAL } from "../../shared/brand.js";

export const PANEL_CSS = `
:host {
  all: initial;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --radius-sm: 6px;
  --radius-md: 9px;
  --radius-lg: 12px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;

  /* dark surface tokens (default) */
  --bg: #1c1c1f;
  --bg-raised: #232326;
  --fg: #ededf0;
  --fg-dim: #a3a3ab;
  --fg-faint: #75757e;
  --border: rgba(255,255,255,0.09);
  --border-strong: rgba(255,255,255,0.16);
  --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 12px 32px -8px rgba(0,0,0,0.5);
}
* { box-sizing: border-box; }

/* ---------- trigger / widget ---------- */

.nlogn-widget {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  font: 13px/1.5 var(--font-sans);
}
.nlogn-widget.floating {
  position: fixed;
  z-index: 2147483647;
}

.nlogn-bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  background: ${BRAND_GRADIENT};
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: filter 0.15s var(--ease);
}
.nlogn-bubble:hover { filter: brightness(1.12); }
.nlogn-bubble:active { filter: brightness(0.96); }
.nlogn-bubble.hidden { display: none; }

.nlogn-logo {
  height: 60%;
  width: auto;
  display: block;
  flex-shrink: 0;
}

.nlogn-bubble.docked {
  height: 36px;
  padding: 0 14px;
  background: #222222;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  border-left: 1px solid rgba(0,0,0,0.35);
  flex: 0 1 auto;
}
.nlogn-bubble.docked:hover { background: #2b2b2b; filter: none; }

.nlogn-bubble.pill {
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  box-shadow: var(--shadow);
}

.nlogn-tooltip {
  position: fixed;
  z-index: 2147483647;
  display: none;
  background: #1a1a1c;
  color: var(--fg);
  font: 500 12px/1.4 var(--font-sans);
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  white-space: nowrap;
  pointer-events: none;
}
.nlogn-tooltip.open { display: block; }

/* ---------- card ---------- */

.nlogn-card {
  position: fixed;
  z-index: 2147483647;
  width: 380px;
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  font: 13px/1.5 var(--font-sans);
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
  pointer-events: none;
  visibility: hidden;
  transition: opacity 0.16s var(--ease), transform 0.16s var(--ease), visibility 0s linear 0.16s;
}
.nlogn-card.light {
  --bg: #ffffff;
  --bg-raised: #f7f7f8;
  --fg: #18181b;
  --fg-dim: #6b6b74;
  --fg-faint: #97979f;
  --border: rgba(0,0,0,0.09);
  --border-strong: rgba(0,0,0,0.14);
  --shadow: 0 1px 2px rgba(0,0,0,0.06), 0 12px 28px -10px rgba(0,0,0,0.2);
}
.nlogn-card.open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  visibility: visible;
  transition: opacity 0.16s var(--ease), transform 0.16s var(--ease);
}

.nlogn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.nlogn-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nlogn-header-title img {
  height: 17px;
  width: auto;
}
.nlogn-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
}
.nlogn-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.nlogn-link {
  color: var(--fg-dim);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: color 0.15s, background 0.15s;
}
.nlogn-link:hover { color: var(--fg); background: var(--bg-raised); }
.nlogn-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: var(--fg-dim);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s, background 0.15s;
}
.nlogn-close:hover { color: var(--fg); background: var(--bg-raised); }

.nlogn-body {
  padding: var(--space-4);
  overflow-y: auto;
}

.nlogn-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: ${BRAND_GRADIENT};
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font: 600 13px/1 var(--font-sans);
  cursor: pointer;
  transition: filter 0.15s var(--ease), transform 0.1s var(--ease);
}
.nlogn-btn:hover { filter: brightness(1.1); }
.nlogn-btn:active { transform: scale(0.985); }
.nlogn-btn:disabled { opacity: 0.5; cursor: default; filter: none; transform: none; }
.nlogn-btn:focus-visible, .nlogn-link:focus-visible, .nlogn-close:focus-visible, .nlogn-bubble:focus-visible {
  outline: 2px solid ${BRAND_TEAL};
  outline-offset: 2px;
}

.nlogn-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--fg-dim);
  margin-top: var(--space-3);
}
.nlogn-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: ${BRAND_TEAL};
  animation: nlogn-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes nlogn-spin { to { transform: rotate(360deg); } }

.nlogn-output code {
  font-family: var(--font-mono);
}

.nlogn-status-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: var(--space-3);
  color: var(--fg-faint);
}
.nlogn-grounded {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: ${BRAND_TEAL};
}
.nlogn-grounded.ungrounded { color: var(--fg-faint); }
.nlogn-grounded svg { flex-shrink: 0; }

.nlogn-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
.nlogn-status-row + .nlogn-section { border-top: none; padding-top: 0; }

.nlogn-side-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nlogn-side-label,
.nlogn-section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-faint);
}
.nlogn-side-label { min-width: 44px; }
.nlogn-section-label { margin-bottom: var(--space-3); }
.nlogn-side-label svg, .nlogn-section-label svg { flex-shrink: 0; opacity: 0.85; }
.nlogn-bigo {
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.nlogn-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-radius: 4px;
  padding: 2px 6px;
  text-transform: uppercase;
  margin-left: auto;
}
.nlogn-badge-high { background: rgba(20,155,149,0.16); color: ${BRAND_TEAL}; }
.nlogn-badge-medium { background: rgba(234,179,8,0.15); color: #d69e0b; }
.nlogn-badge-low { background: rgba(248,113,113,0.15); color: #ef6767; }

.nlogn-blocks { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
.nlogn-block {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  border-left: 2px solid rgba(20,155,149,0.35);
  padding-left: var(--space-2);
}
.nlogn-block code {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: ${BRAND_TEAL};
  padding-top: 1px;
}
.nlogn-block span { color: var(--fg-dim); }
.nlogn-card.light .nlogn-block code { filter: brightness(0.85); }

.nlogn-optimal {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${BRAND_TEAL};
}
.nlogn-optimal svg { flex-shrink: 0; }
.nlogn-suboptimal {
  font-size: 12px;
  border-left: 2px solid #d69e0b;
  padding-left: var(--space-2);
}
.nlogn-suboptimal-head { display: flex; align-items: baseline; gap: 6px; color: var(--fg-dim); }
.nlogn-suboptimal code { font-family: var(--font-mono); color: var(--fg); font-weight: 600; }
.nlogn-suboptimal p { margin: 5px 0 0; color: var(--fg-dim); line-height: 1.5; }

.nlogn-issues { display: flex; flex-direction: column; gap: var(--space-2); }
.nlogn-issue {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}
.nlogn-issue code {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-faint);
  padding-top: 1px;
}
.nlogn-issue-warn span { color: #d69e0b; }
.nlogn-issue-info span { color: var(--fg-dim); }

.nlogn-verdict {
  display: inline-flex;
  align-items: center;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  margin-top: var(--space-2);
}
.nlogn-verdict-good { background: rgba(20,155,149,0.16); color: ${BRAND_TEAL}; }
.nlogn-verdict-warn { background: rgba(234,179,8,0.15); color: #d69e0b; }
.nlogn-verdict-bad { background: rgba(248,113,113,0.15); color: #ef6767; }

.nlogn-diag-summary {
  font-weight: 600;
  font-size: 13.5px;
  margin-top: var(--space-3);
  line-height: 1.4;
}
.nlogn-diag-explanation {
  font-size: 12px;
  color: var(--fg-dim);
  margin-top: 6px;
  line-height: 1.55;
}

.nlogn-testcase {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  background: var(--bg-raised);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}
.nlogn-testcase > div {
  display: flex;
  gap: 10px;
  align-items: baseline;
}
.nlogn-testcase span {
  min-width: 56px;
  flex-shrink: 0;
  color: var(--fg-faint);
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.nlogn-testcase code {
  font-family: var(--font-mono);
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--fg);
}

.nlogn-error {
  color: #ef6767;
  font-size: 12px;
  margin-top: var(--space-3);
  line-height: 1.5;
}
`;
