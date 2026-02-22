import styles from './Sidebar.module.css'
import { NavLink } from 'react-router-dom'

interface NavItem {
    icon: string
    label: string
    to: string
}

const navItems: NavItem[] = [
    { icon: 'home', label: 'Inicio', to: '/' },
    { icon: 'dashboard', label: 'Dashboard', to: '/dashboard' },
    { icon: 'notifications_active', label: 'Alertas DAI', to: '/dai' },
    { icon: 'videocam', label: 'CCTV', to: '/cctv' },
    { icon: 'people', label: 'Usuarios', to: '/usuarios' },
    { icon: 'download', label: 'Reportes', to: '/reportes' },
    { icon: 'public', label: 'Mapa Vial', to: '/mapa' },
    { icon: 'settings', label: 'Ajustes', to: '/ajustes' },
]

export default function Sidebar() {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <img src="/favicon.ico" alt="INVIAS" width={32} height={32} />
            </div>
            <nav className={styles.nav}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `${styles.navItem} ${isActive ? styles.active : ''}`
                        }
                        title={item.label}
                    >
                        <span className="material-icons">{item.icon}</span>
                        <span className={styles.tooltip}>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </aside>
    )
}
