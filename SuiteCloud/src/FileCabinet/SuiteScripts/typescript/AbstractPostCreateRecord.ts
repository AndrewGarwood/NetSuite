/**
 * @deprecated
 * @NApiVersion 2.1
 * @NScriptType RESTlet
 */

import record = require('N/record');
import log = require('N/log');

//TODO: Add validation for fieldDict and sublistDict to 
// ensure they are valid field IDs and sublist IDs and have valid value types.
export function post(req: CreateRecordRequest) {
    try {
        const {type, fieldDict, sublistDict} = req;
        const rec = record.create({type});
        for (const fieldId in fieldDict) {
            rec.setValue({fieldId, value: fieldDict[fieldId]});
        }
        rec.getFields()
        rec.getSublists()
        
        Object.keys(sublistDict).forEach((sublistId, index) => {
            const sublist = sublistDict[sublistId];
            for (const sublistFieldId in Object.keys(sublist)) {
                rec.setSublistValue({
                    sublistId,
                    fieldId: sublistFieldId,
                    value: sublist[sublistFieldId],
                    line: index,
                });
            }
        });
        const recId = rec.save();
        log.debug(`Successfully created ${type} record, recordId:`, recId);
        return {recordId : recId};
    } catch (e) {
        log.debug('Error in AbstractPostCreateRecord post():', e);
        throw e;
    }
}

/**
 * @interface CreateRecordRequest
 * @param {string} type - The record type to create.
 * @param {object.<string, any>} fieldDict - An object containing field IDs and their corresponding values.
 * @param {object.<string, any>} sublistDict - An object containing sublist IDs and their corresponding field IDs and values.
 * @param {string} fieldDict.fieldId - The internal ID of a standard or custom field.
 * @param {any} fieldDict.value - The value to set the field to. The value type must correspond to the field type being set.
 * @param {string} sublistDict.sublistId - The internal ID of the sublist.
 * @param {string} sublistDict.fieldId - The internal ID of a standard or custom sublist field.
 * @param {any} sublistDict.value - The value to set the sublist field to. The value type must correspond to the field type being set.
 * For example:
 * - Text, Radio and Select fields accept string values.
 * - Checkbox fields accept Boolean values.
 * - Date and DateTime fields accept Date values.
 * - Integer, Float, Currency and Percent fields accept number values.
 */
export interface CreateRecordRequest {
    type: record.Type;
    fieldDict: {
        [fieldId: string]: any
    };
    sublistDict: {
        [sublistId: string]: {
            [sublistFieldId: string]: any
        }
    };
}

// interface SetSublistValueOptions {
//     /** The internal ID of the sublist. */
//     sublistId: string;
//     /** The internal ID of a standard or custom sublist field. */
//     fieldId: string;
//     /** The internal ID of a standard or custom sublist field. */
//     line: number;
//     /**
//      * The value to set the sublist field to.
//      * The value type must correspond to the field type being set. For example:
//      * - Text, Radio and Select fields accept string values.
//      * - Checkbox fields accept Boolean values.
//      * - Date and DateTime fields accept Date values.
//      * - Integer, Float, Currency and Percent fields accept number values.
//      */
//     value: FieldValue;
//     /** WARNING - UNDOCUMENTED. Set to true to synchronously set this value and its sourced values before returning. */
//     fireSlavingSync?: boolean;
//     /** Use forceSyncSourcing instead of fireSlavingSync on currentRecord module. */
//     forceSyncSourcing?: boolean
// }