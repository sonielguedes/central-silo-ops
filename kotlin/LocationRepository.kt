package br.com.siloops.apk.data.location

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Representa uma posição GPS válida capturada pelo dispositivo.
 *
 * Somente coordenadas que passaram pela validação [isValidGpsLocation] chegam aqui.
 * Nunca conterá 0,0 nem valores fora do range geográfico.
 */
data class GpsLocation(
    val latitude:  Double,
    val longitude: Double,
    val accuracy:  Float,           // metros
    val speed:     Float,           // m/s — converta para km/h ao exibir (× 3.6)
    val timestamp: Long = System.currentTimeMillis(),
)

// ──────────────────────────────────────────────────────────────────────────────
// Validação central de coordenadas GPS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Retorna true somente quando a localização contém coordenadas geograficamente
 * plausíveis para operação agrícola no Brasil.
 *
 * Regras:
 *  - Não nulo
 *  - Lat ∈ (-90, 90)  / Lng ∈ (-180, 180)  — range global válido
 *  - Não é (0.0, 0.0) — "null island", indica GPS não inicializado
 *  - accuracy ≤ 150 m  — descarta leituras com erro muito alto
 */
fun isValidGpsLocation(loc: GpsLocation?): Boolean {
    if (loc == null) return false
    if (loc.latitude  == 0.0 && loc.longitude == 0.0) return false
    if (loc.latitude  <= -90.0  || loc.latitude  >= 90.0)  return false
    if (loc.longitude <= -180.0 || loc.longitude >= 180.0) return false
    if (loc.accuracy > MAX_ACCURACY_METERS) return false
    return true
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Repositório de localização GPS baseado em FusedLocationProviderClient.
 *
 * - Atualiza [lastLocation] somente quando recebe uma posição válida.
 * - A última posição válida é preservada até ser substituída por outra válida.
 * - Deve ser injetado como @Singleton para que todos os consumidores compartilhem
 *   o mesmo estado.
 *
 * Uso:
 * ```kotlin
 * locationRepo.startTracking()          // no início da jornada
 * locationRepo.lastLocation.collect { loc -> ... }
 * locationRepo.stopTracking()           // ao encerrar a jornada
 * ```
 */
@Singleton
class LocationRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    private val _lastLocation = MutableStateFlow<GpsLocation?>(null)

    /** StateFlow da última posição GPS **válida** recebida. null = nenhuma posição ainda. */
    val lastLocation: StateFlow<GpsLocation?> = _lastLocation.asStateFlow()

    // Mantemos referência ao callback para poder remover depois
    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val androidLoc = result.lastLocation ?: return

            val candidate = GpsLocation(
                latitude  = androidLoc.latitude,
                longitude = androidLoc.longitude,
                accuracy  = androidLoc.accuracy,
                speed     = androidLoc.speed,
            )

            if (isValidGpsLocation(candidate)) {
                _lastLocation.value = candidate
                android.util.Log.d(
                    TAG,
                    "[GPS ok] lat=${candidate.latitude} lng=${candidate.longitude} " +
                    "acc=${candidate.accuracy}m spd=${String.format("%.1f", candidate.speed * 3.6f)}km/h"
                )
            } else {
                android.util.Log.w(
                    TAG,
                    "[GPS rejeitado] lat=${androidLoc.latitude} lng=${androidLoc.longitude} " +
                    "acc=${androidLoc.accuracy}m — mantendo última posição válida"
                )
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Inicia a captura de localização GPS de alta precisão.
     * Deve ser chamado após a permissão ACCESS_FINE_LOCATION ser concedida.
     */
    @SuppressLint("MissingPermission")
    fun startTracking() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_DISTANCE_METERS)
            .build()

        fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
        android.util.Log.i(TAG, "[GPS] tracking iniciado — intervalo=${INTERVAL_MS / 1000}s distMin=${MIN_DISTANCE_METERS}m")
    }

    /**
     * Para a captura de localização e libera recursos.
     * Chame ao encerrar a jornada ou quando o app for para background.
     */
    fun stopTracking() {
        fusedClient.removeLocationUpdates(locationCallback)
        android.util.Log.i(TAG, "[GPS] tracking encerrado")
    }

    // ──────────────────────────────────────────────────────────────────────────

    companion object {
        const val TAG                = "LocationRepository"
        private const val INTERVAL_MS        = 10_000L  // atualização preferencial: 10s
        private const val MIN_INTERVAL_MS    = 5_000L   // mínimo: 5s
        private const val MIN_DISTANCE_METERS = 10f     // mínimo: 10 metros
        private const val MAX_ACCURACY_METERS = 150f    // descarta acurácia pior que 150m
    }
}
