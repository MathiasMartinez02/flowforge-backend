import { describe, expect, it } from 'vitest';
import { ConditionEvaluator } from './condition-evaluator.js';

// Tests del set fijo de operadores (ver guia de desarrollo, seccion 0): sin evaluador de
// expresiones libre, cada operador se prueba contra el output tipico de un paso anterior.
describe('ConditionEvaluator', () => {
  const evaluator = new ConditionEvaluator();

  it('== compara por valor normalizado (numero de la config contra string del output)', () => {
    const result = evaluator.evaluate({ field: 'statusCode', operator: '==', value: 200 }, { statusCode: '200' });
    expect(result).toBe(true);
  });

  it('!= detecta valores distintos', () => {
    const result = evaluator.evaluate({ field: 'statusCode', operator: '!=', value: 200 }, { statusCode: 500 });
    expect(result).toBe(true);
  });

  it('> compara numericamente', () => {
    const result = evaluator.evaluate({ field: 'durationMs', operator: '>', value: 100 }, { durationMs: 250 });
    expect(result).toBe(true);
  });

  it('< compara numericamente', () => {
    const result = evaluator.evaluate({ field: 'durationMs', operator: '<', value: 100 }, { durationMs: 250 });
    expect(result).toBe(false);
  });

  it('contains busca substring en el valor actual', () => {
    const result = evaluator.evaluate({ field: 'body', operator: 'contains', value: 'ok' }, { body: 'status: ok' });
    expect(result).toBe(true);
  });

  it('resuelve field anidado con notacion de punto', () => {
    const result = evaluator.evaluate({ field: 'data.status', operator: '==', value: 'ready' }, { data: { status: 'ready' } });
    expect(result).toBe(true);
  });

  it('tira error si falta field u operator en la config', () => {
    expect(() => evaluator.evaluate({ operator: '==', value: 1 }, {})).toThrow(/field.*operator/);
  });

  it('tira error si el operador no esta soportado', () => {
    expect(() => evaluator.evaluate({ field: 'x', operator: '>=' as never, value: 1 }, { x: 2 })).toThrow(/no soportado/);
  });

  it('tira error si > compara contra un valor no numerico', () => {
    expect(() => evaluator.evaluate({ field: 'x', operator: '>', value: 'abc' }, { x: 1 })).toThrow(/no es un numero valido/);
  });

  it('previousOutput null resuelve el field como undefined, no rompe', () => {
    const result = evaluator.evaluate({ field: 'statusCode', operator: '!=', value: 200 }, null);
    expect(result).toBe(true);
  });
});
