// Contrato que implementa cada tipo de accion. Agregar un tipo nuevo no toca el motor de ejecucion.
export interface StepExecutor {
  execute(config: Record<string, unknown>, previousOutput: Record<string, unknown> | null): Promise<Record<string, unknown>>;
}
