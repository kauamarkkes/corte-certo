const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const dbFilePath = process.env.DB_PATH || path.join(__dirname, 'database.json');

const STATUSES = ['pendente', 'confirmado', 'concluido', 'cancelado'];

const isPositiveNumber = (value) => value !== '' && value !== null && Number.isFinite(Number(value)) && Number(value) > 0;

const readDb = () => {
    try {
        const data = fs.readFileSync(dbFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return { services: [], appointments: [], barber: [] };
    }
};

const writeDb = (data) => {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
};

app.get('/api/services', (req, res) => {
    const db = readDb();
    res.json(db.services || []);
});


app.post('/api/services', (req, res) => {
    const { name, description, price, duration, icon } = req.body;
    if (typeof name !== 'string' || !name.trim() || !isPositiveNumber(price) || !isPositiveNumber(duration)) {
        return res.status(400).json({ error: 'Informe nome, preço e duração válidos (maiores que zero).' });
    }

    const db = readDb();
    if (!db.services) db.services = [];

    const newService = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        price: Number(price),
        duration: Number(duration),
        icon: icon || '✂',
        active: true
    };

    db.services.push(newService);
    writeDb(db);
    res.status(201).json(newService);
});

app.put('/api/services/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, price, duration, active, icon } = req.body;
    
    const db = readDb();
    if (!db.services) db.services = [];

    const service = db.services.find(s => String(s.id) === String(id));
    
    if (!service) {
        return res.status(404).json({ error: 'Serviço não encontrado.' });
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
        return res.status(400).json({ error: 'O nome do serviço não pode ser vazio.' });
    }
    if (price !== undefined && !isPositiveNumber(price)) {
        return res.status(400).json({ error: 'O preço deve ser um número maior que zero.' });
    }
    if (duration !== undefined && !isPositiveNumber(duration)) {
        return res.status(400).json({ error: 'A duração deve ser um número maior que zero.' });
    }
    if (active !== undefined && typeof active !== 'boolean') {
        return res.status(400).json({ error: 'O campo active deve ser booleano.' });
    }

    if (name) service.name = name.trim();
    if (description !== undefined) service.description = typeof description === 'string' ? description.trim() : '';
    if (price !== undefined) service.price = Number(price);
    if (duration !== undefined) service.duration = Number(duration);
    if (active !== undefined) service.active = active;
    if (icon) service.icon = icon;

    writeDb(db);
    res.json(service);
});

app.delete('/api/services/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    if (!db.services) db.services = [];
    
    const index = db.services.findIndex(s => String(s.id) === String(id));
    if (index === -1) {
        return res.status(404).json({ error: 'Serviço não encontrado.' });
    }

    const inUse = (db.appointments || []).some(a => String(a.serviceId) === String(id) && a.status !== 'cancelado');
    if (inUse) {
        return res.status(409).json({ error: 'Existem agendamentos ativos com esse serviço. Desative-o em vez de remover.' });
    }

    db.services.splice(index, 1);
    writeDb(db);
    res.json({ message: 'Serviço removido com sucesso.' });
});

app.get('/api/barber', (req, res) => {
    const db = readDb();
    res.json(db.barber || []);
});


app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = 'admin'; 

    if (password === adminPassword) {
        return res.json({ success: true, token: 'fake-jwt-token-admin' });
    }
    res.status(401).json({ error: 'Senha incorreta.' });
});


app.get('/api/appointments', (req, res) => {
    const db = readDb();
    res.json(db.appointments || []);
});


const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const isValidTime = (str) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(str));

const parseLocalDate = (str) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str));
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const d = new Date(year, month - 1, day);
    return (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) ? d : null;
};

const hasConflict = (db, date, startMin, endMin, ignoreId = null) => db.appointments.some(appt => {
    if (appt.date !== date || appt.status === 'cancelado' || appt.id === ignoreId) return false;
    const existingService = db.services.find(s => String(s.id) === String(appt.serviceId));
    const existingStart = timeToMinutes(appt.time);
    const existingEnd = existingStart + (existingService ? existingService.duration : 30);
    return startMin < existingEnd && existingStart < endMin;
});

const hasBlockConflict = (db, date, startMin, endMin) => (db.blocks || []).some(bl => {
    if (bl.date !== date) return false;
    const blStart = bl.start ? timeToMinutes(bl.start) : 0;
    const blEnd = bl.end ? timeToMinutes(bl.end) : 1440;
    return startMin < blEnd && blStart < endMin;
});

app.get('/api/hours', (req, res) => {
    const db = readDb();
    res.json(db.hours || []);
});

app.put('/api/hours', (req, res) => {
    const hours = req.body;

if (
  !Array.isArray(hours) ||
  hours.length !== 7 ||
  hours.some(h =>
    h.open && (
      !Array.isArray(h.periods) ||
      h.periods.length !== 2 ||
      h.periods.some(p =>
        !isValidTime(p.start) ||
        !isValidTime(p.end) ||
        timeToMinutes(p.end) <= timeToMinutes(p.start)
      ) ||
      timeToMinutes(h.periods[0].end) >
        timeToMinutes(h.periods[1].start)
    )
  )
) {
  return res.status(400).json({
    error: 'Configuração de horários inválida.'
  });
}

    const db = readDb();
    db.hours = hours;
    writeDb(db);
    res.json(db.hours);
});

app.get('/api/blocks', (req, res) => {
    const db = readDb();
    res.json(db.blocks || []);
});

app.post('/api/blocks', (req, res) => {
    const { date, start = null, end = null, barberId = null, reason = '' } = req.body;
    if (!parseLocalDate(date)) {
        return res.status(400).json({ error: 'Data inválida. Use o formato AAAA-MM-DD.' });
    }
    if (start !== null || end !== null) {
        if (!isValidTime(start) || !isValidTime(end) || timeToMinutes(end) <= timeToMinutes(start)) {
            return res.status(400).json({ error: 'Intervalo de bloqueio inválido.' });
        }
    }

    const db = readDb();
    if (!db.blocks) db.blocks = [];
    if (!db.appointments) db.appointments = [];
    if (!db.services) db.services = [];

    const blStart = start ? timeToMinutes(start) : 0;
    const blEnd = end ? timeToMinutes(end) : 1440;
    if (hasConflict(db, date, blStart, blEnd)) {
        return res.status(409).json({ error: 'Já existe agendamento ativo neste período. Cancele o agendamento antes de bloquear.' });
    }

    const newBlock = {
        id: crypto.randomUUID(),
        date,
        start: start || null,
        end: end || null,
        barberId: barberId || null,
        reason: typeof reason === 'string' ? reason.trim() : ''
    };
    db.blocks.push(newBlock);
    writeDb(db);
    res.status(201).json(newBlock);
});

app.delete('/api/blocks/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    if (!db.blocks) db.blocks = [];
    const index = db.blocks.findIndex(b => String(b.id) === String(id));
    if (index === -1) {
        return res.status(404).json({ error: 'Bloqueio não encontrado.' });
    }
    db.blocks.splice(index, 1);
    writeDb(db);
    res.json({ message: 'Bloqueio removido com sucesso.' });
});


app.post('/api/appointments', (req, res) => {
    const { clientName, clientPhone, serviceId, date, time, whatsappConsent } = req.body;

    if (typeof clientName !== 'string' || !clientName.trim() || !clientPhone || !serviceId || !date || !time) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const phoneDigits = String(clientPhone).replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        return res.status(400).json({ error: 'Telefone inválido.' });
    }

    const parsedDate = parseLocalDate(date);
    if (!parsedDate) {
        return res.status(400).json({ error: 'Data inválida. Use o formato AAAA-MM-DD.' });
    }

    if (!isValidTime(time)) {
        return res.status(400).json({ error: 'Hora inválida. Use o formato HH:MM.' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (parsedDate < today || (parsedDate.getTime() === today.getTime() && timeToMinutes(time) <= nowMinutes)) {
        return res.status(400).json({ error: 'Não é possível agendar em data ou horário que já passou.' });
    }

    const db = readDb();
    if (!db.services) db.services = [];
    if (!db.appointments) db.appointments = [];

    const service = db.services.find(s => String(s.id) === String(serviceId) && s.active !== false);

    if (!service) {
        return res.status(400).json({ error: 'Serviço não encontrado ou inativo.' });
    }

    const newStartMin = timeToMinutes(time);
    const newEndMin = newStartMin + (service.duration || 30);

    const dayHours = (db.hours || [])[parsedDate.getDay()];

    if (!dayHours || !dayHours.open) {
    return res.status(400).json({
        error: 'A barbearia está fechada neste dia.'
    });
    }

    const periods = dayHours.periods || [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '18:00' }
    ];

    const fitsPeriod = periods.some(period =>
    newStartMin >= timeToMinutes(period.start) &&
    newEndMin <= timeToMinutes(period.end)
    );

    if (!fitsPeriod) {
    return res.status(400).json({
        error: 'Horário fora dos períodos de funcionamento.'
    });
    }

    if (hasBlockConflict(db, date, newStartMin, newEndMin)) {
    return res.status(400).json({
        error: 'Este horário está bloqueado.'
    });
}

    if (hasConflict(db, date, newStartMin, newEndMin)) {
    return res.status(400).json({
        error: 'Este horário conflita com outro agendamento existente.'
    });
}

    if (hasBlockConflict(db, date, newStartMin, newEndMin)) {
        return res.status(400).json({ error: 'Este horário está bloqueado.' });
    }

    if (hasConflict(db, date, newStartMin, newEndMin)) {
        return res.status(400).json({ error: 'Este horário conflita com outro agendamento existente.' });
    }

    const id = crypto.randomUUID();
    const usedCodes = new Set(db.appointments.map(a => a.code));
    const codeRange = Math.max(10000, usedCodes.size * 10);
    let code;
    do {
        code = `#CC-${String(crypto.randomInt(0, codeRange)).padStart(4, '0')}`;
    } while (usedCodes.has(code));

    const newAppointment = {
        id,
        code,
        clientName: clientName.trim(),
        clientPhone,
        serviceId: service.id,
        date,
        time,
        status: 'confirmado',
        whatsappConsent: Boolean(whatsappConsent)
    };

    db.appointments.push(newAppointment);
    writeDb(db);

    res.status(201).json(newAppointment);
});

app.patch('/api/appointments/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== undefined && !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status inválido.' });
    }

    const db = readDb();
    if (!db.appointments) db.appointments = [];

    const appItem = db.appointments.find(a => String(a.id) === String(id));

    if (!appItem) {
        return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    if (status && status !== 'cancelado') {
        if (!db.services) db.services = [];
        const service = db.services.find(s => String(s.id) === String(appItem.serviceId));
        const startMin = timeToMinutes(appItem.time);
        const endMin = startMin + (service ? service.duration : 30);
        if (hasConflict(db, appItem.date, startMin, endMin, appItem.id)) {
            return res.status(400).json({ error: 'Este horário conflita com outro agendamento existente.' });
        }
    }

    appItem.status = status || appItem.status;
    writeDb(db);

    res.json(appItem);
});

app.delete('/api/appointments/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    if (!db.appointments) db.appointments = [];

    const appItem = db.appointments.find(a => String(a.id) === String(id));
    if (!appItem) {
        return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    appItem.status = 'cancelado';
    appItem.canceledAt = new Date().toISOString();
    writeDb(db);

    res.json({ message: 'Agendamento cancelado com sucesso.', appointment: appItem });
});

module.exports = app;
