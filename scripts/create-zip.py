#!/usr/bin/env python3
import os
import zipfile
import shutil
from pathlib import Path

script_dir = Path(__file__).parent
project_dir = script_dir.parent
dist_dir = project_dir / 'dist'
releases_dir = project_dir / 'releases'
output_zip = releases_dir / 'streamlist-extension.zip'

# Crear directorio releases
releases_dir.mkdir(exist_ok=True)

# Verificar dist
if not dist_dir.exists():
    print(f"❌ Error: carpeta dist no encontrada en {dist_dir}")
    exit(1)

print("📦 Empaquetando extensión como ZIP...")

# Remover ZIP anterior si existe
if output_zip.exists():
    output_zip.unlink()

# Crear ZIP
try:
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(dist_dir.parent)
                zipf.write(file_path, arcname)
    
    zip_size_mb = output_zip.stat().st_size / (1024 * 1024)
    print(f"\n✅ Extensión empaquetada exitosamente!")
    print(f"📦 Ubicación: {output_zip}")
    print(f"📊 Tamaño: {zip_size_mb:.2f} MB")
    print("\n💡 Para instalar:")
    print("1. Descomprime el ZIP")
    print("2. Abre chrome://extensions")
    print("3. Activa 'Modo de desarrollador' (esquina superior derecha)")
    print("4. Click en 'Cargar extensión sin empaquetar'")
    print("5. Selecciona la carpeta descomprimida")
    
except Exception as e:
    print(f"❌ Error al empaquetar: {e}")
    exit(1)
