package br.com.siloops.apk.data.outbox

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.siloops.apk.data.api.MobileApiService
import br.com.siloops.apk.data.session.ActiveSessionRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * WorkManager worker that flushes the Outbox to the Central via
 * POST /api/mobile/events/batch.
 *
 * Retry strategy:
 *  - Exponential backoff: 30s, 1min, 2min, 4min, 8min … (capped by WorkManager at 5h).
 *  - Constraint: network required (any connected network).
 *  - Idempotency: each OutboxEvent carries a UUID (offlineId); the Central returns
 *    DUPLICATE (200) for already-processed events — safe to retry.
 *  - Survives app restart: WorkManager + Room persistence guarantees events are
 *    replayed after process death or device reboot.
 */
class OutboxSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {

    // Injected via Hilt WorkerFactory (not shown here for brevity)
    lateinit var outboxRepo:  OutboxRepository
    lateinit var apiService:  MobileApiService
    lateinit var sessionRepo: ActiveSessionRepository

    override suspend fun doWork(): Result {
        val pending = outboxRepo.getPending()
        if (pending.isEmpty()) return Result.success()

        val session = sessionRepo.getActive()
        if (session == null) {
            android.util.Log.w(TAG, "No active session — cannot sync ${pending.size} events")
            return Result.retry()
        }

        return try {
            val batch = pending.map { event ->
                mapOf(
                    "uuid"      to event.offlineId,
                    "type"      to event.type,
                    "timestamp" to event.timestamp,
                    "data"      to event.payload,
                )
            }

            val response = apiService.postBatch(
                companyToken = session.companyToken,
                header = mapOf(
                    "machineId"  to session.equipmentId,
                    "tenantId"   to session.tenantId,
                    "fleetCode"  to session.fleetCode,
                    "mobileToken" to session.mobileToken,
                ),
                events = batch,
            )

            if (response.isSuccessful) {
                val body = response.body()
                body?.results?.forEach { result ->
                    val status = result["status"] as? String ?: return@forEach
                    // Both SYNCED and DUPLICATE are terminal — mark as done.
                    if (status == "SYNCED" || status == "DUPLICATE") {
                        outboxRepo.markSynced(result["offlineId"] as String)
                        android.util.Log.i(TAG, "Synced offlineId=${result["offlineId"]} status=$status")
                    } else if (status == "REJECTED") {
                        // Business-rule rejection — do NOT retry; mark as error.
                        outboxRepo.markError(
                            offlineId = result["offlineId"] as String,
                            reason    = result["reason"] as? String ?: "REJECTED",
                        )
                        android.util.Log.w(TAG, "Rejected offlineId=${result["offlineId"]} reason=${result["reason"]}")
                    }
                }
                Result.success()
            } else {
                android.util.Log.w(TAG, "Batch failed HTTP ${response.code()} — will retry")
                Result.retry()
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Network error — will retry", e)
            Result.retry()
        }
    }

    companion object {
        const val TAG       = "OutboxSyncWorker"
        const val WORK_NAME = "outbox_sync"

        /**
         * Enqueue a sync with exponential backoff.
         * Uses KEEP policy — only one sync work at a time.
         */
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<OutboxSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30, TimeUnit.SECONDS,
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
