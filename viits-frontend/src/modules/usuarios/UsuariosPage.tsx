import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import TopBar from '@/components/layout/TopBar'
import { usersApi, type User } from '@/api/users.api'
import styles from './UsuariosPage.module.css'

const ROL_LABEL: Record<string, string> = {
    admin: 'Administrador', supervisor: 'Supervisor',
    operador: 'Operador', auditor: 'Auditor'
}
const ROL_COLOR: Record<string, string> = {
    admin: '#dc2626', supervisor: '#2563eb',
    operador: '#059669', auditor: '#7c3aed'
}

export default function UsuariosPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<User | null>(null)

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.getAll(),
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => usersApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setSelected(null) },
    })

    const filtered = users.filter(u =>
        [u.nombre, u.email, u.rol].some(v => v.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div className={styles.page}>
            <TopBar title="Gestión de Usuarios" subtitle="Control de accesos y roles del sistema" />

            <div className={styles.content}>
                {/* Toolbar */}
                <div className={styles.toolbar}>
                    <div className={styles.search}>
                        <span className="material-icons">search</span>
                        <input placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button className={styles.addBtn}>
                        <span className="material-icons">person_add</span> Nuevo usuario
                    </button>
                </div>

                {/* Stats row */}
                <div className={styles.statsRow}>
                    {[
                        { label: 'Total', count: users.length, icon: 'people', color: '#2563eb' },
                        { label: 'Administradores', count: users.filter(u => u.rol === 'admin').length, icon: 'admin_panel_settings', color: '#dc2626' },
                        { label: 'Activos', count: users.filter(u => u.estado === 'activo').length, icon: 'check_circle', color: '#059669' },
                        { label: 'Inactivos', count: users.filter(u => u.estado !== 'activo').length, icon: 'block', color: '#94a3b8' },
                    ].map(s => (
                        <div key={s.label} className={styles.statCard}>
                            <span className="material-icons" style={{ color: s.color }}>{s.icon}</span>
                            <span className={styles.statNum}>{s.count}</span>
                            <span className={styles.statLabel}>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Table & Detail split */}
                <div className={styles.split}>
                    {/* Table */}
                    <div className={styles.table}>
                        <div className={styles.tableHead}>
                            <div>Usuario</div><div>Rol</div><div>Estado</div><div>Último acceso</div><div />
                        </div>
                        {isLoading && <div className={styles.empty}><span className="material-icons">hourglass_empty</span><p>Cargando...</p></div>}
                        {!isLoading && filtered.length === 0 && <div className={styles.empty}><span className="material-icons">inbox</span><p>Sin usuarios</p></div>}
                        {filtered.map(u => (
                            <div
                                key={u.id}
                                className={`${styles.row} ${selected?.id === u.id ? styles.selected : ''}`}
                                onClick={() => setSelected(u)}
                            >
                                <div className={styles.userCell}>
                                    <div className={styles.avatar} style={{ background: ROL_COLOR[u.rol] + '22', color: ROL_COLOR[u.rol] }}>
                                        {u.nombre.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className={styles.nombre}>{u.nombre}</div>
                                        <div className={styles.email}>{u.email}</div>
                                    </div>
                                </div>
                                <div>
                                    <span className={styles.rolBadge} style={{ background: ROL_COLOR[u.rol] + '1a', color: ROL_COLOR[u.rol] }}>
                                        {ROL_LABEL[u.rol]}
                                    </span>
                                </div>
                                <div>
                                    <span className={`${styles.estBadge} ${styles[u.estado]}`}>{u.estado}</span>
                                </div>
                                <div className={styles.lastLogin}>{u.lastLogin ?? '—'}</div>
                                <div><span className="material-icons" style={{ color: '#94a3b8' }}>chevron_right</span></div>
                            </div>
                        ))}
                    </div>

                    {/* Detail panel */}
                    {selected && (
                        <div className={styles.detail}>
                            <div className={styles.detailHeader}>
                                <div className={styles.bigAvatar} style={{ background: ROL_COLOR[selected.rol] + '22', color: ROL_COLOR[selected.rol] }}>
                                    {selected.nombre.slice(0, 2).toUpperCase()}
                                </div>
                                <h3>{selected.nombre}</h3>
                                <p>{selected.email}</p>
                                <button className={styles.closeDetail} onClick={() => setSelected(null)}>
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                            <div className={styles.detailBody}>
                                <div className={styles.infoRow}><label>Rol</label><span style={{ color: ROL_COLOR[selected.rol], fontWeight: 700 }}>{ROL_LABEL[selected.rol]}</span></div>
                                <div className={styles.infoRow}><label>Estado</label><span>{selected.estado}</span></div>
                                <div className={styles.infoRow}><label>Creado</label><span>{selected.createdAt}</span></div>
                                <div className={styles.infoRow}><label>Último acceso</label><span>{selected.lastLogin ?? 'Nunca'}</span></div>
                            </div>
                            <div className={styles.detailActions}>
                                <button className={styles.actionEdit}><span className="material-icons">edit</span> Editar</button>
                                <button className={styles.actionReset}><span className="material-icons">lock_reset</span> Reset password</button>
                                <button className={styles.actionDelete} onClick={() => deleteMut.mutate(selected.id)}>
                                    <span className="material-icons">delete</span> Eliminar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
