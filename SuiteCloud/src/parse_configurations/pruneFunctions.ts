/**
 * @file src/parse_configurations/pruneFunctions.ts
 */

import { pruneLogger as plog, mainLogger as mlog, INDENT_LOG_LINE as TAB, indentedStringify } from '../config';
import { 
    EntityRecordTypeEnum,
    FieldDictionary,
    RecordOptions,
    RecordTypeEnum,
    SetFieldSubrecordOptions,
    SetFieldValueOptions,
    SetSublistSubrecordOptions,
    SetSublistValueOptions,
    SublistLine,
    SubrecordValue,
} from "../utils/api/types";
import { hasKeys, isNullLike, RADIO_FIELD_FALSE, RADIO_FIELD_TRUE, anyNull, isNonEmptyArray } from "../utils/typeValidation";
import { equivalentAlphanumericStrings as equivalentAlphanumeric } from '../utils/io/regex/index';

const SALES_ORDER_REQUIRED_FIELDS = ['entity', 'trandate'];

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
    if (!Object.values(EntityRecordTypeEnum).includes(options.recordType as EntityRecordTypeEnum)) {
        mlog.error(`pruneEntity(): options.recordType is not a valid EntityRecordType`,
            TAB+`expected one of: ${JSON.stringify(Object.values(EntityRecordTypeEnum))}`,
            TAB+`       received: '${options.recordType}'`
        );
        return null;
    }
    if (!hasKeys(options.fields, ENTITY_REQUIRED_FIELDS)) { 
        plog.warn(`pruneEntity(): options.fields does not have required fields.`,
            TAB+`required: ${JSON.stringify(ENTITY_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(options.fields)}`
        );
        return null; 
    }
    if (options.fields.isperson === RADIO_FIELD_TRUE 
        && !hasKeys(options.fields, CONTACT_REQUIRED_FIELDS)) {
        plog.warn(`prune.entity(): options.fields does not have required fields.`,
            TAB+`recordType: ${options.recordType}`,
            TAB+`required: ${JSON.stringify(CONTACT_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(Object.keys(options.fields))}`
        );
        return null;
    } else if (options.fields.isperson === RADIO_FIELD_FALSE) {
        const nameFields = [...CONTACT_REQUIRED_FIELDS, 'middlename', 'salutation', 'title'];
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
 * - {@link ADDRESS_REQUIRED_FIELDS}
 * @param address {@link SetFieldSubrecordOptions} | {@link SetSublistSubrecordOptions}
 * @returns **`address`** {@link SetFieldSubrecordOptions} | {@link SetSublistSubrecordOptions} | null
 */
export const address = (
    address: SetFieldSubrecordOptions | SetSublistSubrecordOptions
): SetFieldSubrecordOptions | SetSublistSubrecordOptions | null => {
    if (!address || !address.fields) {
        mlog.error(`[prune.address()] Invalid 'address' parameter:`, 
            TAB+`address is undefined or does not have the 'fields' property`
        );
        return null;
    }
    if (!hasKeys(address.fields, ADDRESS_REQUIRED_FIELDS)) {
        plog.warn(`[prune.address()]: address not have required fields. returning null.`,
            TAB+`required: ${JSON.stringify(ADDRESS_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(Object.keys(address.fields))}`,
        );
        return null;
    }
    const attentionIsRedundant = Boolean(address.fields 
        && typeof address.fields.addressee === 'string'
        && typeof address.fields.attention === 'string'
        && (
            equivalentAlphanumeric(
                address.fields.addressee, 
                address.fields.attention
            ) 
            || (address.fields.addressee).includes(address.fields.attention)
        )
    );
    if (attentionIsRedundant) {
        plog.info(`[prune.address()]: address.attention is redundant with address.addressee , deleting it.`,
            TAB+`addressee: ${address.fields.addressee}`,
            TAB+`attention: ${address.fields.attention}`
        );
        delete address.fields.attention;
    }
    return address;

}
/**
 * @TODO abstract to pruneSublistFields and accept sublistId + requiredFieldIds as params
 * @description prune the addressbook sublist of entity records. 
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
        let addressOptions = sublistLine.addressbookaddress as SetSublistSubrecordOptions;
        let validatedAddress = address(addressOptions) as SetSublistSubrecordOptions | null;
        if (!validatedAddress) { continue; }
        addressBook[i].addressbookaddress = validatedAddress;
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
 * `if options.fields.isperson === 'T'` -> do not make the contact record because the customer 
 * is a person (and netsuite won't allow it)
 * @param options 
 * @returns `options` with required fields for contact records, or `null` if required fields are missing
 */
export const contact = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNullLike(options) || !options.fields) {
        mlog.warn(`prune.contact(): options or options.fields is null or undefined, returning null`);
        return null;
    }
    if (options.recordType !== RecordTypeEnum.CONTACT) {
        mlog.error(`[prune.contact()] Prune Function mismatch: invalid options.recordType`,
            TAB+`expected: '${RecordTypeEnum.CONTACT}'`,
            TAB+`received: '${options.recordType}'`
        );
        return null;
    }
    if (options.fields.isperson === RADIO_FIELD_TRUE) {
        return null;
    }
    if (!hasKeys(options.fields, CONTACT_REQUIRED_FIELDS)) {
        mlog.warn(`[prune.contact()]: options.fields does not have required fields`,
            TAB+`required: ${JSON.stringify(CONTACT_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(Object.keys(options.fields))}`
        );
        return null;
    }
    return pruneAddressBook(options) as RecordOptions;    

}

/**
 * - {@link SALES_ORDER_REQUIRED_FIELDS} = `['entity', 'trandate']`
 * - validate address in options.fields.billaddress and options.fields.shipaddress
 * - make sure options.sublists.item.length > 1
 * @param options {@link RecordOptions}
 * @returns **`options`** or **`null`**
 */
export const salesOrder = (
    options: RecordOptions
): RecordOptions | null => {
    if (isNullLike(options) || !options.fields || !options.sublists) {
        mlog.warn(`[prune.salesOrder()]: Invalid 'options' parameter`,
            TAB+`options or options.fields or options.sublists is null or undefined.`,
            TAB+` -> returning null`
        );
        return null;
    }
    if (options.recordType !== RecordTypeEnum.SALES_ORDER) {
        mlog.error(`[prune.salesOrder()] Prune Function mismatch: invalid options.recordType`,
            TAB+`expected: '${RecordTypeEnum.SALES_ORDER}'`,
            TAB+`received: '${options.recordType}'`
        );
        return null;
    }
    if (!hasKeys(options.fields, SALES_ORDER_REQUIRED_FIELDS)) { 
        plog.warn(`[prune.salesOrder()]: options.fields does not have required fields.`,
            TAB+`required: ${JSON.stringify(SALES_ORDER_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(options.fields)}`
        );
        return null; 
    }
    if (options.fields.billaddress) {
        let validatedAddress = address(
            options.fields.billaddress as SetFieldSubrecordOptions
        );
        if (!validatedAddress) {
            delete options.fields.billaddress
        } else {
            options.fields.billaddress = validatedAddress;
        }
    }
    if (options.fields.shipaddress) {
        let validatedAddress = address(
            options.fields.shipaddress as SetFieldSubrecordOptions
        );
        if (!validatedAddress) {
            delete options.fields.shipaddress
        } else {
            options.fields.shipaddress = validatedAddress;
        }
    }
    if (!options.fields.billaddress && !options.fields.shipaddress) {
        mlog.warn(`[prune.salesOrder()]: options.fields does not have any address fields.`,
            TAB+`options.fields.externalid: '${options.fields.externalid}'`,
        );
    }
    if (!isNonEmptyArray(options.sublists.item)) {
        mlog.warn(`[prune.salesOrder()]: options.sublists.item is empty or not an array.`,
            TAB+`options.sublists.item: ${JSON.stringify(options.sublists.item)}`,
            TAB+`options.fields.externalid: '${options.fields.externalid}'`,
            TAB+` -> returning null`
        );
        return null;
    }
    return options;
}
