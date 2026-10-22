const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dbFilePath = process.env.DB_PATH || path.join(__dirname, 'database.json');

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
    const { name, price, duration, icon } = req.body;
    if (!name || !price || !duration) {
        return res.status(400).json({ error: 'Preencha nome, preÃƒÂ§o e duraÃƒÂ§ÃƒÂ£o.' });
    }

    const db = readDb();
    if (!db.services) db.services = [];

    const newService = {
        id: Date.now().toString(),
        name,
        price: Number(price),
        duration: Number(duration),
        icon: icon || 'Ã¢Å“â€š',
        active: true
    };

    db.services.push(newService);
    writeDb(db);
    res.status(201).json(newService);
});

app.put('/api/services/:id', (req, res) => {
    const { id } = req.params;
    const { name, price, duration, active, icon } = req.body;
    
    const db = readDb();
    if (!db.services) db.services = [];

    const service = db.services.find(s => String(s.id) === String(id));
    
    if (!service) {
        return res.status(404).json({ error: 'ServiÃƒÂ§o nÃƒÂ£o encontrado.' });
    }

    if (name) service.name = name;
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
        return res.status(404).json({ error: 'ServiÃƒÂ§o nÃƒÂ£o encontrado.' });
    }

    db.services.splice(index, 1);
    writeDb(db);
    res.json({ message: 'ServiÃƒÂ§o removido com sucesso.' });
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


app.post('/api/appointments', (req, res) => {
    const { clientName, clientPhone, serviceId, date, time } = req.body;

    if (!clientName || !clientPhone || !serviceId || !date || !time) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatÃƒÂ³rios.' });
    }

    const db = readDb();
    if (!db.services) db.services = [];
    if (!db.appointments) db.appointments = [];

    let service = db.services.find(s => 
        String(s.id) === String(serviceId) || 
        s.name.toLowerCase() === String(serviceId).toLowerCase() ||
        String(serviceId).includes(String(s.id))
    );

    if (!service && db.services.length > 0) {
        service = db.services[0];
    }

    if (!service) {
        return res.status(400).json({ error: 'Nenhum serviÃƒÂ§o disponÃƒÂ­vel no sistema.' });
    }

    const newStartMin = timeToMinutes(time);
    const newEndMin = newStartMin + (service.duration || 30);

    for (const app of db.appointments) {
        if (app.date === date && app.status !== 'cancelado') {
            const existingService = db.services.find(s => String(s.id) === String(app.serviceId));
            const existingDuration = existingService ? existingService.duration : 30;
            
            const existingStartMin = timeToMinutes(app.time);
            const existingEndMin = existingStartMin + existingDuration;

            if (newStartMin < existingEndMin && existingStartMin < newEndMin) {
                return res.status(400).json({ 
                    error: 'Este horÃƒÂ¡rio conflita com outro agendamento existente.' 
                });
            }
        }
    }

    const id = Date.now().toString();
    const code = `#${id.slice(-4).toUpperCase()}`; 

    const newAppointment = {
        id,
        code,
        clientName,
        clientPhone,
        serviceId: service.id,
        date,
        time,
        status: 'Confirmed'
    };

    db.appointments.push(newAppointment);
    writeDb(db);

    res.status(201).json(newAppointment);
});

app.patch('/api/appointments/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const db = readDb();
    if (!db.appointments) db.appointments = [];

    const appItem = db.appointments.find(a => String(a.id) === String(id));

    if (!appItem) {
        return res.status(404).json({ error: 'Agendamento nÃƒÂ£o encontrado.' });
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
        return res.status(404).json({ error: 'Agendamento nÃƒÂ£o encontrado.' });
    }

    appItem.status = 'cancelado';
    appItem.canceledAt = new Date().toISOString();
    writeDb(db);

    res.json({ message: 'Agendamento cancelado com sucesso.', appointment: appItem });
});

module.exports = app;
