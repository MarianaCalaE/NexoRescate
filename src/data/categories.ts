import {
  Activity,
  Waves,
  Mountain,
  Flame,
  Zap,
  Construction,
  UserSearch,
  LifeBuoy,
  HeartPulse,
  Package,
  Building2,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId, Infra } from '../types';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  short: string;
  icon: LucideIcon;
  color: string;
  /** Riesgo directo para la vida (0–1), usado por el motor de priorización. */
  lifeRisk: number;
  humanitarian: boolean;
  sensitive?: boolean;
  defaultInfra?: Infra[];
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'atrapada', label: 'Persona atrapada', short: 'Atrapada', icon: LifeBuoy, color: '#B91C1C', lifeRisk: 1, humanitarian: true, sensitive: true },
  { id: 'medica', label: 'Emergencia médica', short: 'Médica', icon: HeartPulse, color: '#DC2626', lifeRisk: 0.9, humanitarian: true },
  { id: 'deslizamiento', label: 'Deslizamiento o derrumbe', short: 'Derrumbe', icon: Mountain, color: '#92400E', lifeRisk: 0.7, humanitarian: false, defaultInfra: ['via'] },
  { id: 'inundacion', label: 'Inundación', short: 'Inundación', icon: Waves, color: '#0369A1', lifeRisk: 0.6, humanitarian: true, defaultInfra: ['vivienda'] },
  { id: 'estructural', label: 'Daño estructural', short: 'Estructura', icon: Building2, color: '#3B5BA9', lifeRisk: 0.6, humanitarian: false, defaultInfra: ['vivienda'] },
  { id: 'sismo', label: 'Terremoto o movimiento sísmico', short: 'Sismo', icon: Activity, color: '#9A3412', lifeRisk: 0.5, humanitarian: false },
  { id: 'incendio', label: 'Incendio forestal', short: 'Incendio', icon: Flame, color: '#EA580C', lifeRisk: 0.55, humanitarian: false },
  { id: 'desaparecida', label: 'Persona desaparecida', short: 'Desaparecida', icon: UserSearch, color: '#BE185D', lifeRisk: 0.75, humanitarian: true, sensitive: true },
  { id: 'suministros', label: 'Agua, alimentos u otros suministros', short: 'Suministros', icon: Package, color: '#0F766E', lifeRisk: 0.35, humanitarian: true },
  { id: 'poste', label: 'Poste o cable caído', short: 'Poste', icon: Zap, color: '#CA8A04', lifeRisk: 0.4, humanitarian: false, defaultInfra: ['energia'] },
  { id: 'via', label: 'Vía bloqueada', short: 'Vía', icon: Construction, color: '#D97706', lifeRisk: 0.25, humanitarian: false, defaultInfra: ['via'] },
  { id: 'otro', label: 'Otro incidente', short: 'Otro', icon: CircleHelp, color: '#475569', lifeRisk: 0.2, humanitarian: false },
];

export const CAT: Record<CategoryId, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  CategoryDef
>;

export const INFRA_LABEL: Record<Infra, string> = {
  via: 'Vías',
  energia: 'Energía',
  agua: 'Agua',
  salud: 'Salud',
  comunicaciones: 'Comunicaciones',
  vivienda: 'Viviendas',
  puente: 'Puentes',
};

export const VERIF_LABEL = {
  sin_verificar: 'Sin verificar',
  en_verificacion: 'En verificación',
  verificado_oficial: 'Verificado oficialmente',
  descartado: 'Descartado',
} as const;

export const ATTN_LABEL = {
  pendiente: 'Pendiente de atención',
  asignado: 'Asignado',
  en_atencion: 'En atención',
  resuelto: 'Resuelto',
} as const;

export const TX_LABEL = {
  local: 'Guardado localmente',
  pendiente: 'Pendiente de transmisión',
  enviado_canal: 'Enviado al canal',
  recibido_central: 'Recibido por la central',
} as const;

export const SOURCE_LABEL = {
  ciudadano: 'Reporte ciudadano',
  usuario: 'Tu reporte',
  organismo: 'Organismo de respuesta',
  oficial: 'Fuente oficial',
} as const;
