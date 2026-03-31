import { useState, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container portaled to document.body to escape layout bounds */}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
          {toasts.map((toast) => (
            <div 
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border slide-in-from-right-8 w-80 
                ${toast.type === 'success' ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]' : 
                  toast.type === 'error' ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]' : 
                  'bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]'}`
              }
            >
              {toast.type === 'success' && <CheckCircle className="text-[#22c55e] shrink-0" size={20} />}
              {toast.type === 'error' && <AlertCircle className="text-[#ef4444] shrink-0" size={20} />}
              {toast.type === 'info' && <Info className="text-[#3b82f6] shrink-0" size={20} />}
              
              <p className="font-bold text-sm flex-1">{toast.message}</p>
              
              <button 
                onClick={() => removeToast(toast.id)}
                className="p-1.5 hover:bg-black/5 rounded-lg transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
