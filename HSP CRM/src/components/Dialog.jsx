import { useEffect, useRef } from 'react';
export function useDialog(onClose, enabled = true) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const candidates = () => [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(e => !e.disabled && e.getClientRects().length);
    candidates()[0]?.focus();
    function key(event) {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const elements = candidates(), first = elements[0], last = elements.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [enabled]);
}
export default function Dialog({ title, onClose, children }) {
  useDialog(onClose);
  return <div className="crm-dialog" role="dialog" aria-modal="true" aria-label={title}><section className="crm-dialog-panel"><header className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} type="button">Close</button></header>{children}</section></div>;
}
