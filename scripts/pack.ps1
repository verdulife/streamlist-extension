# Script PowerShell para empaquetar la extension

param(
    [ValidateSet('zip', 'crx')]
    [string]$Format = 'zip'
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistDir = Join-Path $ScriptDir '../dist'
$ReleasesDir = Join-Path $ScriptDir '../releases'
$PrivateKeyPath = Join-Path $ScriptDir '../streamlist-key.pem'

# Crear directorio de releases
if (-not (Test-Path $ReleasesDir)) {
    New-Item -ItemType Directory -Path $ReleasesDir | Out-Null
}

# Verificar dist
if (-not (Test-Path $DistDir)) {
    Write-Host "❌ Error: carpeta dist no encontrada. Ejecuta primero: npm run build" -ForegroundColor Red
    exit 1
}

if ($Format -eq 'zip') {
    $OutputZip = Join-Path $ReleasesDir 'streamlist-extension.zip'
    Write-Host "📦 Empaquetando extensión como ZIP..." -ForegroundColor Cyan
    
    try {
        # Remover ZIP anterior si existe
        if (Test-Path $OutputZip) {
            Remove-Item $OutputZip -Force
        }
        
        # Comprimir
        Compress-Archive -Path $DistDir -DestinationPath $OutputZip -Force
        
        Write-Host "`n✅ Extensión empaquetada exitosamente!" -ForegroundColor Green
        Write-Host "📦 Ubicación: $OutputZip" -ForegroundColor Cyan
        Write-Host "`n💡 Para instalar:" -ForegroundColor Yellow
        Write-Host "1. Descomprime el ZIP"
        Write-Host "2. Abre chrome://extensions"
        Write-Host "3. Activa 'Modo de desarrollador' (esquina superior derecha)"
        Write-Host "4. Click en 'Cargar extensión sin empaquetar'"
        Write-Host "5. Selecciona la carpeta descomprimida"
        Write-Host ""
    } catch {
        Write-Host "❌ Error al empaquetar: $_" -ForegroundColor Red
        exit 1
    }
}
elseif ($Format -eq 'crx') {
    Write-Host "📦 Empaquetando extensión como CRX..." -ForegroundColor Cyan
    Write-Host "💡 Asegúrate de tener 'crx3' instalado: npm install -D crx3" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para crear un CRX, usa: npm run package" -ForegroundColor Cyan
}
