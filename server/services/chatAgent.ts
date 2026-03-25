/**
 * Conversational Chat Agent
 *
 * Enables natural language Q&A about stocks, market conditions,
 * comparisons, and trading strategies.
 */

import { callLLM, isAgentEnabled } from "./llmClient";
import type { Quote, OHLCV, NewsArticle } from "../../src/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    symbolsMentioned?: string[];
    suggestedActions?: ChatSuggestedAction[];
    dataReferences?: ChatDataReference[];
  };
}

export interface ChatSuggestedAction {
  type: "view_chart" | "set_alert" | "add_watchlist" | "run_screener";
  label: string;
  payload?: Record<string, unknown>;
}

export interface ChatDataReference {
  type: "quote" | "ohlcv" | "news" | "indicator";
  symbol?: string;
  summary: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  context?: {
    symbols?: string[];
    lastAnalyzedSymbol?: string;
  };
}

interface ChatContext {
  userQuestion: string;
  history: ChatMessage[];
  data: {
    quotes?: Record<string, Quote>;
    ohlcv?: Record<string, OHLCV[]>;
    news?: NewsArticle[];
    marketOverview?: {
      spyChange?: number;
      qqqChange?: number;
      vix?: number;
      marketStatus?: string;
    };
  };
}

/**
 * Process a chat message and generate AI response
 */
export async function chatWithAgent(context: ChatContext): Promise<ChatMessage> {
  if (!isAgentEnabled()) {
    return createFallbackResponse(context.userQuestion);
  }

  const { userQuestion, history, data } = context;

  // Build conversation history for LLM
  const messages = [
    {
      role: "system" as const,
      content: `You are a professional stock investment advisor. Answer user questions in concise, professional English.

You can:
- Analyze individual stocks (technical and fundamental)
- Compare multiple stocks
- Interpret market news and sentiment
- Provide trading strategy suggestions
- Explain technical indicators

Response guidelines:
- Support your points with specific prices and data
- Clearly point out risks
- Do not constitute investment advice, for informational purposes only
- Be honest when uncertain`,
    },
    // Add last 5 messages for context
    ...history.slice(-5).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    {
      role: "user" as const,
      content: buildUserPrompt(userQuestion, data),
    },
  ];

  try {
    const response = await callLLM(messages, {
      temperature: 0.5,
      maxTokens: 800,
    });

    // Extract symbols mentioned
    const symbolsMentioned = extractSymbols(userQuestion + " " + response.content);
    const suggestedActions = generateSuggestedActions(symbolsMentioned, response.content);

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response.content,
      timestamp: new Date().toISOString(),
      metadata: {
        symbolsMentioned,
        suggestedActions,
      },
    };
  } catch (error) {
    console.error("[ChatAgent] Error:", error);
    return createFallbackResponse(userQuestion);
  }
}

function buildUserPrompt(question: string, data: ChatContext["data"]): string {
  let prompt = `User question: ${question}\n\n`;

  // Add relevant market data
  if (data.marketOverview) {
    const { spyChange, qqqChange, vix, marketStatus } = data.marketOverview;
    prompt += `Market Overview:\n`;
    if (spyChange !== undefined) prompt += `- SPY: ${spyChange > 0 ? "+" : ""}${spyChange.toFixed(2)}%\n`;
    if (qqqChange !== undefined) prompt += `- QQQ: ${qqqChange > 0 ? "+" : ""}${qqqChange.toFixed(2)}%\n`;
    if (vix !== undefined) prompt += `- VIX: ${vix.toFixed(2)}\n`;
    if (marketStatus) prompt += `- Market Status: ${marketStatus}\n`;
    prompt += "\n";
  }

  // Add quote data if available
  if (data.quotes && Object.keys(data.quotes).length > 0) {
    prompt += `Stock Quotes:\n`;
    for (const [symbol, quote] of Object.entries(data.quotes)) {
      prompt += `- ${symbol}: $${quote.price.toFixed(2)} (${quote.change > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)\n`;
    }
    prompt += "\n";
  }

  // Add news if available
  if (data.news && data.news.length > 0) {
    prompt += `Recent News:\n`;
    data.news.slice(0, 5).forEach((news) => {
      prompt += `- [${news.sentimentLabel.toUpperCase()}] ${news.headline}\n`;
    });
    prompt += "\n";
  }

  return prompt;
}

function extractSymbols(text: string): string[] {
  // Match common stock symbol patterns
  const patterns = [
    /\b[A-Z]{1,5}\b/g, // Standard symbols (AAPL, SPY)
    /\b[A-Z]{1,10}\.[A-Z]{1,4}\b/g, // Exchange suffix symbols (PETR4.SA, 7203.T, RELIANCE.NS)
    /\b[A-Z]{4}\d{1,2}\b/g, // BR-style class symbols without suffix (PETR4, VALE3)
    /\b[hkH][Kk]?[0-9]{4,5}\b/g, // HK stocks (hk00700, 00700)
    /\b[0-9]{6}\.(SH|SZ)\b/g, // China stocks (600519.SH)
  ];

  const symbols = new Set<string>();

  for (const pattern of patterns) {
    const matches = text.toUpperCase().match(pattern);
    if (matches) {
      matches.forEach((m) => symbols.add(m));
    }
  }

  // Filter out common words that might match
  const exclude = ["I", "A", "THE", "AND", "NOT", "BUY", "SELL", "HOLD", "NEW", "YES", "NO"];
  return Array.from(symbols).filter((s) => !exclude.includes(s));
}

function generateSuggestedActions(
  symbols: string[],
  response: string
): ChatSuggestedAction[] {
  const actions: ChatSuggestedAction[] = [];

  // Suggest viewing chart for mentioned symbols
  for (const symbol of symbols.slice(0, 3)) {
    actions.push({
      type: "view_chart",
      label: `View ${symbol} chart`,
      payload: { symbol },
    });
  }

  // Check for alert-related keywords (Chinese and English)
  if (/\b(提醒 | 警报 | 突破 | 跌破 | 目标价 | 止损)\b|\b(alert|breakout|breakdown|target|stop loss)\b/i.test(response)) {
    for (const symbol of symbols.slice(0, 2)) {
      actions.push({
        type: "set_alert",
        label: `Set ${symbol} price alert`,
        payload: { symbol },
      });
    }
  }

  // Check for watchlist-related keywords (Chinese and English)
  if (/\b(加入 | 自选 | 关注)\b|\b(add|watchlist|watch)\b/i.test(response)) {
    for (const symbol of symbols.slice(0, 2)) {
      actions.push({
        type: "add_watchlist",
        label: `Add ${symbol} to watchlist`,
        payload: { symbol },
      });
    }
  }

  return actions;
}

function createFallbackResponse(_question: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "AI features are not enabled. Please configure AI API keys in Settings to enable intelligent chat.",
    timestamp: new Date().toISOString(),
    metadata: {
      suggestedActions: [],
    },
  };
}

/**
 * Specialized analysis prompts
 */
export async function compareStocks(
  symbols: string[],
  getContext: (symbol: string) => Promise<{ quote: Quote | null; ohlcv: OHLCV[]; news: NewsArticle[] }>
): Promise<ChatMessage> {
  if (!isAgentEnabled()) {
    return createFallbackResponse(`Compare ${symbols.join(" vs ")}`);
  }

  const data = await Promise.all(symbols.map(getContext));
  const quotes = Object.fromEntries(symbols.map((s, i) => [s, data[i].quote]).filter(([, q]) => q !== null) as [string, Quote][]);

  const prompt = `Compare the investment value of the following stocks:\n\n${symbols.map((s) => {
    const q = quotes[s];
    return `${s}: ${q ? `$${q.price.toFixed(2)} (${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)` : "Data not available"}`;
  }).join("\n")}`;

  const response = await callLLM([
    {
      role: "system",
      content: "You are a professional investment advisor. Compare the strengths and weaknesses of multiple stocks and provide a clear conclusion.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: response.content,
    timestamp: new Date().toISOString(),
    metadata: {
      symbolsMentioned: symbols,
      suggestedActions: symbols.map((s) => ({
        type: "view_chart" as const,
        label: `View ${s}`,
        payload: { symbol: s },
      })),
    },
  };
}

/**
 * Export chat session to shareable format
 */
export function exportChatSession(session: ChatSession): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    messages: session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
  }, null, 2);
}
