/* global chrome */
const K_ENABLED   = "virtualEnabled";
const K_AUTO      = "virtualAuto";
const K_THRESHOLD = "virtualThreshold";

const DEF_AUTO      = true;
const DEF_THRESHOLD = 120;

/* ----- helpers ---- */
function $(id) { return document.getElementById(id); }
function flash(msg) {
  const s = $("status");
  s.textContent = msg;
  setTimeout(() => (s.textContent = ""), 1800);
}

/* ----- load saved prefs ---- */
chrome.storage.sync.get(
  { [K_ENABLED]: null, [K_AUTO]: DEF_AUTO, [K_THRESHOLD]: DEF_THRESHOLD },
  prefs => {
    $("auto").checked      = prefs[K_AUTO];
    $("threshold").value   = prefs[K_THRESHOLD];
    $("enabled").value     = String(prefs[K_ENABLED]);
  }
);

/* ----- save ---- */
$("save").addEventListener("click", () => {
  const enabledSel = $("enabled").value;
  const updates = {
    [K_AUTO]: $("auto").checked,
    [K_THRESHOLD]: parseInt($("threshold").value, 10) || DEF_THRESHOLD,
    [K_ENABLED]:
      enabledSel === "null" ? null : (enabledSel === "true")
  };
  chrome.storage.sync.set(updates, () => flash("Saved ✓"));
});
