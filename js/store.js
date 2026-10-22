/**
 * store.js — Estado da aplicação com integração ao backend e persistência no localStorage.
 */
import { SEED, SLOT_STEP } from './data.js';
import { toMin, toHHMM, todayISO, fromISO, uid } from './utils.js';

const KEY = 'corte-certo:v1';
const listeners = new Set();

/** Carrega o estado salvo ou cria um novo a partir do seed. */
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.services) return saved;
  } catch { /* JSON inválido: recomeça */ }
  return structuredClone(SEED);
}

let db = load();
window.debugDB = db;
function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn(db));
}

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const getDB = () => db;
export const resetDB = () => { db = structuredClone(SEED); persist(); };

/*  Consultas  */
export const getService = (id) => {if (!id) return null;const cleanId = String(id).toLowerCase();return db.services.find((s) => { const sId = String(s.id).toLowerCase();return sId === cleanId || sId === 's' + cleanId || cleanId === 's' + sId;});};
export const getBarber = (id) => db.barbers.find((b) => String(b.id) === String(id));
export const activeServices = () => db.services.filter((s) => s.active);
export const getBooking = (id) => db.bookings.find((b) => String(b.id) === String(id));
export const bookingsOn = (date) => db.bookings.filter((b) => b.date === date).sort((a, b) => a.time.localeCompare(b.time));

/** Faixa de bloqueio em minutos (dia todo = 0..1440). */
const blockRange = (bl) => [bl.start ? toMin(bl.start) : 0, bl.end ? toMin(bl.end) : 1440];
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

/** O dia está totalmente fechado (barbearia fechada ou bloqueio de dia inteiro)? */
export function isDayClosed(date, barberId = null) {
  const d = fromISO(date);
  if (!db.hours[d.getDay()].open) return true;
  return db.blocks.some((bl) => bl.date === date && !bl.start && (!bl.barberId || bl.barberId === barberId));
}

/**
 * Gera os horários de um dia para um barbeiro/serviço, marcando quais estão livres.
 */
export function getSlots(date, barberId, serviceId, ignoreBookingId = null) {
  const service = getService(serviceId);
  const day = db.hours[fromISO(date).getDay()];
  if (!service || !day.open || isDayClosed(date, barberId)) return [];

  const open = toMin(day.start);
  const close = toMin(day.end);
  const now = new Date();
  const nowMin = date === todayISO() ? now.getHours() * 60 + now.getMinutes() + 15 : -1;

  const busy = db.bookings
    .filter((b) => b.date === date && String(b.barberId) === String(barberId) && b.status !== 'cancelado' && b.id !== ignoreBookingId)
    .map((b) => [toMin(b.time), toMin(b.time) + (getService(b.serviceId)?.duration || 30)]);
  const blocked = db.blocks
    .filter((bl) => bl.date === date && (!bl.barberId || String(bl.barberId) === String(barberId)))
    .map(blockRange);

  const slots = [];
  for (let t = open; t + service.duration <= close; t += SLOT_STEP) {
    if (t <= nowMin) continue; 
    const end = t + service.duration;
    
    const free = !busy.some(([a, b]) => overlaps(t, end, a, b))
      && !blocked.some(([a, b]) => overlaps(t, end, a, b));
      
    slots.push({ time: toHHMM(t), free });
  }
  return slots;
}

export async function createBooking(bookingData) {
  try {
    const payload = {
      clientName: bookingData.clientName || bookingData.name,
      clientPhone: bookingData.clientPhone || bookingData.phone,
      serviceId: bookingData.serviceId,
      date: bookingData.date,
      time: bookingData.time,
    };

    console.log("DADOS AJUSTADOS PARA O BACKEND:", payload);

    const response = await fetch('http://localhost:3000/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao criar agendamento.');
    }

    rememberBooking(data.id);

    return {
      id: data.id,
      code: data.code || `#${String(data.id).slice(-4).toUpperCase()}`,
      serviceId: data.serviceId,
      barberId: bookingData.barberId || '1',
      date: data.date,
      time: data.time,
      name: data.clientName,
      phone: data.clientPhone,
      status: data.status,
    };
  } catch (err) {
    console.error('Erro no createBooking:', err);
    throw err;
  }
}

export async function setBookingStatus(id, status) {
  try {
    const response = await fetch(`http://localhost:3000/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error('Erro ao atualizar status do agendamento.');
    }

    const updated = await response.json();
    return updated;
  } catch (err) {
    console.error('Erro ao alterar status:', err);
    throw err;
  }
}

/*  Mutações: serviços  */
export function saveService(data) {
  if (data.id) Object.assign(getService(data.id), data);
  else db.services.push({ ...data, id: uid('s_'), active: true, icon: data.icon || '✂' });
  persist();
}
export function toggleService(id) { const s = getService(id); s.active = !s.active; persist(); }
export function removeService(id) {
  if (db.bookings.some((b) => b.serviceId === id && b.status !== 'cancelado' && b.date >= todayISO())) {
    throw new Error('Existem agendamentos futuros com esse serviço. Desative-o em vez de remover.');
  }
  db.services = db.services.filter((s) => s.id !== id);
  persist();
}

/*  Mutações: funcionamento e bloqueios  */
export function saveHours(hours) { db.hours = hours; persist(); }
export function addBlock(block) { db.blocks.push({ ...block, id: uid('bl_') }); persist(); }
export function removeBlock(id) { db.blocks = db.blocks.filter((b) => b.id !== id); persist(); }

/*  Sessão (cliente e admin)  */
const SESSION = 'corte-certo:session';
export const session = {
  get: () => JSON.parse(sessionStorage.getItem(SESSION) || '{}'),
  set(patch) { sessionStorage.setItem(SESSION, JSON.stringify({ ...this.get(), ...patch })); },
};

/*  Controle de IDs Locais ("Meus Agendamentos")  */
const MINE = 'corte-certo:mine';

export const myBookingIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(MINE) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(id => id !== null && id !== undefined && id !== '');
  } catch {
    return [];
  }
};

export const rememberBooking = (id) => {
  if (!id) return;
  const currentIds = myBookingIds();
  const updatedIds = [...new Set([...currentIds, String(id)])];
  localStorage.setItem(MINE, JSON.stringify(updatedIds));
};

export async function getMyAppointments() {
  try {
    const response = await fetch('http://localhost:3000/api/appointments');
    if (!response.ok) throw new Error('Erro ao buscar agendamentos');
    
    const allAppointments = await response.json();
    const mineIds = myBookingIds();

    return allAppointments
      .filter(app => mineIds.some(id => String(id) === String(app.id)))
      .map(app => ({
        ...app,
        code: app.code || `#${String(app.id).slice(-4).toUpperCase()}`,
        name: app.clientName || app.name,
        phone: app.clientPhone || app.phone
      }));
  } catch (err) {
    console.error('Erro ao carregar meus agendamentos:', err);
    return [];
  }
}
export async function syncBookingsWithBackend() {
  try {
    const response = await fetch('http://localhost:3000/api/appointments');
    if (response.ok) {
      const data = await response.json();
      
      db.bookings = data.map((app) => ({
        id: String(app.id),
        serviceId: String(app.serviceId),
        barberId: String(app.barberId || 'b1'),
        date: app.date,
        time: app.time,
        status: app.status || 'confirmado'
      }));
    }
  } catch (err) {
    console.error('Erro ao sincronizar bookings com backend:', err);
  }
}