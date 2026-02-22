import styles from './TopBar.module.css'
import { useAuthStore } from '@/stores/auth.store'

interface TopBarProps {
    title: string
    subtitle?: string
}

export default function TopBar({ title, subtitle }: TopBarProps) {
    const { user, logout } = useAuthStore()

    return (
        <header className={styles.topbar}>
            <div className={styles.left}>
                <h1 className={styles.title}>{title}</h1>
                {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            <div className={styles.right}>
                <div className={styles.statusBadge}>
                    <span className={styles.statusDot} />
                    Sistema Operativo
                </div>
                <div className={styles.userAvatar} title={user?.nombre} onClick={logout}>
                    {user?.nombre?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
            </div>
        </header>
    )
}
