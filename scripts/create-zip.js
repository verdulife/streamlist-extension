const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '../dist');
const releasesDir = path.join(__dirname, '../releases');
const outputZip = path.join(releasesDir, 'streamlist-extension.zip');

// Crear directorio releases
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

// Verificar dist
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: carpeta dist no encontrada. Ejecuta primero: npm run build');
  process.exit(1);
}

console.log('📦 Empaquetando extensión como ZIP...');

try {
  // Remover ZIP anterior si existe
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }

  // Usar tar para crear ZIP (más compatible)
  const cmd = process.platform === 'win32'
    ? `powershell -Command "Compress-Archive -Path ${distDir} -DestinationPath ${outputZip} -Force"`
    : `zip -r ${outputZip} dist`;

  execSync(cmd, { 
    stdio: 'pipe',
    shell: true,
    cwd: path.dirname(distDir)
  });

  console.log('\n✅ Extensión empaquetada exitosamente!');
  console.log(`📦 Ubicación: ${outputZip}`);
  console.log('\n💡 Para instalar:');
  console.log('1. Descomprime el ZIP');
  console.log('2. Abre chrome://extensions');
  console.log('3. Activa "Modo de desarrollador" (esquina superior derecha)');
  console.log('4. Click en "Cargar extensión sin empaquetar"');
  console.log('5. Selecciona la carpeta descomprimida');
} catch (error) {
  console.error('❌ Error al empaquetar:', error.message);
  process.exit(1);
}
