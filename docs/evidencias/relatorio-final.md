# Corte Certo — Relatório do projeto

## 1. Identificação

- **Projeto:** Corte Certo.
- **Objetivo:** desenvolver um site para organizar os atendimentos de uma barbearia.
- **Equipe:** Kauã (organização do trabalho e documentação), Bruno (backend), Thiago (frontend) e Eduardo (testes).
- **Repositório:** https://github.com/kauamarkkes/corte-certo
- **Quadro de acompanhamento:** https://trello.com/b/omwLZZ4s/corte-certo

## 2. Origem e necessidade do projeto

A equipe conversou com o cliente, que informou precisar de um site para gerenciar os atendimentos da barbearia. A partir dessa conversa, foram registrados os serviços, as regras de funcionamento e as funções desejadas.

O projeto foi desenvolvido pela equipe e apresentado ao cliente. Após a apresentação, o cliente demonstrou ter gostado do resultado.

## 3. Requisitos levantados

- Atendimento com um barbeiro.
- Funcionamento de segunda a sábado, das 08h às 12h e das 13h às 18h.
- Corte por R$ 35, com duração de 30 minutos.
- Barba por R$ 30, com duração de 30 minutos.
- Corte e barba por R$ 50, com duração de 50 minutos.
- Luzes por R$ 70, com duração de 1 hora e 20 minutos.
- Plano mensal de R$ 110 para cortes ilimitados durante o mês fechado, com pagamento no estabelecimento.
- Cadastro do cliente antes do agendamento.
- Escolha de serviço, data e horário.
- Prevenção de conflitos entre atendimentos.
- Cancelamento pelo cliente.
- Retorno ao fim da prioridade após cancelar e fazer um novo agendamento, caso exista fila.

### Situação dos requisitos

| ID | Requisito | Situação documentada |
|---|---|---|
| R01 | Atendimento com um barbeiro | Presente na estrutura do projeto |
| R02 | Expediente de segunda a sábado, 08h–12h e 13h–18h | A equipe informou que corrigiu os horários; a versão publicada precisa corresponder à apresentada |
| R03 | Valores, durações e quatro serviços previstos | A equipe informou que corrigiu os preços; durações e serviço de luzes não foram confirmados nesta documentação |
| R04 | Cadastro antes do agendamento | Funcionamento completo não confirmado |
| R05 | Escolha de serviço, data e horário | Presente no projeto |
| R06 | Prevenção de horários inválidos e conflitos | Presente nas validações da API para os horários cadastrados |
| R07 | Cancelamento de agendamento | Presente no projeto e coberto pelo teste TC-13 |
| R08 | Prioridade após cancelamento e novo agendamento | Funcionamento não confirmado |
| R09 | Mensalidade de R$ 110, apenas cortes e pagamento no local | Funcionamento não confirmado |

A equipe informou ter ajustado preços e horários para atender aos requisitos levantados. O retorno positivo do cliente sobre a apresentação não foi registrado como validação individual de todas as regras da tabela.

## 4. Solução desenvolvida

A interface utiliza HTML, CSS e JavaScript. O backend utiliza Node.js e Express, com dados da API armazenados em um arquivo JSON.

O projeto apresenta serviços, contém um fluxo de agendamento e oferece um painel para acompanhar os atendimentos. A API verifica dados do cliente, datas, horários, disponibilidade e conflitos na agenda. As instruções de execução estão no `README.md`.

### Limitações conhecidas

- O acesso demonstrativo ao painel não protege efetivamente todas as operações da API.
- O armazenamento em arquivo JSON possui limitações para uso simultâneo.
- O funcionamento completo do cadastro, da regra de prioridade após cancelamento e da mensalidade não foi confirmado para este relatório.

## 5. Organização e acompanhamento do trabalho

A equipe utilizou o Trello para acompanhar as atividades e o GitHub para registrar o código e seu histórico de alterações.

| Integrante | Responsabilidade |
|---|---|
| Kauã | Organização do trabalho e documentação |
| Bruno | Backend |
| Thiago | Frontend |
| Eduardo | Testes |

Nos prints fornecidos durante a preparação da entrega, o quadro Trello apresentava sete cartões em **Concluído**, um em **Em andamento** (“Preparar e executar testes”), um em **A fazer — Sprint** (“Documentar e preparar a entrega”) e três no **Product Backlog**. Esses números representam o estado do quadro no momento das capturas.

Entre os cartões concluídos visíveis estavam as regras de agendamento, o cancelamento e painel do barbeiro, a estrutura inicial da API e a normalização de dados.

## 6. Testes e defeitos

O repositório contém testes automatizados da API para agendamentos, validações, conflitos de horários, cancelamentos, serviços e bloqueios. O arquivo `docs/evidencias/execucao-2-depois.json` registra uma execução com **30 testes**.

O TC-22 utiliza `test.failing` para acompanhar um defeito conhecido relacionado à autorização de acesso. Esse registro não significa que a proteção esteja implementada.

| Verificação | Evidência disponível |
|---|---|
| Criar agendamento válido | TC-01 |
| Impedir conflito entre horários | TC-11 e TC-14 |
| Liberar horário após cancelamento | TC-13 |
| Exigir autorização para criar serviço | TC-22 — defeito conhecido |

A evidência disponível mostra o resultado da execução registrada no repositório. Não foi apresentado a este relatório um resultado de testes executados após as últimas correções informadas pela equipe.

## 7. Apresentação e retorno do cliente

A equipe apresentou o projeto ao cliente. Segundo o relato da equipe, o cliente gostou do resultado apresentado.

Esse retorno registra a percepção geral do cliente sobre a demonstração. Não há registro de avaliação individual de cada requisito ou de aprovação formal das funções que permaneceram sem confirmação neste relatório.

## 8. Reflexão sobre o processo

O Trello permitiu visualizar as tarefas e seu andamento, enquanto o GitHub registrou as alterações realizadas pelos integrantes. A comparação entre os requisitos e a implementação também tornou visíveis funções que ainda precisam de comprovação.

Como melhoria para um próximo projeto, a equipe pode verificar cada requisito na versão integrada antes da apresentação e registrar no quadro a evidência que levou à conclusão de cada tarefa.

## 9. Conclusão

A equipe desenvolveu e apresentou uma versão demonstrável do Corte Certo, com interface, API, histórico de alterações e testes automatizados. O cliente demonstrou ter gostado da apresentação. Este relatório registra as funcionalidades observadas, as limitações conhecidas e os requisitos cuja implementação completa não foi comprovada.
