/**
 * @file src/utils/ns/accounting/Term.ts
 */

/**
 * @interface **`TermBase`**
 * @description Base interface for the Term object in NetSuite.
 * @property {string} name - The `name/description` of the term.
 * @property {number} [internalid] - The `'internalid'` of the term.
 * @property {boolean} [isinactive] - Indicates if the term is `inactive`. Optional property.
 * @property {boolean} [preferred] - Indicates if the term is `preferred`. Optional property.
 */
export interface TermBase {
    name: string;
    internalid?: number;
    isinactive?: boolean;
    preferred?: boolean;
}


export const SB_TERM_DICTIONARY: Record<string, TermBase> = {
    "Net 15": {
        name: "Net 15",
        internalid: 1,
    },
    "Net 30": {
        name: "Net 30",
        internalid: 2,
    },
    "Net 60": {
        name: "Net 60",
        internalid: 3,
    },
    "Upon Receipt": {
        name: "Upon Receipt",
        internalid: 4,
    },
    "1% 10 Net 30": {
        name: "1% 10 Net 30",
        internalid: 5,
    },
    "2% 10 Net 30": {
        name: "Upon Receipt",
        internalid: 6,
    },
    "30% Prepay and 70% Upon Deliver": {
        name: "30% Prepay / 70% Upon Receipt",
        internalid: 7,
    },
    "50 Prepay/50 Net30": {
        name: "50% Prepay / 50% Net 30",
        internalid: 8,
    },
    "50 prepay/50 upon delivery": {
        name: "50% Prepay / 50% Upon Receipt",
        internalid: 9,
    },
    "Cash": {
        name: "Cash",
        internalid: 10,
    },
    "Check in Advance": {
        name: "Check In Advance",
        internalid: 11,
    },
    "Credit Card": {
        name: "Credit Card",
        internalid: 12,
        preferred: true,
    },
    "Net 10": {
        name: "Net 10",
        internalid: 13,
    },
    "Net 20": {
        name: "Net 20",
        internalid: 14,
    },
    "Net 90": {
        name: "Net 90",
        internalid: 15,
    },
    "Pay In Full": {
        name: "Pay In Full",
        internalid: 16,
    },
    "Prepay-Payment": {
        name: "Prepay-Payment",
        internalid: 17,
    },
    "50 Prepay/ 50 Net 60": {
        name: "50% Prepay / 50% Net 60",
        internalid: 107,
    },
    "C.O.D.": {
        name: "Cash On Delivery",
        internalid: 108,
    },
    "P.P .- Co Check": {
        name: "Prepay-Payment - Company Check",
        internalid: 109,
    },
    "Net 45": {
        name: "Net 45",
        internalid: 110,
    },
}