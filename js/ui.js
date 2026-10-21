/**
 * ui.js — Componentes de interface compartilhados: toast, modal e transições.
 */
const app = () => document.getElementById('app');

/** Renderiza uma "view" com animação de entrada (direction: 'forward' | 'back'). */
export function mount(html, direction = 'forward') {
  app().innerHTML = `<div class="view ${direction === 'back' ? 'back' : ''}">${html}</div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let toastTimer;
export function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${type === 'error' ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/**
 * Abre um modal acessível. `onMount(root, close)` recebe o elemento para ligar eventos.
 * Fecha com ESC, clique no fundo ou chamando close().
 */
export function openModal(html, onMount) {
  const root = document.getElementById('modalRoot');
  const last = document.activeElement;
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const backdrop = root.firstElementChild;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); last?.focus?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  backdrop.querySelector('input, select, button')?.focus();
  onMount?.(backdrop, close);
  return close;
}

/** Modal de confirmação genérico que retorna uma Promise<boolean>. */
export function confirmDialog({ title, text, confirm = 'Confirmar', danger = true }) {
  return new Promise((resolve) => {
    openModal(`
      <span class="eyebrow">Atenção</span>
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="actions">
        <button class="btn" data-close data-no>Voltar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${confirm}</button>
      </div>`, (root, close) => {
      root.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
      root.querySelector('[data-no]').onclick = () => resolve(false);
    });
  });
}
