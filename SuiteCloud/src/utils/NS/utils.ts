/**
 * @file src/utils/ns/utils.ts
 * @description NetSuite-project-specific utility functions and values
 */
import { FieldValue } from "../../api/types";
import { ValueMapping } from "../io/types";
import { isValueMappingEntry } from "../io/types/typeGuards";
import { isNullLike } from "../typeValidation";


export function encodeExternalId(externalId: string): string {
    return externalId.replace(/</, '&lt;').replace(/>/, '&gt;')
}

/**
 * @param originalValue - the initial value to check if it should be overwritten
 * @param originalKey - the original column header (`key`) of the value being transformed
 * @param valueOverrides see {@link ValueMapping}
 * @returns **`mappedValue?.newValue`**: {@link FieldValue} if `originalValue` satisfies `valueOverrides`, otherwise returns `initialValue`
 */
export function checkForOverride(
    originalValue: string, 
    originalKey: string, 
    valueOverrides: ValueMapping
): FieldValue {
    if (!originalValue || isNullLike(valueOverrides)) {
        return originalValue;
    }   
    if (Object.keys(valueOverrides).includes(originalValue)) {
        let mappedValue = valueOverrides[originalValue as keyof typeof valueOverrides];
        if (isValueMappingEntry(mappedValue) && mappedValue.validColumns) {
            const validColumns = Array.isArray(mappedValue.validColumns) 
                ? mappedValue.validColumns 
                : [mappedValue.validColumns];
            if (validColumns.includes(originalKey)) {
                return mappedValue.newValue as FieldValue;
            }
        } else {
            return mappedValue as FieldValue;
        }
    }
    return originalValue;
}

/**
 * @param fieldId `string`
 * @returns 
 */
export const isBooleanFieldId = (fieldId: string): boolean => {
    return BOOLEAN_FIELD_ID_LIST.includes(fieldId) || BOOLEAN_FIELD_ID_REGEX.test(fieldId);
}

/**
 * Represents the `boolean` value `true` for a radio field in NetSuite.
 */
export const RADIO_FIELD_TRUE = 'T';
/**
 * Represents the `boolean` value `false` for a radio field in NetSuite.
 */
export const RADIO_FIELD_FALSE = 'F';
/**
 * - `= typeof `{@link RADIO_FIELD_TRUE}` | typeof `{@link RADIO_FIELD_FALSE}`;` 
 * @description
 * Value representing the state of a radio field in NetSuite. (i.e. is the button filled in or not)
 * - e.g. the Customer record's `'isperson'` field.
 * */
export type RadioFieldBoolean = typeof RADIO_FIELD_TRUE | typeof RADIO_FIELD_FALSE;   


/** `re` = `/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/` */
export const BOOLEAN_FIELD_ID_REGEX = new RegExp(/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/)
export const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y'];
export const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n'];
export const BOOLEAN_FIELD_ID_LIST = [
    'isinactive', 'isprivate', 'giveaccess', 'emailtransactions', 'faxtransactions', 
    'is1099eligible', 'isdefaultbilling', 'isdefaultshipping', 'isprimary', 'isprimaryshipto', 
    'isprimarybilling', 'isprimaryshipping'
];

