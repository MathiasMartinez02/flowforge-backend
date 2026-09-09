// Resuelve un path tipo "data.status" contra un objeto (el output jsonb del paso anterior).
// Compartido por condition-evaluator.ts y notification.action.ts para no duplicar el recorrido.
export function resolveField(source: Record<string, unknown> | null, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}
