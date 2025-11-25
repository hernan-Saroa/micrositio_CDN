#!/bin/bash

# ============================================================================
#   VIITS - Servidor Local Simple
#   Inicia un servidor HTTP para visualizar el proyecto
# ============================================================================

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

clear
echo ""
echo "========================================================================"
echo -e "${BLUE}  VIITS - Sistema de Vigilancia Inteligente${NC}"
echo "  Instituto Nacional de Vías (INVIAS) - Colombia"
echo "========================================================================"
echo ""
echo "  Iniciando servidor local..."
echo ""

# Verificar si Python está instalado
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}  [OK] Python3 detectado${NC}"
    echo "  Servidor iniciando en: http://localhost:8000"
    echo ""
    echo -e "${YELLOW}  Página principal: http://localhost:8000/00-INICIO-PROYECTO.html${NC}"
    echo ""
    echo "  Presiona Ctrl+C para detener el servidor"
    echo "========================================================================"
    echo ""
    python3 -m http.server 8000
    exit 0
fi

# Si no hay python3, intentar con python
if command -v python &> /dev/null; then
    echo -e "${GREEN}  [OK] Python detectado${NC}"
    echo "  Servidor iniciando en: http://localhost:8000"
    echo ""
    echo -e "${YELLOW}  Página principal: http://localhost:8000/00-INICIO-PROYECTO.html${NC}"
    echo ""
    echo "  Presiona Ctrl+C para detener el servidor"
    echo "========================================================================"
    echo ""
    python -m http.server 8000
    exit 0
fi

# Si no hay Python, intentar con PHP
if command -v php &> /dev/null; then
    echo -e "${GREEN}  [OK] PHP detectado${NC}"
    echo "  Servidor iniciando en: http://localhost:8000"
    echo ""
    echo -e "${YELLOW}  Página principal: http://localhost:8000/00-INICIO-PROYECTO.html${NC}"
    echo ""
    echo "  Presiona Ctrl+C para detener el servidor"
    echo "========================================================================"
    echo ""
    php -S localhost:8000
    exit 0
fi

# Si no hay nada instalado, mostrar instrucciones
echo -e "${RED}  [ERROR] No se encontró Python ni PHP en el sistema${NC}"
echo ""
echo "  Para visualizar el proyecto, tienes 3 opciones:"
echo ""
echo "  1. Instalar Python:"
echo "     - Ubuntu/Debian: sudo apt-get install python3"
echo "     - macOS: brew install python3"
echo "     - Fedora: sudo dnf install python3"
echo "     Luego ejecuta este script nuevamente"
echo ""
echo "  2. Abrir directamente los archivos HTML:"
echo "     - Abre '00-INICIO-PROYECTO.html' en tu navegador"
echo ""
echo "  3. Usar Node.js:"
echo "     - Instala Node.js desde: https://nodejs.org/"
echo "     - Ejecuta: npx http-server -p 8000"
echo ""
echo "========================================================================"
echo ""

exit 1
