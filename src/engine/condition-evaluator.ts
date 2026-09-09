import { Injectable } from '@nestjs/common';
import { resolveField } from '../common/resolve-field.util.js';

export type ConditionOperator = '==' | '!=' | '>' | '<' | 'contains';

// Config esperado para un paso de tipo 'condition': { field, operator, value }.
interface ConditionConfig {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

// Evalua una condicion de operadores fijos contra el output del paso anterior.
// Sin evaluador de expresiones libre a proposito (ver guia de desarrollo, seccion 0): un set
// fijo de operadores es mas facil de mostrar y no depende de parsear texto arbitrario.
@Injectable()
export class ConditionEvaluator {
  evaluate(config: Record<string, unknown>, previousOutput: Record<string, unknown> | null): boolean {
    const { field, operator, value } = config as unknown as ConditionConfig;
    if (!field || !operator) {
      throw new Error('condition: faltan "field" u "operator" en la config del paso');
    }

    const actual = resolveField(previousOutput, field);

    switch (operator) {
      case '==':
        return this.normalize(actual) === this.normalize(value);
      case '!=':
        return this.normalize(actual) !== this.normalize(value);
      case '>':
        return this.toNumber(actual) > this.toNumber(value);
      case '<':
        return this.toNumber(actual) < this.toNumber(value);
      case 'contains':
        return String(actual ?? '').includes(String(value ?? ''));
      default:
        throw new Error(`condition: operador "${operator}" no soportado`);
    }
  }

  // Compara por valor normalizado a string para no fallar por (200 !== "200") viniendo de
  // config en JSON vs. un numero real en el output de un http_request.
  private normalize(value: unknown): string {
    return String(value ?? '');
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    if (Number.isNaN(n)) throw new Error(`condition: "${String(value)}" no es un numero valido para comparar`);
    return n;
  }
}
