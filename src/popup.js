/* popup.js — wires the scratchpad UI to the redaction engine + local storage. */
(function () {
  "use strict";
  const R = window.Redactor;
  const $ = (id) => document.getElementById(id);
  let map = { byValue: {}, byPlaceholder: {}, counts: {} };
  let customTerms = [];

  // load saved settings
  chrome.storage.local.get(["enabled", "customTerms", "map"], (d) => {
    $("enabled").checked = d.enabled !== false;
    if (Array.isArray(d.customTerms)) { customTerms = d.customTerms; $("terms").value = customTerms.join("\n"); }
    if (d.map && d.map.byPlaceholder) map = d.map;
  });

  $("enabled").addEventListener("change", () => chrome.storage.local.set({ enabled: $("enabled").checked }));

  $("btnSaveTerms").addEventListener("click", () => {
    customTerms = $("terms").value.split("\n").map((s) => s.trim()).filter(Boolean);
    chrome.storage.local.set({ customTerms });
    $("btnSaveTerms").textContent = "Saved ✓";
    setTimeout(() => ($("btnSaveTerms").textContent = "Save my private terms"), 1500);
  });

  $("btnRedact").addEventListener("click", async () => {
    const text = $("inp").value;
    if (!text.trim()) { $("redOut").textContent = "(nothing to redact)"; return; }
    const res = R.redact(text, { customTerms, map });
    map = res.map;
    chrome.storage.local.set({ map });
    $("redOut").textContent = res.redacted;
    const items = R.summary(map);
    try {
      await navigator.clipboard.writeText(res.redacted);
      $("redInfo").textContent = `Copied safe version ✓ — ${items.length} private item(s) hidden. Paste into any LLM.`;
    } catch (e) {
      $("redInfo").textContent = `${items.length} item(s) hidden. Select the box above and copy.`;
    }
  });

  $("btnDecode").addEventListener("click", () => {
    const text = $("ans").value;
    if (!text.trim()) { $("decOut").textContent = "(paste the AI's answer first)"; return; }
    $("decOut").textContent = R.unredact(text, map);
  });
})();
