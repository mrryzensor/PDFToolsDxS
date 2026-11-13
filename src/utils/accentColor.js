// Utilidad del color principal (acento) de DocuCraft Pro.
//
// Un solo color base elegido por el usuario genera toda la paleta:
// primario, contenedor, hover, selección y el color del texto sobre el
// primario, en modo claro y en modo oscuro. Los valores derivados se
// aplican como variables CSS en <html>, que es lo que lee Tailwind
// (ver tailwind.config.js: primary, primary-container, on-primary,
// surface-tint, primary-fixed, on-primary-fixed, inverse-primary).
// La preferencia se guarda en localStorage y se reaplica antes de que
// React monte (ver el script inline de index.html) para evitar el
// parpadeo del color anterior.

export const DEFAULT_ACCENT = '#004ac6';

export const ACCENT_STORAGE_KEY = 'pdftools-accent';
export const ACCENT_PALETTE_STORAGE_KEY = 'pdftools-accent-palette';

export const PRESET_COLORS = [
  { id: 'azul', name: 'Azul', color: '#004ac6' },
  { id: 'celeste', name: 'Celeste', color: '#0284c7' },
  { id: 'turquesa', name: 'Turquesa', color: '#0891b2' },
  { id: 'esmeralda', name: 'Esmeralda', color: '#059669' },
  { id: 'violeta', name: 'Violeta', color: '#7c3aed' },
  { id: 'rosa', name: 'Rosa', color: '#db2777' },
  { id: 'rojo', name: 'Rojo', color: '#dc2626' },
  { id: 'naranja', name: 'Naranja', color: '#ea580c' },
];

/** Normaliza un color a hexadecimal "#rrggbb" en minúsculas, o null si no es válido. */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/;
  const full = /^#([0-9a-f]{6})$/;
  if (full.test(hex)) return hex;
  const m = hex.match(short);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`;
  return null;
}

function hexToRgb(hex) {
  const n = normalizeHex(hex) || DEFAULT_ACCENT;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mezcla `hex` hacia `target` (0 = color original, 1 = target). */
function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/** Luminancia relativa (0-1) para decidir el color del texto encima. */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const linear = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Texto legible sobre `hex`: blanco sobre colores oscuros, casi negro sobre claros. */
function textOn(hex) {
  return luminance(hex) > 0.35 ? '#0f172a' : '#ffffff';
}

/**
 * Deriva la paleta completa a partir de un color base.
 * Devuelve { light: {...vars}, dark: {...vars} } con las variables CSS.
 */
export function derivePalette(baseHex) {
  const base = normalizeHex(baseHex) || DEFAULT_ACCENT;
  const lightPrimary = base;
  const darkPrimary = mix(base, '#ffffff', 0.55);

  return {
    light: {
      '--color-primary': lightPrimary,
      '--color-primary-container': mix(base, '#ffffff', 0.3),
      '--color-on-primary': textOn(lightPrimary),
      '--color-primary-hover': mix(base, '#ffffff', 0.12),
      '--color-primary-fixed': mix(base, '#ffffff', 0.88),
      '--color-on-primary-fixed': mix(base, '#000000', 0.6),
      '--color-inverse-primary': mix(base, '#ffffff', 0.65),
    },
    dark: {
      '--color-primary': darkPrimary,
      '--color-primary-container': mix(base, '#ffffff', 0.15),
      '--color-on-primary': textOn(darkPrimary),
      '--color-primary-hover': mix(darkPrimary, '#ffffff', 0.1),
      '--color-primary-fixed': mix(base, '#ffffff', 0.88),
      '--color-on-primary-fixed': mix(base, '#000000', 0.6),
      '--color-inverse-primary': mix(base, '#ffffff', 0.65),
    },
  };
}

/** Aplica la paleta derivada al documento y la deja guardada para el pre-pintado. */
export function applyAccent(baseHex, isDark) {
  const palette = derivePalette(baseHex);
  const vars = isDark ? palette.dark : palette.light;
  const root = document.documentElement;
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  try {
    localStorage.setItem(ACCENT_PALETTE_STORAGE_KEY, JSON.stringify(palette));
  } catch {
    // Almacenamiento no disponible (modo privado, etc.): el color igual se aplica en sesión.
  }
  return palette;
}

/** Nombre a mostrar para un color: el del preset si coincide, si no "Personalizado". */
export function accentName(hex) {
  const normalized = normalizeHex(hex);
  const preset = PRESET_COLORS.find((p) => p.color === normalized);
  return preset ? preset.name : 'Personalizado';
}
