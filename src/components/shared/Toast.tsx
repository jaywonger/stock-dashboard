import { X } from "lucide-react";

export interface ToastMessage {
  id: string;
  title: string;
  tone?: "success" | "error" | "info" | "warning";
}

interface ToastProps {
  toasts: ToastMessage[];
  dismiss: (id: string) => void;
}

const toneClass: Record<NonNullable<ToastMessage["tone"]>, string> = {
  success: "border-bullish/50 bg-bullish/10",
  error: "border-bearish/50 bg-bearish/10",
  info: "border-neutral/50 bg-neutral/10",
  warning: "border-warning/50 bg-warning/10"
};

export function Toast({ toasts, dismiss }: ToastProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1200] flex w-[320px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between rounded-lg border px-3 py-2 text-sm text-text-primary ${
            toneClass[toast.tone ?? "info"]
          }`}
        >
          <span>{toast.title}</span>
          <button
            className="ml-3 rounded p-1 text-text-muted transition hover:text-text-primary"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
