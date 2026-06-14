package br.com.siloops.apk.ui.fueling

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.siloops.apk.data.session.ActiveSessionRepository
import br.com.siloops.apk.domain.fueling.FuelingUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel para a tela de registro de abastecimento (TPL 1 — ABASTECIMENTO).
 *
 * Expõe:
 *  - [uiState] — estado reativo da operação (Idle / Loading / Success / Error).
 *  - [fleetCode] — frota da sessão ativa (pré-preenchida na UI).
 *  - [registerFueling] — aciona o UseCase com os dados do formulário.
 */
@HiltViewModel
class FuelingViewModel @Inject constructor(
    private val fuelingUseCase: FuelingUseCase,
    private val sessionRepo:    ActiveSessionRepository,
) : ViewModel() {

    // ── UI State ──────────────────────────────────────────────────────────────

    sealed class UiState {
        object Idle    : UiState()
        object Loading : UiState()
        /** [offlineId] é o UUID do Outbox para rastreamento de sincronização. */
        data class Success(val offlineId: String, val fleetCode: String) : UiState()
        data class Error(val message: String) : UiState()
    }

    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _fleetCode = MutableStateFlow<String>("")
    val fleetCode: StateFlow<String> = _fleetCode.asStateFlow()

    // ── Init ──────────────────────────────────────────────────────────────────

    init {
        loadSession()
    }

    private fun loadSession() {
        viewModelScope.launch {
            val session = sessionRepo.getActive()
            _fleetCode.value = session?.fleetCode ?: ""
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    /**
     * Registra o abastecimento no Outbox (offline-first).
     *
     * @param dieselLitersText  Texto do campo de litros (convertido internamente para Double).
     * @param hourmeterText     Texto do campo de horímetro (convertido internamente para Double).
     * @param operatorRegistration Matrícula do operador (opcional).
     * @param observations      Observações livres (opcional).
     */
    fun registerFueling(
        dieselLitersText:     String,
        hourmeterText:        String,
        operatorRegistration: String? = null,
        observations:         String? = null,
    ) {
        if (_uiState.value is UiState.Loading) return

        val liters = dieselLitersText.trim().replace(',', '.').toDoubleOrNull()
        if (liters == null || liters <= 0.0) {
            _uiState.value = UiState.Error("Informe um valor de litros válido (maior que 0).")
            return
        }

        val hm = hourmeterText.trim().replace(',', '.').toDoubleOrNull()
        if (hm == null || hm <= 0.0) {
            _uiState.value = UiState.Error("Informe um horímetro válido (maior que 0).")
            return
        }

        _uiState.value = UiState.Loading

        viewModelScope.launch {
            val result = fuelingUseCase.execute(
                FuelingUseCase.Params(
                    dieselLiters         = liters,
                    hourmeter            = hm,
                    operatorRegistration = operatorRegistration?.takeIf { it.isNotBlank() },
                    observations         = observations?.takeIf { it.isNotBlank() },
                )
            )

            _uiState.value = when (result) {
                is FuelingUseCase.Result.Success ->
                    UiState.Success(
                        offlineId = result.offlineId,
                        fleetCode = _fleetCode.value,
                    )
                is FuelingUseCase.Result.Error ->
                    UiState.Error(result.message)
            }
        }
    }

    /** Redefine o estado para Idle (usado após fechar dialog de erro/sucesso). */
    fun resetState() {
        _uiState.value = UiState.Idle
    }
}
