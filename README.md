# ContextSense — AI Contextual Word Meaning Extension

A lightweight, distraction-free browser extension for **Microsoft Edge** and Chromium browsers. Double-click or select any unfamiliar word or phrase while reading **any webpage** (Wikipedia, ChatGPT, Medium, Substack, documentation, news, blogs, etc.) to see its **exact contextual definition**, part of speech, simple explanation, and example sentence in a compact floating card.

---

## 🚀 Key Features

- **Universal Inline Reading Assistance**: Works on **all websites** (`http://*/*` and `https://*/*`) — read articles, documentation, or chat responses without switching tabs, opening Google, or looking up words manually.
- **Context-Aware Definitions**: Uses surrounding sentence and paragraph context so ambiguous terms (e.g., *"model"*, *"prompt"*, *"parameter"*, *"bank"*, *"lead"*) are defined according to how they are actually used.
- **Shadow DOM Encapsulation**: Renders the floating button and card inside an isolated Shadow DOM tree so host website CSS cannot interfere with the card, and vice versa.
- **Safe Text Rendering**: Zero `innerHTML` usage. All AI-generated text is rendered safely as pure text nodes to prevent XSS or HTML injection vulnerabilities.
- **Light & Dark Theme Adaptive**: Automatically detects the webpage's dark or light theme and matches its appearance seamlessly.
- **Local API Security**: Your API key is stored strictly in `chrome.storage.local`. The key is **never injected into the webpage DOM** and is **never sent to third-party intermediary servers**.
- **Multiple Provider Support**: Pre-configured presets for OpenAI (`gpt-4o-mini`), Groq (`llama-3.1-8b-instant`), OpenRouter, and local Ollama (`llama3.2`), or any OpenAI-compatible custom `/chat/completions` endpoint.
- **Race Condition & Dismissal Handling**: Older in-flight requests are automatically discarded if a newer word is selected. Dismissible via `Escape`, the close button, or by clicking outside.

---

## 📂 Project Structure

```text
symantics_extension/
├── manifest.json        # Chromium Manifest V3 specification
├── background.js       # Background service worker (secure API requests & CORS handling)
├── content.js          # Content script (text selection, context capture, Shadow DOM UI)
├── options.html        # Extension Settings page
├── options.css         # Sleek Dark/Light theme styles for Settings
├── options.js          # Options controller (presets, storage, connection test)
├── icons/              # Extension icons (16px, 48px, 128px)
└── README.md           # Setup, configuration, and testing guide
```

---

## 🛠️ Installation Instructions for Microsoft Edge

1. **Open Edge Extensions page**:
   - In Microsoft Edge's address bar, navigate to: `edge://extensions`
2. **Enable Developer Mode**:
   - Toggle the **"Developer mode"** switch located in the left sidebar (or top right).
3. **Load Unpacked Extension**:
   - Click the **"Load unpacked"** button.
   - Select the extension folder:
     ```text
     c:\Users\siddh\OneDrive\Documents\symantics_extension
     ```
4. **Confirm Installation**:
   - The **ContextSense** extension will appear in your installed extensions list with its icon and version `1.0.0`.

---

## ⚙️ Configuring Your AI Provider

1. Open the extension settings in either of two ways:
   - Click the **ContextSense** icon on the Edge toolbar and choose **Extension options**.
   - Or right-click the extension icon and select **Options**.
2. **Select a Preset or Custom Provider**:
   - **OpenAI (Default)**:
     - Endpoint: `https://api.openai.com/v1/chat/completions`
     - Model: `gpt-4o-mini`
     - API Key: `sk-...` (from [platform.openai.com](https://platform.openai.com/api-keys))
   - **Groq (Fast & Free tier available)**:
     - Endpoint: `https://api.groq.com/openai/v1/chat/completions`
     - Model: `llama-3.1-8b-instant`
     - API Key: `gsk_...` (from [console.groq.com](https://console.groq.com/keys))
   - **Local Ollama (No API key needed)**:
     - Endpoint: `http://localhost:11434/v1/chat/completions`
     - Model: `llama3.2`
     - API Key: Can be left blank or `ollama`
3. Click **"Test Connection"**:
   - The extension will test the connection with a sample prompt. A green banner confirms when your provider responds correctly.
4. Click **"Save Settings"**.

> **Note on API Costs**: Standard ChatGPT Plus / Team subscriptions do **not** include OpenAI API platform credits. The OpenAI API platform is a separate service billed per token.

---

## 🎯 How to Use on Any Website

1. Navigate to any website (e.g., [Wikipedia](https://wikipedia.org), [ChatGPT](https://chatgpt.com), [Medium](https://medium.com), news, or documentation).
2. **Double-click** any word or click-and-drag to select a short phrase.
3. A small floating **"Meaning"** button will appear directly below/above your selection.
4. Click **"Meaning"** to open the card.
5. The card will display:
   - The selected word & pronunciation guide.
   - Part of speech (e.g., `adjective`, `noun`).
   - **Meaning in this sentence** (tailored to the surrounding text).
   - **General definition**.
   - **Example sentence**.
6. Press `Escape`, click the `×` button, or click anywhere outside to close the card.

---

## 🛡️ Security & Privacy Guardrails

- **Zero Webpage Injection**: The API key is stored in `chrome.storage.local` and accessed only inside the background service worker. Page scripts and ChatGPT React components cannot read the key.
- **Encapsulated Shadow DOM**: Injected UI elements live in an isolated Shadow DOM (`#contextsense-extension-host`) preventing style pollution and DOM interference.
- **Minimal Context Transmission**: Only the selected word and its immediate enclosing sentence/paragraph (up to ~300 characters) are transmitted to the AI provider. Full chat history is never transmitted.
- **Safe DOM Text Rendering**: Every piece of AI text is populated using `textContent` and `document.createElement`. `innerHTML` is strictly forbidden.
- **Message Composer Exclusions**: Text selections inside the ChatGPT message box (`#prompt-textarea`, `input`, `textarea`, `contenteditable`) are automatically ignored.

---

## 🧪 Testing & Verification

| Test Case | Status | Details |
|---|---|---|
| **Manifest V3 Validation** | ✅ Verified | Valid syntax, correct service worker, permissions, and host permissions. |
| **JavaScript Syntax Check** | ✅ Verified | Validated using Node.js syntax compiler (`node -c`). |
| **Input/Composer Exclusion** | ✅ Implemented | Skips selection triggers inside `#prompt-textarea`, `input`, `textarea`, or `contenteditable`. |
| **Shadow DOM Encapsulation** | ✅ Implemented | Prevents CSS conflicts with ChatGPT's Tailwind / custom styling. |
| **Safe Rendering (XSS Protection)** | ✅ Implemented | All responses rendered via `textContent` without `innerHTML`. |
| **Network & Rate Limit Handling** | ✅ Implemented | Explicit states for missing key, invalid key (401), rate limits (429), timeouts, and retries. |
| **Theme Adaptability** | ✅ Implemented | Dynamically switches between dark and light themes matching ChatGPT. |
| **Concurrency / Stale Requests** | ✅ Implemented | Uses incrementing `requestId` to prevent outdated responses from overwriting newer lookups. |
