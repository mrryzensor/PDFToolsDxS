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
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          let containerClasses = "bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-slate-900/10";
          let icon = <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />;
          let iconBg = "bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/50";

          if (toast.type === 'success') {
            containerClasses = "bg-white/98 dark:bg-slate-900/95 border-emerald-300 dark:border-emerald-500/40 text-slate-800 dark:text-slate-100 shadow-emerald-500/10";
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
            iconBg = "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50";
          } else if (toast.type === 'error') {
            containerClasses = "bg-white/98 dark:bg-slate-900/95 border-rose-300 dark:border-rose-500/40 text-slate-800 dark:text-slate-100 shadow-rose-500/10";
            icon = <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />;
            iconBg = "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/50";
          } else if (toast.type === 'warning') {
            containerClasses = "bg-white/98 dark:bg-slate-900/95 border-amber-300 dark:border-amber-500/40 text-slate-800 dark:text-slate-100 shadow-amber-500/10";
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
            iconBg = "bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${containerClasses}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                  {icon}
                </div>
                <p className="text-xs sm:text-sm font-semibold leading-snug break-words text-slate-800 dark:text-slate-100">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                title="Cerrar notificación"
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
