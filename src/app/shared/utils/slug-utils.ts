export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // separate diacritics from letters
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

/**
 * Crea un slug amigable combinando algunas palabras del título y el ID al final.
 * Ejemplo: "LEGO Icons 10281 Árbol Bonsái", 10 -> "lego-icons-10281-arbol-bonsai-10"
 */
export function createFriendlySlug(text: string | null | undefined, id: number | string | null | undefined): string {
  if (id === null || id === undefined) return '';
  const slug = slugify(text || '');
  // Limitamos a unas 6-8 palabras para que no sea infinito
  const slugParts = slug.split('-').slice(0, 10).join('-');
  return `${slugParts}-${id}`;
}

/**
 * Extrae el ID numérico del final de un slug.
 * Ejemplo: "lego-icons-10281-arbol-bonsai-10" -> "10"
 */
export function extractIdFromSlug(slug: string): string {
  if (!slug) return '';
  const parts = slug.split('-');
  return parts[parts.length - 1];
}
