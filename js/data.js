/**
 * data.js — Dados iniciais (seed) da barbearia.
 * Usados apenas na primeira execução ou ao resetar o armazenamento.
 * Para conectar a um backend, substitua esses dados por chamadas à API em store.js.
 */
export const SEED = {
  services: [
    { id: 's1', name: 'Corte clássico', description: 'Máquina e tesoura com acabamento preciso.', icon: '✂', duration: 40, price: 45, active: true },
    { id: 's2', name: 'Barba completa', description: 'Toalha quente, desenho e finalização.', icon: '◆', duration: 30, price: 35, active: true },
    { id: 's3', name: 'Corte + barba', description: 'O combo completo para renovar o visual.', icon: '⚡', duration: 60, price: 70, active: true },
  ],
  barbers: [
    { id: 'b1', name: 'Rafael Martins', initials: 'RM', bio: 'Especialista em: Degradê, Freestyle, Barba, Bigode e Massagem.', rating: 5.0, color: 'green' },
  ],
  // Horário de funcionamento por dia da semana (0 = domingo)
  hours: [
    { open: false, start: '09:00', end: '13:00' },
    { open: true, start: '09:00', end: '19:00' },
    { open: true, start: '09:00', end: '19:00' },
    { open: true, start: '09:00', end: '19:00' },
    { open: true, start: '09:00', end: '20:00' },
    { open: true, start: '09:00', end: '20:00' },
    { open: true, start: '08:00', end: '16:00' },
  ],
  // Bloqueios: date (YYYY-MM-DD), start/end (null = dia todo), barberId (null = todos)
  blocks: [],
  bookings: [],
};

/** Credenciais de demonstração do painel (troque por autenticação real no backend). */
export const DEMO_ADMIN = { email: 'admin@cortecerto.com', password: 'corte123' };

/** Intervalo entre horários exibidos na agenda (minutos). */
export const SLOT_STEP = 20;

/** Quantos dias à frente o cliente pode agendar. */
export const MAX_DAYS_AHEAD = 60;
