/**
 * ContextSense Options Page Controller
 */

const PRESETS = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini"
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.1-8b-instruct"
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant"
  },
  ollama: {
    endpoint: "http://localhost:11434/v1/chat/completions",
    model: "llama3.2"
  }
};

const DEFAULT_SETTINGS = {
  endpoint: PRESETS.openai.endpoint,
  model: PRESETS.openai.model,
  apiKey: ""
};

const presetSelect = document.getElementById("preset-select");
const endpointInput = document.getElementById("api-endpoint");
const modelInput = document.getElementById("api-model");
const apiKeyInput = document.getElementById("api-key");
const toggleKeyBtn = document.getElementById("toggle-key-visibility");
const saveBtn = document.getElementById("save-btn");
const testBtn = document.getElementById("test-btn");
const testSpinner = document.getElementById("test-spinner");
const resetBtn = document.getElementById("reset-btn");
const statusBanner = document.getElementById("status-banner");

// Show status alert
function showStatus(message, isSuccess = true) {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${isSuccess ? "success" : "error"}`;
  statusBanner.classList.remove("hidden");

  if (isSuccess) {
    setTimeout(() => {
      statusBanner.classList.add("hidden");
    }, 4000);
  }
}

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  endpointInput.value = settings.endpoint || DEFAULT_SETTINGS.endpoint;
  modelInput.value = settings.model || DEFAULT_SETTINGS.model;
  apiKeyInput.value = settings.apiKey || "";

  // Check if current matches a preset
  matchPreset(endpointInput.value, modelInput.value);
}

function matchPreset(endpoint, model) {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (preset.endpoint === endpoint && preset.model === model) {
      presetSelect.value = key;
      return;
    }
  }
  presetSelect.value = "custom";
}

// Handle Preset selection
presetSelect.addEventListener("change", (e) => {
  const chosen = e.target.value;
  if (PRESETS[chosen]) {
    endpointInput.value = PRESETS[chosen].endpoint;
    modelInput.value = PRESETS[chosen].model;
  }
});

// Toggle password view
toggleKeyBtn.addEventListener("click", () => {
  const isPass = apiKeyInput.type === "password";
  apiKeyInput.type = isPass ? "text" : "password";
});

// Save settings
saveBtn.addEventListener("click", async () => {
  const endpoint = endpointInput.value.trim();
  const model = modelInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!endpoint) {
    showStatus("API Endpoint URL cannot be empty.", false);
    return;
  }
  if (!model) {
    showStatus("Model Name cannot be empty.", false);
    return;
  }

  await chrome.storage.local.set({ endpoint, model, apiKey });
  showStatus("Settings saved successfully!", true);
});

// Reset settings
resetBtn.addEventListener("click", async () => {
  if (confirm("Reset settings to default OpenAI (gpt-4o-mini)?")) {
    endpointInput.value = DEFAULT_SETTINGS.endpoint;
    modelInput.value = DEFAULT_SETTINGS.model;
    apiKeyInput.value = "";
    presetSelect.value = "openai";
    await chrome.storage.local.set(DEFAULT_SETTINGS);
    showStatus("Settings reset to defaults.", true);
  }
});

// Test Connection
testBtn.addEventListener("click", () => {
  const endpoint = endpointInput.value.trim();
  const model = modelInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey && !endpoint.includes("localhost") && !endpoint.includes("127.0.0.1")) {
    showStatus("Please enter an API Key to test the connection.", false);
    return;
  }

  testBtn.disabled = true;
  testSpinner.classList.remove("hidden");
  statusBanner.classList.add("hidden");

  chrome.runtime.sendMessage(
    {
      action: "TEST_CONNECTION",
      settings: { endpoint, model, apiKey }
    },
    (response) => {
      testBtn.disabled = false;
      testSpinner.classList.add("hidden");

      if (chrome.runtime.lastError) {
        showStatus(`Connection error: ${chrome.runtime.lastError.message}`, false);
        return;
      }

      if (response && response.success) {
        showStatus(response.message || "Connection successful! Provider responded properly.", true);
      } else {
        showStatus(response?.message || "Connection test failed.", false);
      }
    }
  );
});

// Initialize
document.addEventListener("DOMContentLoaded", loadSettings);
