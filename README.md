# NexoRescate — prototipo MVP

**«Del reporte a la respuesta, incluso sin internet».** App ciudadana para reportar y visualizar incidentes durante desastres naturales. Escenario de demostración: sismo **hipotético** M6.4 en el Chocó, Colombia. Todos los incidentes y alertas oficiales del escenario son **ficticios**.

> Prototipo para el Rally Latinoamericano de Innovación. No es un sistema certificado de respuesta a emergencias. En una emergencia real, llame al 123.

## Tres experiencias, un solo sistema

| Rol | Cuenta | Qué ve | Diseño |
|---|---|---|---|
| **Ciudadano** | No necesita | Mapa con peligros cercanos, una alerta oficial destacada y **un solo botón**: «Reportar emergencia». Todo lo demás vive en el menú. | Claro y frío, texto grande, una acción principal |
| **Rescatista** | Acceso de demostración por unidad | Todos los reportes, datos restringidos, cola de prioridades por cercanía, tomar casos, estados de atención, verificación en campo, notas, SMS y radio LoRa | Tema nocturno (menos deslumbramiento en campo), más densidad |
| **Central** | Acceso de demostración | Tablero: indicadores, cola de prioridades, mapa operativo con unidades, asignación, evolución por media hora, tipos, municipios y canales | Tema nocturno de sala de control, pensado para pantalla grande |

Entrar como equipo: menú (☰) → «Acceso para equipos de respuesta». Atajos de demo: `/#rescatista`, `/#central`, `/#ciudadano`.

### Registro con cédula y confirmación de salida

- **Ver el mapa y las alertas no requiere registro.** Para **enviar** un reporte, el ciudadano registra una sola vez su número de documento (cédula por defecto; también TI, CE, PPT o pasaporte) y autoriza su uso (Ley 1581 de 2012). Se guarda en el dispositivo y se adjunta a cada reporte.
- Mientras no se haya registrado, la vista ciudadana muestra siempre el recordatorio «Registra tu cédula». También está en el menú («Tu registro»), donde se puede cambiar o borrar.
- El documento solo lo ven rescatistas y central, enmascarado (`CC •••• 3456`) con opción «Ver número». Va en el SMS a la central, pero **nunca** en LoRa (la malla es de difusión).
- **Confirmación de salida:** cerrar un reporte a medias pide confirmar («Seguir reportando» es la opción destacada). El botón Atrás del teléfono retrocede un paso, cierra la hoja abierta o pregunta «¿Quieres salir de NexoRescate?». Cerrar o recargar la pestaña con algo sin enviar muestra el aviso del navegador. Cerrar la sesión de equipo también pide confirmación.

### Decisiones de diseño (psicología bajo estrés)

- **Una sola acción visible para el ciudadano.** Bajo estrés la atención se estrecha y cada opción extra aumenta el tiempo de decisión (ley de Hick). El botón usa el naranja de la marca, el único color saturado en pantalla, y respira lentamente (~5 s, ritmo de respiración calmada). Respeta `prefers-reduced-motion`.
- **Una pregunta por pantalla, tres pasos:** ¿Qué está pasando? → ¿Dónde es? (GPS automático, se corrige tocando el mapa) → ¿Cuántas personas? (opciones rápidas). Descripción y foto son opcionales. Después se muestra qué hacer mientras llega la ayuda.
- **Lenguaje sencillo** («Alguien está atrapado», «Camino bloqueado»), verbos claros y estados honestos («Guardado en tu teléfono, se enviará con internet»).
- **Paleta de marca:** morado `#621091` (primario: identidad, navegación y botones normales), naranja `#FF9C19` (la acción «Reportar», igual que el rescatista del logo, y prioridad alta), rojo `#FE1647` (solo peligro y prioridad crítica), verde `#6ED155` (resuelto, confirmado, conectado) y crema `#F2E4AB` (avisos suaves y simulacro). Los fondos y textos derivan del morado. Sobre naranja y verde el texto es morado oscuro, porque el blanco no se lee.
- **Privacidad:** el ciudadano solo ve peligros para moverse (derrumbes, inundaciones, vías…). Los casos de personas (atrapadas, desaparecidas, heridas) solo los ven los equipos, con su información restringida.
- **Tipografía:** Atkinson Hyperlegible Next (Braille Institute, diseñada para máxima legibilidad con baja visión, sol directo o pantallas pequeñas) para todo el texto; Barlow Condensed, inspirada en la señalización vial, para titulares y cifras.
- **Prioridad nunca solo por color:** cada nivel lleva glifo (‼ ! ? – ✓) y texto. La paleta de estados se comprobó con un validador de daltonismo; rojo‑naranja‑amarillo no se distinguen bien entre sí, por eso el glifo es obligatorio.
- **Equipos en tema oscuro morado profundo** (`#180D22`): menos deslumbramiento de noche y en campo, ahorra batería en pantallas OLED y deja claro en qué rol se está.

## Ejecutar

```bash
npm install
npm run dev          # http://localhost:5173 (desarrollo)
npm run build        # typecheck + build de producción en dist/
npm run preview      # sirve dist/ en http://localhost:4173 (con service worker / PWA)
npm test             # pruebas unitarias (priorización, seed idempotente, cola sin duplicados, tamaños SMS/LoRa)
```

Requisitos: Node 18+ (probado con Node 22). Para probar el GPS desde un teléfono se necesita HTTPS o `localhost`.

## Mapa real interactivo

El mapa usa **Leaflet** con cartografía real y coordenadas WGS84 reales:

| Capa | Fuente | Requiere internet |
|---|---|---|
| Calles | OpenStreetMap vía CARTO (respaldo: Esri, OSM directo) | Sí (con caché) |
| Satélite | Esri World Imagery + etiquetas | Sí (con caché) |
| Relieve | Esri World Topo (respaldo: OpenTopoMap) | Sí (con caché) |
| Local offline | Natural Earth (dominio público): países, departamentos, límite del Chocó, río Atrato, vías; ríos San Juan y Baudó trazados aproximados; cabeceras municipales | **No** |

- **Marcar puntos reales:** en «Reportar → Marcar el punto en el mapa», toca cualquier lugar; el pin se puede arrastrar. Con internet se obtiene la dirección (OpenStreetMap Nominatim, geocodificación inversa); sin internet, se calcula la cabecera más cercana.
- **GPS real** del dispositivo (con precisión en metros) y botón «Mi ubicación».
- **Buscador:** incidentes + nomenclátor local del Chocó (offline) + OpenStreetMap Nominatim (online, con debounce para respetar 1 consulta/s).
- **Sismos reales (opcional):** capa con el feed público del USGS (M2.5+, 30 días), claramente marcada como «DATO REAL».
- **Clústeres** coloreados por la prioridad más alta, pines por categoría con anillo de prioridad, insignia de reportes agrupados.
- **Caché de teselas:** cada tesela vista se guarda (Cache API, `nr-tiles-v1`). «Capas → Guardar zona visible» descarga el área actual (máx. 450 teselas). Sin internet solo se muestran teselas guardadas y, debajo, la cartografía vectorial local: **el mapa nunca queda en blanco**.

> Las políticas de OSM prohíben descargas masivas de teselas. Para producción se recomienda un servidor de teselas propio o un paquete offline PMTiles/MBTiles de la región.

> Si un proveedor no responde, el mapa prueba automáticamente el siguiente y, si ninguno carga, pasa a la vista simplificada local. OpenStreetMap rechaza teselas cuando el HTML se abre con doble clic (sin dirección web), por eso CARTO y Esri van primero. La página publicada como artefacto bloquea servidores externos por seguridad: allí solo se ve la vista simplificada.

## Arquitectura

```
src/
  App.tsx                 Enrutado por rol y tema (ciudadano claro / equipos oscuro), hojas modales
  screens/CitizenApp.tsx  Vista ciudadana mínima, menú secundario, alertas, acceso de equipos
  screens/ReportFlow.tsx  Reporte en 3 pasos con mapa embebido y consejos de seguridad
  screens/RescuerApp.tsx  App de campo: mapa, prioridades, alertas, enlace (radio/SMS/cola)
  screens/CentralDashboard.tsx  Tablero de la central
  data/units.ts           Unidades de respuesta ficticias
  data/safety.ts          Textos en lenguaje sencillo y consejos por tipo de emergencia
  store.tsx               Estado global (React context) y acciones: crear/actualizar, confirmar, sync, GPS…
  types.ts                Modelos: Incident, SyncOp, LoraMessage, OfficialAlert, Settings
  components/MapView.tsx  Mapa Leaflet (capas, clústeres, pines, GPS, punto manual, USGS, epicentro)
  components/ui.tsx       Componentes visuales (insignias, hojas, botones)
  screens/                MapScreen, ReportScreen, IncidentDetail, AlertsScreen, ReportsScreen, Channels (SMS, LoRa, Offline, Ajustes)
  lib/priority.ts         Motor de priorización explicable con reglas configurables (PRIORITY_RULES)
  services/db.ts          IndexedDB (idb): incidents, ops, log, lora, meta, mockCentral; seed idempotente
  services/sync.ts        Cola persistente + interfaz CentralTransport (adaptador SIMULADO, idempotente por opId)
  services/radio.ts       Interfaz RadioTransport + adaptador Meshtastic SIMULADO
  services/compact.ts     Formatos compactos SMS (≤160) y LoRa (≤228 B)
  services/alerts.ts      Adaptadores de alertas: demo (simulado) y USGS (real); SGC/IDEAM/DIMAR pendientes
  services/geo.ts         Capas base, CachedTileLayer, descarga offline, Nominatim, geocodificación inversa
  data/                   Seed ficticio (43 incidentes), categorías, nomenclátor, geodatos Natural Earth
public/sw.js              Service worker (app shell offline)
tests/core.test.ts        Pruebas unitarias
```

### Priorización

`urgencia` (riesgo vital, necesidad humanitaria, afectados, infraestructura esencial, tiempo sin atención) y `confianza` (fuente, verificación, precisión de ubicación, foto, confirmaciones, duplicados, actualidad) se calculan **por separado**. Duplicados y confirmaciones solo suben la confianza, nunca la urgencia. Niveles: Crítica, Alta, Moderada, Baja, Pendiente de verificación, Atendido. Cada incidente muestra los motivos con sus puntos.

### Estados

- Transmisión: Guardado localmente → Pendiente de transmisión → Enviado al canal (SMS/LoRa) → Recibido por la central.
- Verificación: Sin verificar, En verificación, Verificado oficialmente, Descartado. Las acciones ciudadanas nunca marcan «Verificado oficialmente».
- Atención: Pendiente, Asignado, En atención, Resuelto. «Fue atendido» de un ciudadano queda como aporte hasta que un organismo lo confirme (botones de organismo marcados DEMO).

## Qué es real y qué es simulado

| Real | Simulado / ficticio |
|---|---|
| Mapa y cartografía (OSM, Esri, OpenTopoMap, CARTO, Natural Earth) | Los 43 incidentes del escenario, el sismo M6.4, las unidades de respuesta y sus posiciones |
| GPS del dispositivo, geocodificación OSM | Alertas SGC / IDEAM / DIMAR / UNGRD |
| Feed de sismos USGS | Servidor central (ACK de sincronización) |
| IndexedDB, cola persistente, service worker / PWA | Nodo LoRa/Meshtastic y sus confirmaciones |
| Separación de vistas por rol | Inicio de sesión de equipos (sin credenciales reales) |
| Apertura de la app nativa de SMS (`sms:`) y copiar mensaje | Número de la central (configurable) |

## Cómo probar

1. **Mapa:** toca pines/clústeres; busca «NR-1002», «Tadó» o una dirección; cambia de capa; activa «Sismos recientes (USGS)».
2. **Reporte ciudadano:** «Reportar emergencia» → tipo → «Es aquí» (o toca el mapa) → personas → «Enviar reporte». Si hay un reporte parecido a menos de 350 m, pregunta si es la misma emergencia. Aparece en el mapa con la etiqueta «Tú». Recarga la página: sigue ahí.
2b. **Rescatista:** menú → Acceso para equipos → Entrar como rescatista. En Prioridades abre un caso: «Tomar este caso», cambia el estado, verifica o descarta, deja una nota de campo.
2c. **Central:** abre `/#central` en una pantalla grande. Selecciona un caso de la cola o del mapa y asígnale una unidad.
3. **Offline:** toca el indicador de conexión → «Herramientas para la demostración» → «Simular que no hay internet» (o desconecta la red / DevTools → Offline). El mapa muestra solo teselas guardadas + capa local. Crea un reporte: queda «Guardado localmente» y en la Cola.
4. **SMS:** desde el reporte → «Enviar por SMS». Revisa el mensaje (≤160), «Abrir app de SMS» o «Copiar». Queda «Pendiente de transmisión»; solo si confirmas «Ya envié el SMS» pasa a «Enviado al canal (SMS)». Nunca a «Recibido».
5. **LoRa:** «Enviar por LoRa» → Conectar nodo ficticio → seleccionar incidente → enviar. Verás En cola → Entregado al nodo → Confirmación simulada (o sin ACK, 15 % de las veces).
6. **Sincronización:** indicador de conexión → herramientas de demostración → «Simular que volvió la conexión» (en rescatista también en Enlace o Prioridades → Envíos). Las operaciones pasan a «Sincronizado (simulada)»; reintentos no duplican (idempotencia por opId).
7. **Restaurar:** ciudadano: menú → Acerca de esta app; equipos: icono de cuenta → «Restaurar datos de demostración».

## Qué falta para hardware y servicios reales

**Meshtastic físico**
- Pasarela local (p. ej. Python con la librería `meshtastic`) conectada al nodo por USB‑serial o BLE que exponga HTTP/WebSocket en `localhost`.
- Implementar `MeshtasticGatewayTransport` con la interfaz `RadioTransport` (`connect`, `send`, `onUpdate`), mapear ACK reales y canal cifrado con PSK gestionada fuera del frontend.
- Opcional: `WebSerialTransport` en navegadores con Web Serial.
- Un nodo/pasarela conectado a internet en el puesto de mando que reciba los paquetes `NXR1|…` y los registre en la central.

**Central de SMS**
- Número real y pasarela (módem GSM/SIM o proveedor de SMS) que reciba `NXR …`, lo valide y responda con confirmación.
- Endpoint de la central e implementación real de `CentralTransport` (con `Idempotency-Key = opId`), autenticación y control de acceso para datos sensibles.

**Fuentes oficiales**
- Adaptadores verificados para SGC, IDEAM, DIMAR y UNGRD (no se inventaron endpoints).
- Integración con Ushahidi u otra plataforma vía `CentralTransport`.
