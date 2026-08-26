"""Importador masivo de jerarquía Área → Especialidad → CC desde Excel.

Formato esperado (columnas, no importa el orden — buscadas por nombre):
    Cod01, Area, Cod02, Especialidad, Cod03, CentroCosto,
    TipoCosto (opcional), CodigoCeco (opcional)

Idempotente:
    - Upsert por (proyecto_id, codarea) para áreas
    - Upsert por (area_id, codespecialidad) para especialidades
    - Upsert por (especialidad_id, codcentrocosto) para CC
    - Todo en una sola transacción; si algo falla, rollback completo.

Retorna un resumen con contadores por nivel para feedback al usuario.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID

import openpyxl
from fastapi import HTTPException, status

from app.database import get_db

# ─── Nombres de columna aceptados (case-insensitive, con aliases) ──────────
COL_ALIASES = {
    "cod01":        ["cod01", "codigo_area", "cod_area", "codarea", "cod_1"],
    "area":         ["area", "nombre_area", "nbrarea", "area_nombre"],
    "cod02":        ["cod02", "codigo_esp", "cod_especialidad", "codespecialidad", "cod_2"],
    "especialidad": ["especialidad", "nombre_esp", "nbrespecialidad", "especialidad_nombre"],
    "cod03":        ["cod03", "codigo_cc", "cod_centrocosto", "codcentrocosto", "cod_3"],
    "cc":           ["centrocosto", "centro_costo", "nombre_cc", "nbrcentrocosto", "cc"],
    "tipocosto":    ["tipocosto", "tipo_costo", "tipo"],
    "codigoceco":   ["codigoceco", "codigo_ceco", "cec_final", "ceco"],
    "cecopalma":    ["cecopalma", "ceco_palma"],
    "descripcion":  ["descripcion", "descentrocosto", "desc"],
}


def _norm(s: Any) -> str:
    """Normaliza un header para matcheo (lower, sin espacios, sin puntuación)."""
    if s is None:
        return ""
    return "".join(c for c in str(s).lower() if c.isalnum() or c == "_")


def _build_col_map(header_row: tuple) -> Dict[str, int]:
    """Mapea nombre-canónico → índice de columna. Case/space insensitive."""
    normalized = [_norm(h) for h in header_row]
    col_map: Dict[str, int] = {}
    for canonical, aliases in COL_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                col_map[canonical] = normalized.index(alias)
                break
    return col_map


def _get(row: tuple, col_map: Dict[str, int], key: str) -> Any:
    idx = col_map.get(key)
    if idx is None:
        return None
    if idx >= len(row):
        return None
    v = row[idx]
    return v


def _str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _int_or_none(v: Any) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def parse_ceco_workbook(file_bytes: bytes) -> Dict[str, Any]:
    """Parsea el .xlsx en memoria. Retorna:
        {
          "columns_found": {...},
          "rows": [{cod01, area, cod02, esp, cod03, cc, ...}],
          "warnings": [str]
        }
    Levanta HTTPException(400) si falta alguna columna obligatoria.
    """
    from io import BytesIO
    try:
        wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True, read_only=True)
    except Exception as e:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"No se pudo abrir el Excel: {e}"
        )

    # Usa la primera hoja o busca una llamada "CecoGrecia" / "cecos" / "ceco"
    ws = None
    preferred = {"cecogrecia", "cecos", "ceco", "cecoazoramind"}
    for name in wb.sheetnames:
        if _norm(name) in preferred:
            ws = wb[name]
            break
    if ws is None:
        ws = wb[wb.sheetnames[0]]

    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El Excel está vacío")

    col_map = _build_col_map(header_row)

    # Columnas mínimas obligatorias
    required = ["cod01", "area", "cod03", "cc"]
    missing = [r for r in required if r not in col_map]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}. "
            f"Columnas encontradas: {list(header_row)}"
        )

    warnings = []
    parsed_rows = []
    for i, row in enumerate(rows_iter, start=2):
        if row is None or all(v is None or v == "" for v in row):
            continue  # skip empty
        cod01 = _int_or_none(_get(row, col_map, "cod01"))
        area = _str_or_none(_get(row, col_map, "area"))
        cod02 = _int_or_none(_get(row, col_map, "cod02"))
        esp = _str_or_none(_get(row, col_map, "especialidad"))
        cod03 = _int_or_none(_get(row, col_map, "cod03"))
        cc = _str_or_none(_get(row, col_map, "cc"))
        tipocosto = _str_or_none(_get(row, col_map, "tipocosto"))
        codigoceco = _str_or_none(_get(row, col_map, "codigoceco"))
        cecopalma = _str_or_none(_get(row, col_map, "cecopalma"))
        descripcion = _str_or_none(_get(row, col_map, "descripcion"))

        if cod01 is None or not area:
            warnings.append(f"Fila {i}: sin Cod01/Área — salteada")
            continue
        if cod03 is None or not cc:
            warnings.append(f"Fila {i}: sin Cod03/CC — salteada")
            continue

        # Si no hay especialidad, se usa una default "GENERAL" con cod02=0
        if cod02 is None:
            cod02 = 0
        if not esp:
            esp = "GENERAL"

        parsed_rows.append({
            "cod01": cod01,
            "area": area,
            "cod02": cod02,
            "esp": esp,
            "cod03": cod03,
            "cc": cc,
            "tipocosto": tipocosto,
            "codigoceco": codigoceco,
            "cecopalma": cecopalma,
            "descripcion": descripcion,
            "_source_row": i,
        })

    return {
        "columns_found": col_map,
        "sheet_name": ws.title,
        "rows": parsed_rows,
        "warnings": warnings,
    }


def import_to_proyecto(proyecto_id: UUID, parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Aplica el parseado a un proyecto. Idempotente + transaccional.

    Retorna resumen: {
        areas: {inserted, updated, total},
        especialidades: {inserted, updated, total},
        centros_costo: {inserted, updated, total},
        warnings: [...],
    }
    """
    rows = parsed["rows"]
    warnings = list(parsed["warnings"])

    counters = {
        "areas":         {"inserted": 0, "updated": 0, "total": 0},
        "especialidades":{"inserted": 0, "updated": 0, "total": 0},
        "centros_costo": {"inserted": 0, "updated": 0, "total": 0},
    }

    # Cachés por (cod) → id para evitar N+1
    area_cache: Dict[str, str] = {}       # codarea → id
    esp_cache: Dict[str, str] = {}        # f"{area_id}:{codespecialidad}" → id

    with get_db() as conn, conn.cursor() as cur:
        # Verificar que el proyecto existe
        cur.execute("SELECT id FROM construccion.m_proyecto WHERE id = %s;", (str(proyecto_id),))
        if not cur.fetchone():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Proyecto no encontrado")

        for r in rows:
            codarea = str(r["cod01"])
            codesp = str(r["cod02"])
            codcc = str(r["cod03"])

            # ── ÁREA ──────────────────────────────────
            area_id = area_cache.get(codarea)
            if area_id is None:
                cur.execute(
                    """
                    INSERT INTO construccion.m_area (proyecto_id, codarea, nbrarea)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (proyecto_id, codarea) DO UPDATE
                        SET nbrarea = EXCLUDED.nbrarea
                    RETURNING id, (xmax = 0) AS was_inserted;
                    """,
                    (str(proyecto_id), codarea, r["area"]),
                )
                row_a = cur.fetchone()
                area_id = row_a["id"]
                area_cache[codarea] = area_id
                if row_a["was_inserted"]:
                    counters["areas"]["inserted"] += 1
                else:
                    counters["areas"]["updated"] += 1
                counters["areas"]["total"] += 1

            # ── ESPECIALIDAD ──────────────────────────
            esp_key = f"{area_id}:{codesp}"
            esp_id = esp_cache.get(esp_key)
            if esp_id is None:
                cur.execute(
                    """
                    INSERT INTO construccion.m_especialidad
                        (area_id, codespecialidad, nbrespecialidad)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (codespecialidad, area_id) DO UPDATE
                        SET nbrespecialidad = EXCLUDED.nbrespecialidad
                    RETURNING id, (xmax = 0) AS was_inserted;
                    """,
                    (area_id, codesp, r["esp"]),
                )
                row_e = cur.fetchone()
                esp_id = row_e["id"]
                esp_cache[esp_key] = esp_id
                if row_e["was_inserted"]:
                    counters["especialidades"]["inserted"] += 1
                else:
                    counters["especialidades"]["updated"] += 1
                counters["especialidades"]["total"] += 1

            # ── CENTRO DE COSTO ───────────────────────
            # Unique key: (especialidad_id, codcentrocosto). No hay unique en
            # DB para este par actualmente — usamos SELECT + INSERT/UPDATE.
            cur.execute(
                """
                SELECT id FROM construccion.m_centrocosto
                 WHERE especialidad_id = %s AND codcentrocosto = %s
                 LIMIT 1;
                """,
                (esp_id, codcc),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    """
                    UPDATE construccion.m_centrocosto SET
                           nbrcentrocosto = %s,
                           tipocentrocosto = COALESCE(%s, tipocentrocosto),
                           codigo_ceco = COALESCE(%s, codigo_ceco),
                           ceco_palma = COALESCE(%s, ceco_palma),
                           descentrocosto = COALESCE(%s, descentrocosto)
                     WHERE id = %s;
                    """,
                    (r["cc"], r["tipocosto"], r["codigoceco"],
                     r["cecopalma"], r["descripcion"], existing["id"]),
                )
                counters["centros_costo"]["updated"] += 1
            else:
                cur.execute(
                    """
                    INSERT INTO construccion.m_centrocosto
                        (especialidad_id, codcentrocosto, nbrcentrocosto,
                         tipocentrocosto, codigo_ceco, ceco_palma, descentrocosto)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """,
                    (esp_id, codcc, r["cc"], r["tipocosto"], r["codigoceco"],
                     r["cecopalma"], r["descripcion"]),
                )
                counters["centros_costo"]["inserted"] += 1
            counters["centros_costo"]["total"] += 1

    return {
        **counters,
        "warnings": warnings,
        "processed_rows": len(rows),
        "sheet_name": parsed.get("sheet_name"),
    }
