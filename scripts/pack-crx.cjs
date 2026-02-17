#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

const DIST_DIR = path.join(__dirname, '../dist');
const RELEASES_DIR = path.join(__dirname, '../releases');
const ZIP_TEMP = path.join(RELEASES_DIR, '.temp.zip');
const OUTPUT_CRX = path.join(RELEASES_DIR, 'streamlist-extension.crx');
const KEY_FILE = path.join(RELEASES_DIR, 'streamlist-key.pem');

// Crear directorio de releases
if (!fs.existsSync(RELEASES_DIR)) {
  fs.mkdirSync(RELEASES_DIR, { recursive: true });
}

// Verificar dist
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Error: carpeta dist no encontrada. Ejecuta primero: npm run build');
  process.exit(1);
}

console.log('📦 Empaquetando extensión como CRX...\n');

// Paso 1: Generar clave privada si no existe
if (!fs.existsSync(KEY_FILE)) {
  console.log('🔑 Generando clave privada (una sola vez)...');
  try {
    // Generar con crypto nativo de Node.js (sin depender de OpenSSL)
    const { generateKeyPairSync } = require('crypto');
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    
    const pemKey = privateKey.export({ type: 'pkcs8', format: 'pem' });
    fs.writeFileSync(KEY_FILE, pemKey);
    console.log('✅ Clave privada guardada en:', KEY_FILE);
    console.log('⚠️  IMPORTANTE: Guarda esta clave de forma segura\n');
  } catch (err) {
    console.error('❌ Error generando clave:', err.message);
    process.exit(1);
  }
}

// Paso 2: Crear ZIP temporal
console.log('📦 Creando ZIP...');
const zipOutput = fs.createWriteStream(ZIP_TEMP);
const archive = archiver('zip', { zlib: { level: 9 } });

zipOutput.on('close', () => {
  console.log('✅ ZIP creado\n');
  
  // Paso 3: Crear CRX
  console.log('🔐 Creando archivo CRX...');
  try {
    const CRX = require('crx');
    const crx = new CRX({
      privateKey: fs.readFileSync(KEY_FILE),
      codeZip: ZIP_TEMP,
    });

    crx.pack().then((crxBuffer) => {
      fs.writeFileSync(OUTPUT_CRX, crxBuffer);
      
      // Limpiar ZIP temporal
      fs.unlinkSync(ZIP_TEMP);
      
      const sizeKB = (crxBuffer.length / 1024).toFixed(2);
      console.log('✅ Extensión empaquetada como CRX exitosamente!\n');
      console.log('📦 Ubicación:', OUTPUT_CRX);
      console.log('📊 Tamaño:', sizeKB, 'KB\n');
      console.log('💡 Para instalar:');
      console.log('1. Abre chrome://extensions');
      console.log('2. Activa "Modo de desarrollador"');
      console.log('3. Arrastra y suelta el archivo .crx');
      console.log('   O haz doble-click para instalarlo\n');
      console.log('✨ ¡Listo para distribuir!');
    }).catch((err) => {
      console.error('❌ Error creando CRX:', err.message);
      if (fs.existsSync(ZIP_TEMP)) fs.unlinkSync(ZIP_TEMP);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (fs.existsSync(ZIP_TEMP)) fs.unlinkSync(ZIP_TEMP);
    process.exit(1);
  }
});

zipOutput.on('error', (err) => {
  console.error('❌ Error al escribir ZIP:', err.message);
  process.exit(1);
});

archive.on('error', (err) => {
  console.error('❌ Error al crear ZIP:', err.message);
  process.exit(1);
});

archive.pipe(zipOutput);
archive.directory(DIST_DIR, false);
archive.finalize();
