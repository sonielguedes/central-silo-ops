package br.com.siloops.apk.domain.fueling

import br.com.siloops.apk.data.outbox.OutboxRepository
import br.com.siloops.apk.data.outbox.OutboxEvent
import br.com.siloops.apk.data.session.ActiveSessionRepository
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

/**
 * Registra um abastecimento (TPL 1 — ABASTECIMENTO) de forma offline-first.
 *
 * Fluxo:
 * 1. Validar os campos obrigatórios (litros > 0, horímetro > 0, flota ativa).
 * 2. Gerar UUID único (eventId) — chave de idempotência na Central.
 * 3. Persistir no Outbox Room antes de qualquer chamada de rede.
 * 4. WorkManager sincroniza em background assim que houver conectividade,
 *    com retry exponencial (ver OutboxSyncWorker).
 * 5. O UseCase retorna Success imediatamente — não aguarda resposta de rede.
 *
 * A Central valida: litros > 0, horímetro > 0, frota ativa e token.
 * Duplicidade detectada por (tenantId + eventId) — retry seguro.
 */
class FuelingUseCase @Inject constructor(
    private val outboxRepo:  OutboxRepository,
    private val sessionRepo: ActiveSessionRepository,
) {

    data class Params(
        /** Litros abastecidos — deve ser > 0. */
        val dieselLiters:         Double,
        /** Horímetro no momento do abastecimento — deve ser > 0. */
        val hourmeter:            Double,
        /** Matrícula do operador que conduziu o abastecimento (opcional). */
        val operatorRegistration: String? = null,
        /** Nome do operador (opcional, complementa a matrícula). */
        val operatorName:         String? = null,
        /** Código da operação vigente (opcional). */
        val operationCode:        String? = null,
        /** Observações livres (opcional). */
        val observations:         String? = null,
    )

    sealed class Result {
        /**
         * Evento enfileirado com sucesso no Outbox.
         * [offlineId] é o UUID que identifica este registro; use-o para rastrear
         * o status de sincronização (PENDENTE → SINCRONIZADO).
         */
        data class Success(val offlineId: String) : Result()
        data class Error(val message: String, val cause: Throwable? = null) : Result()
    }

    // ─────────────────────────────────────────────────────────────────────────

    suspend fun execute(params: Params): Result {
        // 1. Validações locais (espelham as regras da Central)
        if (params.dieselLiters <= 0.0) {
            return Result.Error("Litros devem ser maiores que zero.")
        }
        if (params.hourmeter <= 0.0) {
            return Result.Error("Horímetro deve ser maior que zero.")
        }

        val session = sessionRepo.getActive()
            ?: return Result.Error("Nenhuma jornada ativa. Inicie uma jornada antes de registrar abastecimento.")

        if (session.fleetCode.isBlank()) {
            return Result.Error("Sessão sem frota associada — inconsistência de dados.")
        }

        // 2. Gerar UUID (idempotência)
        val offlineId = UUID.randomUUID().toString()
        val fueledAt  = Instant.now().toString()

        // 3. Construir payload (espelha MobileBatchEvent.data na Central)
        val payload = buildPayload(session, params, offlineId, fueledAt)

        // 4. Persistir no Room — offline-first
        return try {
            outboxRepo.enqueue(
                OutboxEvent(
                    offlineId = offlineId,
                    type      = EVENT_TYPE,
                    timestamp = fueledAt,
                    payload   = payload,
                )
            )
            android.util.Log.i(
                TAG,
                "FUELING enqueued offlineId=$offlineId fleetCode=${session.fleetCode} " +
                "liters=${params.dieselLiters} hourmeter=${params.hourmeter}"
            )
            Result.Success(offlineId)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to enqueue FUELING", e)
            Result.Error("Falha ao registrar abastecimento: ${e.message}", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Payload — estrutura esperada pela Central em event.data

    private fun buildPayload(
        session:    br.com.siloops.apk.data.session.ActiveSession,
        params:     Params,
        offlineId:  String,
        fueledAt:   String,
    ): Map<String, Any?> = buildMap {
        // Identidade
        put("tenantId",            session.tenantId)
        put("fleetCode",           session.fleetCode)
        put("equipmentId",         session.equipmentId)
        put("mobileToken",         session.mobileToken)

        // Abastecimento
        put("dieselLiters",        params.dieselLiters)
        put("hourmeter",           params.hourmeter)

        // Operador (opcional)
        params.operatorRegistration?.let { put("operatorRegistration", it) }
        params.operatorName?.let         { put("operatorName", it) }
        session.operatorRegistration?.let { put("operatorRegistration", it) }  // da sessão como fallback
        session.operatorName?.let         { put("operatorName", it) }

        // Operação (opcional)
        params.operationCode?.let { put("operationCode", it) }
        session.operationCode?.let { put("operationCode", it) }

        // Observações
        params.observations?.let { put("observations", it) }

        // Timestamp
        put("fueledAt", fueledAt)
    }

    // ─────────────────────────────────────────────────────────────────────────

    private companion object {
        const val TAG        = "FuelingUseCase"
        const val EVENT_TYPE = "FUELING"
    }
}
