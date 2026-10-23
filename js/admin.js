/**
 * admin.js — Painel do barbeiro: login, agenda do dia, serviços,
 * horários de funcionamento e bloqueios.
 */
import * as store from './store.js';
import { mount, toast, openModal, confirmDialog } from './ui.js';
import { DEMO_ADMIN } from './data.js';
import { esc, money, todayISO, formatLongDate, formatDayLabel, WEEKDAYS_ABBR, toMin } from './utils.js';

const TABS = [
  ['agenda', 'Agenda'], ['services', 'Serviços'], ['hours', 'Funcionamento'], ['blocks', 'Bloqueios'],
];
const STATUSES = ['pendente', 'confirmado', 'concluido', 'cancelado'];
const STATUS_LABEL = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' };

const state = { tab: 'agenda', agendaDate: todayISO(), hoursDraft: null };
const isLogged = () => !!store.session.get().admin;

/*  Login  */
function loginView() {
  return `
    <div class="admin-login">
      <form class="login-box" id="loginForm" novalidate>
        <p class="eyebrow">Acesso restrito</p>
        <h1 class="display">Painel do barbeiro</h1>
        <p>Entre para acompanhar a agenda e configurar a barbearia.</p>
        <div class="field"><label for="lEmail">E-mail</label><input id="lEmail" name="email" type="email" autocomplete="username" value="${DEMO_ADMIN.email}" /></div>
        <div class="field"><label for="lPass">Senha</label><input id="lPass" name="password" type="password" autocomplete="current-password" placeholder="••••••" /></div>
        <div id="loginError"></div>
        <button class="btn dark" style="width:100%">Entrar no painel →</button>
      </form>
    </div>`;
}

/*  Agenda  */
function agendaView() {
  const list = store.bookingsOn(state.agendaDate);
  const count = (s) => list.filter((b) => b.status === s).length;
  const activeMin = list.filter((b) => b.status !== 'cancelado').reduce((t, b) => t + (store.getService(b.serviceId)?.duration || 30), 0);
  const items = list.map((b) => {
    const s = store.getService(b.serviceId);
    const barberName = (store.getBarber(b.barberId)?.name || 'Principal').split(' ')[0];
    const cleanPhone = (b.phone || '').replace(/\D/g, '');
    const waBtn = b.whatsappConsent && cleanPhone
      ? `<a class="btn small" href="https://wa.me/55${cleanPhone}" target="_blank" rel="noopener">WhatsApp</a>`
      : '';
    return `
      <article class="agenda-item status-${b.status}">
        <time>${b.time}</time>
        <div><h4>${esc(b.name)}</h4><p class="subtle">${esc(s?.name ?? '—')} · ${esc(barberName)} · ${esc(b.phone)}</p></div>
        <div class="controls">
          <label class="sr-only" for="st-${b.id}">Status</label>
          <select id="st-${b.id}" data-status="${b.id}">${STATUSES.map((st) => `<option value="${st}" ${st === b.status ? 'selected' : ''}>${STATUS_LABEL[st]}</option>`).join('')}</select>
          ${waBtn}
        </div>
      </article>`;
  }).join('');
  return `
    <div class="section-head">
      <div><p class="eyebrow">${formatLongDate(state.agendaDate)}</p><h1 class="page-title">Agenda do dia</h1>
      <p class="subtle">${list.length} atendimento${list.length === 1 ? '' : 's'} · ${Math.floor(activeMin / 60)}h${String(activeMin % 60).padStart(2, '0')} ocupadas</p></div>
      <div class="day-picker">
        <button class="icon-btn" data-day="-1" aria-label="Dia anterior">‹</button>
        <input type="date" id="agendaDate" value="${state.agendaDate}" aria-label="Escolher dia" />
        <button class="icon-btn" data-day="1" aria-label="Próximo dia">›</button>
      </div>
    </div>
    <div class="stats stagger">
      <div class="stat"><span>Total</span><strong>${String(list.length).padStart(2, '0')}</strong></div>
      <div class="stat"><span>Pendentes</span><strong>${String(count('pendente')).padStart(2, '0')}</strong></div>
      <div class="stat"><span>Confirmados</span><strong>${String(count('confirmado')).padStart(2, '0')}</strong></div>
      <div class="stat"><span>Concluídos</span><strong>${String(count('concluido')).padStart(2, '0')}</strong></div>
    </div>
    <div class="agenda-list stagger">${items || '<div class="notice info">Nenhum atendimento para este dia.</div>'}</div>`;
}

/*  Serviços  */
function servicesView() {
  const rows = store.getDB().services.map((s) => `
    <tr>
      <td><strong>${esc(s.icon)} ${esc(s.name)}</strong></td><td>${s.duration} min</td><td>${money(s.price)}</td>
      <td><button class="pill ${s.active ? 'price' : ''}" data-toggle-service="${s.id}">${s.active ? 'Ativo' : 'Inativo'}</button></td>
      <td><button class="btn small" data-edit-service="${s.id}">Editar</button><button class="btn small danger" data-remove-service="${s.id}">Remover</button></td>
    </tr>`).join('');
  return `
    <div class="section-head"><div><p class="eyebrow">Catálogo</p><h1 class="page-title">Serviços</h1></div>
      <button class="btn primary" data-edit-service="">＋ Novo serviço</button></div>
    <div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function serviceModal(id) {
  const s = id ? store.getService(id) : { name: '', description: '', icon: '✂', duration: 40, price: 50 };
  openModal(`
    <span class="eyebrow">Catálogo</span><h2>${id ? 'Editar serviço' : 'Novo serviço'}</h2>
    <form id="serviceForm" novalidate>
      <div class="field"><label for="sName">Nome do serviço</label><input id="sName" name="name" value="${esc(s.name)}" required /></div>
      <div class="field"><label for="sDesc">Descrição</label><input id="sDesc" name="description" value="${esc(s.description)}" /></div>
      <div class="row-2">
        <div class="field"><label for="sDur">Duração</label><select id="sDur" name="duration">${[20, 30, 40, 50, 60, 80, 90, 120].map((d) => `<option value="${d}" ${d === s.duration ? 'selected' : ''}>${d} minutos</option>`).join('')}</select></div>
        <div class="field"><label for="sPrice">Preço (R$)</label><input id="sPrice" name="price" type="number" min="1" step="0.01" inputmode="decimal" value="${s.price}" /></div>
      </div>
      <div class="field"><label for="sIcon">Ícone</label><select id="sIcon" name="icon">${['✂', '◆', '⚡', '★', '☻', '✦'].map((i) => `<option ${i === s.icon ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
      <div class="actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">Salvar serviço</button></div>
    </form>`, (root, close) => {
    root.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = f.get('name').trim();
      const price = Number(f.get('price'));
      const nameInput = root.querySelector('#sName');
      nameInput.classList.toggle('error', !name);
      root.querySelector('#sPrice').classList.toggle('error', !(price > 0));
      if (!name || !(price > 0)) return toast('Preencha nome e preço válidos.', 'error');
      try {
        await store.saveService({ ...(id && { id }), name, description: f.get('description').trim(), icon: f.get('icon'), duration: Number(f.get('duration')), price });
        close(); toast('Serviço salvo com sucesso.'); render();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });
}

/*  Funcionamento  */
function hoursView() {
  state.hoursDraft ??= structuredClone(store.getDB().hours);
  const rows = state.hoursDraft.map((h, i) => `
    <div class="hour-row ${h.open ? '' : 'off'}">
      <strong>${WEEKDAYS_ABBR[i]}</strong>
      <button type="button" class="switch" role="switch" aria-checked="${h.open}" aria-label="Abrir ${WEEKDAYS_ABBR[i]}" data-switch="${i}"></button>
      <div class="range">
        <input type="time" value="${h.start}" data-hour="${i}" data-key="start" aria-label="Abertura" /> até
        <input type="time" value="${h.end}" data-hour="${i}" data-key="end" aria-label="Fechamento" />
        ${h.open ? '' : '<span class="pill">Fechado</span>'}
      </div>
    </div>`).join('');
  return `
    <div class="section-head"><div><p class="eyebrow">Configuração semanal</p><h1 class="page-title">Horários de funcionamento</h1>
      <p class="subtle">Defina os períodos disponíveis em cada dia. O cliente só vê horários dentro deles.</p></div></div>
    <div class="hours stagger">${rows}</div>
    <div class="actions"><button class="btn" data-reset-hours>Desfazer</button><button class="btn primary" data-save-hours>Salvar alterações</button></div>`;
}

/*  Bloqueios  */
function blocksView() {
  const today = todayISO();
  const list = [...store.getDB().blocks].filter((b) => b.date >= today).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  const items = list.map((b) => `
    <div class="block-item">
      <div><strong>${formatDayLabel(b.date)} · ${b.start ? `${b.start}–${b.end}` : 'Dia todo'}</strong>
      <span class="subtle">${esc(b.reason || 'Indisponível')} · ${b.barberId ? esc(store.getBarber(b.barberId)?.name || 'Todos') : 'Todos'}</span></div>
      <button class="btn small danger" data-remove-block="${b.id}">Remover</button>
    </div>`).join('');
  return `
    <div class="section-head"><div><p class="eyebrow">Indisponibilidades</p><h1 class="page-title">Bloqueio de horários</h1></div>
      <button class="btn primary" data-new-block>＋ Novo bloqueio</button></div>
    <div class="block-list stagger">${items || '<div class="notice info">Nenhum bloqueio futuro cadastrado.</div>'}</div>`;
}

function blockModal() {
  openModal(`
    <span class="eyebrow">Agenda</span><h2>Novo bloqueio</h2>
    <form id="blockForm" novalidate>
      <div class="field"><label for="bDate">Data</label><input id="bDate" name="date" type="date" min="${todayISO()}" value="${todayISO()}" /></div>
      <label class="check" style="margin-bottom:16px"><input type="checkbox" name="allDay" id="bAllDay" /> Dia todo</label>
      <div class="row-2" id="bRange">
        <div class="field"><label for="bStart">Início</label><input id="bStart" name="start" type="time" value="12:00" /></div>
        <div class="field"><label for="bEnd">Fim</label><input id="bEnd" name="end" type="time" value="13:00" /></div>
      </div>
      <div class="field"><label for="bBarber">Profissional</label><select id="bBarber" name="barberId"><option value="">Todos</option>${store.getDB().barbers.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="bReason">Motivo</label><input id="bReason" name="reason" placeholder="Ex.: Intervalo de almoço" /></div>
      <div class="actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">Criar bloqueio</button></div>
    </form>`, (root, close) => {
    root.querySelector('#bAllDay').onchange = (e) => { root.querySelector('#bRange').hidden = e.target.checked; };
    root.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const allDay = f.get('allDay') === 'on';
      if (!f.get('date')) return toast('Escolha uma data.', 'error');
      if (!allDay && toMin(f.get('end')) <= toMin(f.get('start'))) return toast('O fim deve ser depois do início.', 'error');
      try {
        await store.addBlock({ date: f.get('date'), start: allDay ? null : f.get('start'), end: allDay ? null : f.get('end'), barberId: f.get('barberId') || null, reason: f.get('reason').trim() });
        close(); toast('Bloqueio criado com sucesso.'); render();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });
}

/*  Renderização  */
export async function render(direction = 'forward') {
  if (!isLogged()) return mount(`<div class="wrap wide">${loginView()}</div>`, direction);
  
  if (typeof store.syncBookingsWithBackend === 'function') {
    try {
      await store.syncBookingsWithBackend();
    } catch (err) {
      console.error('Erro ao sincronizar agendamentos no admin:', err);
    }
  }

  const views = { agenda: agendaView, services: servicesView, hours: hoursView, blocks: blocksView };
  mount(`
    <div class="wrap wide">
      <nav class="admin-nav" aria-label="Painel">
        ${TABS.map(([k, l]) => `<button data-tab="${k}" class="${state.tab === k ? 'active' : ''}">${l}</button>`).join('')}
        <button class="logout" data-logout>Sair</button>
      </nav>
      ${views[state.tab]()}
    </div>`, direction);
}

export function bindAdminEvents(root) {
  const on = () => document.body.classList.contains('mode-admin');

  root.addEventListener('submit', (e) => {
    if (!on() || e.target.id !== 'loginForm') return;
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get('email').trim().toLowerCase() === DEMO_ADMIN.email && f.get('password') === DEMO_ADMIN.password) {
      store.session.set({ admin: true }); toast('Login realizado com sucesso.'); render();
    } else {
      document.getElementById('loginError').innerHTML = '<div class="notice error">! E-mail ou senha incorretos.</div>';
    }
  });

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !on()) return;
    const d = t.dataset;
    if (d.tab) { const order = TABS.map((x) => x[0]); const dir = order.indexOf(d.tab) < order.indexOf(state.tab) ? 'back' : 'forward'; state.tab = d.tab; state.hoursDraft = null; return render(dir); }
    if ('logout' in d) { store.session.set({ admin: false }); toast('Sessão encerrada.'); return render('back'); }
    if (d.day) { const dt = new Date(state.agendaDate + 'T12:00'); dt.setDate(dt.getDate() + Number(d.day)); state.agendaDate = dt.toISOString().slice(0, 10); return render(Number(d.day) < 0 ? 'back' : 'forward'); }
    if (d.editService !== undefined) return serviceModal(d.editService || null);
    if (d.toggleService) {
      try { await store.toggleService(d.toggleService); return render(); } catch (err) { return toast(err.message, 'error'); }
    }
    if (d.removeService) {
      const s = store.getService(d.removeService);
      if (await confirmDialog({ title: 'Remover serviço?', text: `"${esc(s.name)}" deixará de existir no catálogo.`, confirm: 'Remover' })) {
        try { await store.removeService(s.id); toast('Serviço removido.'); render(); } catch (err) { toast(err.message, 'error'); }
      }
      return;
    }
    if (d.switch) { const h = state.hoursDraft[d.switch]; h.open = !h.open; return render(); }
    if ('resetHours' in d) { state.hoursDraft = null; return render(); }
    if ('saveHours' in d) {
      const bad = state.hoursDraft.findIndex((h) => h.open && toMin(h.end) <= toMin(h.start));
      if (bad >= 0) return toast(`${WEEKDAYS_ABBR[bad]}: fechamento deve ser após a abertura.`, 'error');
      try {
        await store.saveHours(state.hoursDraft); state.hoursDraft = null; toast('Alterações salvas com sucesso.'); return render();
      } catch (err) {
        return toast(err.message, 'error');
      }
    }
    if ('newBlock' in d) return blockModal();
    if (d.removeBlock) {
      try { await store.removeBlock(d.removeBlock); toast('Bloqueio removido.'); return render(); } catch (err) { return toast(err.message, 'error'); }
    }
  });

  root.addEventListener('change', async (e) => {
    if (!on()) return;
    const el = e.target;
    if (el.dataset.status) {
      try {
        await store.setBookingStatus(el.dataset.status, el.value);
        toast(`Status: ${STATUS_LABEL[el.value]}.`);
      } catch (err) {
        toast(err.message, 'error');
      }
      render();
    }
    if (el.id === 'agendaDate' && el.value) { state.agendaDate = el.value; render(); }
    if (el.dataset.hour) state.hoursDraft[el.dataset.hour][el.dataset.key] = el.value;
  });
}
