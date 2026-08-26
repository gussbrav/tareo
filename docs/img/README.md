# Capturas del brochure

Coloca aquí los 6 screenshots del sistema. Formato: `captura-01.png` a `captura-06.png` (también acepta .jpg).

## Qué capturar en cada slot

| Archivo | Página | Qué capturar |
|---------|--------|---|
| `captura-01.png` | 2 | Vista `/dashboard` completa: los 6 KPI cards en la fila superior + el gráfico de tendencia diaria debajo. Aspecto horizontal (idealmente 16:10). |
| `captura-02.png` | 4 | `/actividades/nueva` con las 2 secciones (Selección de fecha y trabajo + Registro de actividad) y algunos trabajadores en el listado inferior. Aspecto vertical/cuadrado. |
| `captura-03.png` | 4 | `/tareo` con 3-4 tarjetas de actividades visibles (avatares de iniciales, StatusPill verde/gris, buscador arriba). Aspecto vertical. |
| `captura-04.png` | 5 | `/agenda` vista Mes con actividades cargadas — la grilla completa con pills coloreadas y el toggle Mes/Semana/Lista arriba. Aspecto vertical. |
| `captura-05.png` | 5 | `/dashboard` vista completa con KPIs + tendencia + ranking + donut (lo mismo que captura-01 pero más completo — puedes reusar). Aspecto vertical. |
| `captura-06.png` | 6 | `/configuracion` → Áreas → botón "Importar Excel" → modal abierto en fase "idle" (con el banner "¿Primera vez?" y el dropzone). |

## Tips para las capturas

- **Resolución mínima recomendada:** 1400×900 px. Chrome DevTools tiene un botón para tomar screenshots exactos.
- **Zoom:** 100% en el navegador para que las proporciones sean naturales.
- **Ventana:** que solo aparezca el área de contenido, sin barra de bookmarks ni pestañas del sistema (Chrome tiene "modo aplicación" con Ctrl+Shift+A).
- **Datos:** carga 4-6 registros de ejemplo antes para que las capturas se vean pobladas, no vacías.
- **Recortar:** puedes recortar el área útil para que no aparezcan barras del navegador. Herramienta gratis: [Greenshot](https://getgreenshot.org/) en Windows.

## Cómo activar cada captura en el HTML

Abre `docs/brochure_tareo.html` y busca `CAPTURA 01` (o el número que sea). Vas a ver un bloque así:

```html
<div class="screenshot screenshot-large">
  <!-- <img src="img/captura-01.png" alt="Dashboard Analytics" class="screenshot-img"> -->
  <div class="screenshot-corner">CAPTURA 01</div>
  ...placeholder...
</div>
```

**Pasos:**
1. Cambia `class="screenshot screenshot-large"` por `class="screenshot has-image"`.
2. Descomenta la línea `<img ...>` (borra los `<!--` y `-->` de esa línea).
3. Borra desde `<div class="screenshot-corner">` hasta `</div>` del hint (todo el placeholder).

Queda así:

```html
<div class="screenshot has-image">
  <img src="img/captura-01.png" alt="Dashboard Analytics" class="screenshot-img">
</div>
```

Repite para las 6 capturas y regenera el PDF:

```bash
cd docs
python generate_brochure_pdf.py
```

El `brochure_tareo.pdf` queda actualizado con tus capturas reales.
