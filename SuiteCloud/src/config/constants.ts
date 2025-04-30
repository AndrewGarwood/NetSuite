/**
 * @file src/config/constants.ts
 */

// maybe move these to typeValidation.ts
export const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y'];
export const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n'];
export const BOOLEAN_FIELD_ID_LIST = [
    'isinactive', 'isprivate', 'giveaccess', 'emailtransactions', 'faxtransactions', 
    'is1099eligible', 'isdefaultbilling', 'isdefaultshipping', 'isprimary', 'isprimaryshipto', 
    'isprimarybilling', 'isprimaryshipping'
];

/** List of strings from VendorCSV['Vendor'] that correspond to humans so know when to set `isperson`=`true` in NetSuite Vendor Record */
export const HUMAN_VENDORS_ORIGINAL_TEXT: string[] = [
    'Andrew Garwood',
]