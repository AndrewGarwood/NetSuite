/**
 * @file src/utils/parses/generalPruneFunctions.ts
 */

import { mainLogger as log } from 'src/config/setupLog';
import { 
    FieldDictionary,
    PostRecordOptions,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SetSubrecordOptions,
    SublistFieldDictionary, 
} from "../api/types";
import { isNullLike, RADIO_FIELD_TRUE } from "../typeValidation";



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
                log.debug(`pruneEntity():`,
                    `\n\tSetFieldValueOptions is missing field "${requiredField}", returning null`);
                return null;
            }
            
        }        
        if (fieldDict.valueFields?.some(
            (field) => field.fieldId === 'isperson' && field.value === RADIO_FIELD_TRUE)
        ) {
            options = requireNameFields(options) as PostRecordOptions;
        } else {
            options = pruneAddressBook(options) as PostRecordOptions;
        }
        return options;
    } catch (error) {
        log.error(`Error in pruneEntity():`, error);
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
                log.debug(`pruneIfNoName():`, 
                    `\n\tSetFieldValueOptions is missing field "${requiredField}", returning null`
                );
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
/** `REQUIRED_ADDRESS_FIELDS = ['addr1']` */
export const pruneAddressBook = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options)) {
        return null;
    }
    const REQUIRED_ADDRESS_FIELDS = ['addr1']
    try {
        let addressbook = options?.sublistDict?.addressbook as SublistFieldDictionary;
        let valueFields = addressbook?.valueFields as SetSublistValueOptions[];
        let subrecordFields = addressbook?.subrecordFields as SetSubrecordOptions[];
        for (let index = 0; index < subrecordFields.length; index++) {
            let subrecOps = subrecordFields[index];
            let subrecValueFields = subrecOps?.fieldDict?.valueFields as SetFieldValueOptions[];
            for (const requiredField of REQUIRED_ADDRESS_FIELDS) {
                if (!subrecValueFields?.some(
                    (field) => field.fieldId === requiredField)
                ) {
                    log.debug(`pruneAddressBook():`,
                        `subrecordFields[${index}]: SetSubrecordOptions is missing address field "${requiredField}"`, 
                        `-> removing it from subrecordFields`
                    );
                    valueFields?.splice(index, 1);
                    subrecordFields.splice(index, 1);
                    index--; // Adjust index after removing an element
                    break;
                }
            }
        }
        if (subrecordFields.length === 0) {
            delete options.sublistDict?.addressbook;
        }
        return options;
    } catch (error) {
        log.error(`pruneAddressBook(): Error in pruneAddressBook: ${error}`);
    }
    return null;
};