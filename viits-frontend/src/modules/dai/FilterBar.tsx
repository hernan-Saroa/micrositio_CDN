import { useDaiStore } from '@/stores/dai.store'
import styles from './FilterBar.module.css'

const SEV_OPTS = [
    { value: '', label: 'Todas' },
    { value: 'critica', label: 'Crítica' },
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Media' },
    { value: 'baja', label: 'Baja' },
]

const ESTADO_OPTS = [
    { value: '', label: 'Todos' },
    { value: 'activa', label: 'Activa' },
    { value: 'en_revision', label: 'En Revisión' },
    { value: 'resuelta', label: 'Resuelta' },
    { value: 'creada', label: 'Creada' },
]

export default function FilterBar() {
    const { filters, filtered, setFilter, resetFilters } = useDaiStore()

    return (
        <div className={styles.wrap}>
            <div className={styles.searchRow}>
                <div className={styles.search}>
                    <span className="material-icons">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por ID, tipo, dispositivo, departamento..."
                        value={filters.search}
                        onChange={(e) => setFilter('search', e.target.value)}
                    />
                    {filters.search && (
                        <button onClick={() => setFilter('search', '')}>
                            <span className="material-icons">close</span>
                        </button>
                    )}
                </div>
                <button className={styles.filterBtn}>
                    <span className="material-icons">tune</span>
                    Filtros
                </button>
            </div>

            <div className={styles.quickFilters}>
                <div className={styles.quickGroup}>
                    <button
                        className={`${styles.quickBtn} ${filters.quickDate === '' ? styles.active : ''}`}
                        onClick={() => setFilter('quickDate', '')}
                    >
                        <span className="material-icons">flash_on</span> Automático
                    </button>
                    <button
                        className={`${styles.quickBtn} ${filters.quickDate === 'today' ? styles.active : ''}`}
                        onClick={() => setFilter('quickDate', 'today')}
                    >
                        <span className="material-icons">today</span> Hoy
                    </button>
                    <button
                        className={`${styles.quickBtn} ${filters.quickDate === 'week' ? styles.active : ''}`}
                        onClick={() => setFilter('quickDate', 'week')}
                    >
                        <span className="material-icons">date_range</span> Esta semana
                    </button>
                </div>

                <div className={styles.statusTabs}>
                    {[
                        { key: '', label: 'Todas', count: filtered.length },
                        { key: 'activa', label: 'Activas', count: filtered.filter(a => a.estado === 'activa').length },
                        { key: 'en_revision', label: 'En Revisión', count: filtered.filter(a => a.estado === 'en_revision').length },
                        { key: 'resuelta', label: 'Resueltas', count: filtered.filter(a => a.estado === 'resuelta').length },
                        { key: 'creada', label: 'Creadas', count: filtered.filter(a => a.estado === 'creada').length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className={`${styles.tab} ${filters.estado === tab.key ? styles.activeTab : ''}`}
                            onClick={() => setFilter('estado', tab.key)}
                        >
                            {tab.label} <span className={styles.tabCount}>{tab.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.resultsRow}>
                <span className={styles.count}>Mostrando {filtered.length} alertas</span>
                <select onChange={(e) => setFilter('sev', e.target.value)} value={filters.sev} className={styles.select}>
                    {SEV_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
        </div>
    )
}
