import React from 'react';
import { 
  FileText, Wrench, Moon, Sun, Download, FileUp, Sparkles, 
  HelpCircle, Laptop
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const Header = ({ 
  currentView, 
  setCurrentView, 
  onOpenExportModal, 
  documentTitle = 'Documento Sin Título' 
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-outline-variant/30 dark:border-transparent bg-surface-container-lowest/80 dark:bg-slate-950 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Brand & Document Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-md shadow-primary/20">
            <FileText className="w-4 h-4" />
          </div>
          <span className="font-headline font-bold text-base tracking-tight text-primary hidden sm:inline">
            DocuCraft <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary-container/20 text-primary">Pro</span>
          </span>
        </div>

        <div className="h-4 w-px bg-outline-variant/30 mx-1 hidden sm:block" />

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-low dark:bg-slate-900/90 p-1 rounded-xl border border-outline-variant/20 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCurrentView('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentView === 'editor'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Editor Word</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('tools')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentView === 'tools'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Herramientas PDF</span>
          </button>
        </div>
      </div>

      {/* Right Actions: Theme Toggle, Export Modal */}
      <div className="flex items-center gap-2">
        {/* Dark/Light mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4 text-secondary-container" /> : <Moon className="w-4 h-4 text-primary" />}
        </button>

        {currentView === 'editor' && (
          <button
            type="button"
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary rounded-xl font-semibold text-xs hover:bg-surface-tint shadow-md shadow-primary/20 transition-all active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        )}
      </div>
    </header>
  );
};
