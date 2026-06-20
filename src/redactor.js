/*
 * redactor.js — reversible PII redaction engine for LLM Privacy Shield.
 *
 * redact(text, opts)   -> { redacted, map }   replaces private data with stable
 *                                             placeholders like ⟦EMAIL_1⟧
 * unredact(text, map)  -> string              restores originals from placeholders
 *
 * Design goals:
 *  - Reversible: every redaction maps to a stable placeholder so the LLM can reason
 *    about "the same value" and we can restore the real value in its answer.
 *  - Consistent: the same input value always gets the same placeholder within a session.
 *  - Vendor-agnostic: pure string in/out; works in a browser or in Node.
 *  - Placeholders use rare bracket chars (⟦ ⟧) that LLMs reliably echo back verbatim.
 *
 * Nothing here phones home. All processing is local.
 */
(function (root) {
  "use strict";

  // Order matters: most specific / highest-risk first so they win over generic ones.
  const RULES = [
    // Private keys / PEM blocks
    ["KEY", /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g],
    // Common API tokens / secrets
    ["SECRET", /\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_\-]{20,}|AKIA[A-Z0-9]{16}|GOCSPX-[A-Za-z0-9_\-]+|xox[baprs]-[A-Za-z0-9-]{10,}|ya29\.[A-Za-z0-9_\-]{10,})\b/g],
    // Credit-card-like 13-16 digit groups (with optional spaces/dashes)
    ["CARD", /\b(?:\d[ -]?){13,16}\b/g],
    // US SSN
    ["SSN", /\b\d{3}-\d{2}-\d{4}\b/g],
    // IBAN
    ["IBAN", /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g],
    // Email
    ["EMAIL", /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g],
    // Phone numbers (US + international, fairly permissive but anchored)
    ["PHONE", /(?:\+?\d{1,3}[ .\-]?)?(?:\(\d{2,4}\)[ .\-]?)?\d{2,4}[ .\-]\d{2,4}[ .\-]\d{2,4}(?:[ .\-]\d{2,4})?/g],
    // IPv4
    ["IP", /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
    // Street address (number + street words) — best-effort
    ["ADDRESS", /\b\d{1,6}\s+(?:[A-Za-z0-9.'\-]+\s){0,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir)\b\.?/gi],
  ];

  function makePlaceholder(type, n) {
    return "⟦" + type + "_" + n + "⟧"; // ⟦TYPE_N⟧
  }

  // Escape a string for use in a RegExp
  function esc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * @param {string} text
   * @param {object} [opts]
   * @param {string[]} [opts.customTerms]  exact strings to always redact (names, employer, etc.)
   * @param {object}   [opts.map]          existing placeholder<->value map to extend (for consistency)
   * @returns {{redacted: string, map: object}}
   */
  function redact(text, opts) {
    opts = opts || {};
    const map = opts.map || { byValue: {}, byPlaceholder: {}, counts: {} };
    map.byValue = map.byValue || {};
    map.byPlaceholder = map.byPlaceholder || {};
    map.counts = map.counts || {};
    if (typeof text !== "string" || !text) return { redacted: text || "", map };

    let out = text;

    function assign(type, value) {
      if (map.byValue[value]) return map.byValue[value]; // reuse existing placeholder
      map.counts[type] = (map.counts[type] || 0) + 1;
      const ph = makePlaceholder(type, map.counts[type]);
      map.byValue[value] = ph;
      map.byPlaceholder[ph] = value;
      return ph;
    }

    // 1) Custom terms first (user-defined, highest priority) — longest first
    const terms = (opts.customTerms || []).filter(Boolean).slice().sort((a, b) => b.length - a.length);
    for (const term of terms) {
      const re = new RegExp(esc(term), "gi");
      out = out.replace(re, (m) => assign("PRIVATE", m));
    }

    // 2) Pattern rules
    for (const [type, re] of RULES) {
      out = out.replace(re, (m) => {
        // skip if this span is already a placeholder
        if (/^⟦[A-Z]+_\d+⟧$/.test(m)) return m;
        const trimmed = m.trim();
        if (!trimmed) return m;
        const ph = assign(type, trimmed);
        return m.replace(trimmed, ph);
      });
    }

    return { redacted: out, map };
  }

  /**
   * Restore original values from placeholders.
   * @param {string} text
   * @param {object} map  the map returned by redact()
   * @returns {string}
   */
  function unredact(text, map) {
    if (typeof text !== "string" || !text || !map || !map.byPlaceholder) return text || "";
    let out = text;
    // Replace longer placeholders first to avoid partial collisions
    const phs = Object.keys(map.byPlaceholder).sort((a, b) => b.length - a.length);
    for (const ph of phs) {
      out = out.split(ph).join(map.byPlaceholder[ph]);
    }
    return out;
  }

  /** Summary of what was redacted (for showing the user). */
  function summary(map) {
    if (!map || !map.byPlaceholder) return [];
    return Object.keys(map.byPlaceholder).map((ph) => ({ placeholder: ph, type: ph.replace(/^⟦|_\d+⟧$/g, "") }));
  }

  const api = { redact, unredact, summary, makePlaceholder, RULES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Redactor = api;
})(typeof window !== "undefined" ? window : globalThis);
