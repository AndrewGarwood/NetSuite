/**
 * @file src/parses/pruneFunctions.ts
 */

import { pruneLogger as log, mainLogger as mlog, INDENT_LOG_LINE as TAB } from 'src/config/setupLog';
import { 
    FieldDictionary,
    PostRecordOptions,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SetSubrecordOptions,
    SublistFieldDictionary, 
} from "../utils/api/types";
import { isNullLike, RADIO_FIELD_TRUE } from "../utils/typeValidation";



/** 
 * `REQUIRED_FIELDS = ['entityid', 'companyname']` 
 * - if entity isperson, call {@link requireNameFields}
 * - call {@link pruneAddressBook}
 * */
export const entity = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options)) {
        log.warn(`pruneEntity(): options is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_FIELDS = ['entityid', 'companyname']
    try {
        let fieldDict = options.fieldDict as FieldDictionary;
        for (const requiredField of REQUIRED_FIELDS) {
            if (!fieldDict?.valueFields?.some(
                (field) => field.fieldId === requiredField && field.value)
            ) {
                // log.debug(`pruneEntity():`,
                //     TAB + `SetFieldValueOptions is missing field "${requiredField}", returning null`
                // );
                return null;
            }
            
        }        
        if (fieldDict.valueFields?.some(
            (field) => field.fieldId === 'isperson' && field.value === RADIO_FIELD_TRUE)
        ) {
            options = requireNameFields(options) as PostRecordOptions;
        } 
        options = pruneAddressBook(options) as PostRecordOptions;
        return options;
    } catch (error) {
        log.error(`Error in pruneEntity('${options.recordType}'):`, error);
        return options;
    }
}

/** make sure options.fieldDict.valueFields has values for firstname and lastname. then call {@link pruneAddressBook} */
export const requireNameFields = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options)) {
        log.warn(`pruneIfNoName(): options is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_CONTACT_FIELDS = ['firstname', 'lastname']
    try {
        let fieldDict = options.fieldDict as FieldDictionary;
        for (const requiredField of REQUIRED_CONTACT_FIELDS) {
            if (!fieldDict?.valueFields?.some(
                (field) => field.fieldId === requiredField && field.value)
            ) {
                // log.debug(`pruneIfNoName():`, 
                //     TAB + `SetFieldValueOptions is missing field "${requiredField}", returning null`
                // );
                return null;
            }
        }
        options = pruneAddressBook(options) as PostRecordOptions;
        return options;
    } catch (error) {
        log.error(`Error in pruneIfNoName():`, error);
        return options;
    }
}
/** prune the addressbook sublist of entity records. `REQUIRED_ADDRESS_FIELDS = ['addr1', 'country']` */
export const pruneAddressBook = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options)) {
        return null;
    }
    const REQUIRED_ADDRESS_FIELDS = ['addr1']; // , 'country'
    const linesToPrune: number[] = [];
    try {
        let addressbook = options?.sublistDict?.addressbook as SublistFieldDictionary;
        let valueFields = addressbook?.valueFields as SetSublistValueOptions[];
        /** subrecordFields will have the address fields to look for*/
        let subrecordFields = addressbook?.subrecordFields as SetSubrecordOptions[];
        for (let index = 0; index < subrecordFields.length; index++) {
            let subrecOps = subrecordFields[index];
            let currentLine = subrecOps?.line as number;
            let subrecValueFields = subrecOps?.fieldDict?.valueFields as SetFieldValueOptions[];
            for (const requiredField of REQUIRED_ADDRESS_FIELDS) {
                if (!subrecValueFields?.some(
                    (field) => field.fieldId === requiredField)
                ) {
                    log.debug(`pruneAddressBook('${options.recordType}'), line=${currentLine}`,
                        TAB + `subrecordFields[${index}] is missing required field: "${requiredField}"`,
                    );
                    linesToPrune.push(currentLine);
                    break; // no need to check other required fields
                }
            }
        }
        for (const lineIndex of linesToPrune) {
            log.debug(`pruneAddressBook('${options.recordType}'):`, 
                TAB + `removing subrecordFields and valueFields with line=${lineIndex} from addressbook sublist`
            );
            valueFields = valueFields.filter(
                (field) => field.line !== lineIndex
            );
            subrecordFields = subrecordFields.filter(
                (field) => field.line !== lineIndex
            );
        }
        // Remove any valueFields whose line does not have a corresponding subrecordField
        const validLines = new Set(subrecordFields.map(f => f.line));
        valueFields = valueFields.filter(
            (field) => validLines.has(field.line)
        );
        // Extra check: only renumber if all remaining fields have the same line value
        const valueFieldLines = new Set(valueFields.map(f => f.line));
        const subrecFieldLines = new Set(subrecordFields.map(f => f.line));
        if (
            validLines.size === 1 &&
            valueFieldLines.size === 1 &&
            subrecFieldLines.size === 1 &&
            valueFieldLines.has(Array.from(validLines)[0]) &&
            subrecFieldLines.has(Array.from(validLines)[0])
        ) {
            for (let field of valueFields) {
                field.line = 0;
            }
            for (let subrecField of subrecordFields) {
                subrecField.line = 0;
            }
        } else if (validLines.size === 1) {
            mlog.warn(`pruneAddressBook(): validLines.size === 1 but not all fields have the same line value. Skipping renumbering.`);
        }
        addressbook.valueFields = valueFields;
        addressbook.subrecordFields = subrecordFields;
        if (subrecordFields.length === 0 || valueFields.length === 0) {
            log.debug(`pruneAddressBook('${options.recordType}'): No valid addressbook fields found.`,
                TAB + `deleting addressbook sublist`
            );
            delete options.sublistDict?.addressbook;
        }
        return options;
    } catch (error) {
        log.error(`pruneAddressBook('${options.recordType}'): Error in pruneAddressBook: ${error}`);
    }
    return null;
};

/**
 * calls {@link requireNameFields}, then {@link pruneAddressBook}
 * @param options 
 * @returns `options` with required fields for contact records, or `null` if required fields are missing
 */
export const contact = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options)) {
        log.warn(`pruneContact(): options is null or undefined, returning null`);
        return null;
    }
    try {
        options = requireNameFields(options) as PostRecordOptions;
        return options === null 
            ? null : pruneAddressBook(options) as PostRecordOptions;    
    } catch (error) {
        log.error(`Error in pruneContact():`, error);
        return options;
    }
}