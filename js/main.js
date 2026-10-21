/**
 * main.js — Ponto de entrada. Alterna entre os modos Cliente e Admin
 * e registra os listeners globais (delegação de eventos).
 */
import * as customer from './customer.js';
import * as admin from './admin.js';
import * as store from './store.js';

const app = document.getElementById('app');
customer.bindCustomerEvents(app);
admin.bindAdminEvents(app);

/** Troca o modo e lembra a escolha na sessão. */
function setMode(mode, direction = 'forward') {
  document.body.classList.toggle('mode-customer', mode === 'customer');
  document.body.classList.toggle('mode-admin', mode === 'admin');
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
    b.setAttribute('aria-pressed', b.dataset.mode === mode);
  });
  store.session.set({ mode });
  (mode === 'admin' ? admin : customer).render(direction);
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelector('[data-action="home"]').addEventListener('click', (e) => {
  e.preventDefault();
  setMode('customer');
  customer.resetFlow();
});

// Sincroniza abas abertas ao mesmo tempo (ex.: cliente em uma aba, admin em outra)
window.addEventListener('storage', (e) => {
  if (e.key?.startsWith('corte-certo')) location.reload();
});

setMode(store.session.get().mode || 'customer');
