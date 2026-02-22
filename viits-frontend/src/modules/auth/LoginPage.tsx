import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import styles from './LoginPage.module.css'

export default function LoginPage() {
    const navigate = useNavigate()
    const { login, isLoading, error, token } = useAuthStore()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)

    useEffect(() => {
        if (token) navigate('/dai', { replace: true })
    }, [token, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await login(email, password)
            navigate('/dai', { replace: true })
        } catch { /* error shown via store */ }
    }

    return (
        <div className={styles.page}>
            {/* Background decoration */}
            <div className={styles.bg}>
                <div className={styles.bgCircle1} />
                <div className={styles.bgCircle2} />
                <div className={styles.bgGrid} />
            </div>

            <div className={styles.card}>
                {/* Logo */}
                <div className={styles.logoWrap}>
                    <div className={styles.logoIcon}>
                        <span className="material-icons">route</span>
                    </div>
                    <div>
                        <h1 className={styles.logoTitle}>VIITS</h1>
                        <p className={styles.logoSub}>INVIAS — Panel Administrativo</p>
                    </div>
                </div>

                <h2 className={styles.heading}>Iniciar sesión</h2>
                <p className={styles.subheading}>Acceso restringido al personal autorizado</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Email */}
                    <div className={styles.field}>
                        <label htmlFor="email">Correo electrónico</label>
                        <div className={styles.input}>
                            <span className="material-icons">email</span>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="usuario@invias.gov.co"
                                autoComplete="email"
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className={styles.field}>
                        <label htmlFor="password">Contraseña</label>
                        <div className={styles.input}>
                            <span className="material-icons">lock</span>
                            <input
                                id="password"
                                type={showPass ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                            <button type="button" onClick={() => setShowPass(v => !v)} className={styles.eyeBtn}>
                                <span className="material-icons">{showPass ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className={styles.errorBox}>
                            <span className="material-icons">error_outline</span>
                            {error}
                        </div>
                    )}

                    <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                        {isLoading
                            ? <><span className={styles.spinner} /> Verificando...</>
                            : <><span className="material-icons">login</span> Ingresar</>
                        }
                    </button>
                </form>

                <div className={styles.security}>
                    <span className="material-icons">security</span>
                    Conexión cifrada · Protegido por OWASP
                </div>
            </div>
        </div>
    )
}
