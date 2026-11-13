import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DEFAULT_ACCENT,
  ACCENT_STORAGE_KEY,
  PRESET_COLORS,
  normalizeHex,
  applyAccent,
  accentName,
} from '../utils/accentColor';

const ThemeContext = createContext();

function readSavedAccent() {
  try {
    return normalizeHex(localStorage.getItem(ACCENT_STORAGE_KEY)) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Color principal elegido por el usuario (predeterminados + personalizado).
  // Se guarda en localStorage y sobrevive a recargas y cierres del navegador.
  const [accentColor, setAccentColorState] = useState(readSavedAccent);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Aplica el color principal (claro u oscuro según el modo) cada vez
  // que cambia el color o el modo, y persiste la elección.
  useEffect(() => {
    applyAccent(accentColor, isDark);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
    } catch {
      // Sin almacenamiento: la preferencia solo vive en esta sesión.
    }
  }, [accentColor, isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const setAccentColor = (color) => {
    setAccentColorState(normalizeHex(color) || DEFAULT_ACCENT);
  };

  const resetAccentColor = () => setAccentColorState(DEFAULT_ACCENT);

  return (
    <ThemeContext.Provider value={{
      isDark,
      toggleTheme,
      accentColor,
      setAccentColor,
      resetAccentColor,
      presetColors: PRESET_COLORS,
      accentColorName: accentName(accentColor),
      isDefaultAccent: accentColor === DEFAULT_ACCENT,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
