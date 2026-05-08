import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Combina múltiplas funções de comparação em uma cadeia de desempate.
 * Retorna a primeira diferença não-zero encontrada, garantindo ordem 100% determinística.
 *
 * @example
 * .sort(compareBy(
 *   (a, b) => (b.monthCheckinCount || 0) - (a.monthCheckinCount || 0), // critério principal
 *   (a, b) => (b.xp || 0) - (a.xp || 0),                              // 1º desempate
 *   (a, b) => (b.level || 1) - (a.level || 1),                         // 2º desempate
 * ))
 */
export function compareBy<T>(
  ...comparators: Array<(a: T, b: T) => number>
): (a: T, b: T) => number {
  return (a, b) => {
    for (const cmp of comparators) {
      const result = cmp(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}
