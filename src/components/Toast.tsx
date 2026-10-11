import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const visibleToasts = toasts.slice(-3);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 flex flex-col-reverse gap-2 max-w-[320px] sm:max-w-[340px] w-full pointer-events-none">
      {visibleToasts.map((toast, index) => {
        const offset = visibleToasts.length - 1 - index;
        const scale = 1 - offset * 0.04;
        const opacity = 1 - offset * 0.15;

        return (
          <div
            key={toast.id}
            style={{
              transform: `scale(${scale})`,
              opacity,
            }}
            className="pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl border border-zinc-700 bg-zinc-900/95 text-white backdrop-blur-md shadow-2xl transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-white" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-zinc-300" />}
              {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-zinc-400" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-zinc-300" />}
            </div>
            <div className="flex-1 text-xs font-mono font-medium leading-snug break-words">
              {toast.message}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 text-zinc-500 hover:text-white transition-colors p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
