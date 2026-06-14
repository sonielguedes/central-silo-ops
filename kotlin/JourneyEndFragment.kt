package br.com.siloops.apk.ui.journey

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import br.com.siloops.apk.R
import br.com.siloops.apk.databinding.FragmentJourneyEndBinding
import br.com.siloops.apk.domain.journey.JourneyEndUseCase
import br.com.siloops.apk.ui.journey.JourneyEndViewModel.UiState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Tela de encerramento de jornada.
 *
 * O operador informa o horímetro final (ou confirma sem horímetro
 * quando a coleta é via CAN/CELULAR).  Após confirmação o UseCase
 * envia o evento JOURNEY_END para o outbox e navega à tela inicial.
 */
@AndroidEntryPoint
class JourneyEndFragment : Fragment() {

    private var _binding: FragmentJourneyEndBinding? = null
    private val binding get() = _binding!!

    private val viewModel: JourneyEndViewModel by viewModels()

    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentJourneyEndBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUi()
        observeState()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI setup

    private fun setupUi() {
        // Pre-fill hourmeterStart from active session (read-only label)
        viewModel.sessionSummary.observe(viewLifecycleOwner) { summary ->
            binding.tvHourmeterStart.text = summary.hourmeterStartFormatted
            binding.tvOperator.text      = summary.operatorName
            binding.tvOperation.text     = summary.operationName
            binding.tvJourneyId.text     = summary.journeyId ?: getString(R.string.journey_id_unknown)
        }

        binding.btnConfirm.setOnClickListener { onConfirmClicked() }
        binding.btnCancel.setOnClickListener { findNavController().popBackStack() }
    }

    private fun onConfirmClicked() {
        val hourmeterEndRaw = binding.etHourmeterEnd.text?.toString()?.trim()
        val hourmeterEnd    = hourmeterEndRaw?.toDoubleOrNull()

        // Validate: if field is filled it must be a positive number
        if (!hourmeterEndRaw.isNullOrEmpty() && hourmeterEnd == null) {
            binding.tilHourmeterEnd.error = getString(R.string.error_invalid_hourmeter)
            return
        }
        binding.tilHourmeterEnd.error = null

        val latitude  = viewModel.lastLatitude
        val longitude = viewModel.lastLongitude
        val accuracy  = viewModel.lastAccuracy

        viewModel.endJourney(
            hourmeterEnd = hourmeterEnd,
            latitude     = latitude,
            longitude    = longitude,
            accuracy     = accuracy,
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State observation

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        UiState.Idle    -> setLoading(false)
                        UiState.Loading -> setLoading(true)

                        is UiState.Success -> {
                            setLoading(false)
                            Toast.makeText(
                                requireContext(),
                                getString(R.string.journey_ended_success),
                                Toast.LENGTH_SHORT,
                            ).show()
                            // Clear active session and return to start screen
                            findNavController().navigate(R.id.action_journeyEnd_to_start)
                        }

                        is UiState.Error -> {
                            setLoading(false)
                            Toast.makeText(
                                requireContext(),
                                state.message,
                                Toast.LENGTH_LONG,
                            ).show()
                        }
                    }
                }
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.progressBar.isVisible = loading
        binding.btnConfirm.isEnabled  = !loading
        binding.btnCancel.isEnabled   = !loading
        binding.etHourmeterEnd.isEnabled = !loading
    }
}
