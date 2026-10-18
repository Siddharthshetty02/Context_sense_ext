/**
 * ContextSense Background Service Worker
 * Handles OpenAI-compatible API calls, network retries, and settings management
 * without injecting keys or making cross-origin requests directly from the webpage.
 */

const DEFAULT_CONFIG = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o-mini",
  apiKey: "",
  temperature: 0.2
};

// Retrieve settings from chrome.storage.local
async function getSettings() {
  const result = await chrome.storage.local.get(DEFAULT_CONFIG);
  return {
    endpoint: (result.endpoint || DEFAULT_CONFIG.endpoint).trim(),
    model: (result.model || DEFAULT_CONFIG.model).trim(),
    apiKey: (result.apiKey || "").trim(),
    temperature: typeof result.temperature === "number" ? result.temperature : DEFAULT_CONFIG.temperature
  };
}

// Build standard prompt for contextual definition
function buildPrompt(word, sentence, context, language) {
  const systemPrompt = `You are a concise, accurate contextual dictionary and linguistic assistant.
Your task is to provide the meaning of a target word or phrase based on the specific context in which it appears.

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "word": string, // The target word or phrase
  "partOfSpeech": string, // e.g. "noun", "verb", "adjective", etc. (lowercase)
  "simpleMeaning": string, // General, easy-to-understand definition (1 sentence)
  "contextualMeaning": string, // Specific meaning as used in this exact sentence/context (1-2 sentences)
  "example": string, // A short, natural example sentence illustrating this specific usage
  "pronunciation": string // Optional phonetic guide, e.g. "kuhn-TEKS-choo-uhl" (omit if unsure)
}

Do not include any Markdown fences, backticks, or explanatory text before or after the JSON.`;

  const userContent = JSON.stringify({
    targetWord: word,
    sentence: sentence || word,
    surroundingContext: context || sentence || word,
    language: language || "en"
  });

  return { systemPrompt, userContent };
}

// Call AI API
async function fetchContextualMeaning(word, sentence, context, language) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    return {
      success: false,
      errorType: "NO_API_KEY",
      message: "No API key configured. Please set your API key in the extension Options."
    };
  }

  const { systemPrompt, userContent } = buildPrompt(word, sentence, context, language);

  const payload = {
    model: settings.model || "gpt-4o-mini",
    temperature: settings.temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Explain this word in its context:\n${userContent}` }
    ]
  };

  // Enable JSON response format where supported
  if (!settings.model.includes("instruct")) {
    payload.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.error?.message || JSON.stringify(errorJson);
      } catch (e) {
        errorDetail = await response.text();
      }

      if (response.status === 401) {
        return {
          success: false,
          errorType: "INVALID_API_KEY",
          message: "Invalid API key. Please check your key in the extension Options."
        };
      } else if (response.status === 429) {
        return {
          success: false,
          errorType: "RATE_LIMITED",
          message: "API rate limit reached or quota exceeded. Please check your provider account."
        };
      } else if (response.status === 404) {
        return {
          success: false,
          errorType: "MODEL_NOT_FOUND",
          message: `Model "${settings.model}" or endpoint not found (${response.status}).`
        };
      } else {
        return {
          success: false,
          errorType: "API_ERROR",
          message: `API request failed with status ${response.status}: ${errorDetail || "Unknown error"}`
        };
      }
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      return {
        success: false,
        errorType: "EMPTY_RESPONSE",
        message: "The AI provider returned an empty response."
      };
    }

    // Clean any markdown code blocks if the model wrapped output
    let cleaned = rawContent;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      return {
        success: false,
        errorType: "PARSE_ERROR",
        message: "Failed to parse AI response into structured data."
      };
    }

    // Validate and sanitize response fields
    const normalized = {
      word: String(parsed.word || word).trim(),
      partOfSpeech: parsed.partOfSpeech ? String(parsed.partOfSpeech).toLowerCase().trim() : "",
      simpleMeaning: String(parsed.simpleMeaning || "No definition available.").trim(),
      contextualMeaning: String(parsed.contextualMeaning || parsed.simpleMeaning || "").trim(),
      example: parsed.example ? String(parsed.example).trim() : "",
      pronunciation: parsed.pronunciation ? String(parsed.pronunciation).trim() : ""
    };

    return {
      success: true,
      data: normalized
    };

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        success: false,
        errorType: "TIMEOUT",
        message: "The request timed out. Please check your internet connection or endpoint."
      };
    }
    return {
      success: false,
      errorType: "NETWORK_ERROR",
      message: `Network error: ${err.message || "Failed to reach AI endpoint"}`
    };
  }
}

// Test connection handler for Options page
async function testConnection(testSettings) {
  const endpoint = (testSettings.endpoint || DEFAULT_CONFIG.endpoint).trim();
  const model = (testSettings.model || DEFAULT_CONFIG.model).trim();
  const apiKey = (testSettings.apiKey || "").trim();

  if (!apiKey) {
    return { success: false, message: "Please enter an API key before testing." };
  }

  const { systemPrompt, userContent } = buildPrompt(
    "contextual",
    "Understand the contextual meaning of a word using the surrounding information.",
    "Understand the contextual meaning of a word using the surrounding information.",
    "en"
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Explain this word in its context:\n${userContent}` }
        ],
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errText = "";
      try {
        const j = await response.json();
        errText = j.error?.message || JSON.stringify(j);
      } catch (e) {
        errText = await response.text();
      }
      return {
        success: false,
        message: `HTTP ${response.status}: ${errText || "Connection test failed."}`
      };
    }

    const resJson = await response.json();
    if (resJson.choices?.[0]?.message?.content) {
      return {
        success: true,
        message: `Success! Model "${model}" responded properly.`
      };
    } else {
      return {
        success: false,
        message: "Endpoint connected, but response format was unexpected."
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      message: err.name === "AbortError" ? "Connection timed out (15s)." : `Network error: ${err.message}`
    };
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_DEFINITION") {
    fetchContextualMeaning(
      request.word,
      request.sentence,
      request.context,
      request.language
    ).then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (request.action === "TEST_CONNECTION") {
    testConnection(request.settings).then(sendResponse);
    return true;
  }

  if (request.action === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }
});
