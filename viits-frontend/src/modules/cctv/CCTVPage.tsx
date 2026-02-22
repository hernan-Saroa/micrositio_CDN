import TopBar from '@/components/layout/TopBar'
import styles from './CCTVPage.module.css'

interface CameraFeed {
    id: string
    nombre: string
    tramo: string
    estado: 'online' | 'offline' | 'error'
    lastSnap?: string
}

// Mock feeds — en producción viene de la API
const FEEDS: CameraFeed[] = [
    { id: 'CAM-001', nombre: 'Peaje Norte - Entrada', tramo: 'Ruta 45', estado: 'online' },
    { id: 'CAM-002', nombre: 'Túnel Boquemonte', tramo: 'Ruta 18', estado: 'online' },
    { id: 'CAM-003', nombre: 'Puente La Pintada', tramo: 'Ruta 62', estado: 'offline' },
    { id: 'CAM-004', nombre: 'Variante Caldas', tramo: 'Ruta 25', estado: 'online' },
    { id: 'CAM-005', nombre: 'Alto El Vino', tramo: 'Ruta 40', estado: 'error' },
    { id: 'CAM-006', nombre: 'Sector La Línea', tramo: 'Ruta 50', estado: 'online' },
]

const EST_COLOR = { online: '#16a34a', offline: '#94a3b8', error: '#dc2626' }
const EST_BG = { online: '#f0fdf4', offline: '#f8fafc', error: '#fef2f2' }

export default function CCTVPage() {
    const online = FEEDS.filter(f => f.estado === 'online').length

    return (
        <div className={styles.page}>
            <TopBar title="CCTV — Vigilancia Vial" subtitle="Cámaras en tiempo real · Red INVIAS CDN" />
            <div className={styles.content}>

                {/* Banner estadístico */}
                <div className={styles.banner}>
                    <div className={styles.bannerItem}>
                        <span className="material-icons">videocam</span>
                        <strong>{FEEDS.length}</strong> Cámaras totales
                    </div>
                    <div className={styles.bannerItem}>
                        <div className={styles.pulseDot} />
                        <strong style={{ color: '#16a34a' }}>{online}</strong> En línea
                    </div>
                    <div className={styles.bannerItem}>
                        <span className="material-icons" style={{ color: '#dc2626' }}>videocam_off</span>
                        <strong style={{ color: '#dc2626' }}>{FEEDS.length - online}</strong> Offline / Error
                    </div>
                </div>

                {/* Grid de cámaras */}
                <div className={styles.grid}>
                    {FEEDS.map(cam => (
                        <div key={cam.id} className={`${styles.cam} ${styles[cam.estado]}`}>
                            {/* Vista previa */}
                            <div className={styles.preview}>
                                {cam.estado === 'online' ? (
                                    <>
                                        <div className={styles.scanline} />
                                        <div className={styles.recBadge}>
                                            <span className={styles.recDot} /> REC LIVE
                                        </div>
                                        <div className={styles.camOverlay}>
                                            <span className="material-icons">videocam</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.offlinePreview}>
                                        <span className="material-icons">{cam.estado === 'error' ? 'error_outline' : 'videocam_off'}</span>
                                        <span>{cam.estado === 'error' ? 'Error de señal' : 'Sin señal'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Info footer */}
                            <div className={styles.camInfo}>
                                <div className={styles.camId}>{cam.id}</div>
                                <div className={styles.camName}>{cam.nombre}</div>
                                <div className={styles.camFooter}>
                                    <span className={styles.camTramo}>{cam.tramo}</span>
                                    <span className={styles.estBadge} style={{ background: EST_BG[cam.estado], color: EST_COLOR[cam.estado] }}>
                                        {cam.estado}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
