/**
 * @file src/parses/pruneFunctions.ts
 */

import { pruneLogger as plog, mainLogger as mlog, INDENT_LOG_LINE as TAB, indentedStringify } from 'src/config/setupLog';
import { 
    FieldDictionary,
    RecordOptions,
    SetFieldValueOptions,
    SetSublistSubrecordOptions,
    SetSublistValueOptions,
    SublistLine,
    SubrecordValue,
} from "../utils/api/types";
import { hasKeys, isNullLike, RADIO_FIELD_FALSE, RADIO_FIELD_TRUE } from "../utils/typeValidation";



const CONTACT_REQUIRED_FIELDS = ['firstname', 'lastname']
const ADDRESS_REQUIRED_FIELDS = ['addr1']; // , 'country'
const ENTITY_REQUIRED_FIELDS = ['entityid', 'isperson', 'companyname']
/** 
 * `ENTITY_REQUIRED_FIELDS = ['entityid', 'companyname']` 
 * - `if` entity isperson, call {@link nameFieldsAreRequired}, 
 * - `else` deletes any existing name fields from `options.fields`
 * - `then` call {@link pruneAddressBook}
 * */
export const entity = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNullLike(options) || !options.fields) {
        plog.warn(`pruneEntity(): options or options.fields is null or undefined, returning null`);
        return null;
    }
    
    if (!hasKeys(options.fields, ENTITY_REQUIRED_FIELDS)) { 
        plog.warn(`pruneEntity(): options.fields does not have required fields.`,
            TAB+`required: ${JSON.stringify(ENTITY_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(options.fields)}`
        );
        return null; 
    }
    const nameFieldsAreRequired = Boolean(options.fields.isperson 
        && options.fields.isperson === RADIO_FIELD_TRUE
    );  
    if (nameFieldsAreRequired && !hasKeys(options.fields, CONTACT_REQUIRED_FIELDS)) {
        plog.warn(`prune.entity(): options.fields does not have required fields.`,
            TAB+`recordType: ${options.recordType}`,
            TAB+`required: ${JSON.stringify(CONTACT_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(Object.keys(options.fields))}`
        );
        return null;
    } else {
        const nameFields = [...CONTACT_REQUIRED_FIELDS, 'middlename', 'salutation']
        for (const nameFieldId of nameFields) {
            if (nameFieldId in options.fields) {
                delete options.fields[nameFieldId];
            }
        }
    }
    options = pruneAddressBook(options) as RecordOptions;
    return options;
}

/**
 * @TODO abstract to pruneSublistFields and accept sublistId + requiredFieldIds as params
 * - prune the addressbook sublist of entity records. 
 * - `ADDRESS_REQUIRED_FIELDS = ['addr1']` 
 * */
export const pruneAddressBook = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNullLike(options) || !options.sublists) {
        return null;
    }
    const linesToKeep: number[] = [];
    let addressBook = options.sublists.addressbook || [] as SublistLine[];
    for (let i = 0; i < addressBook.length; i++) {
        const sublistLine = addressBook[i];
        const address = sublistLine.addressbookaddress as SetSublistSubrecordOptions;
        if (!address.fields || !hasKeys(address.fields, ADDRESS_REQUIRED_FIELDS)) {
            plog.warn(`pruneAddressBook(): sublist line ${i} does not have required fields.`,
                TAB+`required: ${JSON.stringify(ADDRESS_REQUIRED_FIELDS)}`,
                TAB+`received: ${JSON.stringify(Object.keys(sublistLine))}`,
                TAB+`sublistLine: ${indentedStringify(sublistLine)}`
            );
            continue;
        }
        const attentionIsRedundant = Boolean(address.fields 
            && hasKeys(address.fields, ['addressee', 'attention'])
            && address.fields.addressee === address.fields.attention
        );
        if (attentionIsRedundant) {
            plog.info(`pruneAddressBook(): sublist line ${i} has redundant attention field, setting it to empty string.`,
                TAB+`addressee: ${address.fields.addressee}`,
                TAB+`attention: ${address.fields.attention}`
            );
            address.fields.attention = '';
            addressBook[i].addressbookaddress = address;
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
 * @param options 
 * @returns `options` with required fields for contact records, or `null` if required fields are missing
 */
export const contact = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNullLike(options) || !options.fields) {
        mlog.warn(`pruneContact(): options or options.fields is null or undefined, returning null`);
        return null;
    }
    
    if (!hasKeys(options.fields, CONTACT_REQUIRED_FIELDS)) {
        mlog.warn(`contact(): options.fields does not have required fields`,
            TAB+`required: ${JSON.stringify(CONTACT_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(Object.keys(options.fields))}`
        );
        return null;
    }
    return pruneAddressBook(options) as RecordOptions;    

}