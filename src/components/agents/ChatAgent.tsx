/**
 * Chat Agent Component
 *
 * Conversational AI interface for asking questions about stocks,
 * market conditions, comparisons, and trading strategies.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { chatWithAgent, compareStocks } from "../../services/agentService";
import type { ChatMessage, ChatSuggestedAction } from "../../types";

interface ChatAgentProps {
  onAction?: (action: ChatSuggestedAction) => void;
}

export function ChatAgent({ onAction }: ChatAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await chatWithAgent(content, messages);
      if (response) {
        setMessages((prev) => [...prev, response]);
      } else {
        // Fallback message
        const fallback: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "AI features are not enabled. Please configure AI API keys in Settings.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, fallback]);
      }
    } catch (error) {
      console.error("[Chat] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedAction = (action: ChatSuggestedAction) => {
    onAction?.(action);
    if (action.type === "view_chart" && action.payload?.symbol) {
      setInput(`Show chart analysis for ${action.payload.symbol}`);
    }
  };

  const handleCompare = async (symbols: string[]) => {
    if (symbols.length < 2) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `Compare ${symbols.join(" vs ")}`,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await compareStocks(symbols);
      if (response) {
        setMessages((prev) => [...prev, response]);
      }
    } catch (error) {
      console.error("[Compare] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-text-muted">
            <div className="mb-4 text-4xl">🤖</div>
            <h3 className="text-lg font-semibold text-text-primary">AI Assistant</h3>
            <p className="mt-2 max-w-md text-sm">
              Ask me about stocks, markets, technical indicators<br />
              Examples: "Is NVDA a buy now?" or "Compare AAPL and MSFT"
            </p>

            {/* Quick starters */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <QuickChip label="NVDA Analysis" onClick={() => sendMessage("Analyze NVDA for investment")} />
              <QuickChip label="Compare Stocks" onClick={() => handleCompare(["AAPL", "MSFT", "GOOGL"])} />
              <QuickChip label="Market Outlook" onClick={() => sendMessage("What's the outlook for the US stock market?")} />
              <QuickChip label="What is RSI" onClick={() => sendMessage("How do I use the RSI indicator?")} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-neutral text-white"
                      : "bg-base border border-border text-text-primary"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>

                  {/* Suggested Actions */}
                  {msg.role === "assistant" && msg.metadata?.suggestedActions && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.metadata.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestedAction(action)}
                          className="rounded border border-neutral bg-neutral/10 px-2 py-1 text-xs text-neutral hover:bg-neutral/20"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-text-muted">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg border border-border bg-base px-4 py-2">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-neutral" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-neutral" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-neutral" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            className="flex-1 rounded border border-border bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neutral focus:outline-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="rounded bg-neutral px-4 py-2 text-sm font-medium text-white hover:bg-neutral/80 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border bg-base px-3 py-1.5 text-xs text-text-muted hover:border-neutral hover:text-neutral"
    >
      {label}
    </button>
  );
}
