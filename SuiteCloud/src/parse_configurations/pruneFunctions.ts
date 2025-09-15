/**
 * @file src/parse_configurations/pruneFunctions.ts
 */

import { 
    pruneLogger as plog, mainLogger as mlog, INDENT_LOG_LINE as TAB, simpleLogger as slog 
} from "../config/setupLog";
import { 
    isSublistUpdateDictionary,
    RecordOptions,
    SetFieldSubrecordOptions,
    SetSublistSubrecordOptions,
    SublistLine,
} from "../api/types";
import { 
    hasKeys, isEmpty, isInteger, isNonEmptyArray, isNonEmptyString, 
    isNumeric
} from "typeshi:utils/typeValidation";
import { 
    equivalentAlphanumericStrings, 
} from "typeshi:utils/regex";
import { EntityRecordTypeEnum, RecordTypeEnum } from "../utils/ns/Enums";
import { RADIO_FIELD_FALSE, RADIO_FIELD_TRUE } from "../utils/ns";
import { getSourceString } from "@typeshi/io";

const requiredNameFields = ['firstname', 'lastname'];
/** 
 * `ENTITY_REQUIRED_FIELDS = ['entityid', 'companyname']` 
 * - `if` entity isperson, call {@link nameFieldsAreRequired}, 
 * - `else` deletes any existing name fields from `options.fields`
 * - `then` call {@link pruneAddressBook}
 * */
export const entity = (
    options: RecordOptions,
    requiredFields: string[] = ['entityid', 'companyname'] // 'isperson'
): RecordOptions | null => {
    if (isEmpty(options) || !options.fields) {
        plog.warn(`pruneEntity(): options or options.fields is null or undefined, returning null`);
        return null;
    }
    if (!Object.values(EntityRecordTypeEnum).includes(options.recordType as EntityRecordTypeEnum)) {
        mlog.error([`pruneEntity(): options.recordType is not a valid EntityRecordType`,
            `expected one of: ${JSON.stringify(Object.values(EntityRecordTypeEnum))}`,
            `       received: '${options.recordType}'`
        ].join(TAB));
        return null;
    }
    if (!hasKeys(options.fields, requiredFields)) { 
        plog.warn([`pruneEntity(): options.fields does not have required fields.`,
            `required: ${JSON.stringify(requiredFields)}`,
            `received: ${JSON.stringify(options.fields)}`
        ].join(TAB));
        return null; 
    }
    if (options.fields.isperson === RADIO_FIELD_TRUE 
        && !hasKeys(options.fields, requiredNameFields)) {
        plog.warn([`prune.entity(): options.fields does not have required fields.`,
            `recordType: ${options.recordType}`,
            `required: ${JSON.stringify(requiredFields)}`,
            `received: ${JSON.stringify(Object.keys(options.fields))}`
        ].join(TAB));
        return null;
    } else if (options.fields.isperson === RADIO_FIELD_FALSE) {
        const nameFields = [...requiredFields, 'middlename', 'salutation', 'title'];
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
 * @param addressOptions {@link SetFieldSubrecordOptions} | {@link SetSublistSubrecordOptions}
 * @returns **`addressOptions`** {@link SetFieldSubrecordOptions} | {@link SetSublistSubrecordOptions} | null
 */
export const address = (
    addressOptions: SetFieldSubrecordOptions | SetSublistSubrecordOptions,
    requiredFields: string[] = ['addr1']
): SetFieldSubrecordOptions | SetSublistSubrecordOptions | null => {
    if (!addressOptions || !addressOptions.fields) {
        mlog.error([`[prune.address()] Invalid 'address' parameter:`, 
            `address is undefined or does not have the 'fields' property`
        ].join(TAB));
        return null;
    }
    if (!hasKeys(addressOptions.fields, requiredFields)) {
        plog.warn([`[prune.address()]: address not have required fields. returning null.`,
            `required: ${JSON.stringify(requiredFields)}`,
            `received: ${JSON.stringify(Object.keys(addressOptions.fields))}`,
        ].join(TAB));
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
        plog.info([`[prune.address()]: address.attention is redundant with address.addressee , deleting it.`,
            `addressee: ${addressOptions.fields.addressee}`,
            `attention: ${addressOptions.fields.attention}`
        ].join(TAB));
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
    requiredFields: string[] = ['addr1']
): RecordOptions | null => {
    if (isEmpty(options) || !options.sublists) {
        return null;
    }
    const linesToKeep: number[] = [];
    let addressBook = options.sublists.addressbook ?? [];
    if (isSublistUpdateDictionary(addressBook)) return options
    for (let i = 0; i < addressBook.length; i++) {
        const sublistLine = addressBook[i];
        let addressOptions = sublistLine.addressbookaddress as SetSublistSubrecordOptions;
        let validatedAddress = address(addressOptions, requiredFields) as SetSublistSubrecordOptions | null;
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
    requiredFields: string[] = requiredNameFields
): RecordOptions | null => {
    if (isEmpty(options) || !options.fields) {
        mlog.warn(`prune.contact(): options or options.fields is null or undefined, returning null`);
        return null;
    }
    if (options.recordType !== RecordTypeEnum.CONTACT) {
        mlog.error([`[prune.contact()] Prune Function mismatch: invalid options.recordType`,
            `expected: '${RecordTypeEnum.CONTACT}'`,
            `received: '${options.recordType}'`
        ].join(TAB));
        return null;
    }
    if (options.fields.isperson === RADIO_FIELD_TRUE) {
        return null;
    }
    if (!hasKeys(options.fields, requiredFields)) {
        mlog.warn([`[prune.contact()]: options.fields does not have required fields`,
            `required: ${JSON.stringify(requiredFields)}`,
            `received: ${JSON.stringify(Object.keys(options.fields))}`
        ].join(TAB));
        return null;
    }
    return pruneAddressBook(options) as RecordOptions;    
}

/**
 * `async`
 * - (not requiring addresses right now) validate address in `options.fields.billingaddress` and `options.fields.shippingaddress`
 * - make sure `options.sublists.item.length > 1`
 * @param options {@link RecordOptions}
 * @returns **`options`** or **`null`** `Promise<`{@link RecordOptions}` | null>` 
 */
export const salesOrder = async (
    options: RecordOptions,
    requredFields: string[] = ['entity', 'trandate']
): Promise<RecordOptions | null> => {
    const source = getSourceString('prune', salesOrder.name);
    if (isEmpty(options) || !options.fields || !options.sublists || !options.sublists.item) {
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
    if (!hasKeys(options.fields, requredFields)) { 
        plog.warn([`${source}: options.fields does not have required fields.`,
            `required: ${JSON.stringify(requredFields)}`,
            `received: ${JSON.stringify(options.fields)}`
        ].join(TAB));
        return null; 
    }
    let externalId = options.fields.externalid;
    if (!isNonEmptyString(externalId)) { 
        throw new Error(
            `${source} RecordOptions.fields.externalid is null or undefined`
        );
    }
    const itemSublist = options.sublists.item;
    if (isNonEmptyArray(itemSublist) && itemSublist.some(lineItem => 
        lineItem.amount === null || lineItem.amount === undefined 
        || (Number(lineItem.amount) < 0))) {
        mlog.error([`${source}: lineItem.amount is < 0`,
            `    item sublist: ${JSON.stringify(options.sublists.item)}`,
            `order externalid: ${externalId}`,
        ].join(TAB));
        throw new Error(`bad amount`);
    }
    let linesToKeep: SublistLine[] = []
    if (isNonEmptyArray(itemSublist)) {
        let indicesToKeep = [];
        for (let i = 0; i < itemSublist.length; i++) {
            let line = itemSublist[i];
            if (!isNumeric(line.quantity) || Number(line.quantity) === 0) {
                continue;
            }
            indicesToKeep.push(i);
        }
        linesToKeep = indicesToKeep.reduce((acc, lineIndex)=>{
            acc.push(itemSublist[lineIndex]);
            return acc;
        }, [] as SublistLine[]);
    }
    if (linesToKeep.length === 0) {
        mlog.warn(`salesorder has no lineItems with qty > 0`)
    }
    options.sublists.item = linesToKeep;


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
        plog.warn([`${source}: options.fields does not have any address fields.`,
            `options.fields.externalid: '${options.fields.externalid}'`,
        ].join(TAB));
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