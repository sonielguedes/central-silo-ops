package br.com.siloops.apk.ui.operational

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import br.com.siloops.apk.R
import br.com.siloops.apk.data.bootstrap.SelectionItem
import br.com.siloops.apk.data.session.ActiveSessionRepository
import br.com.siloops.apk.databinding.FragmentOperationalSelectionBinding
import br.com.siloops.apk.ui.operational.BootstrapViewModel.UiState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Tela "Seleção Operacional" — primeira tela após o login do operador.
 *
 * Fluxo:
 *  1. Ao abrir: testa conexão e busca /api/mobile/bootstrap.
 *  2. Preenche dropdowns com dados da Central (sem digitação livre).
 *  3. Campos obrigatórios: Frota, OS, Centro de Custo, Operação.
 *  4. Implemento: opcional.
 *  5. "Iniciar Operação" só é habilitado quando os 4 obrigatórios estão preenchidos.
 *  6. Sem dados locais: exibe aviso e bloqueia completamente.
 *
 * UX:
 *  - Nenhum campo de texto livre onde houver cadastro da Central.
 *  - Seleção exclusivamente via dropdown/spinner com dados vindos do bootstrap.
 *
 * Mensagens obrigatórias (todos os strings referenciados por R.string.*):
 *  - "Sincronizando dados da Central..."
 *  - "Dados carregados com sucesso."
 *  - "Sem dados da Central. Sincronize antes de iniciar."
 *  - "Você está offline. Usando últimos dados sincronizados."
 */
@AndroidEntryPoint
class OperationalSelectionFragment : Fragment() {

    private var _binding: FragmentOperationalSelectionBinding? = null
    private val binding get() = _binding!!

    private val viewModel: BootstrapViewModel by viewModels()
    @Inject lateinit var sessionRepo: ActiveSessionRepository

    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentOperationalSelectionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupListeners()
        observeState()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── Listeners ─────────────────────────────────────────────────────────────

    private fun setupListeners() {
        binding.btnSync.setOnClickListener { viewModel.sync() }
        binding.btnStart.setOnClickListener { onStartClicked() }

        // Spinners — seleção exclusiva via lista (sem digitação livre)
        bindSpinner(binding.spinnerEquipment)  { viewModel.selectEquipment(it) }
        bindSpinner(binding.spinnerWorkOrder)  { viewModel.selectWorkOrder(it) }
        bindSpinner(binding.spinnerCostCenter) { viewModel.selectCostCenter(it) }
        bindSpinner(binding.spinnerOperation)  { viewModel.selectOperation(it) }
        // Implemento — opcional: primeiro item = "Nenhum"
        bindSpinnerOptional(binding.spinnerImplement) { viewModel.selectImplement(it) }
    }

    private fun bindSpinner(
        spinner: android.widget.Spinner,
        onSelect: (SelectionItem) -> Unit,
    ) {
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, v: View?, pos: Int, id: Long) {
                val adapter = parent.adapter as? SelectionAdapter ?: return
                // pos 0 = hint "Selecione…" — ignorar
                if (pos > 0) onSelect(adapter.getItem(pos - 1))
            }
            override fun onNothingSelected(parent: AdapterView<*>) = Unit
        }
    }

    private fun bindSpinnerOptional(
        spinner: android.widget.Spinner,
        onSelect: (SelectionItem?) -> Unit,
    ) {
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, v: View?, pos: Int, id: Long) {
                val adapter = parent.adapter as? SelectionAdapter ?: return
                // pos 0 = "Nenhum" (sem implemento)
                onSelect(if (pos == 0) null else adapter.getItem(pos - 1))
            }
            override fun onNothingSelected(parent: AdapterView<*>) = Unit
        }
    }

    // ── State observation ─────────────────────────────────────────────────────

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state -> render(state) }
            }
        }
    }

    private fun render(state: UiState) {
        when (state) {
            is UiState.Idle    -> renderIdle()
            is UiState.Syncing -> renderSyncing()
            is UiState.Loaded  -> renderLoaded(state)
            is UiState.Offline -> renderLoaded(state.data, forceOfflineBanner = true)
            is UiState.NoData  -> renderNoData()
            is UiState.Error   -> renderError(state)
        }
    }

    private fun renderIdle() {
        binding.progressBar.isVisible = false
        binding.groupSelections.isVisible = false
        binding.bannerOffline.isVisible = false
        binding.bannerNoData.isVisible = false
        binding.btnStart.isEnabled = false
    }

    private fun renderSyncing() {
        binding.progressBar.isVisible = true
        binding.groupSelections.isVisible = false
        binding.bannerOffline.isVisible = false
        binding.bannerNoData.isVisible = false
        binding.btnStart.isEnabled = false
        binding.tvStatusMessage.text = getString(R.string.bootstrap_syncing)
        binding.tvStatusMessage.isVisible = true
    }

    private fun renderLoaded(state: UiState.Loaded, forceOfflineBanner: Boolean = false) {
        binding.progressBar.isVisible = false
        binding.groupSelections.isVisible = true
        binding.bannerNoData.isVisible = false

        val isOffline = state.isOffline || forceOfflineBanner
        binding.bannerOffline.isVisible = isOffline
        if (isOffline) {
            binding.tvBannerOffline.text = getString(R.string.bootstrap_offline_banner)
        }

        binding.tvStatusMessage.text = if (isOffline)
            getString(R.string.bootstrap_offline_banner)
        else
            getString(R.string.bootstrap_loaded_success)
        binding.tvStatusMessage.isVisible = true

        // Preencher spinners
        populateSpinner(binding.spinnerEquipment,  state.equipments,  hintRes = R.string.hint_select_equipment)
        populateSpinner(binding.spinnerWorkOrder,  state.workOrders,  hintRes = R.string.hint_select_work_order)
        populateSpinner(binding.spinnerCostCenter, state.costCenters, hintRes = R.string.hint_select_cost_center)
        populateSpinner(binding.spinnerOperation,  state.operations,  hintRes = R.string.hint_select_operation)
        populateSpinnerOptional(binding.spinnerImplement, state.implements, noneLabel = getString(R.string.hint_no_implement))

        // Restaurar seleções persistidas (rotação de tela etc.)
        restoreSelection(binding.spinnerEquipment,  state.selection.equipment)
        restoreSelection(binding.spinnerWorkOrder,  state.selection.workOrder)
        restoreSelection(binding.spinnerCostCenter, state.selection.costCenter)
        restoreSelection(binding.spinnerOperation,  state.selection.operation)
        restoreSelection(binding.spinnerImplement,  state.selection.implement, optional = true)

        binding.btnStart.isEnabled = state.canStart
    }

    private fun renderNoData() {
        binding.progressBar.isVisible = false
        binding.groupSelections.isVisible = false
        binding.bannerOffline.isVisible = false
        binding.bannerNoData.isVisible = true
        binding.tvStatusMessage.text = getString(R.string.bootstrap_no_data)
        binding.tvStatusMessage.isVisible = true
        binding.btnStart.isEnabled = false
    }

    private fun renderError(state: UiState.Error) {
        binding.progressBar.isVisible = false
        binding.bannerNoData.isVisible = !state.hasCached
        binding.groupSelections.isVisible = state.hasCached
        binding.tvStatusMessage.text = state.message
        binding.tvStatusMessage.isVisible = true
        binding.btnStart.isEnabled = false
        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
    }

    // ── Start operation ───────────────────────────────────────────────────────

    private fun onStartClicked() {
        viewLifecycleOwner.lifecycleScope.launch {
            val active = runCatching { sessionRepo.getActive() }.getOrNull()
            if (active != null) {
                Toast.makeText(
                    requireContext(),
                    "Já existe uma jornada ativa para este comboio. Finalize a jornada atual antes de iniciar outra.",
                    Toast.LENGTH_LONG,
                ).show()
                findNavController().navigateUp()
                return@launch
            }

            val selection = viewModel.getReadySelection() ?: return@launch

            // Navegar para tela de início de jornada com os IDs selecionados
            val action = OperationalSelectionFragmentDirections
                .actionOperationalSelectionToJourneyStart(
                    equipmentId  = selection.equipment!!.id,
                    workOrderId  = selection.workOrder!!.id,
                    costCenterId = selection.costCenter!!.id,
                    operationId  = selection.operation!!.id,
                    implementId  = selection.implement?.id,
                )
            findNavController().navigate(action)
        }
    }

    // ── Spinner helpers ───────────────────────────────────────────────────────

    private fun populateSpinner(
        spinner: android.widget.Spinner,
        items: List<SelectionItem>,
        hintRes: Int,
    ) {
        val labels = mutableListOf(getString(hintRes)).also { list ->
            items.forEach { item ->
                val label = if (item.secondaryLabel != null)
                    "${item.displayLabel} — ${item.secondaryLabel}"
                else item.displayLabel
                list.add(label)
            }
        }
        spinner.adapter = SelectionAdapter(requireContext(), labels, items)
    }

    private fun populateSpinnerOptional(
        spinner: android.widget.Spinner,
        items: List<SelectionItem>,
        noneLabel: String,
    ) {
        val labels = mutableListOf(noneLabel).also { list ->
            items.forEach { item ->
                list.add("${item.displayLabel}${if (item.secondaryLabel != null) " — ${item.secondaryLabel}" else ""}")
            }
        }
        spinner.adapter = SelectionAdapter(requireContext(), labels, items)
    }

    private fun restoreSelection(
        spinner: android.widget.Spinner,
        item: SelectionItem?,
        optional: Boolean = false,
    ) {
        if (item == null) return
        val adapter = spinner.adapter as? SelectionAdapter ?: return
        val offset = if (optional) 1 else 1  // hint = pos 0
        val pos = adapter.indexOfId(item.id)
        if (pos >= 0) spinner.setSelection(pos + offset)
    }

    // ── SelectionAdapter ──────────────────────────────────────────────────────

    /**
     * Adapter simples que mantém a lista de [SelectionItem] paralela
     * às labels exibidas no spinner.
     */
    private class SelectionAdapter(
        context: android.content.Context,
        labels: List<String>,
        private val items: List<SelectionItem>,
    ) : ArrayAdapter<String>(context, android.R.layout.simple_spinner_item, labels) {

        init { setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }

        /** Retorna o [SelectionItem] na posição (sem contar o hint). */
        fun getItem(posWithoutHint: Int): SelectionItem = items[posWithoutHint]

        /** Localiza a posição do item pelo id (sem contar o hint). */
        fun indexOfId(id: String): Int = items.indexOfFirst { it.id == id }
    }
}
