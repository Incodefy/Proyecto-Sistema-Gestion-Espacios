# Debug y Logging

## Variables de Entorno para Control de Logging

Para reducir el ruido en los logs y mejorar el rendimiento, se han implementado flags de debug que controlan el nivel de logging:

### Variables Disponibles

En el archivo `.env`:

```env
# Debug flags - Establece en 'true' para habilitar logging detallado
DEBUG_REQUESTS=false    # Logs de cada petición HTTP (método, ruta, usuario, etc.)
DEBUG_MIDDLEWARE=false  # Logs detallados de middlewares (personalization, nomenclatura, checkGrupoActivo)
```

### Comportamiento por Defecto (Producción)

Con ambas variables en `false` o sin definir:

- **Peticiones HTTP**: Solo errores críticos
- **Middlewares**: Solo errores, sin logs de operaciones exitosas
- **Personalización**: Sin logs de carga de datos
- **Nomenclatura**: Sin logs de operaciones normales
- **CheckGrupoActivo**: Sin logs de verificación de cache

**Resultado**: Terminal limpia y mejor rendimiento.

### Modo Debug (Desarrollo)

Establece las variables en `true` cuando necesites investigar problemas:

```env
DEBUG_REQUESTS=true
DEBUG_MIDDLEWARE=true
```

Esto habilitará:
- Logs detallados de cada petición HTTP con timestamp, usuario, grupo activo
- Logs de carga de personalización
- Logs de verificación de grupo activo
- Logs de carga de nomenclatura
- Interceptores de render y redirect

### Uso Recomendado

**Producción o uso normal**:
```env
DEBUG_REQUESTS=false
DEBUG_MIDDLEWARE=false
```

**Desarrollo o debugging**:
```env
DEBUG_REQUESTS=true
DEBUG_MIDDLEWARE=true
```

**Debugging específico de middlewares**:
```env
DEBUG_REQUESTS=false
DEBUG_MIDDLEWARE=true
```

## Notas

- Los errores siempre se mostrarán independientemente de estos flags
- Reiniciar el servidor después de cambiar estas variables
- Para un rendimiento óptimo, mantén ambas en `false` en producción
