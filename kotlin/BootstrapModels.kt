package br.com.siloops.apk.data.bootstrap

import com.google.gson.annotations.SerializedName

// ─── DTOs (JSON → Kotlin) ────────────────────────────────────────────────────

/**
 * Equipamento recebido no pacote bootstrap.
 * Somente campos necessários na tela Seleção Operacional.
 */
data class EquipmentDto(
    @SerializedName("id")            val id: String,
    @SerializedName("code")          val code: String,
    @SerializedName("brand")         val brand: String? = null,
    @SerializedName("status")        val status: String? = null,
    @SerializedName("entityStatus")  val entityStatus: String? = null,
    @SerializedName("mobileEnabled") val mobileEnabled: Boolean? = null,
    @SerializedName("hourmeter")     val hourmeter: Double? = null,
)

/**
 * Ordem de Serviço recebida no pacote bootstrap.
 */
data class WorkOrderDto(
    @SerializedName("id")            val id: String,
    @SerializedName("code")          val code: String,
    // number: sempre preenchido pelo bootstrap (fallback em cadeia). Nunca sera null.
    @SerializedName("number")        val number: String? = null,
    @SerializedName("displayName")   val displayName: String? = null,
    @SerializedName("description")   val description: String? = null,
    @SerializedName("type")          val type: String? = null,
    @SerializedName("priority")      val priority: String? = null,
    @SerializedName("status")        val status: String,
    @SerializedName("equipmentId")   val equipmentId: String? = null,
    @SerializedName("operatorId")    val operatorId: String? = null,
    @SerializedName("costCenterId")  val costCenterId: String? = null,
    @SerializedName("operationId")   val operationId: String? = null,
    @SerializedName("openedAt")      val openedAt: String? = null,
    @SerializedName("createdAt")     val createdAt: String? = null,
    @SerializedName("updatedAt")     val updatedAt: String? = null,
) {
    /**
     * Retorna o numero limpo da OS. Nunca null.
     * Fallback: number -> code -> id -> "SEM_NUMERO"
     * Garante que WorkOrderEntity.number (nao-nulo) nunca recebe null.
     */
    fun safeNumber(): String =
        number?.takeIf { it.isNotBlank() }
            ?: code.takeIf { it.isNotBlank() }
            ?: id.takeIf { it.isNotBlank() }
            ?: "SEM_NUMERO"

    fun safeDisplayName(): String =
        displayName?.takeIf { it.isNotBlank() }
            ?: "OS ${safeNumber()}"
}

/**
 * Centro de Custo recebido no pacote bootstrap.
 */
data class CostCenterDto(
    @SerializedName("id")          val id: String,
    @SerializedName("code")        val code: String,
    @SerializedName("name")        val name: String,
    @SerializedName("description") val description: String? = null,
    @SerializedName("status")      val status: String,
)

/**
 * Implemento recebido no pacote bootstrap.
 */
data class ImplementDto(
    @SerializedName("id")          val id: String,
    @SerializedName("code")        val code: String,
    @SerializedName("name")        val name: String,
    @SerializedName("status")      val status: String? = null,
    @SerializedName("typeId")      val typeId: String? = null,
)

/**
 * Operação recebida no pacote bootstrap.
 */
data class OperationDto(
    @SerializedName("id")          val id: String,
    @SerializedName("type")        val type: String,
    @SerializedName("status")      val status: String? = null,
    @SerializedName("equipmentId") val equipmentId: String? = null,
    @SerializedName("operatorId")  val operatorId: String? = null,
    @SerializedName("start")       val start: String? = null,
)

/**
 * Resposta completa do endpoint GET /api/mobile/bootstrap.
 */
data class BootstrapResponse(
    @SerializedName("tenantId")    val tenantId: String,
    @SerializedName("operatorId")  val operatorId: String? = null,
    @SerializedName("equipments")  val equipments: List<EquipmentDto> = emptyList(),
    @SerializedName("workOrders")  val workOrders: List<WorkOrderDto> = emptyList(),
    @SerializedName("costCenters") val costCenters: List<CostCenterDto> = emptyList(),
    @SerializedName("implements")  val implements: List<ImplementDto> = emptyList(),
    @SerializedName("operations")  val operations: List<OperationDto> = emptyList(),
    @SerializedName("updatedAt")   val updatedAt: String,
    @SerializedName("version")     val version: String,
)

// ─── Domain models (UI layer) ─────────────────────────────────────────────────

/** Item exibido nos spinners/listas da tela Seleção Operacional. */
data class SelectionItem(
    val id: String,
    val displayLabel: String,       // texto exibido no dropdown / lista
    val secondaryLabel: String? = null,
)

fun EquipmentDto.toSelectionItem() = SelectionItem(
    id = id,
    displayLabel = code,
    secondaryLabel = brand,
)

fun WorkOrderDto.toSelectionItem() = SelectionItem(
    id = id,
    displayLabel = safeDisplayName(),
    secondaryLabel = description,
)

fun CostCenterDto.toSelectionItem() = SelectionItem(
    id = id,
    displayLabel = "$code – $name",
    secondaryLabel = description,
)

fun ImplementDto.toSelectionItem() = SelectionItem(
    id = id,
    displayLabel = "$code – $name",
)

fun OperationDto.toSelectionItem() = SelectionItem(
    id = id,
    displayLabel = type,
    secondaryLabel = status,
)
