/**
 * store.js — Estado da aplicação com persistência em localStorage.
 *
 * Toda leitura/escrita de dados passa por aqui. Para migrar para um backend,
 * basta reimplementar estas funções usando fetch() mantendo as mesmas assinaturas.
 */
import { SEED, SLOT_STEP } from './data.js';
import { toMin, toHHMM, todayISO, fromISO, uid, bookingCode } from './utils.js';

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

function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn(db));
}

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const getDB = () => db;
export const resetDB = () => { db = structuredClone(SEED); persist(); };

/*  Consultas  */
export const getService = (id) => db.services.find((s) => s.id === id);
export const getBarber = (id) => db.barbers.find((b) => b.id === id);
export const activeServices = () => db.services.filter((s) => s.active);
export const getBooking = (id) => db.bookings.find((b) => b.id === id);
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
 * Regras: dentro do expediente, sem conflito com outros agendamentos ativos do
 * mesmo barbeiro, sem conflito com bloqueios e não pode estar no passado.
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
    .filter((b) => b.date === date && b.barberId === barberId && b.status !== 'cancelado' && b.id !== ignoreBookingId)
    .map((b) => [toMin(b.time), toMin(b.time) + getService(b.serviceId).duration]);
  const blocked = db.blocks
    .filter((bl) => bl.date === date && (!bl.barberId || bl.barberId === barberId))
    .map(blockRange);

  const slots = [];
  for (let t = open; t + service.duration <= close; t += SLOT_STEP) {
    if (t <= nowMin) continue; // horários que já passaram hoje nem aparecem
    const end = t + service.duration;
    const free = !busy.some(([a, b]) => overlaps(t, end, a, b))
      && !blocked.some(([a, b]) => overlaps(t, end, a, b));
    slots.push({ time: toHHMM(t), free });
  }
  return slots;
}

/*  Mutações: agendamentos  */
export function createBooking({ serviceId, barberId, date, time, name, phone }) {
  // Revalida no momento da gravação para evitar dois clientes no mesmo horário
  const ok = getSlots(date, barberId, serviceId).some((s) => s.time === time && s.free);
  if (!ok) throw new Error('Esse horário acabou de ser ocupado. Escolha outro.');
  const booking = {
    id: uid('bk_'), code: bookingCode(), serviceId, barberId, date, time,
    name: name.trim(), phone, status: 'confirmado', createdAt: new Date().toISOString(),
  };
  db.bookings.push(booking);
  persist();
  return booking;
}
export function setBookingStatus(id, status) {
  const b = getBooking(id);
  if (b) { b.status = status; persist(); }
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
/** IDs dos agendamentos feitos neste navegador (área "Meus agendamentos"). */
const MINE = 'corte-certo:mine';
export const myBookingIds = () => JSON.parse(localStorage.getItem(MINE) || '[]');
export const rememberBooking = (id) => localStorage.setItem(MINE, JSON.stringify([...new Set([...myBookingIds(), id])]));
