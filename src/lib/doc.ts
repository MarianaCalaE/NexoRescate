import type { DocType, ReporterDoc } from '../types';

export const DOC_LABEL: Record<DocType, string> = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  CE: 'Cédula de extranjería',
  PPT: 'Permiso por Protección Temporal',
  PA: 'Pasaporte',
};

export function validateDoc(type: DocType, raw: string): string | null {
  const v = raw.trim();
  if (type === 'PA') return /^[A-Za-z0-9]{5,12}$/.test(v) ? null : 'Escribe el número del pasaporte (5 a 12 letras o números).';
  if (!/^\d+$/.test(v)) return 'Escribe solo números, sin puntos ni espacios.';
  if (v.length < 5 || v.length > 10) return 'El número debe tener entre 5 y 10 dígitos.';
  return null;
}

export function maskDoc(d: ReporterDoc) {
  return `${d.type} •••• ${d.number.slice(-4)}`;
}

