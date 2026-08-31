# NetGuardian — Detecção Autônoma de Anomalias de Rede com IA e Human-in-the-Loop

TCC: framework serverless (AWS) que combina **gerência de rede programável (RESTCONF/YANG)**,
**aprendizado de máquina não supervisionado** e **NetDevOps orientado a eventos** para detectar,
classificar e remediar (com aprovação humana) três classes de problemas em uma rede Cisco:

| Módulo | Fonte de dados | Técnica | Ação sugerida |
|---|---|---|---|
| **1 — Compliance & Hardening** | Configuração (RESTCONF/YANG, análise estática) | Regras determinísticas | Habilitar Port Security/QoS, desativar Telnet/HTTP |
| **2 — Segurança & Ameaças** | Fluxo de tráfego (análise dinâmica) | Isolation Forest (não supervisionado) | Isolar host (port scan), aplicar rate-limit (pico de tráfego) |
| **3 — Saúde da Infraestrutura** | Telemetria/contadores (RESTCONF oper-data) | Detecção de séries temporais (janela deslizante) | Dampening/shutdown (flapping), redirecionar para link de backup (CRC drops) |

Todos os módulos publicam um evento normalizado (`AnomalyEvent`) em um **barramento de eventos**
(AWS EventBridge). Um serviço de notificação envia o alerta ao **Telegram**, com botões
**Aprovar/Rejeitar** (Human-in-the-Loop). A aprovação dispara a remediação real via RESTCONF,
com trilha de auditoria (alinhado a ITIL v4 — Gestão de Mudanças — e ISO 27001 — Registro/Auditoria).

## Por que a arquitetura é modular

Cada módulo é um Lambda independente que **apenas** produz `AnomalyEvent`s. O bot, o barramento
de eventos e o executor de remediação são genéricos e não sabem nada sobre a origem do evento.
Isso significa que um "Módulo 4" novo (ex.: detecção de rogue DHCP) é só: uma função Lambda que
lê uma fonte de dados e publica um `AnomalyEvent` — nada mais muda.

```
docs/architecture.md   → diagrama detalhado, decisões de arquitetura e mapeamento acadêmico
src/shared/            → contratos e clientes usados pelos 3 módulos (RESTCONF, EventBridge, Telegram)
src/module1_compliance/→ Módulo 1
src/module2_threats/   → Módulo 2 (feature engineering + Isolation Forest + treino/avaliação)
src/module3_health/    → Módulo 3
src/bot/                → notificação + execução de remediação (Human-in-the-Loop)
src/mocks/              → simulador RESTCONF (Flask) e gerador sintético de tráfego, para
                           desenvolver e demonstrar sem depender de hardware Cisco ou de uma
                           conta AWS real
infra/template.yaml     → IaC (AWS SAM): Lambdas, API Gateway (webhook Telegram), EventBridge
tests/                  → testes unitários (pytest) para as regras, o modelo e a análise de telemetria
```

## Como rodar localmente (sem Cisco/AWS reais)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Sobe um "switch" Cisco simulado que fala RESTCONF/YANG (ietf-interfaces)
python -m src.mocks.restconf_mock_server        # http://localhost:8443

# 2. Gera dataset sintético de fluxo de tráfego (tráfego normal + port scan + pico de exfiltração)
python -m src.mocks.traffic_generator --out data/flows.csv --rows 20000

# 3. Treina e avalia o detector do Módulo 2 (Isolation Forest)
python -m src.module2_threats.train --data data/flows.csv --model-out data/model.joblib

# 4. Roda os testes
pytest -q
```

Para rodar um handler de módulo manualmente contra o mock (fora do Lambda), veja os `if __name__ ==
"__main__":` no fim de cada `lambda_handler.py`.

## Deploy na AWS (quando houver credenciais)

```bash
sam build
sam deploy --guided   # cria Lambdas, API Gateway (webhook do Telegram) e o EventBridge bus
```

Variáveis de ambiente necessárias (ver `src/shared/config.py`): `SWITCH_HOST`, `SWITCH_USER`,
`SWITCH_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `EVENT_BUS_NAME`.

## Mapeamento com os eixos da monografia

Ver `docs/architecture.md` para a discussão completa de cada um dos 5 eixos (Engenharia de Redes,
IA/Ciência de Dados, Engenharia de Software/NetDevOps, Nuvem/Sistemas Distribuídos, Cibersegurança/
Governança) e como cada um se materializa no código.

## Status

Scaffold inicial funcional: regras do Módulo 1, pipeline de ML do Módulo 2 (com métricas de
avaliação), análise de telemetria do Módulo 3, executor de remediação com HitL via Telegram, mocks
para desenvolvimento local e testes automatizados. Próximos passos sugeridos ficam registrados em
`docs/architecture.md#próximos-passos`.
