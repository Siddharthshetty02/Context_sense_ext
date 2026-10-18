/**
 * ContextSense Content Script
 * Injected into chatgpt.com to detect word selections, capture surrounding context,
 * and display a floating action button and contextual meaning card via Shadow DOM.
 */

(() => {
  // Prevent duplicate injection
  if (window.__CONTEXT_SENSE_INITIALIZED__) return;
  window.__CONTEXT_SENSE_INITIALIZED__ = true;

  let hostElement = null;
  let shadowRoot = null;
  let currentSelectionData = null;
  let currentRequestId = 0;
  let activeElement = null; // 'button' | 'card' | null

  // Create or retrieve Shadow DOM Host
  function ensureShadowHost() {
    if (hostElement && shadowRoot) return shadowRoot;

    hostElement = document.createElement("div");
    hostElement.id = "contextsense-extension-host";
    hostElement.style.cssText = "all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;";
    document.documentElement.appendChild(hostElement);

    shadowRoot = hostElement.attachShadow({ mode: "open" });

    // Inject styles
    const styleEl = document.createElement("style");
    styleEl.textContent = getShadowStyles();
    shadowRoot.appendChild(styleEl);

    // Main container
    const container = document.createElement("div");
    container.id = "contextsense-container";
    shadowRoot.appendChild(container);

    return shadowRoot;
  }

  // Detect whether current webpage or browser is in dark mode
  function isDarkMode() {
    if (
      document.documentElement.classList.contains("dark") ||
      document.body?.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark" ||
      document.body?.getAttribute("data-theme") === "dark" ||
      document.documentElement.getAttribute("data-color-mode") === "dark"
    ) {
      return true;
    }

    try {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 110) return true;
        if (lum > 160) return false;
      }
    } catch (e) {}

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // Get Shadow DOM CSS Styles
  function getShadowStyles() {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      }

      #contextsense-container {
        pointer-events: auto;
        position: fixed;
      }

      /* CSS Variables for Dark & Light Themes */
      .theme-light {
        --cs-bg: #ffffff;
        --cs-border: #e2e8f0;
        --cs-text-main: #0f172a;
        --cs-text-muted: #64748b;
        --cs-accent: #4f46e5;
        --cs-accent-bg: #eef2ff;
        --cs-accent-border: #c7d2fe;
        --cs-accent-hover: #4338ca;
        --cs-card-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.08);
        --cs-btn-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        --cs-badge-bg: #f1f5f9;
        --cs-badge-text: #475569;
        --cs-error-bg: #fef2f2;
        --cs-error-text: #991b1b;
        --cs-error-border: #fecaca;
        --cs-divider: #f1f5f9;
      }

      .theme-dark {
        --cs-bg: #1e293b;
        --cs-border: #334155;
        --cs-text-main: #f8fafc;
        --cs-text-muted: #94a3b8;
        --cs-accent: #6366f1;
        --cs-accent-bg: rgba(99, 102, 241, 0.15);
        --cs-accent-border: rgba(99, 102, 241, 0.35);
        --cs-accent-hover: #4f46e5;
        --cs-card-shadow: 0 16px 32px -4px rgba(0, 0, 0, 0.45), 0 6px 14px -2px rgba(0, 0, 0, 0.3);
        --cs-btn-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        --cs-badge-bg: #334155;
        --cs-badge-text: #cbd5e1;
        --cs-error-bg: #450a0a;
        --cs-error-text: #fecaca;
        --cs-error-border: #dc2626;
        --cs-divider: #334155;
      }

      /* Floating Action Button ("Meaning") */
      .cs-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background-color: var(--cs-bg);
        color: var(--cs-text-main);
        border: 1px solid var(--cs-border);
        border-radius: 9999px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: var(--cs-btn-shadow);
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
        user-select: none;
        white-space: nowrap;
        animation: cs-fade-in 0.15s ease-out;
      }

      .cs-action-btn:hover {
        transform: translateY(-1px);
        border-color: var(--cs-accent);
        color: var(--cs-accent);
      }

      .cs-action-btn:active {
        transform: translateY(0);
      }

      .cs-btn-icon {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      /* Floating Meaning Card */
      .cs-card {
        width: 320px;
        max-width: calc(100vw - 24px);
        background-color: var(--cs-bg);
        color: var(--cs-text-main);
        border: 1px solid var(--cs-border);
        border-radius: 12px;
        box-shadow: var(--cs-card-shadow);
        overflow: hidden;
        animation: cs-scale-in 0.15s ease-out;
        display: flex;
        flex-direction: column;
        max-height: 420px;
      }

      .cs-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid var(--cs-divider);
        gap: 8px;
      }

      .cs-word-info {
        display: flex;
        align-items: baseline;
        gap: 8px;
        overflow: hidden;
      }

      .cs-word-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--cs-text-main);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .cs-pronunciation {
        font-size: 12px;
        color: var(--cs-text-muted);
        font-style: italic;
        white-space: nowrap;
      }

      .cs-close-btn {
        background: transparent;
        border: none;
        color: var(--cs-text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background-color 0.1s ease, color 0.1s ease;
      }

      .cs-close-btn:hover {
        background-color: var(--cs-badge-bg);
        color: var(--cs-text-main);
      }

      .cs-card-body {
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Part of speech badge */
      .cs-badge-row {
        display: flex;
        align-items: center;
      }

      .cs-badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background-color: var(--cs-badge-bg);
        color: var(--cs-badge-text);
        padding: 2px 8px;
        border-radius: 6px;
      }

      /* Sections */
      .cs-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cs-section-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--cs-text-muted);
      }

      /* Contextual Meaning Callout */
      .cs-contextual-box {
        background-color: var(--cs-accent-bg);
        border: 1px solid var(--cs-accent-border);
        border-radius: 8px;
        padding: 10px;
      }

      .cs-contextual-box .cs-section-label {
        color: var(--cs-accent);
        margin-bottom: 3px;
      }

      .cs-text-content {
        font-size: 13px;
        line-height: 1.45;
        color: var(--cs-text-main);
      }

      .cs-example-text {
        font-size: 12.5px;
        font-style: italic;
        line-height: 1.4;
        color: var(--cs-text-muted);
        border-left: 2px solid var(--cs-accent);
        padding-left: 8px;
        margin-top: 2px;
      }

      /* Loading State */
      .cs-loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
        gap: 12px;
        color: var(--cs-text-muted);
        text-align: center;
      }

      .cs-spinner {
        width: 24px;
        height: 24px;
        border: 2.5px solid var(--cs-border);
        border-top-color: var(--cs-accent);
        border-radius: 50%;
        animation: cs-spin 0.75s linear infinite;
      }

      .cs-loading-text {
        font-size: 12.5px;
      }

      /* Error State */
      .cs-error-box {
        background-color: var(--cs-error-bg);
        border: 1px solid var(--cs-error-border);
        color: var(--cs-error-text);
        border-radius: 8px;
        padding: 12px;
        font-size: 12.5px;
        line-height: 1.4;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .cs-action-btn-row {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }

      .cs-inline-btn {
        background-color: var(--cs-bg);
        color: var(--cs-text-main);
        border: 1px solid var(--cs-border);
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.1s ease;
      }

      .cs-inline-btn:hover {
        background-color: var(--cs-badge-bg);
      }

      .cs-inline-btn.primary {
        background-color: var(--cs-accent);
        color: #ffffff;
        border-color: transparent;
      }

      .cs-inline-btn.primary:hover {
        background-color: var(--cs-accent-hover);
      }

      @keyframes cs-fade-in {
        from { opacity: 0; transform: translateY(3px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes cs-scale-in {
        from { opacity: 0; transform: scale(0.96) translateY(4px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      @keyframes cs-spin {
        to { transform: rotate(360deg); }
      }
    `;
  }

  // Dismiss current popup UI
  function dismissUI() {
    if (!shadowRoot) return;
    const container = shadowRoot.getElementById("contextsense-container");
    if (container) {
      container.replaceChildren(); // Safely clear children
    }
    activeElement = null;
  }

  // Check if a node is inside an editable element or message composer
  function isInsideEditableOrComposer(node) {
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;

    // Check input, textarea, contenteditable, or specific text entry elements
    return !!el.closest([
      "input",
      "textarea",
      "[contenteditable='true']",
      "#prompt-textarea",
      "[role='textbox']"
    ].join(","));
  }

  // Check if target event is inside extension shadow host
  function isInsideExtensionUI(event) {
    if (!hostElement) return false;
    const path = event.composedPath();
    return path.includes(hostElement);
  }

  // Extract sentence and surrounding context from selection
  function extractContext(range, selectedText) {
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    // Traverse upwards to find the enclosing paragraph, list item, or block
    let block = container.closest("p, li, blockquote, dd, dt, h1, h2, h3, h4, h5, h6, [data-message-author-role], article, section, td, th") || container;

    const blockText = (block.textContent || "").trim();
    if (!blockText) {
      return {
        sentence: selectedText,
        context: selectedText,
        language: document.documentElement.lang || navigator.language || "en"
      };
    }

    // Locate the selected text inside the block text
    const wordIdx = blockText.toLowerCase().indexOf(selectedText.toLowerCase());
    let sentence = "";

    if (wordIdx !== -1) {
      // Find sentence boundary before word
      const preText = blockText.substring(0, wordIdx);
      const lastPunctuation = Math.max(
        preText.lastIndexOf(". "),
        preText.lastIndexOf("! "),
        preText.lastIndexOf("? "),
        preText.lastIndexOf("\n")
      );
      const startIdx = lastPunctuation === -1 ? 0 : lastPunctuation + 2;

      // Find sentence boundary after word
      const postText = blockText.substring(wordIdx + selectedText.length);
      const match = postText.match(/[.!?](\s|\n|$)/);
      const endIdx = match ? wordIdx + selectedText.length + match.index + 1 : blockText.length;

      sentence = blockText.substring(startIdx, endIdx).trim();
    }

    if (!sentence) {
      sentence = blockText.length > 250 ? blockText.substring(0, 250) + "..." : blockText;
    }

    // Surrounding context (up to ~300 chars around the sentence)
    let context = blockText;
    if (context.length > 350) {
      const cStart = Math.max(0, wordIdx - 150);
      const cEnd = Math.min(blockText.length, wordIdx + selectedText.length + 150);
      context = (cStart > 0 ? "..." : "") + blockText.substring(cStart, cEnd).trim() + (cEnd < blockText.length ? "..." : "");
    }

    return {
      sentence,
      context,
      language: document.documentElement.lang || navigator.language || "en"
    };
  }

  // Compute position relative to viewport with boundary clamping
  function calculatePopupPosition(rect, elementWidth, elementHeight) {
    const margin = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal centering relative to selection rect
    let left = rect.left + rect.width / 2 - elementWidth / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - elementWidth - margin));

    // Vertical positioning: default below selection, fallback to above
    let top = rect.bottom + 8;
    if (top + elementHeight > viewportHeight - margin) {
      // Place above selection
      top = rect.top - elementHeight - 8;
      if (top < margin) {
        // If it doesn't fit above either, clamp to viewport top or bottom
        top = Math.max(margin, viewportHeight - elementHeight - margin);
      }
    }

    return { left, top };
  }

  // Render the floating "Meaning" action button
  function showFloatingButton(selectionData) {
    ensureShadowHost();
    const container = shadowRoot.getElementById("contextsense-container");
    container.replaceChildren();

    // Set theme class
    container.className = isDarkMode() ? "theme-dark" : "theme-light";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cs-action-btn";

    // Book/Dictionary Icon SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "cs-btn-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path1.setAttribute("d", "M4 19.5A2.5 2.5 0 0 1 6.5 17H20");
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path2.setAttribute("d", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z");
    svg.appendChild(path1);
    svg.appendChild(path2);
    btn.appendChild(svg);

    const label = document.createElement("span");
    label.textContent = "Meaning";
    btn.appendChild(label);

    // Initial position estimation (approx button dimensions 86px x 30px)
    const { left, top } = calculatePopupPosition(selectionData.rect, 86, 30);
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    container.appendChild(btn);

    activeElement = "button";

    // Handle button click -> trigger card & AI lookup
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      showMeaningCard(selectionData);
    });
  }

  // Render the Meaning Card with loading / success / error states
  function showMeaningCard(selectionData) {
    ensureShadowHost();
    const container = shadowRoot.getElementById("contextsense-container");
    container.replaceChildren();

    container.className = isDarkMode() ? "theme-dark" : "theme-light";

    const card = document.createElement("div");
    card.className = "cs-card";

    // Card Header
    const header = document.createElement("div");
    header.className = "cs-card-header";

    const wordInfo = document.createElement("div");
    wordInfo.className = "cs-word-info";

    const wordTitle = document.createElement("span");
    wordTitle.className = "cs-word-title";
    wordTitle.textContent = selectionData.text;
    wordInfo.appendChild(wordTitle);

    const pronunciationSpan = document.createElement("span");
    pronunciationSpan.className = "cs-pronunciation";
    wordInfo.appendChild(pronunciationSpan);

    header.appendChild(wordInfo);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cs-close-btn";
    closeBtn.setAttribute("title", "Close (Esc)");

    const closeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    closeSvg.setAttribute("width", "16");
    closeSvg.setAttribute("height", "16");
    closeSvg.setAttribute("viewBox", "0 0 24 24");
    closeSvg.setAttribute("fill", "none");
    closeSvg.setAttribute("stroke", "currentColor");
    closeSvg.setAttribute("stroke-width", "2");
    closeSvg.setAttribute("stroke-linecap", "round");
    closeSvg.setAttribute("stroke-linejoin", "round");
    const closeLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    closeLine1.setAttribute("x1", "18");
    closeLine1.setAttribute("y1", "6");
    closeLine1.setAttribute("x2", "6");
    closeLine1.setAttribute("y2", "18");
    const closeLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    closeLine2.setAttribute("x1", "6");
    closeLine2.setAttribute("y1", "6");
    closeLine2.setAttribute("x2", "18");
    closeLine2.setAttribute("y2", "18");
    closeSvg.appendChild(closeLine1);
    closeSvg.appendChild(closeLine2);
    closeBtn.appendChild(closeSvg);

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissUI();
    });

    header.appendChild(closeBtn);
    card.appendChild(header);

    // Card Body
    const body = document.createElement("div");
    body.className = "cs-card-body";
    card.appendChild(body);

    // Initial Loading State
    const loadingState = document.createElement("div");
    loadingState.className = "cs-loading-state";

    const spinner = document.createElement("div");
    spinner.className = "cs-spinner";
    loadingState.appendChild(spinner);

    const loadingText = document.createElement("div");
    loadingText.className = "cs-loading-text";
    loadingText.textContent = "Analyzing context & fetching meaning...";
    loadingState.appendChild(loadingText);

    body.appendChild(loadingState);

    // Position Card (approx 320px x 240px initial)
    const { left, top } = calculatePopupPosition(selectionData.rect, 320, 240);
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    container.appendChild(card);

    activeElement = "card";

    // Concurrency tracking: generate new requestId
    const thisRequestId = ++currentRequestId;

    // Trigger AI lookup
    executeLookup(selectionData, thisRequestId, pronunciationSpan, body);
  }

  // Execute lookup and safely populate the card body
  function executeLookup(selectionData, requestId, pronunciationSpan, body) {
    chrome.runtime.sendMessage(
      {
        action: "FETCH_DEFINITION",
        word: selectionData.text,
        sentence: selectionData.contextData.sentence,
        context: selectionData.contextData.context,
        language: selectionData.contextData.language
      },
      (response) => {
        // Discard if user triggered a newer request or card closed
        if (requestId !== currentRequestId || activeElement !== "card") return;

        if (chrome.runtime.lastError) {
          renderErrorState(
            body,
            selectionData,
            requestId,
            pronunciationSpan,
            chrome.runtime.lastError.message || "Failed to communicate with extension background worker."
          );
          return;
        }

        if (!response || !response.success) {
          const isNoKey = response?.errorType === "NO_API_KEY";
          renderErrorState(
            body,
            selectionData,
            requestId,
            pronunciationSpan,
            response?.message || "An error occurred while fetching the definition.",
            isNoKey
          );
          return;
        }

        renderSuccessState(body, response.data, pronunciationSpan);
      }
    );
  }

  // Render successful definition using safe text assignment (NO innerHTML)
  function renderSuccessState(body, data, pronunciationSpan) {
    body.replaceChildren();

    // Pronunciation in header
    if (data.pronunciation) {
      pronunciationSpan.textContent = `/${data.pronunciation}/`;
    }

    // Part of speech badge
    if (data.partOfSpeech) {
      const badgeRow = document.createElement("div");
      badgeRow.className = "cs-badge-row";
      const badge = document.createElement("span");
      badge.className = "cs-badge";
      badge.textContent = data.partOfSpeech;
      badgeRow.appendChild(badge);
      body.appendChild(badgeRow);
    }

    // Contextual Meaning (Highlighted callout)
    if (data.contextualMeaning) {
      const contextBox = document.createElement("div");
      contextBox.className = "cs-contextual-box";

      const label = document.createElement("div");
      label.className = "cs-section-label";
      label.textContent = "Meaning in this sentence";
      contextBox.appendChild(label);

      const text = document.createElement("div");
      text.className = "cs-text-content";
      text.textContent = data.contextualMeaning;
      contextBox.appendChild(text);

      body.appendChild(contextBox);
    }

    // Simple / General Meaning
    if (data.simpleMeaning) {
      const section = document.createElement("div");
      section.className = "cs-section";

      const label = document.createElement("div");
      label.className = "cs-section-label";
      label.textContent = "General definition";
      section.appendChild(label);

      const text = document.createElement("div");
      text.className = "cs-text-content";
      text.textContent = data.simpleMeaning;
      section.appendChild(text);

      body.appendChild(section);
    }

    // Example
    if (data.example) {
      const section = document.createElement("div");
      section.className = "cs-section";

      const label = document.createElement("div");
      label.className = "cs-section-label";
      label.textContent = "Example";
      section.appendChild(label);

      const exampleText = document.createElement("div");
      exampleText.className = "cs-example-text";
      exampleText.textContent = `"${data.example.replace(/^["']|["']$/g, "")}"`;
      section.appendChild(exampleText);

      body.appendChild(section);
    }
  }

  // Render error state with Retry or Open Options action
  function renderErrorState(body, selectionData, requestId, pronunciationSpan, errorMessage, isNoKey = false) {
    body.replaceChildren();

    const errorBox = document.createElement("div");
    errorBox.className = "cs-error-box";

    const msg = document.createElement("div");
    msg.textContent = errorMessage;
    errorBox.appendChild(msg);

    const btnRow = document.createElement("div");
    btnRow.className = "cs-action-btn-row";

    if (isNoKey) {
      const optBtn = document.createElement("button");
      optBtn.type = "button";
      optBtn.className = "cs-inline-btn primary";
      optBtn.textContent = "Open Settings";
      optBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
      });
      btnRow.appendChild(optBtn);
    } else {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "cs-inline-btn primary";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        body.replaceChildren();
        const loadingState = document.createElement("div");
        loadingState.className = "cs-loading-state";
        const spinner = document.createElement("div");
        spinner.className = "cs-spinner";
        loadingState.appendChild(spinner);
        const loadingText = document.createElement("div");
        loadingText.className = "cs-loading-text";
        loadingText.textContent = "Retrying contextual lookup...";
        loadingState.appendChild(loadingText);
        body.appendChild(loadingState);

        executeLookup(selectionData, requestId, pronunciationSpan, body);
      });
      btnRow.appendChild(retryBtn);
    }

    errorBox.appendChild(btnRow);
    body.appendChild(errorBox);
  }

  // Handle text selection on mouseup / keyup
  function handleSelection(event) {
    // If the click/event originated inside the extension's UI, don't reprocess
    if (event && isInsideExtensionUI(event)) return;

    // Small delay to allow browser selection to settle
    setTimeout(() => {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {
        // If clicking outside and active element is a button, dismiss button
        if (activeElement === "button") {
          dismissUI();
        }
        return;
      }

      const text = selection.toString().trim();

      // Disallow empty, whitespace, or overly long selections (e.g. whole page)
      if (!text || text.length === 0 || text.length > 120) {
        if (activeElement === "button") dismissUI();
        return;
      }

      // Check if selection is inside input, textarea, or composer
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (isInsideEditableOrComposer(anchorNode) || isInsideEditableOrComposer(focusNode)) {
        if (activeElement) dismissUI();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Ensure valid visible bounding rect
      if (rect.width === 0 && rect.height === 0) return;

      const contextData = extractContext(range, text);

      currentSelectionData = {
        text,
        rect,
        range,
        contextData
      };

      // Show the floating "Meaning" button
      showFloatingButton(currentSelectionData);
    }, 20);
  }

  // Global Event Listeners
  document.addEventListener("mouseup", (e) => {
    // If card is currently active and user clicks outside both selection and card, dismiss
    if (activeElement === "card" && !isInsideExtensionUI(e)) {
      dismissUI();
      return;
    }
    handleSelection(e);
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape") {
      dismissUI();
      return;
    }
    // Shift+Arrows or double-click key selection
    handleSelection(e);
  });

  // Reposition or dismiss on scroll
  window.addEventListener("scroll", () => {
    // If button is active, dismiss on scroll to avoid stale floating button
    if (activeElement === "button") {
      dismissUI();
    }
    // If card is active, update its position to follow selection if range is still valid
    if (activeElement === "card" && currentSelectionData?.range) {
      try {
        const newRect = currentSelectionData.range.getBoundingClientRect();
        if (newRect.width > 0 && shadowRoot) {
          const container = shadowRoot.getElementById("contextsense-container");
          if (container) {
            const { left, top } = calculatePopupPosition(newRect, 320, 240);
            container.style.left = `${left}px`;
            container.style.top = `${top}px`;
          }
        }
      } catch (err) {
        // Selection range might have become invalid after dynamic DOM re-render
      }
    }
  }, { passive: true });

})();
