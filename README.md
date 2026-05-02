# MisClases — Control Docente
## Guía de instalación y uso

---

## 🚀 Cómo instalar en el celular (PWA)

1. **Sube los archivos** a cualquier hosting web gratuito:
   - [Netlify Drop](https://app.netlify.com/drop) — arrastra la carpeta, listo en segundos
   - [GitHub Pages](https://pages.github.com) — gratis y permanente
   - [Vercel](https://vercel.com) — muy fácil, gratis

2. **Abre la URL en Chrome (Android)** o Safari (iPhone)

3. **Instala la app:**
   - Android/Chrome: menú ⋮ → "Añadir a pantalla de inicio"
   - iPhone/Safari: ícono de compartir → "Agregar a inicio"

4. La app funciona **sin internet** después de la primera carga.

---

## 🔑 Credenciales iniciales (modifica en Perfil)

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `1234` |

⚠️ **Cambia la contraseña** en Perfil → guarda el nuevo email y contraseña.

---

## 📋 Flujo de uso básico

### Como Docente:

1. **Perfil** → Captura tu nombre y celular de WhatsApp
2. **Grupos → + Nuevo** → Crea el grupo con nivel (Bach/Lic), fechas y lista de alumnos
3. **Grupos → detalle → Compartir** → Comparte el código QR o el código de grupo con tus alumnos
4. **Actividades** → Crea tareas/actividades desde el detalle del grupo
5. **Asistencia** → Selecciona grupo y fecha, toca A/R/J/F por alumno
6. **Participación** → En Calificaciones, botón "Participación de hoy" → toca + cada vez que participa
7. **Calificaciones** → Vista de tabla con todas las ponderaciones calculadas automáticamente
8. **Perfil → Exportar** → Descarga CSV o XLSX

### Como Alumno:

1. Abre el enlace o la app → "Acceso estudiantes"
2. Ingresa el código de grupo
3. Escribe tu nombre **exactamente** como aparece en lista de asistencia
4. Registra celular y crea contraseña
5. Entrega actividades adjuntando archivos o marcando "ya lo envié por WhatsApp"
6. Ve tus calificaciones en tiempo real

---

## 🎓 Rúbricas

### Bachillerato
| Criterio | Peso |
|----------|------|
| Asistencia | 10% |
| Participación | 20% |
| Actividades | 20% |
| Tareas | 10% |
| Proyecto Integrador | 40% |

### Licenciatura
| Criterio | Peso |
|----------|------|
| Asistencia | 10% |
| Participación | 10% |
| Tareas | 10% |
| Actividades | 10% |
| Trabajo Colaborativo | 20% |
| Autogestión y Autoaprendizaje | 20% |
| Desarrollo Personal | 20% |
| Proyecto Integrador | 20% |

> Todas las rúbricas son editables desde Perfil → Rúbricas

---

## 📊 Asistencia
- **A** (Asistencia) = 10 pts
- **R** (Retardo) = 8 pts
- **J** (Justificada) = 8 pts
- **F** (Falta) = 0 pts

La calificación de asistencia se calcula automáticamente como el promedio ponderado de todos los días registrados.

---

## ⭐ Autogestión y Desarrollo Personal
Los alumnos hacen **autoevaluación con estrellas (1-5)** y pueden adjuntar una reflexión/evidencia. La maestra valida y puede ajustar la calificación final desde la vista de entregas.

---

## 📱 Participación
Sistema de contador por clase: toca **+** cada vez que un alumno participa. Al guardar, el sistema calcula el puntaje proporcional (quien más participó = 10, el resto se escala). Se promedian todos los días para la calificación final.

---

## 🔒 Datos y privacidad
- **Todos los datos se guardan localmente** en el dispositivo (localStorage)
- No hay servidor externo ni base de datos en la nube
- Para backup: usa la función de exportar CSV/XLSX
- Si cambias de dispositivo, los datos no se transfieren automáticamente

---

## 💡 Tips
- Toca el logo **MC** 5 veces en la pantalla de login para cargar datos de ejemplo
- El enlace de registro del grupo incluye el código automáticamente: `tuapp.com?group=CODIGO`
- Las bitácoras registran **cada acción** del alumno (acceso, entrega, solicitudes)
- Las entregas fuera de tiempo quedan marcadas pero sí se reciben

---

## 🛠️ Archivos incluidos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | App completa |
| `style.css` | Estilos (dark industrial + ámbar) |
| `app.js` | Toda la lógica de la aplicación |
| `manifest.json` | Configuración PWA |
| `sw.js` | Service Worker (modo offline) |
| `sw-register.js` | Registro del SW |
| `icon-192.svg` | Ícono de la app |

