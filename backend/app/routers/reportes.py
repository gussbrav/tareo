"""Endpoints de reportes: KPIs y export Excel."""
from datetime import date, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from app.auth.dependencies import get_current_user, require_role
from app.auth.schemas import UserPublic
from app.repositories import reportes as repo

router = APIRouter(prefix="/api/reportes", tags=["reportes"])


def _default_range() -> tuple[date, date]:
    """Default: últimos 30 días hasta hoy."""
    hoy = date.today()
    return hoy - timedelta(days=30), hoy


@router.get("/kpis")
def kpis(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    _: UserPublic = Depends(get_current_user),
):
    d, h = _default_range()
    d = desde or d
    h = hasta or h
    return {
        "rango": {"desde": d.isoformat(), "hasta": h.isoformat()},
        "generales": repo.kpis_generales(d, h),
        "por_trabajador": repo.horas_por_trabajador(d, h),
        "por_semana": repo.horas_por_semana(d, h),
        "por_centro_costo": repo.horas_por_centro_costo(d, h),
    }


@router.get(
    "/actividades.xlsx",
    dependencies=[Depends(require_role("admin", "supervisor"))],
)
def export_excel(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
) -> StreamingResponse:
    d, h = _default_range()
    d = desde or d
    h = hasta or h
    rows = repo.actividades_para_export(d, h)

    wb = Workbook()
    ws = wb.active
    ws.title = "Actividades"

    headers = [
        "Fecha", "Semana", "Trabajador", "Documento", "Categoría",
        "Descripción", "Hora inicio", "Hora fin", "Duración (min)", "Estado",
        "Contrato", "CECO", "Centro de costo", "Observaciones",
    ]
    keys = [
        "fecactividad", "numsemana", "trabajador", "documento", "categoria",
        "desactividad", "hora_inicio", "hora_fin", "duracion_min", "estado",
        "contrato", "ceco", "centro_costo", "observaciones",
    ]

    header_fill = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    for col, name in enumerate(headers, start=1):
        c = ws.cell(row=1, column=col, value=name)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center")

    for i, row in enumerate(rows, start=2):
        for col, key in enumerate(keys, start=1):
            v = row.get(key)
            if hasattr(v, "isoformat"):
                v = v.isoformat() if key != "fecactividad" else v.strftime("%Y-%m-%d")
            ws.cell(row=i, column=col, value=v)

    # Autoancho aproximado
    for col in range(1, len(headers) + 1):
        max_len = max(
            (len(str(ws.cell(row=r, column=col).value or "")) for r in range(1, len(rows) + 2)),
            default=10,
        )
        ws.column_dimensions[get_column_letter(col)].width = min(max(max_len + 2, 12), 45)

    ws.freeze_panes = "A2"

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"tareo_{d.isoformat()}_a_{h.isoformat()}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
