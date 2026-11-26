/**
 * Utilitaires de contraste et de teinte accessibles (WCAG AA).
 * Garantit qu'une couleur personnalisée saisie librement reste lisible.
 */

function parseHexRgb(hex?: string | null, fallback = '#2563EB'): [number, number, number] {
  const clean = (hex || '').trim().replace('#', '');
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  }

  return parseHexRgb(fallback, '#2563EB');
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Assombrit minimalement une couleur hex si nécessaire pour garantir
 * un contraste ≥ 4.6:1 avec du texte blanc (#FFFFFF).
 */
export function ensureWhiteTextContrast(hex?: string | null, fallback = '#2563EB'): string {
  const [r0, g0, b0] = parseHexRgb(hex, fallback);
  let r = r0;
  let g = g0;
  let b = b0;

  // 1.05 / (L + 0.05) >= 4.6 => L <= 0.17826
  const targetMaxLum = 0.175;
  for (let step = 0; step < 12; step++) {
    if (relativeLuminance(r, g, b) <= targetMaxLum) {
      break;
    }
    // Mélange progressif vers slate-900 (#0F172A = 15, 23, 42)
    r = Math.round(r * 0.85 + 15 * 0.15);
    g = Math.round(g * 0.85 + 23 * 0.15);
    b = Math.round(b * 0.85 + 42 * 0.15);
  }

  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Retourne une couleur RGBA très douce pour les fonds de badges teintés.
 */
export function hexToSoftTint(hex?: string | null, alpha = 0.12, fallback = '#2563EB'): string {
  const [r, g, b] = parseHexRgb(hex, fallback);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
