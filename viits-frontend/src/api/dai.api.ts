import api from './client'

export interface DaiAlert {
    id: string
    tipo: string
    sev: 'critica' | 'alta' | 'media' | 'baja'
    estado: 'activa' | 'en_revision' | 'resuelta' | 'creada'
    dep: string
    disp: string
    fecha: string
    fecha_str: string
    latencia_ms: number
    tipo_registro: 'Automático' | 'Manual'
    assignedTo?: string
    notes?: string
    resolutionLabel?: string
}

export interface DaiStats {
    total: number
    critica: number
    alta: number
    media: number
    baja: number
    pendientes: number
    avgResponseMs: number
}

export const daiApi = {
    /** Fetch all alerts from ClickHouse route */
    getAlerts: (params?: Record<string, string>) =>
        api.get<DaiAlert[]>('/clickhouse/alertas', { params }).then((r) => r.data),

    /** Fetch summary stats */
    getStats: () =>
        api.get<DaiStats>('/clickhouse/stats').then((r) => r.data),

    /** Update alert status */
    updateStatus: (id: string, estado: string, nota?: string) =>
        api.patch(`/clickhouse/alertas/${id}`, { estado, nota }).then((r) => r.data),

    /** Assign alert to user */
    assign: (id: string, userId: string) =>
        api.patch(`/clickhouse/alertas/${id}/assign`, { userId }).then((r) => r.data),
}
