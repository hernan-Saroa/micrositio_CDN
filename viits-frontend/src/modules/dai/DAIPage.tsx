import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useDaiStore } from '@/stores/dai.store'
import { daiApi } from '@/api/dai.api'
import TopBar from '@/components/layout/TopBar'
import StatBar from './StatBar'
import LatencyDashboard from './LatencyDashboard'
import FilterBar from './FilterBar'
import AlertTable from './AlertTable'
import AlertDetailDrawer from './AlertDetailDrawer'
import styles from './DAIPage.module.css'

export default function DAIPage() {
    const { setAlerts } = useDaiStore()

    const { data: alerts = [], isLoading, isError } = useQuery({
        queryKey: ['dai-alerts'],
        queryFn: () => daiApi.getAlerts(),
        refetchInterval: 30_000, // refresh every 30s like original
        staleTime: 15_000,
    })

    useEffect(() => {
        if (alerts.length > 0) setAlerts(alerts)
    }, [alerts, setAlerts])

    return (
        <div className={styles.page}>
            <TopBar
                title="Alertas DAI (CDN)"
                subtitle="Dispositivo de Aforo Inteligente — Red CDN INVIAS"
            />

            <div className={styles.content}>
                {/* Stat summary cards */}
                <StatBar alerts={alerts} />

                {/* Collapsible latency dashboard */}
                <LatencyDashboard alerts={alerts} />

                {/* Search + Filter bar */}
                <FilterBar />

                {/* Alert list */}
                <AlertTable isLoading={isLoading} isError={isError} />
            </div>

            {/* Floating detail drawer — does NOT affect table width */}
            <AlertDetailDrawer />
        </div>
    )
}
