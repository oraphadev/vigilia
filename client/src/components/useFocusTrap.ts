import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Prende o foco dentro de um container enquanto `active`.
 *
 * Enquanto ativo: foca o primeiro elemento focável, cicla Tab/Shift+Tab dentro do
 * container e chama `onEscape` no Escape. Ao desativar (ou desmontar), devolve o
 * foco a quem o tinha antes; sem isso, o teclado cai no topo da página.
 */
export function useFocusTrap(
  active: boolean,
  onEscape?: () => void,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );

    const focusFallback = (): void => {
      if (node.tabIndex < 0) node.tabIndex = -1;
      node.focus();
    };

    const first = focusables()[0];
    if (first) first.focus();
    else focusFallback();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        escapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        focusFallback();
        return;
      }

      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      const inside = current !== null && node.contains(current);

      if (event.shiftKey) {
        if (!inside || current === firstEl) {
          event.preventDefault();
          lastEl.focus();
        }
      } else if (!inside || current === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    // Captura: intercepta antes de qualquer handler da árvore React.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous && previous.isConnected) previous.focus();
    };
  }, [active]);

  return ref;
}
