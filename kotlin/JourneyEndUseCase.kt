package br.com.siloops.apk.domain.journey

import br.com.siloops.apk.data.outbox.OutboxRepository
import br.com.siloops.apk.data.outbox.OutboxEvent
import br.com.siloops.apk.data.session.ActiveSessionRepository
import br.com.siloops.apk.data.session.ActiveSession
import br.com.siloops.apk.data.location.LocationRepository
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

/**
 * Encerra a jornada operacional do equipamento.
 *
 * Responsabilidades:
 * 1. Ler a sessão ativa (journeyId, operador, operação, horímetro inicial).
 * 2. Montar o payload JOURNEY_END com todos os campos requeridos pela Central.
 * 3. Gravar no Outbox (persistência offline-first).
 * 4. Limpar a sessão ativa para liberar novo início de jornada.
 *
 * O Outbox é processado em background (WorkManager) assim que a conectividade
 * estiver disponível — o UseCase não depende de rede para retornar sucesso.
 */
class JourneyEndUseCase @Inject constructor(
    private val outboxRepo:  OutboxRepository,
    private val sessionRepo: ActiveSessionRepository,
    private val locationRepo: LocationRepository,
) {

    data class Params(
        /** Horímetro final informado pelo operador (null = não informado / CAN) */
        val hourmeterEnd: Double?,
        val latitude:     Double?,
        val longitude:    Double?,
        val accuracy:     Float?,
    )

    sealed class Result {
        data class Success(val offlineId: String) : Result()
        data class Error(val message: String, val cause: Throwable? = null) : Result()
    }

    // ─────────────────────────────────────────────────────────────────────────

    suspend fun execute(params: Params): Result {
        val session = sessionRepo.getActive()
            ?: return Result.Error("Nenhuma jornada ativa encontrada.")

        if (session.fleetCode.isBlank()) {
            return Result.Error("Sessão ativa sem fleetCode — inconsistência de dados.")
        }

        val endedAt      = Instant.now().toString()
        val offlineId    = UUID.randomUUID().toString()

        val hourmeterStart = session.hourmeterStart
        val hourmeterEnd   = params.hourmeterEnd

        // Warn (but do not block) when hourmeterEnd < hourmeterStart
        if (hourmeterStart != null && hourmeterEnd != null && hourmeterEnd < hourmeterStart) {
            android.util.Log.w(
                TAG,
                "hourmeterEnd($hourmeterEnd) < hourmeterStart($hourmeterStart) " +
                "fleetCode=${session.fleetCode} — enviando com flag de inconsistência"
            )
        }

        // totalHourmeter: calculated on device; Central recalculates independently as fallback
        val totalHourmeter: Double? = if (hourmeterStart != null && hourmeterEnd != null && hourmeterEnd >= hourmeterStart) {
            Math.round((hourmeterEnd - hourmeterStart) * 1000.0) / 1000.0
        } else null

        val payload = buildPayload(
            session        = session,
            params         = params,
            hourmeterEnd   = hourmeterEnd,
            totalHourmeter = totalHourmeter,
            endedAt        = endedAt,
        )

        return try {
            outboxRepo.enqueue(
                OutboxEvent(
                    offlineId  = offlineId,
                    type       = EVENT_TYPE,
                    timestamp  = endedAt,
                    payload    = payload,
                )
            )
            android.util.Log.i(
                TAG,
                "JOURNEY_END enqueued offlineId=$offlineId fleetCode=${session.fleetCode} " +
                "journeyId=${session.journeyId} hourmeterEnd=$hourmeterEnd total=$totalHourmeter"
            )
            // Clear session AFTER successful outbox write
            sessionRepo.clear()
            Result.Success(offlineId)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to enqueue JOURNEY_END", e)
            Result.Error("Falha ao registrar encerramento: ${e.message}", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Payload builder

    private fun buildPayload(
        session:        ActiveSession,
        params:         Params,
        hourmeterEnd:   Double?,
        totalHourmeter: Double?,
        endedAt:        String,
    ): Map<String, Any?> = buildMap {
        // Identity
        put("tenantId",            session.tenantId)
        put("fleetCode",           session.fleetCode)
        put("equipmentId",         session.equipmentId)
        put("journeyId",           session.journeyId)
        put("mobileToken",         session.mobileToken)

        // Operator
        put("operatorRegistration", session.operatorRegistration)
        put("operatorName",         session.operatorName)

        // Operation
        put("operationCode",  session.operationCode)
        put("operationName",  session.operationName)

        // Implement (optional)
        session.implementCode?.let { put("implementCode", it) }
        session.implementName?.let { put("implementName", it) }

        // Hourmeter
        session.hourmeterStart?.let { put("hourmeterStart", it) }
        hourmeterEnd?.let           { put("hourmeterEnd",   it) }
        totalHourmeter?.let         { put("totalHourmeter", it) }
        put("hourmeterSource", session.hourmeterSource ?: "MANUAL")

        // Timestamps
        put("endedAt", endedAt)

        // Location (best available at time of confirmation)
        params.latitude?.let  { put("latitude",  it) }
        params.longitude?.let { put("longitude", it) }
        params.accuracy?.let  { put("accuracy",  it.toDouble()) }
    }

    // ─────────────────────────────────────────────────────────────────────────

    private companion object {
        const val TAG        = "JourneyEndUseCase"
        const val EVENT_TYPE = "JOURNEY_END"
    }
}
