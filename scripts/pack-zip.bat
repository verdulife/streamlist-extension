@echo off
REM Script simple para empaquetar la extension como ZIP en Windows

setlocal enabledelayedexpansion

set "DIST_DIR=%~dp0\..\dist"
set "RELEASES_DIR=%~dp0\..\releases"
set "OUTPUT_ZIP=%RELEASES_DIR%\streamlist-extension.zip"

REM Crear directorio releases si no existe
if not exist "%RELEASES_DIR%" mkdir "%RELEASES_DIR%"

REM Verificar si dist existe
if not exist "%DIST_DIR%" (
    echo Error: carpeta dist no encontrada. Ejecuta primero: npm run build
    exit /b 1
)

echo Empaquetando extension como ZIP...

REM Usar PowerShell para comprimir
powershell -Command "Compress-Archive -Path '%DIST_DIR%' -DestinationPath '%OUTPUT_ZIP%' -Force"

if %errorlevel% equ 0 (
    echo.
    echo ✓ Extension empaquetada exitosamente!
    echo. 
    echo Ubicacion: %OUTPUT_ZIP%
    echo.
    echo Para instalar:
    echo 1. Descomprime el ZIP
    echo 2. Abre chrome://extensions
    echo 3. Activa "Modo de desarrollador"
    echo 4. Click en "Cargar extension sin empaquetar"
    echo 5. Selecciona la carpeta descomprimida
) else (
    echo Error al empaquetar
    exit /b 1
)
