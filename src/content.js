/*
 * content.js — runs on LLM web apps. Adds a floating "Shield" button that
 * redacts the current prompt box ON DEMAND (user-triggered = reliable, no race
 * that could leak), and decodes placeholders back to real values in the displayed
 * answer (display only — the cloud only ever received placeholders).
 */
(function () {
  "use strict";
  const R = window.Redactor;
  if (!R) return;

  let map = { byValue: {}, byPlaceholder: {}, counts: {} };
  let customTerms = [];
  let enabled = true;

  try {
    chrome.storage.local.get(["enabled", "customTerms", "map"], (d) => {
      if (d.enabled === false) enabled = false;
      if (Array.isArray(d.customTerms)) customTerms = d.customTerms;
      if (d.map && d.map.byPlaceholder) map = d.map;
    });
  } catch (e) {}

  function persist() {
    try { chrome.storage.local.set({ map }); } catch (e) {}
  }

  // ---- find the prompt input the user is typing in ----
  function findInput() {
    const a = document.activeElement;
    if (a && (a.tagName === "TEXTAREA" || a.isContentEditable)) return a;
    // fall back to common LLM prompt boxes
    const sel = [
      "textarea",
      'div[contenteditable="true"]',
      '[data-testid="prompt-textarea"]',
    ];
    for (const s of sel) {
      const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null);
      if (els.length) return els[els.length - 1];
    }
    return null;
  }

  function getText(el) {
    return el.value !== undefined ? el.value : el.innerText;
  }

  function setText(el, text) {
    if (el.value !== undefined) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  function flash(msg, bad) {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed", bottom: "84px", right: "20px", zIndex: 2147483647,
      background: bad ? "#b00020" : "#0a7d4f", color: "#fff", padding: "10px 14px",
      borderRadius: "10px", font: "600 14px system-ui", boxShadow: "0 4px 14px rgba(0,0,0,.3)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function redactCurrent() {
    if (!enabled) { flash("Shield is OFF (turn on in the popup)", true); return; }
    const el = findInput();
    if (!el) { flash("No prompt box found — click into it first", true); return; }
    const before = getText(el);
    if (!before.trim()) { flash("Prompt box is empty", true); return; }
    const res = R.redact(before, { customTerms, map });
    map = res.map; persist();
    setText(el, res.redacted);
    const n = R.summary(map).length;
    flash(res.redacted === before ? "Nothing private found — safe as-is" : `Redacted ✓ ${n} item(s) hidden — review & send`);
  }

  // ---- decode placeholders in displayed answers (local display only) ----
  function decodeNode(node) {
    if (!map.byPlaceholder || !Object.keys(map.byPlaceholder).length) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    const hits = [];
    while (walker.nextNode()) {
      if (/⟦[A-Z]+_\d+⟧/.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode);
    }
    for (const tn of hits) tn.nodeValue = R.unredact(tn.nodeValue, map);
  }

  const obs = new MutationObserver((muts) => {
    if (!enabled) return;
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) decodeNode(n);
      else if (n.nodeType === 3 && /⟦[A-Z]+_\d+⟧/.test(n.nodeValue)) n.nodeValue = R.unredact(n.nodeValue, map);
    }
  });
  try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}

  // ---- floating button ----
  function addButton() {
    if (document.getElementById("llm-shield-btn")) return;
    const b = document.createElement("button");
    b.id = "llm-shield-btn";
    b.textContent = "🛡️ Redact";
    b.title = "Replace private data in your prompt with safe placeholders before sending";
    Object.assign(b.style, {
      position: "fixed", bottom: "20px", right: "20px", zIndex: 2147483647,
      background: "#0a7d4f", color: "#fff", border: "none", padding: "12px 16px",
      borderRadius: "999px", font: "700 15px system-ui", cursor: "pointer",
      boxShadow: "0 4px 14px rgba(0,0,0,.3)",
    });
    b.addEventListener("click", redactCurrent);
    document.body.appendChild(b);
  }
  if (document.body) addButton();
  else document.addEventListener("DOMContentLoaded", addButton);

  // keyboard shortcut: Ctrl/Cmd+Shift+R to redact current box
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "R" || e.key === "r")) {
      e.preventDefault(); redactCurrent();
    }
  });

  try {
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.enabled) enabled = ch.enabled.newValue !== false;
      if (ch.customTerms) customTerms = ch.customTerms.newValue || [];
    });
  } catch (e) {}
})();
