#!/bin/bash

# ╔════════════════════════════════════════════════════════════════╗
# ║  SCRIPT DE VERIFICACIÓN - PROYECTO VIITS                      ║
# ║  Instituto Nacional de Vías (INVIAS) - Colombia               ║
# ╚════════════════════════════════════════════════════════════════╝

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║         🔍 VERIFICACIÓN DE INTEGRIDAD - PROYECTO VIITS         ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
total_checks=0
passed_checks=0
failed_checks=0

# Función para verificar archivo
check_file() {
    total_checks=$((total_checks + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1 ($(du -h "$1" | cut -f1))"
        passed_checks=$((passed_checks + 1))
        return 0
    else
        echo -e "${RED}❌${NC} $1 NO ENCONTRADO"
        failed_checks=$((failed_checks + 1))
        return 1
    fi
}

# Función para verificar referencia en archivo
check_reference() {
    local file=$1
    local search=$2
    local description=$3
    
    total_checks=$((total_checks + 1))
    if [ -f "$file" ]; then
        if grep -q "$search" "$file"; then
            echo -e "${GREEN}✅${NC} $description"
            passed_checks=$((passed_checks + 1))
            return 0
        else
            echo -e "${RED}❌${NC} $description"
            failed_checks=$((failed_checks + 1))
            return 1
        fi
    else
        echo -e "${RED}❌${NC} Archivo $file no existe"
        failed_checks=$((failed_checks + 1))
        return 1
    fi
}

# Función para verificar referencia NO existe (para referencias incorrectas)
check_no_reference() {
    local file=$1
    local search=$2
    local description=$3
    
    total_checks=$((total_checks + 1))
    if [ -f "$file" ]; then
        if grep -q "$search" "$file"; then
            echo -e "${RED}❌${NC} $description (aún existe referencia incorrecta)"
            failed_checks=$((failed_checks + 1))
            return 1
        else
            echo -e "${GREEN}✅${NC} $description"
            passed_checks=$((passed_checks + 1))
            return 0
        fi
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📄 VERIFICANDO ARCHIVOS PRINCIPALES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar archivos HTML principales
check_file "index.html"
check_file "login.html"
check_file "admin-panel.html"
check_file "participacion-ciudadana.html"
check_file "documentos.html"
check_file "dashboard-sectores-viales.html"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📄 VERIFICANDO ARCHIVOS DE NAVEGACIÓN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "00-INICIO-PROYECTO.html"
check_file "INICIO-AQUI.html"
check_file "INDICE-NAVEGACION.html"
check_file "INDEX-RECURSOS-VIITS.html"
check_file "GUIA-VISUAL.html"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📄 VERIFICANDO DOCUMENTACIÓN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "LEER-PRIMERO.txt"
check_file "RESUMEN-DESPLIEGUE.txt"
check_file "VERIFICACION-ADMIN-PANEL.txt"
check_file "GUIA-DESPLIEGUE-COMPLETO.md"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔗 VERIFICANDO REFERENCIAS ENTRE ARCHIVOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📍 Referencias en index.html:"
check_reference "index.html" 'href="documentos.html"' "  → documentos.html"
check_reference "index.html" 'href="participacion-ciudadana.html"' "  → participacion-ciudadana.html"
check_reference "index.html" 'href="admin-panel.html"' "  → admin-panel.html"

echo ""
echo "📍 Referencias en login.html:"
check_reference "login.html" "window.location.href = 'admin-panel.html'" "  → admin-panel.html"

echo ""
echo "📍 Referencias en admin-panel.html:"
check_reference "admin-panel.html" "window.location.href = 'login.html'" "  → login.html"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚠️  VERIFICANDO REFERENCIAS INCORRECTAS (NO DEBEN EXISTIR)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_no_reference "index.html" "participacion-ciudadana-CON-SESION.html" "No hay referencias a archivo inexistente"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔧 VERIFICANDO CONFIGURACIÓN DEL ADMIN PANEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if grep -q "const DEMO_MODE = true" "login.html"; then
    echo -e "${BLUE}ℹ️${NC}  Modo demostración ACTIVO en login.html"
else
    echo -e "${YELLOW}⚠️${NC}  Modo producción ACTIVO en login.html (requiere backend)"
fi

if grep -q "const DEMO_MODE = true" "admin-panel.html"; then
    echo -e "${BLUE}ℹ️${NC}  Modo demostración ACTIVO en admin-panel.html"
else
    echo -e "${YELLOW}⚠️${NC}  Modo producción ACTIVO en admin-panel.html (requiere backend)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔍 VERIFICANDO SCRIPTS DE INICIO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "iniciar-servidor.sh"
if [ -x "iniciar-servidor.sh" ]; then
    echo -e "${GREEN}✅${NC} iniciar-servidor.sh tiene permisos de ejecución"
    passed_checks=$((passed_checks + 1))
else
    echo -e "${YELLOW}⚠️${NC}  iniciar-servidor.sh sin permisos de ejecución"
    echo "      Ejecuta: chmod +x iniciar-servidor.sh"
fi
total_checks=$((total_checks + 1))

check_file "INICIAR-SERVIDOR.bat"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    📊 RESUMEN DE VERIFICACIÓN                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  Total de verificaciones: ${BLUE}$total_checks${NC}"
echo -e "  Verificaciones exitosas: ${GREEN}$passed_checks${NC}"
echo -e "  Verificaciones fallidas: ${RED}$failed_checks${NC}"
echo ""

# Calcular porcentaje
percentage=$((passed_checks * 100 / total_checks))

if [ $failed_checks -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}║  ✅ ¡PROYECTO 100% VERIFICADO Y LISTO PARA DESPLEGAR! ✅      ║${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "🚀 Próximos pasos:"
    echo "   1. Abre 00-INICIO-PROYECTO.html en tu navegador"
    echo "   2. O inicia un servidor: ./iniciar-servidor.sh"
    echo "   3. Consulta GUIA-DESPLIEGUE-COMPLETO.md para más detalles"
    exit 0
else
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                                                                ║${NC}"
    echo -e "${YELLOW}║  ⚠️  PROYECTO CON PROBLEMAS MENORES - REVISAR ARRIBA         ║${NC}"
    echo -e "${YELLOW}║                                                                ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "🔧 Revisa los elementos marcados con ❌ arriba"
    echo "📖 Consulta GUIA-DESPLIEGUE-COMPLETO.md para soluciones"
    exit 1
fi

echo ""
