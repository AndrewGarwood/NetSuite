/**
 * @file src/parses/pruneFunctions.ts
 */

import { pruneLogger as plog, mainLogger as mlog, INDENT_LOG_LINE as TAB } from 'src/config/setupLog';
import { 
    FieldDictionary,
    PostRecordOptions,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistLine,
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
    if (isNullLike(options) || !options.fields) {
        plog.warn(`pruneEntity(): options is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_FIELDS = ['entityid', 'companyname']
    try {
        for (const requiredField of REQUIRED_FIELDS) {
            if (!options.fields[requiredField]){
                return null;
            }
            
        }        
        if (options.fields.isperson && options.fields.isperson === RADIO_FIELD_TRUE) {
            options = requireNameFields(options) as PostRecordOptions;
        } 
        options = pruneAddressBook(options) as PostRecordOptions;
        return options;
    } catch (error) {
        plog.error(`Error in pruneEntity('${options.recordType}'):`, error);
        return options;
    }
}

/** make sure options.fieldDict.valueFields has values for firstname and lastname. then call {@link pruneAddressBook} */
export const requireNameFields = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options) || !options.fields) {
        plog.warn(`requireNameFields(): options is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_CONTACT_FIELDS = ['firstname', 'lastname']
    try {
        for (const requiredField of REQUIRED_CONTACT_FIELDS) {
            if (!options.fields || !options.fields[requiredField]) {
                return null;
            }
        }
        options = pruneAddressBook(options) as PostRecordOptions;
        return options;
    } catch (error) {
        plog.error(`Error in pruneIfNoName():`, error);
        return options;
    }
}
/**
 * @notimplemented need to update with new definition of FieldDictionary and SublistDictionary 
 * - prune the addressbook sublist of entity records. `REQUIRED_ADDRESS_FIELDS = ['addr1', 'country']` 
 * */
export const pruneAddressBook = (
    options: PostRecordOptions,
): PostRecordOptions | null => {
    if (isNullLike(options) || !options.sublists) {
        return null;
    }
    const REQUIRED_ADDRESS_FIELDS = ['addr1']; // , 'country'
    const linesToKeep: number[] = [];
    let addressBook = options.sublists.addressbook || [] as SublistLine[];
    for (let i = 0; i < addressBook.length; i++) {
        const sublistLine = addressBook[i];
        if (!sublistLine || !sublistLine.fields) {
            continue;
        }
        let hasRequiredFields = true;
        for (const requiredField of REQUIRED_ADDRESS_FIELDS) {
            if (!sublistLine[requiredField]) {
                hasRequiredFields = false;
                break;
            }
        }
        if (!hasRequiredFields) {
            continue;
        }
        linesToKeep.push(i);
    }
    let prunedAddressBook: SublistLine[] = [];
    if (linesToKeep.length > 0) {
        prunedAddressBook = linesToKeep.map(
            index => addressBook[index] as SublistLine
        );
        options.sublists.addressbook = prunedAddressBook;
    } else {
        delete options.sublists.addressbook;
    }
    return options;
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
        plog.warn(`pruneContact(): options is null or undefined, returning null`);
        return null;
    }
    try {
        options = requireNameFields(options) as PostRecordOptions;
        return options === null 
            ? null : pruneAddressBook(options) as PostRecordOptions;    
    } catch (error) {
        plog.error(`Error in pruneContact():`, error);
        return options;
    }
}