package br.com.siloops.apk.ui.fueling

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
import br.com.siloops.apk.databinding.FragmentFuelingBinding
import br.com.siloops.apk.ui.fueling.FuelingViewModel.UiState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Tela de registro de abastecimento (TPL 1 — ABASTECIMENTO).
 *
 * O operador informa:
 *  - Litros abastecidos (obrigatório, > 0)
 *  - Horímetro atual     (obrigatório, > 0)
 *  - Matrícula           (opcional)
 *  - Observações         (opcional)
 *
 * Ao confirmar:
 *  1. ViewModel valida localmente.
 *  2. UseCase grava no Outbox Room com UUID único.
 *  3. WorkManager sincroniza com a Central em background (retry exponencial).
 *  4. Tela exibe confirmação e retorna à tela anterior — não bloqueia aguardando rede.
 *
 * Funciona offline e após reinício do aplicativo (Room persiste o Outbox).
 */
@AndroidEntryPoint
class FuelingFragment : Fragment() {

    private var _binding: FragmentFuelingBinding? = null
    private val binding get() = _binding!!

    private val viewModel: FuelingViewModel by viewModels()

    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentFuelingBinding.inflate(inflater, container, false)
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
        // Back button
        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }

        // Pre-fill fleet code from session (read-only)
        lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.fleetCode.collect { code ->
                    binding.textFleetCode.text = code.ifBlank {
                        getString(R.string.fueling_no_active_session)
                    }
                }
            }
        }

        // Confirm button
        binding.btnConfirm.setOnClickListener {
            val liters     = binding.editDieselLiters.text?.toString() ?: ""
            val hourmeter  = binding.editHourmeter.text?.toString() ?: ""
            val operator   = binding.editOperatorRegistration.text?.toString()
            val obs        = binding.editObservations.text?.toString()
            viewModel.registerFueling(liters, hourmeter, operator, obs)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State observation

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is UiState.Idle -> {
                            binding.progressBar.isVisible = false
                            binding.btnConfirm.isEnabled  = true
                        }

                        is UiState.Loading -> {
                            binding.progressBar.isVisible = true
                            binding.btnConfirm.isEnabled  = false
                        }

                        is UiState.Success -> {
                            binding.progressBar.isVisible = false
                            binding.btnConfirm.isEnabled  = true
                            showSuccessAndNavigate(state.fleetCode)
                        }

                        is UiState.Error -> {
                            binding.progressBar.isVisible = false
                            binding.btnConfirm.isEnabled  = true
                            showError(state.message)
                            viewModel.resetState()
                        }
                    }
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Navigation & feedback

    private fun showSuccessAndNavigate(fleetCode: String) {
        Toast.makeText(
            requireContext(),
            getString(R.string.fueling_success, fleetCode),
            Toast.LENGTH_LONG,
        ).show()
        // Navigate back to operational menu
        findNavController().navigateUp()
    }

    private fun showError(message: String) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
    }
}
