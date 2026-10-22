/**
 * customer.js — Fluxo do cliente em 5 etapas:
 * 1 Serviço → 2 Barbeiro → 3 Data/hora → 4 Dados → 5 Confirmação
 * + área "Meus agendamentos" (consultar e cancelar).
 */
import * as store from './store.js';
import { mount, toast, confirmDialog } from './ui.js';
import { renderCalendar } from './calendar.js';
import { esc, money, maskPhone, isValidPhone, formatDayLabel, formatDateBR, formatLongDate, todayISO, toISO } from './utils.js';
import { MAX_DAYS_AHEAD } from './data.js';

const STEP_LABELS = ['Serviço', 'Barbeiro', 'Data e hora', 'Seus dados', 'Confirmação'];

/** Estado do rascunho de agendamento (mantido na sessão para sobreviver a um F5). */
const draft = {
  step: 1, serviceId: null, barberId: null, date: null, time: null, name: '', phone: '', consent: true,
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(), lastBookingId: null,
  ...store.session.get().draft,
};
const saveDraft = () => store.session.set({ draft });

function progress(step) {
  return `
    <div class="progress-label"><span>Etapa ${step} de 5</span><span>${STEP_LABELS[step - 1]}</span></div>
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${step}">
      ${STEP_LABELS.map((_, i) => `<span class="step ${i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}"></span>`).join('')}
    </div>`;
}

function header(eyebrow, title, lede) {
  return `<p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1><p class="lede">${lede}</p>`;
}

/** Vai para uma etapa com animação na direção correta. */
function goStep(step) {
  const dir = step < draft.step ? 'back' : 'forward';
  draft.step = step; saveDraft();
  render(dir);
}

/*  Serviços  */
function stepServices() {
  const cards = store.activeServices().map((s) => `
    <button type="button" class="card select-card ${draft.serviceId === s.id ? 'selected' : ''}" data-service="${s.id}" aria-pressed="${draft.serviceId === s.id}">
      <div class="card-body">
        <div class="service-top">
          <div><h3 class="service-name">${esc(s.name)}</h3><p class="subtle">${esc(s.description || '')}</p></div>
          <span class="service-icon" aria-hidden="true">${esc(s.icon)}</span>
        </div>
        <div class="meta"><span class="pill price">${money(s.price)}</span><span class="pill">◷ ${s.duration} min</span></div>
      </div>
    </button>`).join('');
  return `
    ${progress(1)}
    ${header('Escolha seu corte', 'Qual é a sua vibe hoje?', 'Selecione um serviço para começar seu agendamento.')}
    <div class="grid cols-3 stagger">${cards || '<p>Nenhum serviço disponível no momento.</p>'}</div>
    <div class="actions">
      <button class="btn" data-action="mine">Meus agendamentos</button>
      <button class="btn secondary" data-action="plans">⭐ Ver Planos Mensais</button>
      <button class="btn primary" data-next ${draft.serviceId ? '' : 'disabled'}>Continuar →</button>
    </div>`;
}

/*  Barbeiros  */
function stepBarbers() {
  const cards = store.getDB().barbers.map((b) => `
    <button type="button" class="card select-card ${draft.barberId === b.id ? 'selected' : ''}" data-barber="${b.id}" aria-pressed="${draft.barberId === b.id}">
      <div class="barber-photo bg-${b.color}"><span>${b.initials}</span></div>
      <div class="card-body">
        <h3 class="service-name">${esc(b.name)}</h3><p class="subtle">${esc(b.bio)}</p>
        <div class="meta"><span class="pill">★ ${b.rating.toFixed(1).replace('.', ',')}</span><span class="pill price">Disponível</span></div>
      </div>
    </button>`).join('');
  return `
    ${progress(2)}
    ${header('Quem manda na lâmina?', 'Escolha seu barbeiro', 'Todos dominam o corte. Cada um tem sua assinatura.')}
    <div class="grid cols-3 stagger">${cards}</div>
    <div class="actions">
      <button class="btn" data-prev>← Voltar</button>
      <button class="btn primary" data-next ${draft.barberId ? '' : 'disabled'}>Continuar →</button>
    </div>`;
}

/*  Data e hora  */
function timesPanel() {
  const service = store.getService(draft.serviceId);
  const barber = store.getBarber(draft.barberId);
  if (!draft.date) {
    return `<div class="times"><h3>Escolha um dia</h3><p class="subtle">${esc(barber.name)} · ${esc(service.name)}</p>
      <div class="empty-state">Selecione uma data no calendário para ver os horários.</div></div>`;
  }
  const slots = store.getSlots(draft.date, draft.barberId, draft.serviceId);
  const freeCount = slots.filter((s) => s.free).length;
  const grid = slots.map((s) => `
    <button type="button" class="time ${draft.time === s.time ? 'selected' : ''}" data-time="${s.time}" ${s.free ? '' : 'disabled'}
      aria-pressed="${draft.time === s.time}">${s.time}</button>`).join('');
  return `
    <div class="times">
      <h3>${formatDayLabel(draft.date)}</h3>
      <p class="subtle">${esc(barber.name)} · ${esc(service.name)} · ${freeCount} horário${freeCount === 1 ? '' : 's'} livre${freeCount === 1 ? '' : 's'}</p>
      ${freeCount ? `<div class="time-grid stagger">${grid}</div>` : '<div class="empty-state">Sem horários livres neste dia. Tente outra data.</div>'}
      <div class="legend"><span><i style="background:var(--green)"></i>Disponível</span><span><i style="background:var(--lilac)"></i>Selecionado</span><span><i style="background:#3b3b3b"></i>Ocupado</span></div>
    </div>`;
}

async function stepDateTime() {
  await store.syncBookingsWithBackend();
  return `
    ${progress(3)}
    ${header('Reserve seu momento', 'Quando fica melhor?', `Escolha um dia e um dos horários disponíveis. Agendamentos em até ${MAX_DAYS_AHEAD} dias.`)}
    <div class="booking-layout">
      <div id="calSlot">${renderCalendar({ year: draft.calYear, month: draft.calMonth, selected: draft.date, barberId: draft.barberId })}</div>
      <div id="timesSlot">${timesPanel()}</div>
    </div>
    <div class="actions">
      <button class="btn" data-prev>← Voltar</button>
      <button class="btn primary" data-next ${draft.date && draft.time ? '' : 'disabled'}>Continuar →</button>
    </div>`;
}

/** Re-renderiza só calendário/horários. */
async function refreshDateTime() {
  await store.syncBookingsWithBackend();
  document.getElementById('calSlot').innerHTML = renderCalendar({ year: draft.calYear, month: draft.calMonth, selected: draft.date, barberId: draft.barberId });
  document.getElementById('timesSlot').innerHTML = timesPanel();
  document.querySelector('[data-next]').disabled = !(draft.date && draft.time);
  saveDraft();
}

/** Seleciona automaticamente o primeiro dia útil com horários livres. */
function autoPickDate() {
  if (draft.date) return;
  const d = new Date();
  for (let i = 0; i <= MAX_DAYS_AHEAD; i++) {
    const iso = toISO(d);
    if (store.getSlots(iso, draft.barberId, draft.serviceId).some((s) => s.free)) {
      draft.date = iso; draft.calYear = d.getFullYear(); draft.calMonth = d.getMonth(); return;
    }
    d.setDate(d.getDate() + 1);
  }
}

/* Dados  */
function stepForm() {
  const s = store.getService(draft.serviceId);
  return `
    ${progress(4)}
    ${header('Falta pouco', 'Como falamos com você?', `${esc(s.name)} · ${formatDayLabel(draft.date)} às ${draft.time} · ${money(s.price)}`)}
    <form class="form-card" id="bookingForm" novalidate>
      <div class="field">
        <label for="fName">Nome completo</label>
        <input id="fName" name="name" autocomplete="name" value="${esc(draft.name)}" placeholder="Ex.: João da Silva" />
      </div>
      <div class="field">
        <label for="fPhone">WhatsApp</label>
        <input id="fPhone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" value="${esc(draft.phone)}" placeholder="(11) 98765-4321" />
      </div>
      <label class="check"><input type="checkbox" name="consent" ${draft.consent ? 'checked' : ''} /> Aceito receber a confirmação deste agendamento pelo WhatsApp.</label>
      <div id="formError"></div>
      <div class="actions">
        <button type="button" class="btn" data-prev>← Voltar</button>
        <button type="submit" class="btn primary">Confirmar agendamento →</button>
      </div>
    </form>`;
}

/** Valida um campo e mostra/remove a mensagem de erro abaixo dele. */
function validateField(input) {
  const rules = {
    name: (v) => (v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 ? '' : 'Informe nome e sobrenome.'),
    phone: (v) => (isValidPhone(v) ? '' : 'Digite um telefone válido com DDD.'),
  };
  const msg = rules[input.name]?.(input.value) ?? '';
  input.classList.toggle('error', !!msg);
  input.setAttribute('aria-invalid', !!msg);
  input.parentElement.querySelector('.helper-error')?.remove();
  if (msg) input.insertAdjacentHTML('afterend', `<span class="helper-error">${msg}</span>`);
  return !msg;
}

/* Confirmação  */
function summaryRows(b) {
  const s = store.getService(b.serviceId);
  return `
    <div class="summary">
      <div class="summary-row"><span>Serviço</span><strong>${esc(s ? s.name : 'Corte/Serviço')}</strong></div>
      <div class="summary-row"><span>Barbeiro</span><strong>${esc(store.getBarber(b.barberId)?.name || 'Principal')}</strong></div>
      <div class="summary-row"><span>Data</span><strong>${formatDateBR(b.date)}</strong></div>
      <div class="summary-row"><span>Horário</span><strong>${b.time}</strong></div>
      <div class="summary-row"><span>Duração</span><strong>${s ? s.duration : '30'} minutos</strong></div>
      <div class="summary-row"><span>Total</span><strong>${money(s && s.price ? s.price : 0)}</strong></div>
    </div>`;
}

function stepSuccess() {
  return `
    ${progress(5)}
    <div class="success-hero">
      <div class="success-icon">✓</div>
      <p class="eyebrow">Tudo certo</p>
      <h1 class="page-title">Seu horário está confirmado!</h1>
      <p class="lede">Agora é só chegar 5 minutos antes.</p>
    </div>
    <div class="actions">
      <button class="btn" data-action="new">Novo agendamento</button>
      <button class="btn dark" data-action="mine">Ver meus agendamentos →</button>
    </div>`;
}

/*  Meus agendamentos  */
async function myBookingsView() {
  const list = await store.getMyAppointments();
  const today = todayISO();
  const tickets = list.map((b) => {
    const cancelled = b.status === 'cancelado';
    const past = b.date < today;
    return `
      <article class="card ticket ${cancelled ? 'cancelled' : ''}">
        <div class="ticket-head"><h2>${formatLongDate(b.date)}</h2><span class="code">${b.code}</span></div>
        <div class="ticket-body">
          <span class="pill ${cancelled ? 'pink' : past ? '' : 'price'}">${cancelled ? 'Cancelado' : past ? 'Realizado' : b.status[0].toUpperCase() + b.status.slice(1)}</span>
          ${summaryRows(b)}
          ${!cancelled && !past ? `<div class="actions"><span></span><button class="btn danger" data-cancel="${b.id}">Cancelar agendamento</button></div>` : ''}
        </div>
      </article>`;
  }).join('');
  return `
    ${header('Área do cliente', 'Meus agendamentos', 'Agendamentos feitos neste dispositivo.')}
    <div class="stagger">${tickets || '<div class="notice info">Você ainda não tem agendamentos. Bora marcar um corte?</div>'}</div>
    <div class="actions"><button class="btn" data-action="new">← Início</button><button class="btn primary" data-action="new">Novo agendamento →</button></div>`;
}

/*  Renderização  + eventos  */
let view = 'flow'; // 'flow' | 'mine' | 'plans'

export async function render(direction = 'forward') {
  if (view === 'mine') { 
    const content = await myBookingsView();
    mount(`<div class="wrap">${content}</div>`, direction); 
    return; 
  }
  if (view === 'plans') { mount(`<div class="wrap">${plansScreen()}</div>`, direction); return; }
  if (draft.step === 3) autoPickDate();
  
  const steps = { 1: stepServices, 2: stepBarbers, 3: stepDateTime, 4: stepForm, 5: stepSuccess };
  const content = draft.step === 3 ? await steps[3]() : steps[draft.step]();
  mount(`<div class="wrap">${content}</div>`, direction);
}

export function resetFlow() {
  Object.assign(draft, { step: 1, serviceId: null, barberId: null, date: null, time: null, lastBookingId: null });
  view = 'flow'; saveDraft(); render('back');
}

/* Máscara para CPF */
function maskCPF(value) {
  return value
    .replace(/\D/g, '') 
    .slice(0, 11) 
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/* Delegação de eventos */
export function bindCustomerEvents(root) {
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !document.body.classList.contains('mode-customer')) return;

    if (t.dataset.service) { draft.serviceId = t.dataset.service; draft.time = null; saveDraft(); return goStep(2); }
    if (t.dataset.barber) { draft.barberId = t.dataset.barber; draft.date = null; draft.time = null; saveDraft(); return goStep(3); }
    if (t.dataset.cal) {
      const d = new Date(draft.calYear, draft.calMonth + Number(t.dataset.cal), 1);
      draft.calYear = d.getFullYear(); draft.calMonth = d.getMonth(); return refreshDateTime();
    }
    if (t.dataset.date) { draft.date = t.dataset.date; draft.time = null; return refreshDateTime(); }
    if (t.dataset.time) { draft.time = t.dataset.time; return refreshDateTime(); }
    if ('next' in t.dataset) return goStep(draft.step + 1);
    if ('prev' in t.dataset) return goStep(draft.step - 1);
    if (t.dataset.action === 'new') return resetFlow();
    if (t.dataset.action === 'mine') { view = 'mine'; return render(); }
    if (t.dataset.action === 'plans') { view = 'plans'; return render(); }
    if (t.dataset.action === 'services') { view = 'flow'; draft.step = 1; return render('back'); }
    
    if (t.dataset.cancel) {
      const ok = await confirmDialog({
        title: 'Cancelar seu horário?',
        text: `Esta ação vai cancelar este agendamento.`,
        confirm: 'Sim, cancelar',
      });
      if (ok) {
        await store.setBookingStatus(t.dataset.cancel, 'cancelado');
        toast('Agendamento cancelado.');
        render();
      }
    }
  });

  root.addEventListener('input', (e) => {
    if (e.target.id === 'fPhone' || e.target.id === 'pPhone') {
      e.target.value = maskPhone(e.target.value);
    }
    if (e.target.id === 'pCpf') {
      e.target.value = maskCPF(e.target.value);
    }
    if (e.target.closest('#bookingForm')) {
      draft[e.target.name] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; saveDraft();
      if (e.target.classList.contains('error')) validateField(e.target);
    }
  });
  
  root.addEventListener('focusout', (e) => { if (e.target.closest?.('#bookingForm') && e.target.value) validateField(e.target); });

  root.addEventListener('submit', async (e) => {
    if (e.target.id === 'planSubscriptionForm') {
      e.preventDefault();
      toast('Assinatura realizada com sucesso!');
      setTimeout(() => resetFlow(), 1200);
      return;
    }

    if (e.target.id !== 'bookingForm') return;
    e.preventDefault();
    const form = e.target;
    const valid = [form.elements.namedItem('name'), form.elements.namedItem('phone')].map(validateField).every(Boolean);
    if (!valid) { form.querySelector('.error')?.focus(); return; }
    
    try {
      const booking = await store.createBooking({ 
        ...draft, 
        name: form.elements.namedItem('name').value, 
        phone: form.elements.namedItem('phone').value 
      });
      draft.lastBookingId = booking.id;
      toast(`Agendamento ${booking.code} criado!`);
      goStep(5);
    } catch (err) {
      document.getElementById('formError').innerHTML = `<div class="notice error">! ${err.message}</div>`;
      setTimeout(() => goStep(3), 1600);
      draft.time = null;
    }
  });
}

export async function showCustomer() { 
  view = 'flow'; 
  await store.syncBookingsWithBackend();
  render(); 
};

/*  Tela: Planos Mensais  */
export function plansScreen() {
  return `
    <span class="eyebrow">Economize todo mês</span>
    <h1 class="page-title">PLANOS MENSAIS</h1>
    <p class="lede">Corte o cabelo e faça a barba quantas vezes quiser com valor fixo no mês.</p>

    <div class="grid cols-3 stagger" style="margin-bottom: 30px;">
      <div class="card" style="padding: 20px; background: var(--paper); border: var(--line); box-shadow: var(--shadow);">
        <span class="pill" style="background: var(--lilac); font-weight: 900;">BÁSICO</span>
        <h2 style="font-family: 'Archivo Black'; font-size: 28px; margin: 10px 0 5px;">Cabelo Livre</h2>
        <p class="subtle">Cortes ilimitados no mês todo.</p>
        <div style="font-size: 32px; font-weight: 900; margin: 15px 0; color: var(--ink);">
          R$ 99,90 <small style="font-size: 14px; color: var(--muted);">/mês</small>
        </div>
        <ul style="padding-left: 18px; margin-bottom: 20px; font-size: 14px; font-weight: 600;">
          <li>Cortes de cabelo ilimitados</li>
          <li>10% de desconto em produtos</li>
          <li>Agendamento prioritário</li>
        </ul>
        <button type="button" class="btn primary" style="width: 100%;" onclick="document.getElementById('planForm').scrollIntoView({behavior: 'smooth'})">Assinar Básico</button>
      </div>

      <div class="card" style="padding: 20px; background: var(--paper); border: 4px solid var(--ink); box-shadow: 8px 8px 0 var(--green);">
        <span class="pill" style="background: var(--green); font-weight: 900;">POPULAR</span>
        <h2 style="font-family: 'Archivo Black'; font-size: 28px; margin: 10px 0 5px;">VIP Combo</h2>
        <p class="subtle">Cabelo e barba ilimitados durante todo o mês.</p>
        <div style="font-size: 32px; font-weight: 900; margin: 15px 0; color: var(--ink);">
          R$ 149,90 <small style="font-size: 14px; color: var(--muted);">/mês</small>
        </div>
        <ul style="padding-left: 18px; margin-bottom: 20px; font-size: 14px; font-weight: 600;">
          <li>Cortes e Barbas ilimitados</li>
          <li>Bebida cortesia a cada visita</li>
          <li>15% de desconto em produtos</li>
        </ul>
        <button type="button" class="btn primary" style="width: 100%; background: var(--green);" onclick="document.getElementById('planForm').scrollIntoView({behavior: 'smooth'})">Assinar VIP</button>
      </div>
    </div>

    <div id="planForm" class="form-card" style="max-width: 600px; margin: 0 auto; padding: 25px; background: var(--paper); border: var(--line); box-shadow: var(--shadow);">
      <span class="eyebrow">Cadastro da Assinatura</span>
      <h2 style="font-family: 'Archivo Black'; font-size: 24px; margin-top: 5px;">Seus Dados</h2>
      
      <form id="planSubscriptionForm">
        <div class="field" style="margin-top: 15px;">
          <label>Plano Escolhido</label>
          <select id="pPlan" required style="width: 100%; height: 48px; border: 2px solid var(--ink); padding: 0 10px; font-weight: 700;">
            <option value="vip">VIP Combo — R$ 149,90/mês</option>
            <option value="basico">Básico (Cabelo) — R$ 99,90/mês</option>
          </select>
        </div>

        <div class="field">
          <label for="pName">Nome Completo</label>
          <input id="pName" type="text" placeholder="Ex.: João da Silva" maxlength="50" required style="width: 100%; height: 48px; border: 2px solid var(--ink); padding: 0 10px;">
        </div>

        <div class="field">
          <label for="pPhone">WhatsApp</label>
          <input id="pPhone" type="tel" inputmode="numeric" placeholder="(81) 99999-9999" maxlength="15" required style="width: 100%; height: 48px; border: 2px solid var(--ink); padding: 0 10px;">
        </div>

        <div class="field">
          <label for="pCpf">CPF</label>
          <input id="pCpf" type="text" inputmode="numeric" placeholder="000.000.000-00" maxlength="14" required style="width: 100%; height: 48px; border: 2px solid var(--ink); padding: 0 10px;">
        </div>

        <div class="field">
          <label for="pPayment">Forma de Pagamento</label>
          <select id="pPayment" required style="width: 100%; height: 48px; border: 2px solid var(--ink); padding: 0 10px; font-weight: 700;">
            <option value="pix">Pix (Recorrência Mensal)</option>
            <option value="card">Cartão de Crédito</option>
            <option value="boleto">Boleto Bancário</option>
          </select>
        </div>

        <div class="actions" style="margin-top: 20px;">
          <button type="button" class="btn" data-action="services">← Voltar</button>
          <button type="submit" class="btn primary">Finalizar Assinatura →</button>
        </div>
      </form>
    </div>
  `;
}