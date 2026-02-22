import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 15000,
    withCredentials: true,
})

// Request: attach token if present
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('viits_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Response: redirect to login on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('viits_token')
            window.location.href = '/login'
        }
        return Promise.reject(err)
    }
)

export default api
