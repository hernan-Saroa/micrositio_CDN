import { create } from 'zustand'
import type { DaiAlert } from '@/api/dai.api'

type FilterState = {
    search: string
    sev: string
    estado: string
    dep: string
    quickDate: string
}

interface DaiState {
    alerts: DaiAlert[]
    filtered: DaiAlert[]
    selectedId: string | null
    page: number
    latencyCollapsed: boolean
    filters: FilterState
    // Actions
    setAlerts: (alerts: DaiAlert[]) => void
    selectAlert: (id: string | null) => void
    setFilter: (key: keyof FilterState, value: string) => void
    resetFilters: () => void
    toggleLatency: () => void
    applyFilters: () => void
    loadMore: () => void
}

const PAGE_SIZE = 30

const defaultFilters: FilterState = {
    search: '',
    sev: '',
    estado: '',
    dep: '',
    quickDate: '',
}

export const useDaiStore = create<DaiState>((set, get) => ({
    alerts: [],
    filtered: [],
    selectedId: null,
    page: 1,
    latencyCollapsed: window.innerWidth <= 900,
    filters: { ...defaultFilters },

    setAlerts: (alerts) => {
        set({ alerts, page: 1 })
        get().applyFilters()
    },

    selectAlert: (id) => set({ selectedId: id }),

    setFilter: (key, value) => {
        set((s) => ({ filters: { ...s.filters, [key]: value }, page: 1 }))
        get().applyFilters()
    },

    resetFilters: () => {
        set({ filters: { ...defaultFilters }, page: 1 })
        get().applyFilters()
    },

    toggleLatency: () => set((s) => ({ latencyCollapsed: !s.latencyCollapsed })),

    applyFilters: () => {
        const { alerts, filters } = get()
        const search = filters.search.toLowerCase()
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)

        let result = alerts.filter((a) => {
            if (filters.sev && a.sev !== filters.sev) return false
            if (filters.estado && a.estado !== filters.estado) return false
            if (filters.dep && !a.dep.toLowerCase().includes(filters.dep.toLowerCase())) return false
            if (filters.quickDate === 'today' && new Date(a.fecha) < todayStart) return false
            if (filters.quickDate === 'week' && new Date(a.fecha) < weekStart) return false
            if (search && ![a.id, a.tipo, a.dep, a.disp].some(v => v?.toLowerCase().includes(search))) return false
            return true
        })

        set({ filtered: result })
    },

    loadMore: () => set((s) => ({ page: s.page + 1 })),
}))
