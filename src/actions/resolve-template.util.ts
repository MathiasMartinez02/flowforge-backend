import { resolveField } from '../common/resolve-field.util.js';

// Reemplaza placeholders {{campo.anidado}} en un string con valores del output del paso anterior.
// Permite que una notificacion incluya datos de un paso previo en el mensaje, ej: "status {{statusCode}}".
export function resolveTemplate(template: string, source: Record<string, unknown> | null): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = resolveField(source, path);
    return value === undefined || value === null ? '' : String(value);
  });
}
