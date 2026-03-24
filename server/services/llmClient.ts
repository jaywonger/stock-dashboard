/**
 * AI Agent Service Layer
 *
 * Provides unified interface for AI-powered stock analysis,
 * conversational chat, and autonomous monitoring agents.
 *
 * Uses LiteLLM for model-agnostic LLM access.
 */

import dotenv from "dotenv";
dotenv.config();

// LiteLLM is typically used via HTTP API or Python
// For Node.js, we'll use direct API calls or a LiteLLM proxy server
// Alternative: Use LangChain.js or direct provider SDKs

interface LLMConfig {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call LLM via LiteLLM-compatible API
 *
 * LiteLLM can be run as a proxy server that normalizes all provider APIs
 * See: https://docs.litellm.ai/docs/proxy/quick_start
 *
 * Alternative: Direct provider calls when LiteLLM proxy not available
 */
export async function callLLM(
  messages: LLMMessage[],
  config?: Partial<LLMConfig>
): Promise<LLMResponse> {
  const litellmModel = process.env.LITELLM_MODEL || "gemini/gemini-2.0-flash";
  const litellmApiKey = process.env.LITELLM_API_KEY;
  const litellmBaseUrl = process.env.LITELLM_BASE_URL;

  // Check if using LiteLLM proxy
  if (litellmBaseUrl) {
    return callLiteLLMProxy(messages, {
      model: litellmModel,
      apiKey: litellmApiKey,
      baseUrl: litellmBaseUrl,
      temperature: config?.temperature ?? 0.3,
      maxTokens: config?.maxTokens ?? 1000,
    });
  }

  // Fallback: Direct provider calls based on model prefix
  if (litellmModel.startsWith("gemini/")) {
    return callGemini(messages, {
      model: litellmModel.replace("gemini/", ""),
      apiKey: process.env.GEMINI_API_KEY,
      temperature: config?.temperature ?? 0.3,
      maxTokens: config?.maxTokens ?? 1000,
    });
  }

  if (litellmModel.startsWith("claude/")) {
    return callClaude(messages, {
      model: litellmModel.replace("claude/", ""),
      apiKey: process.env.CLAUDE_API_KEY,
      temperature: config?.temperature ?? 0.3,
      maxTokens: config?.maxTokens ?? 1000,
    });
  }

  if (litellmModel.startsWith("gpt/") || litellmModel.startsWith("openai/")) {
    return callOpenAI(messages, {
      model: litellmModel.replace(/^(gpt|openai)\//, ""),
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      temperature: config?.temperature ?? 0.3,
      maxTokens: config?.maxTokens ?? 1000,
    });
  }

  // Default to Gemini
  return callGemini(messages, {
    model: "gemini-2.0-flash",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: config?.temperature ?? 0.3,
    maxTokens: config?.maxTokens ?? 1000,
  });
}

async function callLiteLLMProxy(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`LiteLLM proxy error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content ?? "",
    model: data.model,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function callGemini(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const model = config.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const geminiMessages = messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: geminiMessages,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    model: `gemini/${model}`,
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount,
      completionTokens: data.usageMetadata.candidatesTokenCount,
      totalTokens: data.usageMetadata.totalTokenCount,
    } : undefined,
  };
}

async function callClaude(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model || "claude-3-5-sonnet-20241022",
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: messages.filter(m => m.role !== "system"),
      system: messages.find(m => m.role === "system")?.content,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text ?? "",
    model: `claude/${data.model}`,
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } : undefined,
  };
}

async function callOpenAI(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content ?? "",
    model: `openai/${data.model}`,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

/**
 * Parse structured analysis response from LLM
 * Expects JSON format from the model
 */
export function parseAnalysisResponse<T>(content: string): T | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if agent functionality is enabled
 */
export function isAgentEnabled(): boolean {
  const enabled = process.env.AGENT_ENABLED || "false";
  const hasApiKey = !!(
    process.env.LITELLM_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.CLAUDE_API_KEY
  );
  return enabled.toLowerCase() === "true" && hasApiKey;
}
