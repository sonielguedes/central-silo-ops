# ETAPA 6.10 — FINALIZAÇÃO DE JORNADA COM HORÍMETRO FINAL + FICHA OPERADOR

**Data:** 2026-06-18
**Status:** IMPLEMENTADO
**Módulos afetados:** APK (Android), Central (Node.js/Next.js)

## Objetivo
Implementar o fluxo completo de encerramento de jornada, garantindo a coleta do horímetro final, validação de consistência, cálculo de tempo trabalhado e atualização da Ficha Operador na Central.

## Fluxo de Finalização (APK)
1. O operador aciona o botão "Finalizar Jornada" no Computador de Bordo.
2. Um diálogo de confirmação exibe os dados atuais (Frota, Operador, OS, Horímetro Inicial).
3. O operador deve informar o **Horímetro Final**.
4. **Validação:** O horímetro final deve ser maior ou igual ao inicial. Caso contrário, o encerramento é bloqueado com mensagem de erro.
5. Ao confirmar, o APK:
    - Encerra qualquer parada ativa automaticamente (se houver).
    - Gera evento `JOURNEY_END` com o payload completo.
    - Salva o evento no **Outbox** local (Room).
    - Marca a jornada local como `FINALIZADA` no banco de dados.
    - Limpa a sessão ativa (`activeJourney = null`).
    - Bloqueia o retorno para a tela de jornada ativa.
    - Aciona o `SyncWorker` para envio imediato.

## Payload JOURNEY_END
O evento gerado segue o contrato oficial:

```json
{
  "offlineId": "uuid-evento",
  "type": "JOURNEY_END",
  "timestamp": "2026-06-18T22:30:00.000Z",
  "payload": {
    "eventType": "JOURNEY_END",
    "status": "FINALIZADO",
    "deviceId": "uuid-do-dispositivo",
    "journeyId": "uuid-da-jornada",
    "fleetCode": "2026",
    "equipmentCode": "2026",
    "operatorRegistration": "01",
    "workOrderCode": "100",
    "operationCode": "1001",
    "operationDescription": "PREPARO DE SOLO",
    "costCenterCode": "8080",
    "implementCode": "5000",
    "implementDescription": "SULCADOR",
    "hourmeterStart": 3.0,
    "hourmeterEnd": 4.2,
    "totalHourmeter": 1.2,
    "startedAt": "2026-06-18T18:40:00.000Z",
    "endedAt": "2026-06-18T22:30:00.000Z",
    "stopEndedAt": "2026-06-18T22:30:00.000Z",
    "latitude": -17.55094,
    "longitude": -52.55147,
    "accuracy": 8.5,
    "hourmeterEndSource": "MANUAL"
  }
}
```

## Comportamento na Central
Ao receber o `JOURNEY_END`, a Central:
1. Atualiza o `live-state` da frota para `status: FINALIZADO`.
2. Persiste o `hourmeterEnd` como o último horímetro válido da máquina.
3. A **Ficha Operador** reflete o estado finalizado, calculando o `totalHourmeter` se não enviado pelo APK.
4. A frota é removida da visualização de "Operações Ativas" (filtro padrão) ou exibida como `FINALIZADO`.
5. A **Timeline** registra o marco de encerramento.

## Regras de Outbox e Idempotência
- O evento `JOURNEY_END` é gravado com `idempotencyKey` baseado no `journeyId`, evitando duplicidade no processamento da Central.
- Em caso de falha na rede, o evento permanece no Room com status `PENDING` e é reprocessado pelo `SyncWorker` com backoff exponencial.

## Arquivos Alterados
### APK (Android)
- `data/local/entity/Journey.kt`: Adição de `finalHorimeter`.
- `data/local/SiloDatabase.kt`: Incremento da versão do DB para 27.
- `data/repository/JourneyRepositoryImpl.kt`: Lógica de geração de `JOURNEY_END` e `Outbox`.
- `domain/usecase/FinalizeJourneyUseCase.kt`: Refatoração para delegar ao repositório dentro de transação atômica.
- `data/repository/SyncRepository.kt`: Mapeamento de campos específicos de `JOURNEY_END` para o batch.
- `ui/board/BoardViewModel.kt`: Validação e chamada do usecase.

### Central (Node.js)
- `app/api/mobile/events/batch/route.ts`: Processamento do tipo `JOURNEY_END`.
- `lib/server-storage.ts`: Atualização do `live-state` com prioridade terminal para `FINALIZADO`.
- `lib/operator-sheet-builder.ts`: Lógica de construção da Ficha Operador com dados de encerramento.

## Resultado da Validação
- Build APK: OK
- Testes Unitários APK: OK (`FinalizeJourneyTest`)
- Contrato de Payload: OK
- Persistência Outbox: OK
- Sincronização Central: OK
