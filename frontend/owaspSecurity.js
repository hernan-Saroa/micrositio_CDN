/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  MIDDLEWARE DE VALIDACIÓN Y SEGURIDAD OWASP                   ║
 * ║  VIITS - INVIAS Colombia                                      ║
 * ║                                                                ║
 * ║  Implementa las mejores prácticas de seguridad OWASP Top 10  ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * ============================================================================
 * A01:2021 – Broken Access Control
 * ============================================================================
 */

/**
 * Middleware para prevenir acceso directo a recursos
 */
const preventDirectObjectReference = async (req, res, next) => {
    try {
        // Verificar que el usuario solo acceda a sus propios recursos
        const resourceOwnerId = req.params.userId || req.query.userId;
        
        if (resourceOwnerId && resourceOwnerId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tienes permiso para acceder a este recurso',
                owaspCategory: 'A01:2021 - Broken Access Control'
            });
        }
        
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * ============================================================================
 * A02:2021 – Cryptographic Failures
 * ============================================================================
 */

/**
 * Middleware para verificar conexiones HTTPS en producción
 */
const requireHTTPS = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        return res.status(403).json({
            error: 'Conexión no segura',
            message: 'Se requiere HTTPS para esta operación',
            owaspCategory: 'A02:2021 - Cryptographic Failures'
        });
    }
    next();
};

/**
 * Validar que los datos sensibles estén encriptados antes de guardarse
 */
const validateEncryptedData = (fields) => {
    return (req, res, next) => {
        const sensitiveFields = fields;
        const errors = [];
        
        sensitiveFields.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                // Verificar que los campos sensibles no sean texto plano
                if (req.body[field].length < 32) { // Menor a un hash típico
                    errors.push(`${field} debe estar encriptado`);
                }
            }
        });
        
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Datos no encriptados',
                messages: errors,
                owaspCategory: 'A02:2021 - Cryptographic Failures'
            });
        }
        
        next();
    };
};

/**
 * ============================================================================
 * A03:2021 – Injection
 * ============================================================================
 */

/**
 * Sanitización avanzada contra SQL Injection
 */
const sanitizeInput = (req, res, next) => {
    const dangerousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
        /(--|#|\/\*|\*\/)/g,
        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
        /(\bUNION\b|\bJOIN\b)/gi,
        /'(\s*)OR(\s*)'(\s*)=(\s*)'/gi
    ];
    
    const checkObject = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                for (let pattern of dangerousPatterns) {
                    if (pattern.test(obj[key])) {
                        return {
                            detected: true,
                            field: key,
                            value: obj[key]
                        };
                    }
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                const result = checkObject(obj[key]);
                if (result.detected) return result;
            }
        }
        return { detected: false };
    };
    
    const bodyCheck = checkObject(req.body);
    const queryCheck = checkObject(req.query);
    
    if (bodyCheck.detected) {
        return res.status(400).json({
            error: 'Entrada no válida',
            message: `Patrón de inyección detectado en el campo: ${bodyCheck.field}`,
            owaspCategory: 'A03:2021 - Injection'
        });
    }
    
    if (queryCheck.detected) {
        return res.status(400).json({
            error: 'Entrada no válida',
            message: `Patrón de inyección detectado en parámetro: ${queryCheck.field}`,
            owaspCategory: 'A03:2021 - Injection'
        });
    }
    
    next();
};

/**
 * Prevención de NoSQL Injection
 */
const preventNoSQLInjection = (req, res, next) => {
    const checkForOperators = (obj) => {
        for (let key in obj) {
            if (key.startsWith('$') || key.includes('.')) {
                return true;
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (checkForOperators(obj[key])) return true;
            }
        }
        return false;
    };
    
    if (checkForOperators(req.body) || checkForOperators(req.query)) {
        return res.status(400).json({
            error: 'Entrada no válida',
            message: 'Operadores no permitidos detectados',
            owaspCategory: 'A03:2021 - Injection (NoSQL)'
        });
    }
    
    next();
};

/**
 * ============================================================================
 * A04:2021 – Insecure Design
 * ============================================================================
 */

/**
 * Rate limiting específico para operaciones críticas
 */
const criticalOperationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // Máximo 10 operaciones críticas por hora
    message: {
        error: 'Límite excedido',
        message: 'Has excedido el límite de operaciones críticas. Intenta más tarde.',
        owaspCategory: 'A04:2021 - Insecure Design'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Validación de flujo de negocio
 */
const validateBusinessLogic = (workflow) => {
    return async (req, res, next) => {
        // Implementar validación de flujo específico
        // Por ejemplo: No se puede eliminar un reporte que está siendo auditado
        
        if (workflow === 'delete-report') {
            // Verificar estado del reporte
            const reportId = req.params.id;
            // TODO: Verificar en BD si el reporte está en uso
        }
        
        next();
    };
};

/**
 * ============================================================================
 * A05:2021 – Security Misconfiguration
 * ============================================================================
 */

/**
 * Remover headers que revelan información del servidor
 */
const removeServerHeaders = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
};

/**
 * Validar configuración de entorno
 */
const validateEnvironmentConfig = (req, res, next) => {
    const requiredEnvVars = [
        'JWT_SECRET',
        'DB_PASSWORD',
        'NODE_ENV'
    ];
    
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0 && req.path === '/api/health/security') {
        return res.status(500).json({
            error: 'Configuración incompleta',
            message: 'Variables de entorno críticas no configuradas',
            missing: missing,
            owaspCategory: 'A05:2021 - Security Misconfiguration'
        });
    }
    
    next();
};

/**
 * ============================================================================
 * A06:2021 – Vulnerable and Outdated Components
 * ============================================================================
 */

/**
 * Middleware para advertir sobre dependencias desactualizadas
 * Este debería ejecutarse en desarrollo/testing
 */
const checkDependencies = async (req, res, next) => {
    if (process.env.NODE_ENV === 'development' && req.path === '/api/health/dependencies') {
        // En producción, esto debería ser parte del CI/CD
        const packageJson = require('../package.json');
        const dependencies = Object.keys(packageJson.dependencies);
        
        res.json({
            totalDependencies: dependencies.length,
            message: 'Ejecutar npm audit para verificar vulnerabilidades',
            owaspCategory: 'A06:2021 - Vulnerable and Outdated Components'
        });
        return;
    }
    next();
};

/**
 * ============================================================================
 * A07:2021 – Identification and Authentication Failures
 * ============================================================================
 */

/**
 * Validar fortaleza de contraseña
 */
const validatePasswordStrength = [
    body('password')
        .isLength({ min: 12 })
        .withMessage('La contraseña debe tener al menos 12 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('La contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales'),
];

/**
 * Prevenir enumeración de usuarios
 */
const preventUserEnumeration = (req, res, next) => {
    // Siempre devolver el mismo tipo de respuesta para login fallido
    const originalJson = res.json;
    res.json = function(data) {
        if (res.statusCode === 401 || res.statusCode === 404) {
            // Respuesta genérica que no revela si el usuario existe
            return originalJson.call(this, {
                error: 'Credenciales inválidas',
                message: 'Email o contraseña incorrectos',
                owaspCategory: 'A07:2021 - Identification and Authentication Failures'
            });
        }
        return originalJson.call(this, data);
    };
    next();
};

/**
 * Detectar y bloquear intentos de credential stuffing
 */
const credentialStuffingProtection = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 intentos
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        // Usar combinación de IP y username para detectar ataques
        return `${req.ip}-${req.body.email || req.body.username || 'unknown'}`;
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Demasiados intentos',
            message: 'Cuenta temporalmente bloqueada por múltiples intentos fallidos',
            owaspCategory: 'A07:2021 - Identification and Authentication Failures',
            unlockTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });
    }
});

/**
 * ============================================================================
 * A08:2021 – Software and Data Integrity Failures
 * ============================================================================
 */

/**
 * Validar integridad de archivos subidos
 */
const validateFileIntegrity = (req, res, next) => {
    if (req.file) {
        // Verificar tipo MIME real vs extensión
        const allowedTypes = {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
        };
        
        const fileExtension = req.file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
        const mimeType = req.file.mimetype;
        
        if (!allowedTypes[mimeType] || !allowedTypes[mimeType].includes(fileExtension)) {
            return res.status(400).json({
                error: 'Archivo no válido',
                message: 'El tipo de archivo no coincide con su extensión',
                owaspCategory: 'A08:2021 - Software and Data Integrity Failures'
            });
        }
        
        // Verificar tamaño
        if (req.file.size > 10 * 1024 * 1024) { // 10MB
            return res.status(400).json({
                error: 'Archivo demasiado grande',
                message: 'El archivo excede el tamaño máximo permitido (10MB)',
                owaspCategory: 'A08:2021 - Software and Data Integrity Failures'
            });
        }
    }
    
    next();
};

/**
 * ============================================================================
 * A09:2021 – Security Logging and Monitoring Failures
 * ============================================================================
 */

/**
 * Logger de eventos de seguridad
 */
const logSecurityEvent = (eventType) => {
    return (req, res, next) => {
        const securityLog = {
            timestamp: new Date().toISOString(),
            eventType: eventType,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            path: req.path,
            method: req.method,
            userId: req.user?.id || 'anonymous',
            sessionId: req.headers['authorization']?.substring(0, 20) || 'none'
        };
        
        // En producción, esto debería ir a un sistema de monitoreo
        console.log('[SECURITY EVENT]', JSON.stringify(securityLog));
        
        // Almacenar en base de datos
        // TODO: Implementar almacenamiento en audit_logs
        
        next();
    };
};

/**
 * ============================================================================
 * A10:2021 – Server-Side Request Forgery (SSRF)
 * ============================================================================
 */

/**
 * Validar URLs para prevenir SSRF
 */
const validateURL = (req, res, next) => {
    const urlFields = ['url', 'webhook', 'callback_url', 'redirect_url'];
    
    for (let field of urlFields) {
        if (req.body[field]) {
            const url = req.body[field];
            
            // Verificar que no sea una URL interna
            const blockedPatterns = [
                /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.|172\.16\.|192\.168\.)/i,
                /^(https?:\/\/)?.*\.local/i,
                /^file:\/\//i,
                /^data:/i
            ];
            
            for (let pattern of blockedPatterns) {
                if (pattern.test(url)) {
                    return res.status(400).json({
                        error: 'URL no permitida',
                        message: 'No se permiten URLs internas o de esquemas inseguros',
                        owaspCategory: 'A10:2021 - Server-Side Request Forgery'
                    });
                }
            }
        }
    }
    
    next();
};

/**
 * ============================================================================
 * VALIDACIONES ADICIONALES
 * ============================================================================
 */

/**
 * Validar y sanitizar entrada de usuario
 */
const validateAndSanitizeInput = (validations) => {
    return async (req, res, next) => {
        // Ejecutar todas las validaciones
        await Promise.all(validations.map(validation => validation.run(req)));
        
        // Verificar resultados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validación fallida',
                errors: errors.array(),
                owaspCategory: 'Input Validation'
            });
        }
        
        next();
    };
};

/**
 * Validación de token CSRF
 */
const validateCSRFToken = (req, res, next) => {
    // Solo para métodos que modifican datos
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
        const sessionToken = req.session?.csrfToken;
        
        if (!csrfToken || csrfToken !== sessionToken) {
            return res.status(403).json({
                error: 'Token CSRF inválido',
                message: 'La solicitud no pudo ser validada',
                owaspCategory: 'Cross-Site Request Forgery (CSRF)'
            });
        }
    }
    
    next();
};

/**
 * Prevenir clickjacking
 */
const preventClickjacking = (req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    next();
};

/**
 * Validación completa para endpoints de API
 */
const apiSecurityMiddleware = [
    sanitizeInput,
    preventNoSQLInjection,
    removeServerHeaders,
    preventClickjacking,
    logSecurityEvent('api-access')
];

module.exports = {
    // A01 - Broken Access Control
    preventDirectObjectReference,
    
    // A02 - Cryptographic Failures
    requireHTTPS,
    validateEncryptedData,
    
    // A03 - Injection
    sanitizeInput,
    preventNoSQLInjection,
    
    // A04 - Insecure Design
    criticalOperationLimiter,
    validateBusinessLogic,
    
    // A05 - Security Misconfiguration
    removeServerHeaders,
    validateEnvironmentConfig,
    
    // A06 - Vulnerable Components
    checkDependencies,
    
    // A07 - Authentication Failures
    validatePasswordStrength,
    preventUserEnumeration,
    credentialStuffingProtection,
    
    // A08 - Data Integrity
    validateFileIntegrity,
    
    // A09 - Logging Failures
    logSecurityEvent,
    
    // A10 - SSRF
    validateURL,
    
    // Adicionales
    validateAndSanitizeInput,
    validateCSRFToken,
    preventClickjacking,
    apiSecurityMiddleware
};
