import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import TopBar from '@/components/layout/TopBar'
import styles from './MapaPage.module.css'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

// Fix leaflet default icon path with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

// Custom icons by severity
function makeSevIcon(color: string) {
    return L.divIcon({
        className: '',
        html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.4)
    "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    })
}

const SEV_ICONS: Record<string, L.DivIcon> = {
    critica: makeSevIcon('#dc2626'),
    alta: makeSevIcon('#ea580c'),
    media: makeSevIcon('#ca8a04'),
    baja: makeSevIcon('#16a34a'),
}

interface AlertPoint {
    id: string
    tipo: string
    sev: 'critica' | 'alta' | 'media' | 'baja'
    dep: string
    lat: number
    lng: number
    estado: string
}

// Center of Colombia
const COL_CENTER: [number, number] = [4.570868, -74.297333]

function FlyTo({ center }: { center: [number, number] }) {
    const map = useMap()
    useEffect(() => { map.flyTo(center, 9, { duration: 1.2 }) }, [center, map])
    return null
}

export default function MapaPage() {
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
    const [activeLayer, setActiveLayer] = useState<'osm' | 'sat'>('osm')
    const mapRef = useRef<L.Map | null>(null)

    // Cargar puntos de alertas con coordenadas desde la API
    const { data: points = [] } = useQuery<AlertPoint[]>({
        queryKey: ['map-alerts'],
        queryFn: () => api.get('/clickhouse/alertas-mapa').then(r => r.data).catch(() => MOCK_POINTS),
        staleTime: 60_000,
    })

    const critCount = points.filter(p => p.sev === 'critica').length
    const deptosUniq = [...new Set(points.map(p => p.dep))].length

    return (
        <div className={styles.page}>
            <TopBar title="Mapa Vial — Red INVIAS" subtitle="Alertas georreferenciadas en tiempo real" />

            <div className={styles.body}>
                {/* Sidebar control */}
                <aside className={styles.sidebar}>
                    <div className={styles.legend}>
                        <h3>Severidad</h3>
                        {[
                            { key: 'critica', color: '#dc2626', label: `Crítica (${points.filter(p => p.sev === 'critica').length})` },
                            { key: 'alta', color: '#ea580c', label: `Alta (${points.filter(p => p.sev === 'alta').length})` },
                            { key: 'media', color: '#ca8a04', label: `Media (${points.filter(p => p.sev === 'media').length})` },
                            { key: 'baja', color: '#16a34a', label: `Baja (${points.filter(p => p.sev === 'baja').length})` },
                        ].map(s => (
                            <div key={s.key} className={styles.legendRow}>
                                <span className={styles.legendDot} style={{ background: s.color }} />
                                {s.label}
                            </div>
                        ))}
                    </div>

                    <div className={styles.kpis}>
                        <div className={styles.kpiCard}>
                            <span className="material-icons">place</span>
                            <strong>{points.length}</strong>
                            <span>Alertas en mapa</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className="material-icons" style={{ color: '#dc2626' }}>error</span>
                            <strong style={{ color: '#dc2626' }}>{critCount}</strong>
                            <span>Críticas</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className="material-icons">map</span>
                            <strong>{deptosUniq}</strong>
                            <span>Departamentos</span>
                        </div>
                    </div>

                    <div className={styles.layerToggle}>
                        <h3>Capa base</h3>
                        <div className={styles.layerBtns}>
                            <button
                                className={`${styles.layerBtn} ${activeLayer === 'osm' ? styles.active : ''}`}
                                onClick={() => setActiveLayer('osm')}
                            >
                                <span className="material-icons">map</span> Mapa
                            </button>
                            <button
                                className={`${styles.layerBtn} ${activeLayer === 'sat' ? styles.active : ''}`}
                                onClick={() => setActiveLayer('sat')}
                            >
                                <span className="material-icons">satellite</span> Satélite
                            </button>
                        </div>
                    </div>

                    <div className={styles.alertList}>
                        <h3>Alertas críticas</h3>
                        {points.filter(p => p.sev === 'critica').map(p => (
                            <button key={p.id} className={styles.alertItem} onClick={() => setFlyTarget([p.lat, p.lng])}>
                                <span className={styles.dot} style={{ background: '#dc2626' }} />
                                <div>
                                    <div className={styles.alertId}>{p.id}</div>
                                    <div className={styles.alertDep}>{p.dep}</div>
                                </div>
                                <span className="material-icons" style={{ color: '#cbd5e1', fontSize: 16 }}>my_location</span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Map */}
                <div className={styles.mapWrap}>
                    <MapContainer
                        center={COL_CENTER}
                        zoom={6}
                        style={{ height: '100%', width: '100%' }}
                        ref={mapRef}
                    >
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked={activeLayer === 'osm'} name="OpenStreetMap">
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer checked={activeLayer === 'sat'} name="Satélite">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution='Tiles &copy; Esri'
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>

                        {flyTarget && <FlyTo center={flyTarget} />}

                        {points.map(p => (
                            <Marker key={p.id} position={[p.lat, p.lng]} icon={SEV_ICONS[p.sev]}>
                                <Popup>
                                    <div style={{ fontFamily: 'Work Sans, sans-serif', minWidth: 200 }}>
                                        <strong style={{ display: 'block', marginBottom: 4 }}>{p.id}</strong>
                                        <span>{p.tipo}</span><br />
                                        <span style={{ fontSize: '.8rem', color: '#64748b' }}>{p.dep} · {p.estado}</span>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    )
}

// Mock data con puntos distribuidos en Colombia
const MOCK_POINTS: AlertPoint[] = [
    { id: 'DAI-0001', tipo: 'Congestionamiento', sev: 'critica', dep: 'Cundinamarca', lat: 4.710989, lng: -74.072092, estado: 'activa' },
    { id: 'DAI-0002', tipo: 'Accidente vial', sev: 'critica', dep: 'Antioquia', lat: 6.244203, lng: -75.581212, estado: 'activa' },
    { id: 'DAI-0003', tipo: 'Derrumbe', sev: 'alta', dep: 'Boyacá', lat: 5.454166, lng: -73.362243, estado: 'activa' },
    { id: 'DAI-0004', tipo: 'Falla dispositivo', sev: 'media', dep: 'Valle', lat: 3.451647, lng: -76.531982, estado: 'en_revision' },
    { id: 'DAI-0005', tipo: 'Clima adverso', sev: 'alta', dep: 'Nariño', lat: 1.214360, lng: -77.279020, estado: 'activa' },
    { id: 'DAI-0006', tipo: 'Congestionamiento', sev: 'baja', dep: 'Santander', lat: 7.119349, lng: -73.122741, estado: 'resuelta' },
    { id: 'DAI-0007', tipo: 'Derrumbe', sev: 'critica', dep: 'Cauca', lat: 2.441436, lng: -76.606671, estado: 'activa' },
    { id: 'DAI-0008', tipo: 'Accidente vial', sev: 'alta', dep: 'Tolima', lat: 4.093946, lng: -75.294838, estado: 'activa' },
    { id: 'DAI-0009', tipo: 'Falla dispositivo', sev: 'baja', dep: 'Huila', lat: 2.535090, lng: -75.528300, estado: 'resuelta' },
    { id: 'DAI-0010', tipo: 'Clima adverso', sev: 'media', dep: 'Meta', lat: 4.142979, lng: -73.626734, estado: 'en_revision' },
]
