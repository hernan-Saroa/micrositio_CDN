@echo off
REM ============================================================================
REM   VIITS - Servidor Local Simple
REM   Inicia un servidor HTTP para visualizar el proyecto
REM ============================================================================

color 0A
echo.
echo ========================================================================
echo   VIITS - Sistema de Vigilancia Inteligente
echo   Instituto Nacional de Vias (INVIAS) - Colombia
echo ========================================================================
echo.
echo   Iniciando servidor local...
echo.

REM Verificar si Python esta instalado
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo   [OK] Python detectado
    echo   Servidor iniciando en: http://localhost:8000
    echo.
    echo   Pagina principal: http://localhost:8000/00-INICIO-PROYECTO.html
    echo.
    echo   Presiona Ctrl+C para detener el servidor
    echo ========================================================================
    echo.
    python -m http.server 8000
    goto :end
)

REM Si no hay Python, intentar con Python3
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo   [OK] Python3 detectado
    echo   Servidor iniciando en: http://localhost:8000
    echo.
    echo   Pagina principal: http://localhost:8000/00-INICIO-PROYECTO.html
    echo.
    echo   Presiona Ctrl+C para detener el servidor
    echo ========================================================================
    echo.
    python3 -m http.server 8000
    goto :end
)

REM Si no hay Python, mostrar instrucciones
echo   [ERROR] Python no esta instalado en este sistema
echo.
echo   Para visualizar el proyecto, tienes 3 opciones:
echo.
echo   1. Instalar Python desde: https://www.python.org/downloads/
echo      Luego ejecuta este script nuevamente
echo.
echo   2. Abrir directamente los archivos HTML:
echo      - Abre "00-INICIO-PROYECTO.html" en tu navegador
echo.
echo   3. Usar otro servidor (Node.js):
echo      - Instala Node.js desde: https://nodejs.org/
echo      - Ejecuta: npx http-server -p 8000
echo.
echo ========================================================================
echo.

:end
pause
