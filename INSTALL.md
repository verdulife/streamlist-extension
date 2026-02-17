# 📦 Instalar Streamlist Extension

## Opción 1: Desde Carpeta Compilada (Desarrollo)

### Pasos:
1. Asegúrate de compilar primero:
   ```bash
   npm run build
   ```

2. Ve a `chrome://extensions` en tu navegador

3. Activa el **"Modo de desarrollador"** (esquina superior derecha)

4. Click en **"Cargar extensión sin empaquetar"**

5. Selecciona la **carpeta `dist`** de este proyecto

¡Listo! La extensión debería aparecer en tu lista.

## Opción 2: Desde CRX (Recomendado para Distribución) ⭐

El formato CRX es un archivo único instalable con doble-click, perfecto para compartir.

### Crear el CRX:
```bash
npm install  # Instalar dependencias si no lo has hecho
npm run pack:crx
```

Esto generará: `releases/streamlist-extension.crx` (~1-3 MB)

### Instalar el CRX:
**Opción A - Drag & Drop (Más fácil):**
1. Ve a `chrome://extensions`
2. Activa **"Modo de desarrollador"**
3. **Arrastra y suelta** el archivo `.crx` en la página
4. Click en **"Añadir extensión"**

**Opción B - Doble-click:**
1. Haz doble-click en el archivo `.crx`
2. Chrome abrirá la página de instalación
3. Click en **"Añadir extensión"**

### Ventajas de CRX:
- ✅ Archivo único (fácil de compartir)
- ✅ Instalable con doble-click
- ✅ Firmado digitalmente
- ✅ Profesional para distribución

## Opción 3: Desde ZIP (Alternativa)

### Crear el ZIP:
```bash
npm run pack:zip
```

Esto generará: `releases/streamlist-extension.zip`

### Instalar desde ZIP:
1. **Descomprime** el ZIP a una carpeta (ej: `streamlist-extension`)
2. Ve a `chrome://extensions`
3. Activa **"Modo de desarrollador"**
4. Click en **"Cargar extensión sin empaquetar"**
5. Selecciona la carpeta descomprimida

## Comparativa de Opciones

| Método | Ventajas | Desventajas |
|--------|----------|-------------|
| **Carpeta `dist`** | Rápido, sin compilación extra | Solo para desarrollo |
| **CRX** ⭐ | Profesional, instalable con click, sin descomprimir | Requiere generar clave |
| **ZIP** | Portable, fácil de compartir | Necesita descomprimir |

## Verificar Instalación

Después de instalar:
1. Ve a `chrome://extensions`
2. Busca "**Streamlist**" en la lista
3. Verifica que esté **habilitada** (toggle azul)
4. Haz click en "**Detalles**" para ver más información

## Desinstalar

1. Ve a `chrome://extensions`
2. Encuentra "Streamlist"
3. Click en **"Remover"**

## Troubleshooting

**El archivo .crx no se instala:**
- Asegúrate de tener las dependencias instaladas: `npm install`
- Intenta con drag & drop en lugar de doble-click
- Verifica que `Modo de desarrollador` esté activado

**La extensión no aparece:**
- Asegúrate de tener `dist` compilada: `npm run build`
- Recarga la página `chrome://extensions`
- Si cambió el archivo, recarga la extensión

**Errores en la consola:**
- Abre las herramientas de desarrollador (F12)
- Ve a la pestaña "Console"
- Verifica los mensajes de error

## Para Desarrollo Continuo

Usa el modo watch:
```bash
npm run dev
```

Esto compilará automáticamente los cambios. Solo necesitas recargar la extensión en Chrome.

## Distribución

- **CRX**: Compartir el archivo `.crx` directamente
- **ZIP**: Para usuarios que prefieren carpeta desempaquetada
- **Chrome Web Store**: Sube para distribución masiva (requiere cuenta Google)


