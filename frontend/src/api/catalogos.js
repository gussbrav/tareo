import { api } from './client'

export const catalogosApi = {
  areas: (proyectoId) =>
    api.get('/api/catalogos/areas', {
      params: proyectoId ? { proyecto_id: proyectoId } : {},
    }).then((r) => r.data),
  especialidades: (areaId) =>
    api.get('/api/catalogos/especialidades', { params: { area_id: areaId } }).then((r) => r.data),
  centrosCosto: (especialidadId) =>
    api.get('/api/catalogos/centros-costo', { params: { especialidad_id: especialidadId } }).then((r) => r.data),
  proyectos: () => api.get('/api/catalogos/proyectos').then((r) => r.data),
  // Nota: proyecto_id ahora es obligatorio a nivel API (scoping por proyecto).
  // El backend rechaza la request si no viene.
  trabajadoresDisponibles: (fecha, proyectoId) =>
    api.get('/api/catalogos/trabajadores', {
      params: { fecha, proyecto_id: proyectoId },
    }).then((r) => r.data),
  trabajadoresAll: () => api.get('/api/catalogos/trabajadores/all').then((r) => r.data),
}
