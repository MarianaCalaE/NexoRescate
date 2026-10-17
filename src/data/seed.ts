import type { Incident, CategoryId, Source, Verification, Attention, Infra, LocationPrecision, Transmission } from '../types';

/**
 * ESCENARIO DE DEMOSTRACIÓN — DATOS FICTICIOS.
 * Sismo hipotético M6.4 con epicentro a ~30 km al occidente de Quibdó (Alto Baudó).
 * Las ubicaciones corresponden a lugares reales del Chocó, pero los incidentes NO
 * ocurrieron. No deben interpretarse como hechos reales.
 */
export const SEED_VERSION = 5;
export const SCENARIO = {
  name: 'Simulacro: sismo hipotético M6.4 — Chocó',
  epicenter: { lat: 5.71, lng: -76.94 },
  magnitude: 6.4,
  depthKm: 18,
  minutesAgo: 190,
};

interface S {
  id: string;
  c: CategoryId;
  t: string;
  d: string;
  at: [number, number] | null;
  loc: string;
  mun: string;
  m: number; // minutos desde el reporte
  src?: Source;
  srcL?: string;
  v?: Verification;
  a?: Attention;
  aff?: number | null;
  inf?: Infra[];
  dup?: string;
  conf?: number;
  prec?: LocationPrecision;
  upd?: number; // minutos desde la última actualización
  tx?: Transmission;
}

const RAW: S[] = [
  // ——— Quibdó urbano ———
  { id: 'NR-1001', c: 'estructural', t: 'Colapso parcial de vivienda de dos pisos', d: 'Fachada y segundo piso colapsados. Vecinos reportan que la familia logró salir. Riesgo de caída del muro lateral.', at: [5.6976, -76.6452], loc: 'Barrio Kennedy, cerca a la carrera 4', mun: 'Quibdó', m: 175, v: 'en_verificacion', a: 'asignado', aff: 6, inf: ['vivienda'], conf: 4, prec: 'gps' },
  { id: 'NR-1002', c: 'atrapada', t: 'Dos personas atrapadas bajo escombros', d: 'Se escuchan voces bajo la losa de un local comercial. Se requiere equipo USAR.', at: [5.6911, -76.6571], loc: 'Centro, calle 26 con carrera 3', mun: 'Quibdó', m: 168, src: 'organismo', srcL: 'Cuerpo de Bomberos (simulado)', v: 'verificado_oficial', a: 'en_atencion', aff: 2, inf: ['vivienda'], conf: 6, prec: 'gps', upd: 12 },
  { id: 'NR-1003', c: 'atrapada', t: 'Personas atrapadas en local del centro', d: 'Hay gente debajo del local, ayuda urgente.', at: [5.6913, -76.6575], loc: 'Centro de Quibdó', mun: 'Quibdó', m: 160, dup: 'NR-1002', prec: 'gps' },
  { id: 'NR-1004', c: 'atrapada', t: 'Atrapados por derrumbe de local', d: 'Video en redes muestra el local caído. Compartido muchas veces.', at: [5.6909, -76.6569], loc: 'Calle 26, Quibdó', mun: 'Quibdó', m: 150, dup: 'NR-1002', prec: 'aproximada' },
  { id: 'NR-1005', c: 'medica', t: 'Heridos en espera de atención', d: 'Al menos 14 personas con heridas leves y 3 con fracturas en el coliseo. Faltan camillas e insumos.', at: [5.6888, -76.6531], loc: 'Coliseo cubierto (punto de encuentro)', mun: 'Quibdó', m: 140, src: 'organismo', srcL: 'Cruz Roja seccional (simulado)', v: 'verificado_oficial', a: 'en_atencion', aff: 17, inf: ['salud'], conf: 3, prec: 'gps', upd: 20 },
  { id: 'NR-1006', c: 'estructural', t: 'Grietas en pabellón del hospital', d: 'Grietas diagonales en muros del pabellón de hospitalización. Se evacúan pacientes al parqueadero.', at: [5.6894, -76.6511], loc: 'Hospital San Francisco de Asís', mun: 'Quibdó', m: 150, src: 'organismo', srcL: 'Secretaría de Salud (simulado)', v: 'verificado_oficial', a: 'en_atencion', aff: 80, inf: ['salud'], conf: 2, prec: 'gps', upd: 35 },
  { id: 'NR-1007', c: 'poste', t: 'Poste caído con cables energizados', d: 'Poste de media tensión sobre la vía. Cables en el suelo, chispas.', at: [5.7008, -76.6528], loc: 'Barrio Medrano', mun: 'Quibdó', m: 120, v: 'sin_verificar', a: 'pendiente', inf: ['energia', 'via'], conf: 2, prec: 'gps' },
  { id: 'NR-1008', c: 'inundacion', t: 'Rebose de quebrada La Yesca', d: 'Agua hasta la rodilla en viviendas de la ribera tras la lluvia posterior al sismo.', at: [5.6851, -76.6559], loc: 'Barrio La Yesca', mun: 'Quibdó', m: 95, v: 'en_verificacion', a: 'pendiente', aff: 35, inf: ['vivienda'], conf: 3, prec: 'gps' },
  { id: 'NR-1009', c: 'suministros', t: 'Albergue sin agua potable', d: 'Unas 120 personas en el albergue temporal. Se requiere agua, kits de higiene y colchonetas.', at: [5.6965, -76.6602], loc: 'Institución educativa, barrio Cabí', mun: 'Quibdó', m: 85, src: 'organismo', srcL: 'Defensa Civil (simulado)', v: 'verificado_oficial', a: 'asignado', aff: 120, inf: ['agua'], conf: 1, prec: 'manual', upd: 40 },
  { id: 'NR-1010', c: 'estructural', t: 'Daño en muelle del malecón', d: 'Fisuras en la plataforma del malecón. Se recomienda no usar el embarcadero.', at: [5.6928, -76.6624], loc: 'Malecón, río Atrato', mun: 'Quibdó', m: 130, v: 'sin_verificar', a: 'pendiente', inf: ['via'], conf: 1, prec: 'manual' },
  { id: 'NR-1011', c: 'estructural', t: 'Grietas en pista del aeropuerto', d: 'Reporte de fisuras en la plataforma. Operaciones suspendidas temporalmente.', at: [5.6908, -76.6414], loc: 'Aeropuerto El Caraño', mun: 'Quibdó', m: 160, src: 'oficial', srcL: 'Autoridad aeronáutica (simulado)', v: 'verificado_oficial', a: 'en_atencion', inf: ['via', 'comunicaciones'], prec: 'gps', upd: 60 },
  { id: 'NR-1012', c: 'medica', t: 'Adulto mayor con dolor en el pecho', d: 'Persona de la tercera edad con dolor torácico tras el susto del sismo. No hay transporte.', at: [5.6862, -76.6421], loc: 'Zona Minera', mun: 'Quibdó', m: 40, v: 'sin_verificar', a: 'pendiente', aff: 1, prec: 'gps' },
  { id: 'NR-1013', c: 'via', t: 'Vía cerrada por escombros', d: 'Escombros de una casa cayeron sobre la calle. Solo pasan motos.', at: [5.6945, -76.6488], loc: 'Carrera 6, sector centro-oriente', mun: 'Quibdó', m: 110, v: 'sin_verificar', a: 'resuelto', inf: ['via'], prec: 'manual', upd: 30 },
  { id: 'NR-1014', c: 'desaparecida', t: 'Menor no localizado tras evacuación', d: 'Familia reporta un menor no localizado después de la evacuación del colegio. Datos personales protegidos: solo visibles para organismos.', at: [5.6982, -76.6466], loc: 'Sector Kennedy (zona general)', mun: 'Quibdó', m: 100, src: 'ciudadano', v: 'en_verificacion', a: 'asignado', aff: 1, prec: 'aproximada' },
  { id: 'NR-1015', c: 'sismo', t: 'Réplica fuerte sentida', d: 'Réplica fuerte, se cayeron objetos y hubo pánico en la calle.', at: [5.6935, -76.6560], loc: 'Quibdó', mun: 'Quibdó', m: 55, v: 'sin_verificar', a: 'pendiente', prec: 'aproximada', conf: 5 },
  // ——— Vía Quibdó – Medellín ———
  { id: 'NR-1020', c: 'deslizamiento', t: 'Derrumbe cubre la vía Quibdó – Medellín', d: 'Derrumbe de gran volumen cubre los dos carriles. Vehículos atrapados entre dos frentes de derrumbe.', at: [5.7468, -76.5245], loc: 'Vía Quibdó–Medellín, sector Tutunendo', mun: 'Quibdó', m: 170, src: 'oficial', srcL: 'INVÍAS (simulado)', v: 'verificado_oficial', a: 'asignado', aff: 25, inf: ['via'], conf: 4, prec: 'gps', upd: 50 },
  { id: 'NR-1021', c: 'deslizamiento', t: 'Derrumbe en Tutunendo', d: 'Se cayó la montaña sobre la carretera.', at: [5.7462, -76.5258], loc: 'Tutunendo', mun: 'Quibdó', m: 165, dup: 'NR-1020', prec: 'gps' },
  { id: 'NR-1022', c: 'via', t: 'Pérdida de banca', d: 'Hundimiento de la banca en un tramo de 40 m. Paso restringido a un carril.', at: [5.8150, -76.3540], loc: 'Vía Quibdó–Medellín, tramo alto', mun: 'El Carmen de Atrato', m: 150, v: 'en_verificacion', a: 'pendiente', inf: ['via'], prec: 'manual' },
  { id: 'NR-1023', c: 'atrapada', t: 'Bus intermunicipal atrapado entre derrumbes', d: 'Bus con pasajeros quedó entre dos derrumbes. Conductor reporta heridos leves por radio.', at: [5.7720, -76.4560], loc: 'Vía Quibdó–Medellín, km 20 aprox.', mun: 'Quibdó', m: 135, src: 'ciudadano', v: 'en_verificacion', a: 'asignado', aff: 32, inf: ['via'], conf: 2, prec: 'aproximada' },
  { id: 'NR-1024', c: 'via', t: 'Paso habilitado a un carril', d: 'Maquinaria habilitó paso provisional. Tránsito controlado.', at: [5.8790, -76.2010], loc: 'Cerca al casco urbano', mun: 'El Carmen de Atrato', m: 180, src: 'oficial', srcL: 'INVÍAS (simulado)', v: 'verificado_oficial', a: 'resuelto', inf: ['via'], prec: 'gps', upd: 25 },
  // ——— Vía a Pereira / San Juan ———
  { id: 'NR-1030', c: 'deslizamiento', t: 'Deslizamiento afecta viviendas', d: 'Ladera se desprendió sobre tres viviendas. Familias evacuadas, una persona sin contactar.', at: [5.2690, -76.5640], loc: 'Tadó, sector alto', mun: 'Tadó', m: 125, v: 'en_verificacion', a: 'pendiente', aff: 14, inf: ['vivienda'], prec: 'gps' },
  { id: 'NR-1031', c: 'inundacion', t: 'Creciente del río San Juan', d: 'Río San Juan sube rápido. Casas de la orilla con agua.', at: [5.1590, -76.6880], loc: 'Istmina, ribera del San Juan', mun: 'Istmina', m: 80, v: 'sin_verificar', a: 'pendiente', aff: 60, inf: ['vivienda'], conf: 3, prec: 'gps' },
  { id: 'NR-1032', c: 'estructural', t: 'Puente con fisuras', d: 'Fisuras visibles en el estribo del puente. Paso peatonal solamente.', at: [5.2810, -76.6290], loc: 'Las Ánimas, puente vehicular', mun: 'Unión Panamericana', m: 145, src: 'oficial', srcL: 'Alcaldía municipal (simulado)', v: 'verificado_oficial', a: 'asignado', inf: ['puente', 'via'], prec: 'gps', upd: 70 },
  { id: 'NR-1033', c: 'medica', t: 'Centro de salud saturado', d: 'El puesto de salud atiende más de 30 heridos. Falta personal y medicamentos.', at: [5.0920, -76.6505], loc: 'Condoto, puesto de salud', mun: 'Condoto', m: 90, src: 'organismo', srcL: 'Hospital local (simulado)', v: 'verificado_oficial', a: 'en_atencion', aff: 30, inf: ['salud'], prec: 'gps', upd: 45 },
  { id: 'NR-1034', c: 'suministros', t: 'Comunidad sin agua por daño de acueducto', d: 'Tubería principal rota. Unas 400 familias sin agua.', at: [5.3720, -76.6060], loc: 'Cértegui', mun: 'Cértegui', m: 100, v: 'sin_verificar', a: 'pendiente', aff: 1600, inf: ['agua'], prec: 'manual' },
  // ——— Atrato medio y alto ———
  { id: 'NR-1040', c: 'inundacion', t: 'Inundación en Bellavista', d: 'El río Atrato inunda la parte baja. Familias se refugian en la iglesia.', at: [6.5580, -76.8890], loc: 'Bellavista, Bojayá', mun: 'Bojayá', m: 70, v: 'sin_verificar', a: 'pendiente', aff: 200, inf: ['vivienda'], prec: 'gps' },
  { id: 'NR-1041', c: 'suministros', t: 'Necesidad de alimentos y lanchas', d: 'Comunidad ribereña incomunicada. Requiere alimentos y transporte fluvial.', at: [5.9670, -76.7830], loc: 'Beté, Medio Atrato', mun: 'Medio Atrato', m: 60, src: 'ciudadano', v: 'sin_verificar', a: 'pendiente', aff: 90, prec: 'aproximada' },
  { id: 'NR-1042', c: 'deslizamiento', t: 'Derrumbe en camino veredal', d: 'Camino a la vereda bloqueado; comunidad indígena sin acceso.', at: [5.4180, -76.4210], loc: 'Bagadó, camino veredal', mun: 'Bagadó', m: 115, v: 'sin_verificar', a: 'pendiente', aff: 45, inf: ['via'], prec: 'manual' },
  { id: 'NR-1043', c: 'estructural', t: 'Iglesia con daños en el campanario', d: 'Se desprendió parte del campanario. Zona acordonada por vecinos.', at: [5.4975, -76.5450], loc: 'Lloró, parque principal', mun: 'Lloró', m: 160, v: 'sin_verificar', a: 'resuelto', prec: 'gps', upd: 90 },
  { id: 'NR-1044', c: 'otro', t: 'Olor a gas cerca a estación', d: 'Vecinos perciben olor a combustible después del sismo.', at: [5.5300, -76.6380], loc: 'Yuto', mun: 'Atrato', m: 50, v: 'sin_verificar', a: 'pendiente', prec: 'manual' },
  // ——— Baudó (cerca del epicentro, pocos reportes) ———
  { id: 'NR-1050', c: 'estructural', t: 'Viviendas palafíticas colapsadas', d: 'Mensaje recibido por radio comunitaria: varias casas sobre pilotes cayeron. Sin detalles de heridos.', at: [5.5160, -76.9740], loc: 'Pie de Pató, Alto Baudó', mun: 'Alto Baudó', m: 155, src: 'ciudadano', v: 'sin_verificar', a: 'pendiente', aff: null, inf: ['vivienda'], prec: 'aproximada', upd: 155 },
  { id: 'NR-1051', c: 'medica', t: 'Herido grave, sin transporte', d: 'Persona con trauma en la cabeza. Necesita evacuación aérea o fluvial.', at: null, loc: 'Comunidad sobre el río Baudó (ubicación sin confirmar)', mun: 'Alto Baudó', m: 145, src: 'ciudadano', v: 'sin_verificar', a: 'pendiente', aff: 1, prec: 'desconocida', upd: 145 },
  { id: 'NR-1052', c: 'sismo', t: 'Sismo muy fuerte sentido en Puerto Meluk', d: 'Movimiento muy fuerte, duración de casi un minuto.', at: [5.1920, -76.9500], loc: 'Puerto Meluk', mun: 'Medio Baudó', m: 188, v: 'sin_verificar', a: 'pendiente', prec: 'gps' },
  { id: 'NR-1053', c: 'desaparecida', t: 'Pescador sin regresar', d: 'Familia reporta pescador que salió antes del sismo y no ha regresado. Datos personales protegidos.', at: [4.9550, -77.3700], loc: 'Pizarro, desembocadura del Baudó', mun: 'Bajo Baudó', m: 120, v: 'en_verificacion', a: 'asignado', aff: 1, prec: 'aproximada' },
  // ——— Costa Pacífica ———
  { id: 'NR-1060', c: 'otro', t: 'Retiro inusual del mar', d: 'Pobladores dicen que el mar se retiró unos metros. Se autoevacuaron a la parte alta.', at: [5.7090, -77.2740], loc: 'Nuquí, playa principal', mun: 'Nuquí', m: 175, v: 'sin_verificar', a: 'pendiente', prec: 'manual', conf: 2 },
  { id: 'NR-1061', c: 'suministros', t: 'Turistas varados sin vuelos', d: 'Unos 60 turistas sin vuelos ni lanchas. Necesitan agua y alojamiento.', at: [6.2220, -77.4040], loc: 'Ciudad Mutis, Bahía Solano', mun: 'Bahía Solano', m: 95, v: 'sin_verificar', a: 'pendiente', aff: 60, prec: 'gps' },
  { id: 'NR-1062', c: 'poste', t: 'Red eléctrica caída', d: 'Sin energía en todo el casco urbano. Postes inclinados.', at: [6.2260, -77.4010], loc: 'Bahía Solano', mun: 'Bahía Solano', m: 150, v: 'en_verificacion', a: 'asignado', inf: ['energia', 'comunicaciones'], prec: 'manual' },
  { id: 'NR-1063', c: 'incendio', t: 'Incendio en vivienda tras el sismo', d: 'Incendio por cortocircuito en una vivienda de madera. Controlado por vecinos.', at: [4.2580, -77.3650], loc: 'Docordó', mun: 'El Litoral del San Juan', m: 170, v: 'sin_verificar', a: 'resuelto', aff: 5, prec: 'manual', upd: 120 },
  // ——— Norte / Darién ———
  { id: 'NR-1070', c: 'inundacion', t: 'Crecida en Riosucio', d: 'El Atrato sube y amenaza barrios bajos. Comunidad organiza evacuación.', at: [7.4400, -77.1190], loc: 'Riosucio, ribera', mun: 'Riosucio', m: 65, v: 'sin_verificar', a: 'pendiente', aff: 150, inf: ['vivienda'], prec: 'gps' },
  { id: 'NR-1071', c: 'incendio', t: 'Quema forestal fuera de control', d: 'Columna de humo visible desde la carretera.', at: [7.3800, -76.7300], loc: 'Cerca a Belén de Bajirá', mun: 'Belén de Bajirá', m: 30, v: 'sin_verificar', a: 'pendiente', prec: 'manual' },
  { id: 'NR-1072', c: 'sismo', t: 'Sismo sentido levemente', d: 'Se sintió suave, sin daños.', at: [8.5110, -77.2790], loc: 'Acandí', mun: 'Acandí', m: 189, v: 'sin_verificar', a: 'resuelto', prec: 'gps', upd: 150 },
  { id: 'NR-1073', c: 'otro', t: 'Reporte sin ubicación precisa', d: 'Mensaje de texto reenviado: "ayuda en la vereda, casas caídas". Sin municipio claro.', at: null, loc: 'Ubicación desconocida', mun: 'Sin determinar', m: 110, src: 'ciudadano', v: 'sin_verificar', a: 'pendiente', prec: 'desconocida', upd: 110 },
  { id: 'NR-1074', c: 'via', t: 'Vía a Nóvita con piedras', d: 'Rocas pequeñas sobre la vía, transitable con precaución.', at: [4.9600, -76.6110], loc: 'Nóvita, acceso', mun: 'Nóvita', m: 140, v: 'sin_verificar', a: 'pendiente', inf: ['via'], prec: 'manual' },
  { id: 'NR-1075', c: 'suministros', t: 'Solicitud de carpas', d: 'Familias duermen al aire libre por miedo a réplicas. Necesitan carpas y mantas.', at: [5.0950, -76.6960], loc: 'Andagoya', mun: 'Medio San Juan', m: 75, v: 'sin_verificar', a: 'pendiente', aff: 40, prec: 'manual' },
];

/** Asignaciones y notas restringidas del escenario (ficticias). */
const ASSIGN: Record<string, string> = {
  'NR-1002': 'U-USAR', 'NR-1005': 'U-CR1', 'NR-1014': 'U-BOM2', 'NR-1023': 'U-BOM2',
  'NR-1033': 'U-SAL', 'NR-1053': 'U-FLU',
};
const RESTRICTED: Record<string, string> = {
  'NR-1014': 'Niño de 9 años, camiseta azul del colegio, mochila roja. Último punto visto: portón norte de la institución educativa. Familia en el punto de encuentro del parque (contacto vía Defensa Civil). Datos ficticios.',
  'NR-1053': 'Pescador adulto, lancha blanca con franja verde, motor 15 HP. Salió hacia el norte de la bocana. Familia contactable por radio comunitaria de Pizarro. Datos ficticios.',
  'NR-1002': 'Dos adultos bajo losa, zona trasera del local. Contacto por golpes en tubería. Riesgo de colapso secundario: apuntalar antes de ingresar. Datos ficticios.',
  'NR-1023': 'Conductor reporta 32 pasajeros, 3 heridos leves y una gestante. Comunicación intermitente por radio de la empresa. Datos ficticios.',
  'NR-1051': 'Posible comunidad: aguas arriba de Pie de Pató. Reporte llegó por mensaje reenviado sin número de origen. Datos ficticios.',
};

export function buildSeed(now = Date.now()): Incident[] {
  return RAW.map((r) => {
    const createdAt = now - r.m * 60_000;
    const updatedAt = now - (r.upd ?? Math.max(5, Math.round(r.m * 0.6))) * 60_000;
    const src = r.src ?? 'ciudadano';
    const tx: Transmission = r.tx ?? 'recibido_central';
    return {
      id: r.id,
      category: r.c,
      title: r.t,
      description: r.d,
      lat: r.at ? r.at[0] : null,
      lng: r.at ? r.at[1] : null,
      locationLabel: r.loc,
      municipality: r.mun,
      locationPrecision: r.prec ?? (r.at ? 'manual' : 'desconocida'),
      createdAt,
      updatedAt,
      source: src,
      sourceLabel: r.srcL ?? (src === 'ciudadano' ? 'Reporte ciudadano (demo)' : 'Demo'),
      verification: r.v ?? 'sin_verificar',
      attention: r.a ?? 'pendiente',
      transmission: tx,
      channel: 'internet',
      affected: r.aff ?? null,
      infrastructure: r.inf ?? [],
      duplicateOf: r.dup ?? null,
      confirmations: r.conf ?? 0,
      lastConfirmedAt: r.conf ? now - Math.round(r.m * 0.3) * 60_000 : null,
      contributions: [],
      photo: null,
      version: 1,
      isDemo: true,
      sensitive: r.c === 'desaparecida' || r.c === 'atrapada',
      assignedTo: ASSIGN[r.id] ?? null,
      restrictedNotes: RESTRICTED[r.id] ?? null,
      verifiedBy: (r.v ?? 'sin_verificar') === 'verificado_oficial' ? (r.srcL ?? 'Organismo (demo)') : null,
    } satisfies Incident;
  });
}
