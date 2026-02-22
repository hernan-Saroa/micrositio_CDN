import { useQuery } from '@tanstack/react-query'
import TopBar from '@/components/layout/TopBar'
import api from '@/api/client'
import styles from './DashboardPage.module.css'

interface SystemStats {
    totalAlertas: number
    alertasActivas: number
    dispositivosOnline: number
    uptimePct: number
}

function useStats() {
    return useQuery<SystemStats>({
        queryKey: ['stats'],
        queryFn: () => api.get('/stats').then(r => r.data),
        refetchInterval: 60_000,
    })
}

const modules = [
    { icon: 'notifications_active', label: 'Alertas DAI', to: '/dai', color: '#2563eb', desc: 'Dispositivos de Aforo Inteligente' },
    { icon: 'videocam', label: 'CCTV', to: '/cctv', color: '#7c3aed', desc: 'Cámaras de vigilancia vial' },
    { icon: 'people', label: 'Usuarios', to: '/usuarios', color: '#059669', desc: 'Gestión de accesos y roles' },
    { icon: 'download', label: 'Reportes', to: '/reportes', color: '#dc2626', desc: 'Exportar datos y estadísticas' },
    { icon: 'map', label: 'Mapa Vial', to: '/mapa', color: '#d97706', desc: 'Red vial INVIAS en tiempo real' },
    { icon: 'public', label: 'Ciudadana', to: '/ciudadana', color: '#0284c7', desc: 'Participación ciudadana' },
]

export default function DashboardPage() {
    const { data: stats } = useStats()

    return (
        <div className={styles.page}>
            <TopBar title="Dashboard VIITS" subtitle="Sistema Integrado de Vigilancia Vial" />
            <div className={styles.scroll}>

                {/* KPI strip */}
                <div className={styles.kpiRow}>
                    {[
                        { icon: 'notifications', label: 'Total Alertas', value: stats?.totalAlertas ?? '—', color: '#2563eb' },
                        { icon: 'error', label: 'Activas', value: stats?.alertasActivas ?? '—', color: '#dc2626' },
                        { icon: 'router', label: 'Dispositivos Online', value: stats?.dispositivosOnline ?? '—', color: '#059669' },
                        { icon: 'verified', label: 'Uptime', value: stats ? `${stats.uptimePct}%` : '—', color: '#7c3aed' },
                    ].map(k => (
                        <div key={k.label} className={styles.kpiCard}>
                            <div className={styles.kpiIcon} style={{ background: `${k.color}18`, color: k.color }}>
                                <span className="material-icons">{k.icon}</span>
                            </div>
                            <div className={styles.kpiNum}>{k.value}</div>
                            <div className={styles.kpiLabel}>{k.label}</div>
                        </div>
                    ))}
                </div>

                {/* Module grid */}
                <h2 className={styles.sectionTitle}>Módulos del sistema</h2>
                <div className={styles.moduleGrid}>
                    {modules.map(m => (
                        <a href={m.to} key={m.to} className={styles.moduleCard}>
                            <div className={styles.moduleIcon} style={{ background: `${m.color}1a`, color: m.color }}>
                                <span className="material-icons">{m.icon}</span>
                            </div>
                            <div className={styles.moduleName}>{m.label}</div>
                            <div className={styles.moduleDesc}>{m.desc}</div>
                            <span className="material-icons" style={{ color: '#cbd5e1', marginTop: 'auto' }}>arrow_forward</span>
                        </a>
                    ))}
                </div>

                {/* System health */}
                <h2 className={styles.sectionTitle}>Estado del sistema</h2>
                <div className={styles.healthGrid}>
                    {[
                        { label: 'API Backend', status: 'ok', latency: '18ms' },
                        { label: 'ClickHouse DB', status: 'ok', latency: '42ms' },
                        { label: 'PostgreSQL', status: 'ok', latency: '12ms' },
                        { label: 'Redis Cache', status: 'ok', latency: '2ms' },
                        { label: 'ElasticSearch', status: 'warn', latency: '210ms' },
                        { label: 'Feeds CCTV', status: 'ok', latency: '—' },
                    ].map(h => (
                        <div key={h.label} className={styles.healthCard}>
                            <div className={`${styles.healthDot} ${styles[h.status]}`} />
                            <div className={styles.healthLabel}>{h.label}</div>
                            <div className={styles.healthLat}>{h.latency}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
