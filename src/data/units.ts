import type { Unit } from '../types';

/** Unidades de respuesta FICTICIAS para la demostración (no representan despliegues reales). */
export const UNITS: Unit[] = [
  { id: 'U-BOM2', name: 'Bomberos Quibdó · Máquina 2', short: 'B2', org: 'Bomberos (demo)', kind: 'bomberos', base: 'Quibdó', lat: 5.6948, lng: -76.6545, members: 6 },
  { id: 'U-USAR', name: 'Grupo USAR Chocó', short: 'US', org: 'Bomberos (demo)', kind: 'bomberos', base: 'Quibdó', lat: 5.6915, lng: -76.6578, members: 12 },
  { id: 'U-CR1', name: 'Cruz Roja · Ambulancia 1', short: 'CR', org: 'Cruz Roja (demo)', kind: 'cruz_roja', base: 'Quibdó', lat: 5.6889, lng: -76.6527, members: 4 },
  { id: 'U-DC3', name: 'Defensa Civil · Grupo 3', short: 'DC', org: 'Defensa Civil (demo)', kind: 'defensa_civil', base: 'Quibdó', lat: 5.6968, lng: -76.6599, members: 8 },
  { id: 'U-SAL', name: 'Brigada de salud Istmina', short: 'BS', org: 'Salud departamental (demo)', kind: 'salud', base: 'Istmina', lat: 5.1612, lng: -76.6851, members: 5 },
  { id: 'U-FLU', name: 'Unidad fluvial Atrato', short: 'UF', org: 'Armada (demo)', kind: 'ejercito', base: 'Quibdó', lat: 5.6931, lng: -76.6631, members: 6 },
  { id: 'U-TAD', name: 'Brigada comunitaria Tadó', short: 'BT', org: 'Comunitaria (demo)', kind: 'comunitaria', base: 'Tadó', lat: 5.2662, lng: -76.5612, members: 10 },
];
export const UNIT: Record<string, Unit> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
