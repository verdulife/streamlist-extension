#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_DIR = path.join(__dirname, '../dist');
const RELEASES_DIR = path.join(__dirname, '../releases');
const OUTPUT_ZIP = path.join(RELEASES_DIR, 'streamlist-extension.zip');

// Crear directorio de releases si no existe
if (!fs.existsSync(RELEASES_DIR)) {
  fs.mkdirSync(RELEASES_DIR, { recursive: true });
}

// Verificar si dist existe
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Error: carpeta dist no encontrada. Ejecuta primero: npm run build');
  process.exit(1);
}

console.log('📦 Empaquetando extensión como ZIP...');

const output = fs.createWriteStream(OUTPUT_ZIP);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log('✅ Extensión empaquetada exitosamente!');
  console.log('📦 Ubicación:', OUTPUT_ZIP);
  console.log('\n💡 Para instalar:');
  console.log('1. Descomprime el ZIP');
  console.log('2. Abre chrome://extensions');
  console.log('3. Activa "Modo de desarrollador"');
  console.log('4. Click en "Cargar extensión sin empaquetar"');
  console.log('5. Selecciona la carpeta descomprimida');
});

archive.on('error', (err) => {
  console.error('❌ Error al empaquetar:', err.message);
  process.exit(1);
});

archive.pipe(output);
archive.directory(DIST_DIR, 'streamlist-extension');
archive.finalize();
