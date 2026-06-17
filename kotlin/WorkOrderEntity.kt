package br.com.siloops.apk.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import br.com.siloops.apk.data.bootstrap.WorkOrderDto

/**
 * Room entity para Ordem de Servico.
 *
 * IMPORTANTE: `number` e declarado NOT NULL no banco.
 * O mapper WorkOrderDto.toEntity() NUNCA passa null para este campo —
 * usa WorkOrderDto.safeNumber() como fallback em cadeia:
 *   dto.number -> dto.code -> dto.id -> "SEM_NUMERO"
 *
 * Isso corrige o crash:
 *   "Parameter specified as non-null is null: method WorkOrderEntity.<init>, parameter number"
 */
@Entity(tableName = "work_orders")
data class WorkOrderEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    /** Numero limpo da OS (ex: "100"). Nunca null — usa safeNumber() no mapper. */
    @ColumnInfo(name = "number")
    val number: String,

    @ColumnInfo(name = "code")
    val code: String,

    @ColumnInfo(name = "display_name")
    val displayName: String,

    @ColumnInfo(name = "description")
    val description: String?,

    @ColumnInfo(name = "type")
    val type: String?,

    @ColumnInfo(name = "priority")
    val priority: String?,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "equipment_id")
    val equipmentId: String?,

    @ColumnInfo(name = "operator_id")
    val operatorId: String?,

    @ColumnInfo(name = "cost_center_id")
    val costCenterId: String?,

    @ColumnInfo(name = "operation_id")
    val operationId: String?,

    @ColumnInfo(name = "opened_at")
    val openedAt: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: String?,

    @ColumnInfo(name = "updated_at")
    val updatedAt: String?,
)

// ─── Mapper DTO → Entity ──────────────────────────────────────────────────────

/**
 * Converte WorkOrderDto (JSON) para WorkOrderEntity (Room).
 *
 * A propriedade `number` do entity e NOT NULL. Usamos [WorkOrderDto.safeNumber]
 * que aplica fallback: dto.number ?: dto.code ?: dto.id ?: "SEM_NUMERO".
 * Isso previne o NPE em WorkOrderEntity.<init> quando o servidor envia
 * uma OS com `number` ausente ou null.
 */
fun WorkOrderDto.toEntity(): WorkOrderEntity {
    val safeNum = safeNumber()   // nunca null nem blank
    if (safeNum == "SEM_NUMERO") {
        android.util.Log.e("WorkOrderMapper", "OS id=$id nao possui numero valido. Salvo como SEM_NUMERO.")
    }
    return WorkOrderEntity(
        id           = id,
        number       = safeNum,
        code         = code.takeIf { it.isNotBlank() } ?: safeNum,
        displayName  = safeDisplayName(),
        description  = description,
        type         = type,
        priority     = priority,
        status       = status,
        equipmentId  = equipmentId?.takeIf { it.isNotBlank() },
        operatorId   = operatorId?.takeIf { it.isNotBlank() },
        costCenterId = costCenterId?.takeIf { it.isNotBlank() },
        operationId  = operationId?.takeIf { it.isNotBlank() },
        openedAt     = openedAt,
        createdAt    = createdAt,
        updatedAt    = updatedAt,
    )
}

/**
 * Converte uma lista de DTOs para entities.
 * Filtra DTOs invalidos (id vazio) antes de mapear.
 */
fun List<WorkOrderDto>.toEntities(): List<WorkOrderEntity> =
    filter { it.id.isNotBlank() }.map { it.toEntity() }
