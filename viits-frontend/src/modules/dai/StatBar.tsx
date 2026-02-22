import type { DaiAlert } from '@/api/dai.api'
import styles from './StatBar.module.css'

function msToTime(ms: number) {
    if (!ms) return '—'
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}min ${s % 60}s`
}

interface Props { alerts: DaiAlert[] }

export default function StatBar({ alerts }: Props) {
    const total = alerts.length
    const critica = alerts.filter(a => a.sev === 'critica').length
    const alta = alerts.filter(a => a.sev === 'alta').length
    const media = alerts.filter(a => a.sev === 'media').length
    const baja = alerts.filter(a => a.sev === 'baja').length
    const pendientes = alerts.filter(a => a.estado === 'activa' || a.estado === 'en_revision').length
    const avgResp = alerts.length
        ? alerts.reduce((s, a) => s + (a.latencia_ms || 0), 0) / alerts.length
        : 0

    const cards = [
        { label: 'Total', value: total, icon: 'notifications', cls: 'total' },
        { label: 'Crítica', value: critica, icon: 'error', cls: 'critica', trend: true },
        { label: 'Alta', value: alta, icon: 'warning', cls: 'alta' },
        { label: 'Media', value: media, icon: 'info', cls: 'media' },
        { label: 'Baja', value: baja, icon: 'check_circle', cls: 'baja' },
        { label: 'Pendientes', value: pendientes, icon: 'hourglass_empty', cls: 'pendiente' },
        { label: 'T. Respuesta', value: msToTime(avgResp), icon: 'timer', cls: 'tiempo' },
    ]

    return (
        <div className={styles.bar}>
            {cards.map((c) => (
                <div key={c.label} className={`${styles.card} ${styles[c.cls]}`}>
                    <div className={styles.icon}>
                        <span className="material-icons">{c.icon}</span>
                    </div>
                    <div className={styles.info}>
                        <div className={styles.num}>{c.value}</div>
                        <div className={styles.lbl}>{c.label}</div>
                        {c.trend && <div className={styles.trend}>↑</div>}
                    </div>
                </div>
            ))}
        </div>
    )
}
