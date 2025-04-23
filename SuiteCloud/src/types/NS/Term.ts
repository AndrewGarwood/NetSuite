/**
 * @file Term.ts
 * @description TypeScript interface for the (payment) Term object in NetSuite.
 */

/**
 * @interface TermBase
 * @description Base interface for the Term object in NetSuite.
 * @property {string} name - The name/description of the term.
 * @property {boolean} [isinactive] - Indicates if the term is inactive. Optional property.
 * @property {boolean} [preferred] - Indicates if the term is preferred. Optional property.
 */
export interface TermBase {
    name: string;
    isinactive?: boolean;
    preferred?: boolean;
}