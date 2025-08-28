/**
 * @file src/parse_configurations/pruneFunctions.ts
 */

import { 
    pruneLogger as plog, mainLogger as mlog, INDENT_LOG_LINE as TAB 
} from "../config/setupLog";
import { 
    FieldDictionary,
    RecordOptions,
    SetFieldSubrecordOptions,
    SetFieldValueOptions,
    SetSublistSubrecordOptions,
    SetSublistValueOptions,
    SublistLine,
    SubrecordValue,
} from "../api/types";
import { 
    hasKeys, isNullLike as isNull, isNonEmptyArray, isNonEmptyString 
} from "typeshi:utils/typeValidation";
import { clean, 
    equivalentAlphanumericStrings, 
    RegExpFlagsEnum 
} from "typeshi:utils/regex";
import { EntityRecordTypeEnum, RecordTypeEnum } from "../utils/ns/Enums";
import { indentedStringify } from "typeshi:utils/io/writing";
import { RADIO_FIELD_FALSE, RADIO_FIELD_TRUE } from "../utils/ns";

/** `['entity', 'trandate']` */
const SALES_ORDER_REQUIRED_FIELDS = ['entity', 'trandate'];

const CONTACT_REQUIRED_FIELDS = ['firstname', 'lastname']
const ADDRESS_REQUIRED_FIELDS = ['addr1']; // , 'country'
const ENTITY_REQUIRED_FIELDS = ['entityid', 'companyname'] // 'isperson', 
/** 
 * `ENTITY_REQUIRED_FIELDS = ['entityid', 'companyname']` 
 * - `if` entity isperson, call {@link nameFieldsAreRequired}, 
 * - `else` deletes any existing name fields from `options.fields`
 * - `then` call {@link pruneAddressBook}
 * */
export const entity = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNull(options) || !options.fields) {
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
 * - {@link ADDRESS_REQUIRED_FIELDS} = `['addr1']`
 * @param addressOptions {@link SetFieldSubrecordOptions} | {@link SetSublistSubrecordOptions}
 * @returns **`addressOptions`** {@link SetFieldSubrecordOptions} | {@link SetSublistSubrecordOptions} | null
 */
export const address = (
    addressOptions: SetFieldSubrecordOptions | SetSublistSubrecordOptions
): SetFieldSubrecordOptions | SetSublistSubrecordOptions | null => {
    if (!addressOptions || !addressOptions.fields) {
        mlog.error(`[prune.address()] Invalid 'address' parameter:`, 
            TAB+`address is undefined or does not have the 'fields' property`
        );
        return null;
    }
    if (!hasKeys(addressOptions.fields, ADDRESS_REQUIRED_FIELDS)) {
        plog.warn(`[prune.address()]: address not have required fields. returning null.`,
            TAB+`required: ${JSON.stringify(ADDRESS_REQUIRED_FIELDS)}`,
            TAB+`received: ${JSON.stringify(Object.keys(addressOptions.fields))}`,
        );
        return null;
    }
    const attentionIsRedundant = Boolean(addressOptions.fields 
        && isNonEmptyString(addressOptions.fields.addressee)
        && isNonEmptyString(addressOptions.fields.attention)
        && (
            equivalentAlphanumericStrings(
                addressOptions.fields.addressee, 
                addressOptions.fields.attention
            ) 
            || (addressOptions.fields.addressee).includes(addressOptions.fields.attention)
        )
    );
    if (attentionIsRedundant) {
        plog.info(`[prune.address()]: address.attention is redundant with address.addressee , deleting it.`,
            TAB+`addressee: ${addressOptions.fields.addressee}`,
            TAB+`attention: ${addressOptions.fields.attention}`
        );
        delete addressOptions.fields.attention;
    }
    delete addressOptions.sublists; // delete the empty object created by the parser
    return addressOptions;

}
/**
 * @TODO abstract to pruneSublistFields and accept sublistId + requiredFieldIds as params
 * @description prune the addressbook sublist of entity records. 
 * - `ADDRESS_REQUIRED_FIELDS = ['addr1']` 
 * */
export const pruneAddressBook = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNull(options) || !options.sublists) {
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
 * @param options {@link RecordOptions} 
 * @returns **`options`** with required fields for contact records, or `null` if required fields are missing
 */
export const contact = (
    options: RecordOptions,
): RecordOptions | null => {
    if (isNull(options) || !options.fields) {
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
 * *`async`*
 * - {@link SALES_ORDER_REQUIRED_FIELDS} = `['entity', 'trandate']`
 * - (not requiring addresses right now) validate address in `options.fields.billingaddress` and `options.fields.shippingaddress`
 * - make sure `options.sublists.item.length > 1`
 * @param options {@link RecordOptions}
 * @returns **`options`** or **`null`** `Promise<`{@link RecordOptions}` | null>` 
 */
export const salesOrder = async (
    options: RecordOptions
): Promise<RecordOptions | null> => {
    const source = `[prune.salesOrder()]`
    if (isNull(options) || !options.fields || !options.sublists || !options.sublists.item) {
        mlog.warn([`${source}: Invalid 'options' parameter`,
            `options or options.fields or options.sublists is null or undefined.`,
            ` -> returning null`
        ].join(TAB));
        return null;
    }
    if (options.recordType !== RecordTypeEnum.SALES_ORDER) {
        mlog.error([`${source} Prune Function mismatch: invalid options.recordType`,
            `expected: '${RecordTypeEnum.SALES_ORDER}'`,
            `received: '${options.recordType}'`
        ].join(TAB));
        return null;
    }
    if (!hasKeys(options.fields, SALES_ORDER_REQUIRED_FIELDS)) { 
        plog.warn([`${source}: options.fields does not have required fields.`,
            `required: ${JSON.stringify(SALES_ORDER_REQUIRED_FIELDS)}`,
            `received: ${JSON.stringify(options.fields)}`
        ].join(TAB));
        return null; 
    }
    if (!isNonEmptyString(options.fields.externalid)) { 
        throw new Error(
            `${source} RecordOptions.fields.externalid is null or undefined`
        );
    }
    const itemSublist = options.sublists.item;
    if (itemSublist.some(lineItem => 
        lineItem.amount === null || lineItem.amount === undefined 
        || (Number(lineItem.amount) < 0))) {
        mlog.error([`${source}: lineItem.amount is < 0`,
            `    item sublist: ${JSON.stringify(options.sublists.item)}`,
            `order externalid: ${options.fields.externalid}`,
            `meta: ${indentedStringify(options.meta || {})}`
        ].join(TAB));
        throw new Error(`bad amount`);
    }

    if (options.fields.billingaddress) {
        let validatedAddress = address(
            options.fields.billingaddress as SetFieldSubrecordOptions
        );
        if (!validatedAddress) {
            delete options.fields.billingaddress
        } else {
            options.fields.billingaddress = validatedAddress;
        }
    }
    if (options.fields.shippingaddress) {
        let validatedAddress = address(
            options.fields.shippingaddress as SetFieldSubrecordOptions
        );
        if (!validatedAddress) {
            delete options.fields.shippingaddress
        } else {
            options.fields.shippingaddress = validatedAddress;
        }
    }
    if (!options.fields.billingaddress && !options.fields.shippingaddress) {
        plog.warn(`${source}: options.fields does not have any address fields.`,
            TAB+`options.fields.externalid: '${options.fields.externalid}'`,
        );
        // return null;
    }
    if (!isNonEmptyArray(options.sublists.item)) {
        mlog.warn([`${source}: options.sublists.item is empty or not an array.`,
            `options.sublists.item: ${JSON.stringify(options.sublists.item)}`,
            `options.fields.externalid: '${options.fields.externalid}'`,
            ` -> returning null`
        ].join(TAB));
        return null;
    }
    return options;
}


/** check `hasKeys(options.fields, accounts, requireAll)` */
export const item = async (
    options: RecordOptions,
    accounts: string | string[],
    requireAll: boolean = false
): Promise<RecordOptions | null> => {
    if (!options || !options.fields) {
        return null;
    }
    if (!hasKeys(options.fields, accounts, requireAll)) {
        mlog.warn([
            `[prune.item()] options.fields is missing account field`,
            `  accounts: ${JSON.stringify(accounts)}`,
            `requireAll: ${requireAll}`
        ].join(TAB));
        return null;
    }
    return options;
}