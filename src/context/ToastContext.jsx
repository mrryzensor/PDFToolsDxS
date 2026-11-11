import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3800) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          let bgClass = "bg-surface-container-highest/95 border-outline-variant/30 text-on-surface";
          let icon = <Info className="w-5 h-5 text-primary shrink-0" />;

          if (toast.type === 'success') {
            bgClass = "bg-primary-container/95 border-primary text-on-primary-container shadow-primary/20";
            icon = <CheckCircle2 className="w-5 h-5 text-on-primary-container shrink-0" />;
          } else if (toast.type === 'error') {
            bgClass = "bg-tertiary-container/95 border-tertiary text-on-tertiary-container shadow-tertiary/20";
            icon = <XCircle className="w-5 h-5 text-on-tertiary-container shrink-0" />;
          } else if (toast.type === 'warning') {
            bgClass = "bg-secondary-container/95 border-secondary text-on-secondary-container shadow-secondary/20";
            icon = <AlertTriangle className="w-5 h-5 text-on-secondary-container shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${bgClass}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {icon}
                <p className="text-sm font-medium leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
