import { useDaiStore } from '@/stores/dai.store'
import styles from './AlertDetailDrawer.module.css'

const SEV_LABEL: Record<string, string> = {
    critica: 'CRÍTICA', alta: 'ALTA', media: 'MEDIA', baja: 'BAJA'
}
const EST_LABEL: Record<string, string> = {
    activa: 'Activa', en_revision: 'En Revisión', resuelta: 'Resuelta', creada: 'Creado'
}

function fmtMs(ms: number) {
    if (!ms) return '—'
    const s = (ms / 1000).toFixed(1)
    return `${s}s`
}

export default function AlertDetailDrawer() {
    const { alerts, selectedId, selectAlert } = useDaiStore()
    const alert = selectedId ? alerts.find(a => a.id === selectedId) : null
    const isOpen = !!alert

    const close = () => selectAlert(null)

    return (
        <>
            {/* Backdrop */}
            {isOpen && <div className={styles.backdrop} onClick={close} />}

            {/* Drawer */}
            <aside className={`${styles.drawer} ${isOpen ? styles.open : ''}`}>
                {!alert ? (
                    <div className={styles.empty}>
                        <span className="material-icons">touch_app</span>
                        <h4>Selecciona una alerta</h4>
                        <p>Haz clic en cualquier fila para ver el detalle completo.</p>
                    </div>
                ) : (
                    <>
                        {/* Urgency bar */}
                        <div className={`${styles.urgencyBar} ${styles[`urg-${alert.sev}`]}`} />

                        {/* Header */}
                        <div className={styles.header}>
                            <div className={styles.topRow}>
                                <span className={styles.alertId}>{alert.id}</span>
                                <button className={styles.closeBtn} onClick={close}>
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                            <div className={styles.alertTipo}>{alert.tipo}</div>
                            <div className={styles.pills}>
                                <span className={`${styles.sevPill} ${styles[alert.sev]}`}>
                                    {SEV_LABEL[alert.sev]}
                                </span>
                                <span className={`${styles.statusPill} ${styles[alert.estado]}`}>
                                    <span className={styles.dot} />
                                    {EST_LABEL[alert.estado]}
                                </span>
                                <span className={styles.tag}>
                                    {alert.tipo_registro === 'Automático' ? '⚡' : '👤'} {alert.tipo_registro}
                                </span>
                            </div>
                        </div>

                        {/* Info grid */}
                        <div className={styles.infoGrid}>
                            <InfoRow icon="place" label="Departamento" value={alert.dep} />
                            <InfoRow icon="router" label="Dispositivo" value={alert.disp} />
                            <InfoRow icon="schedule" label="Fecha" value={alert.fecha_str} />
                            <InfoRow icon="speed" label="Latencia" value={fmtMs(alert.latencia_ms)} />
                        </div>

                        {/* Actions */}
                        <div className={styles.actions}>
                            <button className={`${styles.actionBtn} ${styles.primary}`}>
                                <span className="material-icons">edit</span> Actualizar estado
                            </button>
                            <button className={styles.actionBtn}>
                                <span className="material-icons">person_add</span> Asignar
                            </button>
                            <button className={styles.actionBtn}>
                                <span className="material-icons">attach_file</span> Adjuntar
                            </button>
                        </div>
                    </>
                )}
            </aside>
        </>
    )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className={styles.infoRow}>
            <span className="material-icons">{icon}</span>
            <div>
                <div className={styles.infoLabel}>{label}</div>
                <div className={styles.infoValue}>{value}</div>
            </div>
        </div>
    )
}
