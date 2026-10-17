// En la demo de un solo archivo no se incluye Vosk (≈6 MB); el dictado usa el respaldo del navegador.
export async function createModel(): Promise<never> {
  throw new Error('vosk no incluido en la demo');
}
