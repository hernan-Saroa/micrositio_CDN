import { useDaiStore } from '@/stores/dai.store'
import styles from './AlertTable.module.css'
import type { DaiAlert } from '@/api/dai.api'

const SEV_LABEL: Record<string, string> = {
    critica: 'CRÍTICA', alta: 'ALTA', media: 'MEDIA', baja: 'BAJA'
}
const EST_LABEL: Record<string, string> = {
    activa: 'Activa', en_revision: 'En Revisión', resuelta: 'Resuelta', creada: 'Creado'
}

function latFmt(ms: number) {
    if (!ms) return '—'
    return (ms / 1000).toFixed(1) + 's'
}

interface Props { isLoading: boolean; isError: boolean }

export default function AlertTable({ isLoading, isError }: Props) {
    const { filtered, selectedId, page, selectAlert, loadMore } = useDaiStore()
    const visible = filtered.slice(0, page * 30)

    if (isLoading) return (
        <div className={styles.state}>
            <span className="material-icons">hourglass_empty</span>
            <h4>Cargando alertas...</h4>
        </div>
    )
    if (isError) return (
        <div className={`${styles.state} ${styles.error}`}>
            <span className="material-icons">error_outline</span>
            <h4>Error al cargar alertas</h4>
        </div>
    )

    return (
        <div className={styles.wrap}>
            {/* Header */}
            <div className={styles.header}>
                <div>Sev.</div>
                <div>Alerta</div>
                <div>Departamento</div>
                <div>Dispositivo</div>
                <div>Fecha</div>
                <div>Estado</div>
                <div>Lat.</div>
                <div />
            </div>

            {/* Rows */}
            <div className={styles.body}>
                {visible.length === 0 && (
                    <div className={styles.state}>
                        <span className="material-icons">inbox</span>
                        <h4>Sin alertas</h4>
                        <p>No hay alertas con los filtros actuales</p>
                    </div>
                )}
                {visible.map((a) => (
                    <AlertRow
                        key={a.id}
                        alert={a}
                        isSelected={selectedId === a.id}
                        onSelect={() => selectAlert(a.id)}
                    />
                ))}
            </div>

            {/* Load more */}
            {visible.length < filtered.length && (
                <div className={styles.loadMore}>
                    <button onClick={loadMore}>
                        <span className="material-icons">expand_more</span> Cargar más
                    </button>
                    <span className={styles.pageInfo}>{visible.length}/{filtered.length}</span>
                </div>
            )}
        </div>
    )
}

function AlertRow({ alert: a, isSelected, onSelect }: {
    alert: DaiAlert
    isSelected: boolean
    onSelect: () => void
}) {
    const latMs = a.latencia_ms || 0
    const latCls = latMs <= 20000 ? styles.latOk : latMs <= 35000 ? styles.latWarn : styles.latFail

    return (
        <div
            className={`${styles.row} ${styles[`sev-${a.sev}`]} ${isSelected ? styles.selected : ''}`}
            onClick={onSelect}
        >
            <div className={styles.strip} />
            <div className={styles.sevCell}>
                <span className={`${styles.sevPill} ${styles[a.sev]}`}>{SEV_LABEL[a.sev]}</span>
            </div>
            <div className={styles.infoCell}>
                <div className={styles.tipo} title={a.tipo}>{a.tipo}</div>
                <div className={styles.id}>{a.id}</div>
            </div>
            <div className={styles.cell}>{a.dep}</div>
            <div className={`${styles.cell} ${styles.mono}`}>{a.disp?.replace('INV-DAI-', '')}</div>
            <div className={styles.cell}>{a.fecha_str}</div>
            <div className={styles.cell}>
                <span className={`${styles.statusPill} ${styles[a.estado]}`}>
                    <span className={styles.dot} />
                    {EST_LABEL[a.estado]}
                </span>
            </div>
            <div className={`${styles.lat} ${latCls}`}>{latFmt(latMs)}</div>
            <div className={styles.arrow}>
                <span className="material-icons">chevron_right</span>
            </div>
        </div>
    )
}
