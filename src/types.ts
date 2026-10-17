export type CategoryId =
  | 'sismo'
  | 'inundacion'
  | 'deslizamiento'
  | 'incendio'
  | 'poste'
  | 'via'
  | 'desaparecida'
  | 'atrapada'
  | 'medica'
  | 'suministros'
  | 'estructural'
  | 'otro';

export type Source = 'ciudadano' | 'usuario' | 'organismo' | 'oficial';
export type Verification = 'sin_verificar' | 'en_verificacion' | 'verificado_oficial' | 'descartado';
export type Attention = 'pendiente' | 'asignado' | 'en_atencion' | 'resuelto';
/** Estado de transmisión: nunca se confunde envío por canal con recepción en central. */
export type Transmission = 'local' | 'pendiente' | 'enviado_canal' | 'recibido_central';
export type Channel = 'internet' | 'sms' | 'lora';
export type LocationPrecision = 'gps' | 'manual' | 'aproximada' | 'desconocida';
export type Infra = 'via' | 'energia' | 'agua' | 'salud' | 'comunicaciones' | 'vivienda' | 'puente';

export interface Contribution {
  at: number;
  text: string;
  kind: 'aporte' | 'sigue_activo' | 'atendido_ciudadano' | 'estado' | 'campo' | 'verificacion' | 'asignacion';
  by?: string;
}

export interface Incident {
  id: string;
  category: CategoryId;
  title: string;
  description: string;
  lat: number | null;
  lng: number | null;
  locationLabel: string;
  municipality: string;
  locationPrecision: LocationPrecision;
  accuracyM?: number | null;
  createdAt: number;
  updatedAt: number;
  source: Source;
  sourceLabel: string;
  verification: Verification;
  attention: Attention;
  transmission: Transmission;
  channel?: Channel;
  affected?: number | null;
  infrastructure?: Infra[];
  duplicateOf?: string | null;
  confirmations: number;
  lastConfirmedAt?: number | null;
  contributions: Contribution[];
  photo?: string | null;
  version: number;
  isDemo: boolean;
  /** Reportes que involucran a personas: los detalles personales no se exponen públicamente. */
  sensitive?: boolean;
  mine?: boolean;
  /** Unidad de rescate asignada (visible solo para equipos). */
  assignedTo?: string | null;
  /** Información restringida: solo rescatistas y central (datos de búsqueda, contacto institucional). */
  restrictedNotes?: string | null;
  /** Quién verificó (organismo) y cuándo. */
  verifiedBy?: string | null;
  /** Dirección o referencia escrita por quien reporta. */
  addressText?: string | null;
  /** Momento en que se abrió la app de SMS; queda pendiente de confirmar si se envió. */
  smsPreparedAt?: number | null;
  /** Canales alternos por los que ya salió el reporte. */
  sentVia?: Channel[];
  /** Documento de quien reporta (solo visible para equipos de respuesta). */
  reporterDoc?: ReporterDoc | null;
}

export type DocType = 'CC' | 'TI' | 'CE' | 'PPT' | 'PA';
export interface ReporterDoc {
  type: DocType;
  number: string;
}
export interface Profile extends ReporterDoc {
  /** Fecha de la autorización de tratamiento de datos (Ley 1581 de 2012). */
  consentAt: number;
}

export type Role = 'ciudadano' | 'rescatista' | 'central';
export interface Session {
  role: Role;
  name: string;
  unitId?: string;
}

export interface Unit {
  id: string;
  name: string;
  short: string;
  org: string;
  kind: 'bomberos' | 'cruz_roja' | 'defensa_civil' | 'salud' | 'ejercito' | 'comunitaria';
  base: string;
  lat: number;
  lng: number;
  members: number;
}

export type OpType = 'create' | 'update' | 'confirm' | 'contribute' | 'attention' | 'verify' | 'assign';
export type OpStatus = 'pendiente' | 'enviando' | 'sincronizado' | 'error';

export interface SyncOp {
  opId: string;
  incidentId: string;
  type: OpType;
  createdAt: number;
  version: number;
  status: OpStatus;
  attempts: number;
  syncedAt?: number | null;
  lastError?: string | null;
  summary: string;
}

export interface LogEntry {
  id: string;
  at: number;
  kind: 'info' | 'sync' | 'sms' | 'lora' | 'offline' | 'error';
  text: string;
  incidentId?: string;
}

export interface OfficialAlert {
  id: string;
  kind: 'sismo' | 'lluvia' | 'deslizamiento' | 'tsunami' | 'meteo';
  level: 'roja' | 'naranja' | 'amarilla' | 'informativa';
  title: string;
  body: string;
  source: string;
  sourceShort: string;
  location: string;
  lat?: number;
  lng?: number;
  issuedAt: number;
  updatedAt: number;
  simulated: boolean;
  url?: string;
  magnitude?: number;
  depthKm?: number;
}

export interface LoraMessage {
  id: string;
  incidentId: string;
  payload: string;
  bytes: number;
  direction: 'tx' | 'rx';
  at: number;
  status: 'en_cola' | 'entregado_al_nodo' | 'ack_simulado' | 'sin_ack' | 'error';
  ackAt?: number | null;
  simulated: boolean;
  hops?: number;
}

export interface Settings {
  smsNumber: string;
  offlineDemo: boolean;
  loraAdapter: 'simulado' | 'ninguno';
  baseLayer: 'calles' | 'satelite' | 'topo' | 'local' | 'oscuro';
  showUsgs: boolean;
  opsBaseLayer: 'calles' | 'satelite' | 'topo' | 'local' | 'oscuro';
}
