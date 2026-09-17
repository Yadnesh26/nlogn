import { PANEL_CSS } from "./panel.css.js";
import { renderResult, renderDiagnosis } from "./format.js";
import { call, onVerdict } from "../bridge-client.js";
import { rpc } from "../worker-client.js";
import { fetchProblemContext } from "../graphql-client.js";
import { extractSlug } from "../mount-points.js";
import { LOGO_DATA_URI } from "../../assets/logo-data-uri.js";
import { ICON_CLOSE } from "./icons.js";

const MARGIN = 12;
const GAP = 8;

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function positionCardNear(card, anchorRect) {
  const width = card.offsetWidth || 380;
  const height = card.offsetHeight || 400;

  let left = anchorRect.right - width;
  let top = anchorRect.bottom + GAP;

  if (top + height > window.innerHeight - MARGIN) {
    top = anchorRect.top - height - GAP; // flip above if no room below
  }
  left = Math.max(MARGIN, Math.min(window.innerWidth - width - MARGIN, left));
  top = Math.max(MARGIN, Math.min(window.innerHeight - height - MARGIN, top));

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function makeDraggable(card, handle) {
  handle.addEventListener("mousedown", (e) => {
    if (e.target.closest("button, a")) return;

    const rect = card.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      card.style.left = `${Math.max(0, Math.min(window.innerWidth - 40, rect.left + dx))}px`;
      card.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, rect.top + dy))}px`;
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

function rowGapPx(el) {
  const cs = getComputedStyle(el);
  const gap = cs.columnGap !== "normal" ? cs.columnGap : cs.gap;
  const px = parseFloat(gap);
  return Number.isFinite(px) ? px : 0;
}

// The trigger is a tiny element that either becomes a real inline sibling
// next to Submit (so it takes up genuine layout space and can't overlap
// neighboring icons) or, if no anchor was found, a fixed pill in the
// corner. It is intentionally as small and shrink-friendly as possible so
// it can never force LeetCode's own toolbar row to wrap.
function createTrigger({ insertAfter, sampleEl }) {
  const host = document.createElement("div");
  host.id = "nlogn-trigger";

  const docked = !!insertAfter;
  if (docked) {
    host.style.display = "inline-flex";
    host.style.alignItems = "center";
    host.style.alignSelf = "center";
    host.style.verticalAlign = "middle";
    host.style.flex = "0 1 auto";
    host.style.minWidth = "0";
    // Cancel the row's own flex gap so we sit flush against the Submit
    // group instead of floating a gap away from it.
    const gap = rowGapPx(insertAfter.parentElement);
    if (gap > 0) host.style.marginLeft = `-${gap}px`;
  }

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;

  const widget = document.createElement("div");
  widget.className = docked ? "nlogn-widget" : "nlogn-widget floating";
  if (!docked) {
    widget.style.right = `${MARGIN}px`;
    widget.style.bottom = `${MARGIN}px`;
  }

  const bubble = document.createElement("button");
  bubble.className = `nlogn-bubble ${docked ? "docked" : "pill"}`;
  bubble.setAttribute("aria-label", "nlogn: analyze complexity");

  const logo = document.createElement("img");
  logo.className = "nlogn-logo";
  logo.src = LOGO_DATA_URI;
  logo.alt = "nlogn";
  bubble.append(logo);

  // Custom tooltip instead of the native `title` attribute, styled to match
  // LeetCode's own hover tooltips (e.g. the one on their Submit button).
  const tooltip = document.createElement("div");
  tooltip.className = "nlogn-tooltip";
  tooltip.textContent = "Analyze complexity";
  let tooltipTimer;
  bubble.addEventListener("mouseenter", () => {
    tooltipTimer = setTimeout(() => {
      const rect = bubble.getBoundingClientRect();
      tooltip.classList.add("open");
      const tw = tooltip.offsetWidth;
      tooltip.style.left = `${Math.max(MARGIN, Math.min(window.innerWidth - tw - MARGIN, rect.left + rect.width / 2 - tw / 2))}px`;
      tooltip.style.top = `${rect.bottom + 6}px`;
    }, 350);
  });
  bubble.addEventListener("mouseleave", () => {
    clearTimeout(tooltipTimer);
    tooltip.classList.remove("open");
  });
  bubble.addEventListener("click", () => {
    clearTimeout(tooltipTimer);
    tooltip.classList.remove("open");
  });

  if (docked && sampleEl) {
    // Match LeetCode's own button metrics exactly — font, height, corner
    // radius — sampled live from their Submit button, instead of guessing
    // pixel values that drift from whatever their actual CSS renders.
    const sample = getComputedStyle(sampleEl);
    bubble.style.fontFamily = sample.fontFamily;
    bubble.style.fontWeight = sample.fontWeight;
    bubble.style.fontSize = sample.fontSize;
    bubble.style.letterSpacing = sample.letterSpacing;

    const rect = sampleEl.getBoundingClientRect();
    if (rect.height > 0) bubble.style.height = `${rect.height}px`;

    const groupRadius = parseFloat(getComputedStyle(insertAfter).borderRadius);
    const ownRadius = parseFloat(sample.borderRadius);
    const radius = groupRadius > 0 ? groupRadius : ownRadius > 0 ? ownRadius : 8;
    bubble.style.borderTopRightRadius = `${radius}px`;
    bubble.style.borderBottomRightRadius = `${radius}px`;
  }

  widget.append(bubble);
  shadow.append(style, widget, tooltip);

  if (docked) {
    insertAfter.insertAdjacentElement("afterend", host);
  } else {
    document.body.append(host);
  }

  return { host, bubble };
}

function createPopup() {
  const host = document.createElement("div");
  host.id = "nlogn-popup";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = PANEL_CSS;

  const card = document.createElement("div");
  card.className = `nlogn-card ${isDarkMode() ? "" : "light"}`;

  const header = document.createElement("div");
  header.className = "nlogn-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "nlogn-header-title";

  const titleLogo = document.createElement("img");
  titleLogo.src = LOGO_DATA_URI;
  titleLogo.alt = "";

  const title = document.createElement("span");
  title.className = "nlogn-title";
  title.textContent = "nlogn";

  titleWrap.append(titleLogo, title);

  const actions = document.createElement("div");
  actions.className = "nlogn-header-actions";

  const settingsLink = document.createElement("button");
  settingsLink.className = "nlogn-link";
  settingsLink.textContent = "settings";
  settingsLink.addEventListener("click", () => rpc("openOptions"));

  const closeBtn = document.createElement("button");
  closeBtn.className = "nlogn-close";
  closeBtn.innerHTML = ICON_CLOSE;
  closeBtn.setAttribute("aria-label", "close");

  actions.append(settingsLink, closeBtn);
  header.append(titleWrap, actions);

  const body = document.createElement("div");
  body.className = "nlogn-body";

  const analyzeBtn = document.createElement("button");
  analyzeBtn.className = "nlogn-btn";
  analyzeBtn.textContent = "Analyze";

  const status = document.createElement("div");
  status.className = "nlogn-status";
  status.style.display = "none";

  const spinner = document.createElement("div");
  spinner.className = "nlogn-spinner";
  const statusText = document.createElement("span");
  status.append(spinner, statusText);

  const output = document.createElement("div");
  output.className = "nlogn-output";

  body.append(analyzeBtn, status, output);
  card.append(header, body);
  shadow.append(style, card);
  document.body.append(host);

  return { host, card, header, closeBtn, analyzeBtn, output, status, statusText, spinner };
}

export function createPanel({ insertAfter = null, sampleEl = null } = {}) {
  const trigger = createTrigger({ insertAfter, sampleEl });
  const popup = createPopup();

  function setStatus(text) {
    if (!text) {
      popup.status.style.display = "none";
      return;
    }
    popup.status.style.display = "flex";
    popup.statusText.textContent = text;
  }

  function showError(text) {
    popup.output.innerHTML = "";
    const err = document.createElement("div");
    err.className = "nlogn-error";
    err.textContent = text;
    popup.output.append(err);
  }

  function showCard() {
    popup.card.classList.add("open");
    positionCardNear(popup.card, trigger.bubble.getBoundingClientRect());
  }
  function hideCard() {
    popup.card.classList.remove("open");
  }

  trigger.bubble.addEventListener("click", showCard);
  popup.closeBtn.addEventListener("click", hideCard);
  makeDraggable(popup.card, popup.header);

  popup.analyzeBtn.addEventListener("click", async () => {
    popup.output.innerHTML = "";
    popup.analyzeBtn.disabled = true;
    setStatus("reading editor...");

    try {
      const code = await call("getCode");
      if (!code.ok) {
        setStatus("");
        showError(`Could not read editor (${code.error}).`);
        return;
      }
      if (code.code.trim().length < 5) {
        setStatus("");
        showError("Write some code first.");
        return;
      }

      setStatus("analyzing...");
      const response = await rpc("analyze", { code: code.code, lang: code.lang });
      setStatus("");

      if (!response.ok) {
        showError(
          response.error === "NO_API_KEY"
            ? "No API key set. Click settings to add one."
            : `Analysis failed: ${response.error}`
        );
        return;
      }

      popup.output.innerHTML = renderResult(response.result, response.grounded);
    } catch (err) {
      setStatus("");
      showError(String(err?.message ?? err));
    } finally {
      popup.analyzeBtn.disabled = false;
    }
  });

  // Auto-diagnose whenever a submission verdict comes in — the whole point
  // of P4 is "know why it failed" without having to click anything first.
  const stopVerdictListener = onVerdict(async (verdict) => {
    showCard();
    popup.output.innerHTML = "";
    popup.analyzeBtn.disabled = true;
    setStatus("reading editor...");

    try {
      const code = await call("getCode");
      if (!code.ok) {
        setStatus("");
        showError(`Could not read editor (${code.error}).`);
        return;
      }

      setStatus("fetching problem context...");
      const slug = extractSlug();
      const problemContext = slug ? await fetchProblemContext(slug) : null;

      setStatus("diagnosing...");
      const response = await rpc("diagnose", { code: code.code, lang: code.lang, verdict, problemContext });
      setStatus("");

      if (!response.ok) {
        showError(
          response.error === "NO_API_KEY"
            ? "No API key set. Click settings to add one."
            : `Diagnosis failed: ${response.error}`
        );
        return;
      }

      popup.output.innerHTML = renderDiagnosis(response.result, response.grounded, verdict);
    } catch (err) {
      setStatus("");
      showError(String(err?.message ?? err));
    } finally {
      popup.analyzeBtn.disabled = false;
    }
  });

  return {
    destroy() {
      stopVerdictListener();
      trigger.host.remove();
      popup.host.remove();
    },
  };
}
