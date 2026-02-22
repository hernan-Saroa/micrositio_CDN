import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import styles from './CiudadanaPage.module.css'

interface Reporte {
    id: string
    tipo: 'hueco' | 'derrumbe' | 'señal' | 'inundacion' | 'otro'
    descripcion: string
    municipio: string
    carretera?: string
    estado: 'recibido' | 'en_proceso' | 'resuelto'
    fecha: string
    votos: number
}

const TIPO_ICON: Record<string, string> = {
    hueco: 'construction', derrumbe: 'landslide',
    señal: 'signpost', inundacion: 'water', otro: 'report_problem'
}
const TIPO_COLOR: Record<string, string> = {
    hueco: '#ca8a04', derrumbe: '#dc2626',
    señal: '#2563eb', inundacion: '#0891b2', otro: '#7c3aed'
}
const EST_LABEL: Record<string, string> = {
    recibido: 'Recibido', en_proceso: 'En proceso', resuelto: 'Resuelto'
}
const EST_COLOR: Record<string, string> = {
    recibido: '#f59e0b', en_proceso: '#3b82f6', resuelto: '#22c55e'
}

// Mock data
const MOCK_REPORTES: Reporte[] = [
    { id: 'RPT-001', tipo: 'hueco', descripcion: 'Hueco grande en la vía Bogotá-Tunja, km 42', municipio: 'Tunja', carretera: 'Ruta 55', estado: 'en_proceso', fecha: '2026-02-20', votos: 12 },
    { id: 'RPT-002', tipo: 'derrumbe', descripcion: 'Derrumbe bloquea un carril en la vía al Llano', municipio: 'Villavicencio', carretera: 'Ruta 40', estado: 'recibido', fecha: '2026-02-21', votos: 28 },
    { id: 'RPT-003', tipo: 'señal', descripcion: 'Señal de velocidad máxima dañada, peligro para conductores', municipio: 'Ibagué', carretera: 'Ruta 50', estado: 'resuelto', fecha: '2026-02-15', votos: 5 },
    { id: 'RPT-004', tipo: 'inundacion', descripcion: 'Inundación en la vía cerca al río Magdalena', municipio: 'Honda', carretera: 'Ruta 45', estado: 'en_proceso', fecha: '2026-02-19', votos: 19 },
]

export default function CiudadanaPage() {
    const [reportes, setReportes] = useState<Reporte[]>(MOCK_REPORTES)
    const [form, setForm] = useState({ tipo: 'hueco', descripcion: '', municipio: '', carretera: '' })
    const [showForm, setShowForm] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [filter, setFilter] = useState<string>('todos')

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        const nuevo: Reporte = {
            id: `RPT-${String(Date.now()).slice(-4)}`,
            tipo: form.tipo as Reporte['tipo'],
            descripcion: form.descripcion,
            municipio: form.municipio,
            carretera: form.carretera,
            estado: 'recibido',
            fecha: new Date().toISOString().slice(0, 10),
            votos: 1,
        }
        setReportes(prev => [nuevo, ...prev])
        setForm({ tipo: 'hueco', descripcion: '', municipio: '', carretera: '' })
        setShowForm(false)
        setSubmitted(true)
        setTimeout(() => setSubmitted(false), 4000)
    }

    const vote = (id: string) => {
        setReportes(prev => prev.map(r => r.id === id ? { ...r, votos: r.votos + 1 } : r))
    }

    const filtered = filter === 'todos' ? reportes : reportes.filter(r => r.estado === filter)

    return (
        <div className={styles.page}>
            <TopBar title="Participación Ciudadana" subtitle="Reporta problemas en la red vial nacional" />

            <div className={styles.content}>
                {/* Hero strip */}
                <div className={styles.hero}>
                    <div className={styles.heroText}>
                        <h2>Tu reporte importa</h2>
                        <p>Los ciudadanos que usan la red vial son los primeros en detectar problemas. Reporta y ayuda a INVIAS a actuar más rápido.</p>
                    </div>
                    <button className={styles.newBtn} onClick={() => setShowForm(v => !v)}>
                        <span className="material-icons">add_circle</span>
                        Hacer un reporte
                    </button>
                </div>

                {/* Stats */}
                <div className={styles.statsRow}>
                    {[
                        { label: 'Reportes totales', val: reportes.length, icon: 'report', color: '#2563eb' },
                        { label: 'En proceso', val: reportes.filter(r => r.estado === 'en_proceso').length, icon: 'build', color: '#3b82f6' },
                        { label: 'Resueltos', val: reportes.filter(r => r.estado === 'resuelto').length, icon: 'check_circle', color: '#22c55e' },
                        { label: 'Total votos', val: reportes.reduce((s, r) => s + r.votos, 0), icon: 'thumb_up', color: '#7c3aed' },
                    ].map(s => (
                        <div key={s.label} className={styles.stat}>
                            <span className="material-icons" style={{ color: s.color }}>{s.icon}</span>
                            <strong>{s.val}</strong>
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Form collapsible */}
                {showForm && (
                    <form className={styles.form} onSubmit={submit}>
                        <h3>Nuevo reporte ciudadano</h3>
                        <div className={styles.typeGrid}>
                            {Object.entries(TIPO_ICON).map(([key, icon]) => (
                                <button
                                    type="button" key={key}
                                    className={`${styles.typeBtn} ${form.tipo === key ? styles.selected : ''}`}
                                    style={form.tipo === key ? { borderColor: TIPO_COLOR[key], background: TIPO_COLOR[key] + '18', color: TIPO_COLOR[key] } : {}}
                                    onClick={() => setForm(f => ({ ...f, tipo: key }))}
                                >
                                    <span className="material-icons">{icon}</span>
                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className={styles.fields}>
                            <div className={styles.field}>
                                <label>Descripción del problema *</label>
                                <textarea
                                    rows={3}
                                    placeholder="Describe el problema con el máximo detalle posible..."
                                    value={form.descripcion}
                                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className={styles.row2}>
                                <div className={styles.field}>
                                    <label>Municipio *</label>
                                    <input type="text" placeholder="Ej: Honda" value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} required />
                                </div>
                                <div className={styles.field}>
                                    <label>Carretera / Ruta</label>
                                    <input type="text" placeholder="Ej: Ruta 45 — km 12" value={form.carretera} onChange={e => setForm(f => ({ ...f, carretera: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.formActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
                            <button type="submit" className={styles.submitFormBtn}>
                                <span className="material-icons">send</span> Enviar reporte
                            </button>
                        </div>
                    </form>
                )}

                {submitted && (
                    <div className={styles.successMsg}>
                        <span className="material-icons">check_circle</span>
                        Reporte enviado exitosamente. INVIAS lo revisará pronto.
                    </div>
                )}

                {/* Filter tabs */}
                <div className={styles.tabs}>
                    {[['todos', 'Todos'], ['recibido', 'Recibidos'], ['en_proceso', 'En proceso'], ['resuelto', 'Resueltos']].map(([v, l]) => (
                        <button key={v} className={`${styles.tab} ${filter === v ? styles.tabActive : ''}`} onClick={() => setFilter(v)}>{l}</button>
                    ))}
                </div>

                {/* Cards list */}
                <div className={styles.cards}>
                    {filtered.map(r => (
                        <div key={r.id} className={styles.card}>
                            <div className={styles.cardLeft}>
                                <div className={styles.cardIcon} style={{ background: TIPO_COLOR[r.tipo] + '18', color: TIPO_COLOR[r.tipo] }}>
                                    <span className="material-icons">{TIPO_ICON[r.tipo]}</span>
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.cardHead}>
                                    <span className={styles.cardTipo} style={{ color: TIPO_COLOR[r.tipo] }}>{r.tipo.toUpperCase()}</span>
                                    <span className={styles.estBadge} style={{ background: EST_COLOR[r.estado] + '22', color: EST_COLOR[r.estado] }}>
                                        {EST_LABEL[r.estado]}
                                    </span>
                                </div>
                                <p className={styles.cardDesc}>{r.descripcion}</p>
                                <div className={styles.cardMeta}>
                                    <span><span className="material-icons">place</span>{r.municipio}{r.carretera ? ` · ${r.carretera}` : ''}</span>
                                    <span><span className="material-icons">calendar_today</span>{r.fecha}</span>
                                    <span className={styles.cardId}>{r.id}</span>
                                </div>
                            </div>
                            <button className={styles.voteBtn} onClick={() => vote(r.id)}>
                                <span className="material-icons">thumb_up</span>
                                <strong>{r.votos}</strong>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
