import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { reportsApi, type ReportConfig } from '@/api/reports.api'
import styles from './ReportesPage.module.css'

const TIPOS = [
    { value: 'alertas', label: 'Alertas DAI', icon: 'notifications' },
    { value: 'latencia', label: 'Latencia CDN', icon: 'speed' },
    { value: 'dispositivos', label: 'Dispositivos', icon: 'router' },
    { value: 'historico', label: 'Histórico general', icon: 'history' },
]
const FORMATOS = [
    { value: 'xlsx', label: 'Excel (.xlsx)', icon: 'table_chart' },
    { value: 'csv', label: 'CSV (.csv)', icon: 'description' },
    { value: 'pdf', label: 'PDF (.pdf)', icon: 'picture_as_pdf' },
]

export default function ReportesPage() {
    const [tipo, setTipo] = useState<ReportConfig['tipo']>('alertas')
    const [formato, setFormato] = useState<ReportConfig['formato']>('xlsx')
    const [fechaInicio, setFechaInicio] = useState('')
    const [fechaFin, setFechaFin] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const generate = async () => {
        setLoading(true); setSuccess(false)
        try {
            const blob = await reportsApi.generate({ tipo, formato, fechaInicio, fechaFin })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `VIITS_${tipo}_${Date.now()}.${formato}`
            a.click()
            URL.revokeObjectURL(url)
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <TopBar title="Reportes y Descargas" subtitle="Exportar datos del sistema VIITS" />
            <div className={styles.content}>
                <div className={styles.grid}>

                    {/* Generator card */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>
                            <span className="material-icons">download</span> Generar reporte
                        </h2>

                        <div className={styles.section}>
                            <label>Tipo de reporte</label>
                            <div className={styles.optionGrid}>
                                {TIPOS.map(t => (
                                    <button
                                        key={t.value}
                                        className={`${styles.optBtn} ${tipo === t.value ? styles.selected : ''}`}
                                        onClick={() => setTipo(t.value as ReportConfig['tipo'])}
                                    >
                                        <span className="material-icons">{t.icon}</span>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <label>Formato de exportación</label>
                            <div className={styles.optionRow}>
                                {FORMATOS.map(f => (
                                    <button
                                        key={f.value}
                                        className={`${styles.formatBtn} ${formato === f.value ? styles.selected : ''}`}
                                        onClick={() => setFormato(f.value as ReportConfig['formato'])}
                                    >
                                        <span className="material-icons">{f.icon}</span>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.dateRow}>
                            <div className={styles.field}>
                                <label>Desde</label>
                                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                            </div>
                            <div className={styles.field}>
                                <label>Hasta</label>
                                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                            </div>
                        </div>

                        <button className={styles.generateBtn} onClick={generate} disabled={loading}>
                            {loading
                                ? <><span className={styles.spinner} /> Generando...</>
                                : <><span className="material-icons">download</span> Descargar reporte</>
                            }
                        </button>

                        {success && (
                            <div className={styles.successMsg}>
                                <span className="material-icons">check_circle</span> Reporte descargado exitosamente
                            </div>
                        )}
                    </div>

                    {/* Quick exports */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>
                            <span className="material-icons">bolt</span> Exportaciones rápidas
                        </h2>
                        <div className={styles.quickList}>
                            {[
                                { label: 'Alertas críticas — Hoy', icon: 'error', color: '#dc2626' },
                                { label: 'Resumen semanal DAI', icon: 'calendar_today', color: '#2563eb' },
                                { label: 'Dispositivos offline', icon: 'router', color: '#ea580c' },
                                { label: 'Histórico mensual', icon: 'history', color: '#7c3aed' },
                                { label: 'Audit log completo', icon: 'policy', color: '#059669' },
                            ].map(q => (
                                <button key={q.label} className={styles.quickItem}>
                                    <div className={styles.quickIcon} style={{ background: q.color + '1a', color: q.color }}>
                                        <span className="material-icons">{q.icon}</span>
                                    </div>
                                    <span className={styles.quickLabel}>{q.label}</span>
                                    <span className="material-icons" style={{ color: '#cbd5e1', fontSize: 18 }}>download</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
