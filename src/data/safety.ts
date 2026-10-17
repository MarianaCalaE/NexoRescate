import type { CategoryId } from '../types';

/** Lenguaje sencillo para personas bajo estrés: verbos claros y una o dos acciones. */
export const CITIZEN_LABEL: Record<CategoryId, string> = {
  atrapada: 'Alguien está atrapado',
  medica: 'Alguien está herido o enfermo',
  desaparecida: 'Falta una persona',
  deslizamiento: 'Derrumbe',
  inundacion: 'Inundación',
  incendio: 'Incendio',
  estructural: 'Casa o edificio dañado',
  suministros: 'Necesitamos agua o comida',
  sismo: 'Tembló fuerte',
  poste: 'Poste o cables caídos',
  via: 'Camino bloqueado',
  otro: 'Otra emergencia',
};

export const PRIMARY_CATS: CategoryId[] = ['atrapada', 'medica', 'desaparecida', 'deslizamiento', 'inundacion', 'incendio', 'estructural', 'suministros'];
export const MORE_CATS: CategoryId[] = ['via', 'poste', 'sismo', 'otro'];

export const SAFETY_TIP: Record<CategoryId, string> = {
  atrapada: 'No entres a estructuras dañadas. Si puedes, habla con la persona para que sepa que viene ayuda.',
  medica: 'Mantén a la persona quieta y abrigada. Si sangra, presiona la herida con un trapo limpio.',
  desaparecida: 'Quédate en un punto de encuentro conocido para que el equipo pueda encontrarte.',
  deslizamiento: 'Aléjate de la ladera y de las quebradas. Puede haber más derrumbes.',
  inundacion: 'Sube a un lugar alto. No cruces corrientes de agua aunque parezcan bajas.',
  incendio: 'Aléjate del humo, en dirección contraria al viento.',
  estructural: 'No vuelvas a entrar. Pueden venir réplicas.',
  suministros: 'Guarda el agua potable para tomar y prioriza a niños, mayores y enfermos.',
  sismo: 'Si vuelve a temblar: agáchate, cúbrete y sujétate, lejos de ventanas.',
  poste: 'No toques cables ni el agua cerca de ellos. Mantén a otros lejos.',
  via: 'No intentes pasar por el tramo bloqueado.',
  otro: 'Quédate en un lugar seguro mientras llega la ayuda.',
};

export const AFFECTED_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'No sé', value: null },
  { label: '1', value: 1 },
  { label: '2 a 5', value: 4 },
  { label: '6 a 20', value: 12 },
  { label: 'Más de 20', value: 30 },
];
