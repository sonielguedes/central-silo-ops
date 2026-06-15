package br.com.siloops.apk.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.siloops.apk.data.location.GpsLocation
import br.com.siloops.apk.data.location.LocationRepository
import br.com.siloops.apk.data.location.isValidGpsLocation
import br.com.siloops.apk.data.outbox.OutboxEvent
import br.com.siloops.apk.data.outbox.OutboxRepository
import br.com.siloops.apk.data.session.ActiveSessionRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Worker periódico que cria eventos HEARTBEAT com posição GPS no Outbox.
 *
 * Arquitetura:
 *  - Cada execução lê a sessão ativa + última posição GPS válida.
 *  - Se há jornada ativa, grava HEARTBEAT no Outbox (offline-first).
 *  - O [br.com.siloops.apk.data.outbox.OutboxSyncWorker] flushes os eventos para a API.
 *  - Ao final, re-agenda a si mesmo para rodar em [HEARTBEAT_INTERVAL_SECONDS].
 *    Isso contorna a limitação do Android de 15min mínimos para PeriodicWork.
 *
 * Payload HEARTBEAT enviado para /api/mobile/events/batch:
 * {
 *   "tenantId":             "...",
 *   "fleetCode":            "2026",
 *   "equipmentId":          "...",
 *   "mobileToken":          "...",
 *   "operatorRegistration": "00125",
 *   "journeyId":            "...",
 *   "operationCode":        "...",
 *   "latitude":             -17.000000,   // só presente quando GPS válido
 *   "longitude":            -50.000000,   // só presente quando GPS válido
 *   "accuracy":             8.5,
 *   "speed":                0.0,          // m/s
 *   "speedKmh":             0.0,          // km/h (alias para a Central)
 * }
 *
 * IMPORTANTE — Validação:
 *  - GPS jamais é enviado como null, 0,0 ou fora do range válido.
 *  - Se não há posição válida, o heartbeat é enviado sem campos de GPS.
 *    A API preserva a última posição válida já gravada.
 */
@HiltWorker
class HeartbeatWorker @AssistedInject constructor(
    @Assisted private val appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val outboxRepo:   OutboxRepository,
    private val sessionRepo:  ActiveSessionRepository,
    private val locationRepo: LocationRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        // 1. Verificar se há jornada ativa — se não, não há o que enviar
        val session = sessionRepo.getActive()
        if (session == null) {
            android.util.Log.i(TAG, "[Heartbeat] Sem sessão ativa — worker finalizado.")
            return Result.success()
        }

        // 2. Capturar posição GPS atual
        val loc: GpsLocation? = locationRepo.lastLocation.value
        val hasValidGps = isValidGpsLocation(loc)

        // 3. Log antes da chamada à API (via Outbox)
        android.util.Log.i(TAG,
            "[Heartbeat] PRE-ENQUEUE " +
            "tenant=${session.tenantId} " +
            "fleet=${session.fleetCode} " +
            "operador=${session.operatorRegistration} " +
            "lat=${loc?.latitude ?: "N/A"} " +
            "lng=${loc?.longitude ?: "N/A"} " +
            "accuracy=${loc?.accuracy?.let { String.format("%.1f", it) + "m" } ?: "N/A"} " +
            "speed=${loc?.speed?.let { String.format("%.1f", it * 3.6f) + "km/h" } ?: "N/A"} " +
            "gpsValido=$hasValidGps " +
            "ts=${Instant.now()}"
        )

        if (!hasValidGps) {
            android.util.Log.w(TAG,
                "[Heartbeat] GPS inválido ou ausente — heartbeat será enviado SEM coordenadas. " +
                "Verifique: permissão ACCESS_FINE_LOCATION, GPS ativado no dispositivo, " +
                "aguarde aquisição de sinal (pode levar até 60s em campo aberto)."
            )
        }

        // 4. Montar payload
        val ts       = Instant.now().toString()
        val offlineId = UUID.randomUUID().toString()

        val payload: Map<String, Any?> = buildMap {
            // Identity — sempre presente
            put("tenantId",             session.tenantId)
            put("fleetCode",            session.fleetCode)
            put("equipmentId",          session.equipmentId)
            put("mobileToken",          session.mobileToken)
            put("operatorRegistration", session.operatorRegistration)

            // Contexto operacional — se disponível
            session.journeyId?.let      { put("journeyId",     it) }
            session.operationCode?.let  { put("operationCode", it) }

            // GPS — SOMENTE quando válido (nunca envia null, 0,0 ou fora do range)
            if (hasValidGps && loc != null) {
                put("latitude",  loc.latitude)
                put("longitude", loc.longitude)
                put("accuracy",  loc.accuracy.toDouble())
                put("speed",     loc.speed.toDouble())
                put("speedKmh",  (loc.speed * 3.6f).toDouble())
            }
        }

        // 5. Gravar no Outbox (persistência offline-first)
        return try {
            outboxRepo.enqueue(
                OutboxEvent(
                    offlineId = offlineId,
                    type      = EVENT_TYPE,
                    timestamp = ts,
                    payload   = payload,
                )
            )
            android.util.Log.i(TAG,
                "[Heartbeat] enqueued offlineId=$offlineId " +
                "fleet=${session.fleetCode} " +
                "hasGps=$hasValidGps"
            )

            // 6. Reagendar para próxima execução (contorna limite de 15min do PeriodicWork)
            reschedule(appContext)

            // 7. Disparar OutboxSyncWorker para flush imediato
            br.com.siloops.apk.data.outbox.OutboxSyncWorker.enqueue(appContext)

            Result.success()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "[Heartbeat] Falha ao enfileirar evento", e)
            Result.retry()
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    companion object {
        const val TAG        = "HeartbeatWorker"
        const val WORK_NAME  = "heartbeat_periodic"
        const val EVENT_TYPE = "HEARTBEAT"

        /** Intervalo entre heartbeats em segundos */
        private const val HEARTBEAT_INTERVAL_SECONDS = 30L

        /**
         * Inicia o ciclo de heartbeats quando uma jornada começa.
         * Chame ao iniciar a jornada no APK.
         */
        fun start(context: Context) {
            enqueueOnce(context, initialDelay = 0L)
            android.util.Log.i(TAG, "[Heartbeat] ciclo iniciado (a cada ${HEARTBEAT_INTERVAL_SECONDS}s)")
        }

        /**
         * Cancela o ciclo de heartbeats quando a jornada é encerrada.
         * Chame ao encerrar a jornada no APK.
         */
        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            android.util.Log.i(TAG, "[Heartbeat] ciclo cancelado")
        }

        /**
         * Re-agenda o worker para rodar após [HEARTBEAT_INTERVAL_SECONDS].
         * Chamado internamente ao final de cada [doWork].
         */
        private fun reschedule(context: Context) {
            enqueueOnce(context, initialDelay = HEARTBEAT_INTERVAL_SECONDS)
        }

        private fun enqueueOnce(context: Context, initialDelay: Long) {
            val request = OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setInitialDelay(initialDelay, TimeUnit.SECONDS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15L, TimeUnit.SECONDS)
                .build()

            // REPLACE: se já há um heartbeat pendente, substitui para evitar duplicatas
            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }
    }
}
