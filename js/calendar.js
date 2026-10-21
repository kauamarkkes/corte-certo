/**
 * calendar.js — Calendário mensal real (datas do sistema), com dias
 * passados, fechados ou além do limite desabilitados.
 */
import { MONTHS, WEEKDAYS_SHORT, toISO, todayISO } from './utils.js';
import { isDayClosed } from './store.js';
import { MAX_DAYS_AHEAD } from './data.js';

/**
 * @param {{year:number, month:number, selected?:string, barberId?:string}} opts
 * @returns {string} HTML do calendário
 */
export function renderCalendar({ year, month, selected, barberId }) {
  const today = todayISO();
  const limit = new Date(); limit.setDate(limit.getDate() + MAX_DAYS_AHEAD);
  const limitISO = toISO(limit);
  const now = new Date();
  const canPrev = year > now.getFullYear() || month > now.getMonth();
  const canNext = toISO(new Date(year, month + 1, 1)) <= limitISO;

  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span class="day empty"></span>';
  for (let d = 1; d <= total; d++) {
    const iso = toISO(new Date(year, month, d));
    const disabled = iso < today || iso > limitISO || isDayClosed(iso, barberId);
    const cls = ['day', iso === today && 'today', iso === selected && 'selected'].filter(Boolean).join(' ');
    cells += `<button type="button" class="${cls}" data-date="${iso}" ${disabled ? 'disabled' : ''}
      aria-pressed="${iso === selected}" aria-label="${d} de ${MONTHS[month]}${disabled ? ' (indisponível)' : ''}">${d}</button>`;
  }

  return `
    <div class="calendar">
      <div class="calendar-head">
        <button type="button" class="icon-btn" data-cal="-1" ${canPrev ? '' : 'disabled'} aria-label="Mês anterior">‹</button>
        <strong>${MONTHS[month]} ${year}</strong>
        <button type="button" class="icon-btn" data-cal="1" ${canNext ? '' : 'disabled'} aria-label="Próximo mês">›</button>
      </div>
      <div class="week">${WEEKDAYS_SHORT.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="days">${cells}</div>
    </div>`;
}
