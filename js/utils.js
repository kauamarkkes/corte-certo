/**
 * utils.js — Funções utilitárias puras (datas, moeda, máscara, escape de HTML).
 */
export const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Data local -> 'YYYY-MM-DD' (sem problemas de fuso). */
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** 'YYYY-MM-DD' -> Date local à meia-noite. */
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());

/** 'HH:MM' <-> minutos desde 00:00 */
export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Ex.: 'Sexta, 02 Out' */
export const formatDayLabel = (iso) => {
  const d = fromISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};
/** Ex.: '02/10/2026' */
export const formatDateBR = (iso) => fromISO(iso).toLocaleDateString('pt-BR');
/** Ex.: 'Sexta-feira, 02 de outubro' */
export const formatLongDate = (iso) => fromISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

export const money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Máscara de telefone brasileiro: (11) 98765-4321 */
export const maskPhone = (value) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
export const isValidPhone = (v) => /^\d{10,11}$/.test(v.replace(/\D/g, ''));

/** Escapa HTML de textos digitados pelo usuário antes de renderizar. */
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
export const bookingCode = () => 'CC-' + Math.floor(1000 + Math.random() * 9000);
