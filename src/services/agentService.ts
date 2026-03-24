/**
 * Agent Service - Frontend API client
 *
 * Provides methods to interact with the AI agent backend:
 * - Stock analysis
 * - Chat conversations
 * - Monitor alerts
 */

import type {
  StockAnalysis,
  ChatMessage,
  MonitorAlert,
  AgentStatus,
} from "../types";

const API_BASE = "/api/agents";

/**
 * Analyze a single stock
 */
export async function analyzeStock(
  symbol: string,
  timeframe = "1D"
): Promise<StockAnalysis | null> {
  try {
    const response = await fetch(`${API_BASE}/analyze/${symbol}?timeframe=${timeframe}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 503) {
        return null; // Agent not enabled
      }
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error(`[AgentService] Error analyzing ${symbol}:`, error);
    return null;
  }
}

/**
 * Batch analyze multiple stocks
 */
export async function batchAnalyzeStocks(
  symbols: string[],
  timeframe = "1D"
): Promise<(StockAnalysis | null)[]> {
  try {
    const response = await fetch(`${API_BASE}/analyze/batch?timeframe=${timeframe}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbols }),
    });

    if (!response.ok) {
      throw new Error(`Batch analysis failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[AgentService] Error in batch analysis:", error);
    return [];
  }
}

/**
 * Send a chat message
 */
export async function chatWithAgent(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatMessage | null> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error("[AgentService] Chat error:", error);
    return null;
  }
}

/**
 * Compare multiple stocks
 */
export async function compareStocks(symbols: string[]): Promise<ChatMessage | null> {
  try {
    const response = await fetch(`${API_BASE}/compare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbols }),
    });

    if (!response.ok) {
      throw new Error(`Comparison failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error("[AgentService] Compare error:", error);
    return null;
  }
}

/**
 * Monitor watchlist for alerts
 */
export async function monitorWatchlist(symbols: string[]): Promise<MonitorAlert[]> {
  try {
    const response = await fetch(
      `${API_BASE}/monitor?symbols=${symbols.join(",")}&includeNewsSentiment=false`
    );

    if (!response.ok) {
      throw new Error(`Monitoring failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.alerts || [];
  } catch (error) {
    console.error("[AgentService] Monitor error:", error);
    return [];
  }
}

/**
 * Get agent status
 */
export async function getAgentStatus(): Promise<AgentStatus | null> {
  try {
    const response = await fetch(`${API_BASE}/status`);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("[AgentService] Status error:", error);
    return null;
  }
}

/**
 * Export chat session (placeholder)
 */
export async function exportChatSession(sessionId: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/chat/${sessionId}/export`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error("[AgentService] Export error:", error);
    return null;
  }
}
