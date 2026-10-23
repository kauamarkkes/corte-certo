# corte-certo

Sistema de agendamento para um único barbeiro ("Corte Certo"). O cliente escolhe serviço, dia e horário; o barbeiro acompanha a agenda em um painel.

- **Front:** HTML, CSS e JavaScript puro com módulos ES (`index.html`, `js/`, `css/`).
- **Back:** Node.js, Express 5 e um arquivo JSON como banco (`backend/src/database.json`).

## Requisitos
- Node.js 18 ou superior (desenvolvido com v22.19.0)
- npm (desenvolvido com 11.6.1)

## Como rodar o back-end
```bash
cd backend
npm install
npm start
```
A API sobe em `http://localhost:3000`. O front chama essa porta diretamente, então não a altere ao usar o front.

Variáveis de ambiente (opcionais, veja `backend/.env.example`):
| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta da API |
| `DB_PATH` | `backend/src/database.json` | Caminho do arquivo de dados |

O projeto não carrega o arquivo `.env` automaticamente. Para mudar um valor, defina-o no terminal. No PowerShell: `$env:PORT=3111; npm start`.

## Como rodar o front-end
Abra a pasta do projeto no VS Code e use a extensão **Live Server** em `index.html`, na porta **5501**. Mantenha o back-end rodando.

## Como testar
```bash
cd backend
npm test
```
Os testes usam Jest e Supertest, sem iniciar o servidor. Cada teste trabalha em uma cópia temporária do banco (`DB_PATH` em `os.tmpdir()`), então `database.json` não é alterado. Resultado atual: 25 testes passando. O TC-22 está marcado como `test.failing` e registra um defeito conhecido.

## Endpoints principais
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/services` | Lista serviços |
| POST, PUT, DELETE | `/api/services`, `/api/services/:id` | Cria, altera e remove serviços |
| GET | `/api/appointments` | Lista agendamentos |
| POST | `/api/appointments` | Cria agendamento (`clientName`, `clientPhone`, `serviceId`, `date` AAAA-MM-DD, `time` HH:MM) |
| PATCH | `/api/appointments/:id/status` | Altera o status (`pendente`, `confirmado`, `concluido`, `cancelado`) |
| DELETE | `/api/appointments/:id` | Cancela o agendamento e libera o horário |
| POST | `/api/admin/login` | Login do painel |

## Regras validadas pela API
Nome e telefone (10 ou 11 dígitos, a máscara é aceita), data e hora válidas e não passadas, serviço existente e ativo, dia e horário dentro do expediente, sem conflito com outros agendamentos e duração do serviço respeitada.

## Limitações conhecidas
- O login do painel e a listagem de agendamentos não têm proteção real.
- Serviços, horários e bloqueios editados no painel ficam só no navegador e não chegam à API.
- O banco em arquivo só é seguro com um único processo.
