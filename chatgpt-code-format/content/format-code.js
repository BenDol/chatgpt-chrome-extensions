/*  ChatGPT Code Format – content script (independent build)
    ------------------------------------------------------------------ */

const LANG_MAP = {
  csharp: "csharp", cs: "csharp", "c#": "csharp",
  javascript: "javascript", js: "javascript",
  typescript: "typescript", ts: "typescript",
  python: "python",  py: "python",
  java: "java",
  cpp: "cpp", c: "c",
  golang: "go", go: "go",
  rust: "rust",
  ruby: "ruby", rb: "ruby",
  php: "php",
  json: "json",
  html: "xml", xml: "xml",
  css: "css",
  bash: "bash", sh: "bash", shell: "bash",
  powershell: "powershell", ps1: "powershell",
  kotlin: "kotlin",
  swift: "swift",
  sql: "sql",
  yaml: "yaml", yml: "yaml",
  markdown: "markdown", md: "markdown"
};

const BOX_CLASS = "cgptcf-box";   // 🚨 new unique class

/* ---------- Helpers -------------------------------------------------- */

function makeScrollable(codeEl) {
  const pre = codeEl.parentElement;
  if (pre && !pre.classList.contains(BOX_CLASS)) {
    pre.classList.add(BOX_CLASS);
  }
}

function upgradeBlock(codeEl) {
  // Skip blocks already processed or already carrying a language-X class
  if ([...codeEl.classList].some(c => c.startsWith("language-"))) {
    makeScrollable(codeEl);
    return;
  }

  const raw = codeEl.textContent ?? "";
  const match = raw.match(/^\s*([^\s]+)[\s\r\n]+/); // first token
  if (!match) { makeScrollable(codeEl); return; }

  const token = match[1].toLowerCase();
  const lang  = LANG_MAP[token];
  if (!lang) { makeScrollable(codeEl); return; }

  // Strip the language hint & tag the element
  codeEl.textContent = raw.slice(match[0].length);
  codeEl.classList.add("hljs", `language-${lang}`);

  if (typeof hljs !== "undefined") {
    try { hljs.highlightElement(codeEl); } catch (_) { /* ignore */ }
  }

  makeScrollable(codeEl);
}

function upgradeAll(root = document) {
  root.querySelectorAll("pre > code").forEach(upgradeBlock);
}

/* ---------- Initial run + observer ---------------------------------- */

upgradeAll();

new MutationObserver(muts => {
  muts.forEach(m =>
    m.addedNodes.forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE) upgradeAll(n);
    })
  );
}).observe(document.documentElement, { childList: true, subtree: true });
