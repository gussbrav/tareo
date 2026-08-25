import { api } from './client'

export const reportesApi = {
  kpis: (desde, hasta) =>
    api.get('/api/reportes/kpis', { params: { desde, hasta } }).then((r) => r.data),

  dashboard: (desde, hasta, filtros = {}) =>
    api
      .get('/api/reportes/dashboard', {
        params: { desde, hasta, ...filtros },
      })
      .then((r) => r.data),

  exportExcelUrl: (desde, hasta) => {
    const base = api.defaults.baseURL || ''
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    return `${base}/api/reportes/actividades.xlsx?${params.toString()}`
  },

  descargarExcel: async (desde, hasta, filtros = {}) => {
    const response = await api.get('/api/reportes/actividades.xlsx', {
      params: { desde, hasta, ...filtros },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `tareo_${desde}_a_${hasta}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
