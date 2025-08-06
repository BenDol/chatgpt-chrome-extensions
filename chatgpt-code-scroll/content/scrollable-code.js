// When the page first loads, update any existing blocks
upgradeAllCodeBlocks();

// ChatGPT renders messages asynchronously, so watch for new nodes
const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const added of m.addedNodes) {
      // Deep-scan each added subtree
      if (added.nodeType === Node.ELEMENT_NODE) {
        upgradeAllCodeBlocks(added);
      }
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

/**
 * Finds every <pre><code> in the given root (defaults to document)
 * and adds the .scrollable-code class exactly once.
 */
function upgradeAllCodeBlocks(root = document) {
  const blocks = root.querySelectorAll("pre > code");
  blocks.forEach(code => {
    const pre = code.parentElement;
    if (!pre.classList.contains("scrollable-code")) {
      pre.classList.add("scrollable-code");
    }
  });
}
