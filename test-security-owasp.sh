#!/bin/bash

###############################################################################
# Script de Pruebas de Seguridad OWASP - Sistema VIITS
# Instituto Nacional de Vías (INVIAS) - Colombia
# 
# Este script ejecuta una serie de pruebas automatizadas para verificar
# la implementación de controles de seguridad OWASP Top 10
###############################################################################

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
API_URL="${API_URL:-http://localhost:3000}"
BACKEND_DIR="${BACKEND_DIR:-./backend}"
RESULTS_FILE="security-test-results-$(date +%Y%m%d-%H%M%S).txt"

# Contadores
PASSED=0
FAILED=0
WARNINGS=0

###############################################################################
# Funciones auxiliares
###############################################################################

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                            ║${NC}"
    echo -e "${BLUE}║         🔒 PRUEBAS DE SEGURIDAD OWASP - VIITS             ║${NC}"
    echo -e "${BLUE}║         Instituto Nacional de Vías (INVIAS)               ║${NC}"
    echo -e "${BLUE}║                                                            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_section() {
    echo -e "\n${YELLOW}═══ $1 ═══${NC}\n"
}

test_passed() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
    echo "[PASS] $1" >> "$RESULTS_FILE"
}

test_failed() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
    echo "[FAIL] $1" >> "$RESULTS_FILE"
}

test_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
    echo "[WARN] $1" >> "$RESULTS_FILE"
}

###############################################################################
# A01:2021 – Broken Access Control
###############################################################################

test_access_control() {
    print_section "A01:2021 - Broken Access Control"
    
    # Test 1: Acceso sin autenticación
    echo "Probando acceso sin autenticación..."
    response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/users")
    if [ "$response" = "401" ]; then
        test_passed "Acceso sin auth bloqueado correctamente (401)"
    else
        test_failed "Acceso sin auth NO bloqueado (recibido: $response)"
    fi
    
    # Test 2: Verificar endpoint de health es público
    echo "Verificando endpoint público /api/health..."
    response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/health")
    if [ "$response" = "200" ]; then
        test_passed "Endpoint público /api/health accesible"
    else
        test_failed "Endpoint /api/health no responde (recibido: $response)"
    fi
}

###############################################################################
# A02:2021 – Cryptographic Failures
###############################################################################

test_cryptographic_failures() {
    print_section "A02:2021 - Cryptographic Failures"
    
    # Test 1: Verificar que .env no está en git
    echo "Verificando que .env no esté en control de versiones..."
    if grep -q ".env" "$BACKEND_DIR/.gitignore" 2>/dev/null; then
        test_passed ".env está en .gitignore"
    else
        test_warning ".env no encontrado en .gitignore"
    fi
    
    # Test 2: Verificar longitud de JWT_SECRET
    echo "Verificando longitud de JWT_SECRET..."
    if [ -f "$BACKEND_DIR/.env" ]; then
        jwt_length=$(grep JWT_SECRET "$BACKEND_DIR/.env" | cut -d'=' -f2 | wc -c)
        if [ "$jwt_length" -gt 32 ]; then
            test_passed "JWT_SECRET tiene longitud adecuada (>32)"
        else
            test_failed "JWT_SECRET muy corto (<32 caracteres)"
        fi
    else
        test_warning ".env no encontrado - usando .env.example"
    fi
    
    # Test 3: Headers de seguridad
    echo "Verificando headers de seguridad..."
    headers=$(curl -sI "$API_URL/api/health")
    
    if echo "$headers" | grep -q "X-Frame-Options"; then
        test_passed "Header X-Frame-Options presente"
    else
        test_failed "Header X-Frame-Options ausente"
    fi
    
    if echo "$headers" | grep -q "X-Content-Type-Options"; then
        test_passed "Header X-Content-Type-Options presente"
    else
        test_failed "Header X-Content-Type-Options ausente"
    fi
    
    # Test 4: X-Powered-By removido
    if echo "$headers" | grep -q "X-Powered-By"; then
        test_failed "Header X-Powered-By presente (debe ser removido)"
    else
        test_passed "Header X-Powered-By removido correctamente"
    fi
}

###############################################################################
# A03:2021 – Injection
###############################################################################

test_injection() {
    print_section "A03:2021 - Injection"
    
    # Test 1: SQL Injection en login
    echo "Probando inyección SQL en login..."
    response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin'"'"' OR '"'"'1'"'"'='"'"'1","password":"test"}')
    
    if echo "$response" | grep -qi "inyección\|inválida\|error"; then
        test_passed "Inyección SQL detectada y bloqueada"
    else
        test_warning "Respuesta a inyección SQL no clara"
    fi
    
    # Test 2: NoSQL Injection
    echo "Probando inyección NoSQL..."
    response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":{"$ne":null},"password":{"$ne":null}}')
    
    if echo "$response" | grep -qi "operador\|inválid\|error"; then
        test_passed "Inyección NoSQL detectada y bloqueada"
    else
        test_warning "Respuesta a inyección NoSQL no clara"
    fi
    
    # Test 3: XSS básico
    echo "Probando XSS básico..."
    response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"<script>alert(1)</script>"}')
    
    if echo "$response" | grep -q "<script>"; then
        test_failed "Entrada XSS no sanitizada"
    else
        test_passed "Entrada sanitizada correctamente"
    fi
}

###############################################################################
# A04:2021 – Insecure Design
###############################################################################

test_insecure_design() {
    print_section "A04:2021 - Insecure Design"
    
    # Test 1: Rate Limiting
    echo "Probando rate limiting en login..."
    echo "Realizando 6 peticiones rápidas..."
    
    for i in {1..6}; do
        curl -s -X POST "$API_URL/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"test@test.com","password":"test"}' > /dev/null 2>&1 &
    done
    wait
    
    sleep 1
    
    # 7ma petición debe ser bloqueada
    response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}')
    
    if [ "$response" = "429" ]; then
        test_passed "Rate limiting funcionando (429)"
    else
        test_warning "Rate limiting podría no estar activo (recibido: $response)"
    fi
    
    # Esperar para resetear rate limit
    echo "Esperando reseteo de rate limit..."
    sleep 15
}

###############################################################################
# A05:2021 – Security Misconfiguration
###############################################################################

test_security_misconfiguration() {
    print_section "A05:2021 - Security Misconfiguration"
    
    # Test 1: Verificar que no hay credenciales hardcodeadas
    echo "Buscando credenciales hardcodeadas..."
    if [ -d "$BACKEND_DIR" ]; then
        hardcoded=$(grep -r "password.*=.*['\"]" "$BACKEND_DIR" --exclude-dir=node_modules --exclude="*.md" 2>/dev/null | wc -l)
        if [ "$hardcoded" -eq 0 ]; then
            test_passed "No se encontraron credenciales hardcodeadas"
        else
            test_failed "Se encontraron posibles credenciales hardcodeadas ($hardcoded ocurrencias)"
        fi
    else
        test_warning "Directorio backend no encontrado"
    fi
    
    # Test 2: Verificar permisos de archivos
    if [ -f "$BACKEND_DIR/.env" ]; then
        perms=$(stat -c %a "$BACKEND_DIR/.env" 2>/dev/null || stat -f %A "$BACKEND_DIR/.env" 2>/dev/null)
        if [ "$perms" = "600" ] || [ "$perms" = "400" ]; then
            test_passed "Permisos de .env correctos ($perms)"
        else
            test_warning "Permisos de .env deberían ser 600 o 400 (actual: $perms)"
        fi
    fi
    
    # Test 3: CORS configurado
    echo "Verificando configuración CORS..."
    cors_header=$(curl -sI "$API_URL/api/health" | grep -i "access-control-allow-origin")
    if [ -n "$cors_header" ]; then
        test_passed "CORS configurado"
    else
        test_warning "Header CORS no encontrado"
    fi
}

###############################################################################
# A06:2021 – Vulnerable and Outdated Components
###############################################################################

test_vulnerable_components() {
    print_section "A06:2021 - Vulnerable and Outdated Components"
    
    if [ -f "$BACKEND_DIR/package.json" ]; then
        echo "Ejecutando npm audit..."
        cd "$BACKEND_DIR" || exit
        
        # Ejecutar npm audit
        audit_output=$(npm audit --json 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            # Parsear resultados
            critical=$(echo "$audit_output" | grep -o '"critical":[0-9]*' | cut -d':' -f2)
            high=$(echo "$audit_output" | grep -o '"high":[0-9]*' | cut -d':' -f2)
            
            if [ "${critical:-0}" -eq 0 ] && [ "${high:-0}" -eq 0 ]; then
                test_passed "Sin vulnerabilidades críticas o altas"
            else
                test_failed "Encontradas ${critical:-0} críticas y ${high:-0} altas"
            fi
        else
            test_warning "npm audit no ejecutado correctamente"
        fi
        
        cd - > /dev/null || exit
    else
        test_warning "package.json no encontrado"
    fi
}

###############################################################################
# A07:2021 – Identification and Authentication Failures
###############################################################################

test_authentication_failures() {
    print_section "A07:2021 - Identification and Authentication Failures"
    
    # Test 1: Contraseña débil rechazada
    echo "Probando rechazo de contraseña débil..."
    response=$(curl -s -X POST "$API_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"123456","name":"Test"}')
    
    if echo "$response" | grep -qi "12 caracteres\|password.*weak\|contraseña.*débil"; then
        test_passed "Contraseña débil rechazada"
    else
        test_warning "Validación de contraseña no clara"
    fi
    
    # Test 2: Enumeración de usuarios
    echo "Probando prevención de enumeración de usuarios..."
    
    response1=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@invias.gov.co","password":"wrongpass"}')
    
    response2=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"noexiste@test.com","password":"wrongpass"}')
    
    if [ "$response1" = "$response2" ]; then
        test_passed "Respuestas idénticas - enumeración prevenida"
    else
        test_warning "Respuestas diferentes podrían permitir enumeración"
    fi
}

###############################################################################
# A08:2021 – Software and Data Integrity Failures
###############################################################################

test_data_integrity() {
    print_section "A08:2021 - Software and Data Integrity Failures"
    
    # Test 1: package-lock.json existe
    echo "Verificando package-lock.json..."
    if [ -f "$BACKEND_DIR/package-lock.json" ]; then
        test_passed "package-lock.json presente"
    else
        test_failed "package-lock.json ausente (ejecutar npm install)"
    fi
    
    # Test 2: Verificar hashes de integridad
    if [ -f "$BACKEND_DIR/package-lock.json" ]; then
        integrity_count=$(grep -c '"integrity":' "$BACKEND_DIR/package-lock.json")
        if [ "$integrity_count" -gt 0 ]; then
            test_passed "Hashes de integridad presentes ($integrity_count)"
        else
            test_warning "Hashes de integridad no encontrados"
        fi
    fi
}

###############################################################################
# A09:2021 – Security Logging and Monitoring Failures
###############################################################################

test_logging_monitoring() {
    print_section "A09:2021 - Security Logging and Monitoring Failures"
    
    # Test 1: Verificar logs directory
    if [ -d "$BACKEND_DIR/logs" ]; then
        test_passed "Directorio de logs existe"
    else
        test_warning "Directorio de logs no encontrado"
    fi
    
    # Test 2: Verificar logs se están generando
    log_file="$BACKEND_DIR/logs/viits-$(date +%Y-%m-%d).log"
    if [ -f "$log_file" ]; then
        test_passed "Logs del día actual generándose"
        
        # Verificar tamaño del log
        size=$(wc -c < "$log_file")
        if [ "$size" -gt 0 ]; then
            test_passed "Logs contienen datos (${size} bytes)"
        else
            test_warning "Log existe pero está vacío"
        fi
    else
        test_warning "Log del día actual no encontrado"
    fi
    
    # Test 3: Verificar estructura de tabla audit_logs
    if command -v psql &> /dev/null && [ -n "$DB_NAME" ]; then
        if psql -U "$DB_USER" -d "$DB_NAME" -c "\d audit_logs" &> /dev/null; then
            test_passed "Tabla audit_logs existe en BD"
        else
            test_warning "Tabla audit_logs no verificada"
        fi
    else
        test_warning "psql no disponible - no se puede verificar BD"
    fi
}

###############################################################################
# A10:2021 – Server-Side Request Forgery (SSRF)
###############################################################################

test_ssrf() {
    print_section "A10:2021 - Server-Side Request Forgery (SSRF)"
    
    # Test 1: SSRF a localhost
    echo "Probando SSRF a localhost..."
    response=$(curl -s -X POST "$API_URL/api/webhooks" \
        -H "Content-Type: application/json" \
        -d '{"url":"http://localhost:3000/api/users"}')
    
    if echo "$response" | grep -qi "no permitida\|blocked\|forbidden"; then
        test_passed "SSRF a localhost bloqueado"
    else
        test_warning "Endpoint /api/webhooks no disponible para prueba"
    fi
    
    # Test 2: SSRF a IP privada
    echo "Probando SSRF a IP privada..."
    response=$(curl -s -X POST "$API_URL/api/webhooks" \
        -H "Content-Type: application/json" \
        -d '{"url":"http://192.168.1.1/admin"}')
    
    if echo "$response" | grep -qi "no permitida\|blocked\|forbidden"; then
        test_passed "SSRF a IP privada bloqueado"
    else
        test_warning "Validación de IP privada no verificada"
    fi
}

###############################################################################
# Resumen y reporte
###############################################################################

generate_report() {
    print_section "Resumen de Resultados"
    
    TOTAL=$((PASSED + FAILED + WARNINGS))
    
    echo -e "\nTotal de pruebas: ${BLUE}$TOTAL${NC}"
    echo -e "${GREEN}✓ Pasadas: $PASSED${NC}"
    echo -e "${RED}✗ Falladas: $FAILED${NC}"
    echo -e "${YELLOW}⚠ Advertencias: $WARNINGS${NC}\n"
    
    # Calcular porcentaje
    if [ "$TOTAL" -gt 0 ]; then
        percentage=$((PASSED * 100 / TOTAL))
        echo -e "Tasa de éxito: ${BLUE}${percentage}%${NC}\n"
    fi
    
    echo -e "Reporte completo guardado en: ${YELLOW}$RESULTS_FILE${NC}\n"
    
    # Guardar resumen en archivo
    {
        echo ""
        echo "==============================================="
        echo "RESUMEN"
        echo "==============================================="
        echo "Total: $TOTAL"
        echo "Pasadas: $PASSED"
        echo "Falladas: $FAILED"
        echo "Advertencias: $WARNINGS"
        echo "Tasa de éxito: ${percentage}%"
        echo ""
        echo "Fecha: $(date)"
        echo "==============================================="
    } >> "$RESULTS_FILE"
    
    # Código de salida
    if [ "$FAILED" -gt 0 ]; then
        echo -e "${RED}⚠ Hay pruebas fallidas que requieren atención${NC}\n"
        exit 1
    elif [ "$WARNINGS" -gt 5 ]; then
        echo -e "${YELLOW}⚠ Muchas advertencias - revisar configuración${NC}\n"
        exit 0
    else
        echo -e "${GREEN}✓ Todas las pruebas críticas pasaron exitosamente${NC}\n"
        exit 0
    fi
}

###############################################################################
# Main
###############################################################################

main() {
    # Crear archivo de resultados
    echo "REPORTE DE PRUEBAS DE SEGURIDAD OWASP - VIITS" > "$RESULTS_FILE"
    echo "Fecha: $(date)" >> "$RESULTS_FILE"
    echo "API URL: $API_URL" >> "$RESULTS_FILE"
    echo "=========================================" >> "$RESULTS_FILE"
    
    print_header
    
    echo "Ejecutando pruebas de seguridad OWASP Top 10..."
    echo "API URL: $API_URL"
    echo "Backend DIR: $BACKEND_DIR"
    echo ""
    
    # Ejecutar todas las pruebas
    test_access_control
    test_cryptographic_failures
    test_injection
    test_insecure_design
    test_security_misconfiguration
    test_vulnerable_components
    test_authentication_failures
    test_data_integrity
    test_logging_monitoring
    test_ssrf
    
    # Generar reporte
    generate_report
}

# Ejecutar
main "$@"
