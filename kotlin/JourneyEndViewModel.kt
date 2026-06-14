package br.com.siloops.apk.ui.journey

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.siloops.apk.data.location.LocationRepository
import br.com.siloops.apk.data.session.ActiveSessionRepository
import br.com.siloops.apk.domain.journey.JourneyEndUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class JourneyEndViewModel @Inject constructor(
    private val journeyEndUseCase: JourneyEndUseCase,
    private val sessionRepo:       ActiveSessionRepository,
    private val locationRepo:      LocationRepository,
) : ViewModel() {

    sealed class UiState {
        object Idle    : UiState()
        object Loading : UiState()
        data class Success(val offlineId: String) : UiState()
        data class Error(val message: String)     : UiState()
    }

    data class SessionSummary(
        val journeyId:               String?,
        val operatorName:            String,
        val operationName:           String,
        val hourmeterStartFormatted: String,
    )

    // ─────────────────────────────────────────────────────────────────────────

    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _sessionSummary = MutableLiveData<SessionSummary>()
    val sessionSummary: LiveData<SessionSummary> = _sessionSummary

    // Cached last known GPS (updated by LocationRepository observer in real impl)
    var lastLatitude:  Double? = null
    var lastLongitude: Double? = null
    var lastAccuracy:  Float?  = null

    // ─────────────────────────────────────────────────────────────────────────

    init {
        loadSession()
        observeLocation()
    }

    private fun loadSession() {
        viewModelScope.launch {
            val session = sessionRepo.getActive()
            if (session != null) {
                val hStart = session.hourmeterStart
                val formatted = if (hStart != null) {
                    val h = hStart.toInt()
                    val min = ((hStart - h) * 60).toInt()
                    "${h}h ${min}min"
                } else "—"

                _sessionSummary.value = SessionSummary(
                    journeyId               = session.journeyId,
                    operatorName            = session.operatorName ?: "—",
                    operationName           = session.operationName ?: "—",
                    hourmeterStartFormatted = formatted,
                )
            }
        }
    }

    private fun observeLocation() {
        viewModelScope.launch {
            locationRepo.lastLocation.collect { loc ->
                lastLatitude  = loc?.latitude
                lastLongitude = loc?.longitude
                lastAccuracy  = loc?.accuracy
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    fun endJourney(
        hourmeterEnd: Double?,
        latitude:     Double?,
        longitude:    Double?,
        accuracy:     Float?,
    ) {
        if (_uiState.value == UiState.Loading) return

        _uiState.value = UiState.Loading

        viewModelScope.launch {
            val result = journeyEndUseCase.execute(
                JourneyEndUseCase.Params(
                    hourmeterEnd = hourmeterEnd,
                    latitude     = latitude,
                    longitude    = longitude,
                    accuracy     = accuracy,
                )
            )
            _uiState.value = when (result) {
                is JourneyEndUseCase.Result.Success ->
                    UiState.Success(result.offlineId)
                is JourneyEndUseCase.Result.Error   ->
                    UiState.Error(result.message)
            }
        }
    }
}
