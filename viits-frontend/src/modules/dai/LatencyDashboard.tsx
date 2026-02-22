import { useDaiStore } from '@/stores/dai.store'
import type { DaiAlert } from '@/api/dai.api'
import styles from './LatencyDashboard.module.css'

interface Props { alerts: DaiAlert[] }

export default function LatencyDashboard({ alerts }: Props) {
    const { latencyCollapsed, toggleLatency } = useDaiStore()

    const total = alerts.length || 1
    const passing = alerts.filter(a => a.latencia_ms <= 20000).length
    const compliance = (passing / total * 100)
    const avg = alerts.length ? alerts.reduce((s, a) => s + a.latencia_ms, 0) / alerts.length : 0

    const badgeCls = compliance >= 95 ? styles.ok : compliance >= 80 ? styles.warn : styles.fail

    const ranges = [
        { label: '0–5s', min: 0, max: 5000, color: '#16a34a' },
        { label: '5–10s', min: 5000, max: 10000, color: '#65a30d' },
        { label: '10–15s', min: 10000, max: 15000, color: '#ca8a04' },
        { label: '15–20s', min: 15000, max: 20000, color: '#f97316' },
        { label: '20–30s', min: 20000, max: 30000, color: '#dc2626' },
        { label: '>30s', min: 30000, max: Infinity, color: '#7f1d1d' },
    ].map(r => {
        const count = alerts.filter(a => a.latencia_ms >= r.min && a.latencia_ms < r.max).length
        return { ...r, count, pct: (count / total * 100).toFixed(1) }
    })
    const maxCount = Math.max(...ranges.map(r => r.count), 1)

    return (
        <div className={styles.section}>
            <button className={styles.toggle} onClick={toggleLatency}>
                <div className={styles.toggleLeft}>
                    <span className="material-icons">speed</span>
                    <span>Rendimiento de Latencia</span>
                    <span className={`${styles.badge} ${badgeCls}`}>
                        Reto 20s: {compliance.toFixed(1)}%
                    </span>
                </div>
                <span className={`material-icons ${styles.chevron} ${latencyCollapsed ? styles.rotated : ''}`}>
                    expand_less
                </span>
            </button>

            <div className={`${styles.body} ${latencyCollapsed ? styles.collapsed : ''}`}>
                <div className={styles.grid}>
                    {/* Gauge */}
                    <div className={styles.card}>
                        <div className={styles.cardTitle}>
                            <span className="material-icons">verified</span> Tiempo de Carga
                        </div>
                        <div className={styles.gauge} style={{ '--pct': compliance, '--color': compliance >= 95 ? '#16a34a' : compliance >= 80 ? '#ca8a04' : '#dc2626' } as React.CSSProperties}>
                            <div className={styles.gaugeInner}>
                                <span className={styles.gaugeNum}>{compliance.toFixed(1)}%</span>
                                <span className={styles.gaugeSub}>{passing} de {total}</span>
                            </div>
                        </div>
                        <div className={styles.legend}>
                            <div className={styles.legendRow}>
                                <span style={{ background: '#16a34a' }} className={styles.dot} />
                                <span>≤ 20s</span><strong>{passing}</strong>
                            </div>
                            <div className={styles.legendRow}>
                                <span style={{ background: '#ef4444' }} className={styles.dot} />
                                <span>&gt; 20s</span><strong>{total - passing}</strong>
                            </div>
                            <div className={styles.legendRow}>
                                <span style={{ background: '#6366f1' }} className={styles.dot} />
                                <span>Promedio</span><strong>{(avg / 1000).toFixed(1)}s</strong>
                            </div>
                        </div>
                    </div>

                    {/* Distribution bars */}
                    <div className={styles.card}>
                        <div className={styles.cardTitle}>
                            <span className="material-icons">bar_chart</span> Distribución
                        </div>
                        <div className={styles.distrib}>
                            {ranges.map(r => (
                                <div key={r.label} className={styles.barRow}>
                                    <span className={styles.barLabel}>{r.label}</span>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={styles.barFill}
                                            style={{ width: `${(r.count / maxCount * 100).toFixed(1)}%`, background: r.color }}
                                        />
                                    </div>
                                    <span className={styles.barCount}>{r.count}</span>
                                    <span className={styles.barPct}>{r.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
