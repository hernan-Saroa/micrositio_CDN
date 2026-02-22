import api from './client'

export interface ReportConfig {
    tipo: 'alertas' | 'latencia' | 'dispositivos' | 'historico'
    formato: 'csv' | 'xlsx' | 'pdf'
    fechaInicio?: string
    fechaFin?: string
    filtros?: Record<string, string>
}

export const reportsApi = {
    generate: (config: ReportConfig) =>
        api.post('/reports/generate', config, { responseType: 'blob' }).then(r => r.data),

    getHistory: () =>
        api.get('/downloads').then(r => r.data),

    download: (id: string) =>
        api.get(`/downloads/${id}`, { responseType: 'blob' }).then(r => r.data),
}
