/**
 * @file src/parses/vendor/vendorParsePruneFunctions.ts
 */
import { 
    FieldValue,
    FieldDictionary,
    CreateRecordOptions, PostRecordOptions,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SetSubrecordOptions,
    SublistFieldDictionary,
} from "../../utils/api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { isNullLike, RADIO_FIELD_TRUE } from "../../utils/typeValidation";
import { printConsoleGroup as print } from "../../utils/io";
import { READLINE as rl } from "src/config/env";

/**@deprecated */
export const pruneVendor = (
    vendorOptions: CreateRecordOptions,
    label?: string
): CreateRecordOptions | null => {
    if (isNullLike(vendorOptions)) {
        log.warn(`pruneVendor(${(label || '')}): vendorOptions is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_VENDOR_FIELDS = ['entityid', 'companyname']
    try {
        let fieldDict = vendorOptions.fieldDict as FieldDictionary;
        if (fieldDict.valueFields?.some((field) => field.fieldId === 'isperson' && field.value === RADIO_FIELD_TRUE)) {
            // if vendor is a person, then we need to check for the first name and last name
            REQUIRED_VENDOR_FIELDS.push('firstname', 'lastname');
        }
        for (const requiredField of REQUIRED_VENDOR_FIELDS) {
            if (!fieldDict?.valueFields?.some((field) => field.fieldId === requiredField && field.value)) {
                // print({
                //     label: `pruneVendor(${(label || '')}):\n\tSetFieldValueOptions is missing field "${requiredField}", returning null`, 
                //     printToConsole: false
                // });
                log.debug(`pruneVendor(${(label || '')}):\n\tSetFieldValueOptions is missing field "${requiredField}", returning null`,
                    `\npruned vendorOptions`, vendorOptions);
                return null;
            }
        }
        vendorOptions = pruneAddressBook(vendorOptions, `${(label || '')}, pruneVendor calling pruneAddressBook `) as CreateRecordOptions;
        return vendorOptions;
    } catch (error) {
        console.error(`Error in pruneVendor(${(label || '')}):`, error);
        return vendorOptions;
    }
}

/**
 * @deprecated 
 * make sure contact has a firstname and entityid. then call {@link pruneAddressBook} */
export const pruneContact = (
    contactOptions: CreateRecordOptions,
    label?: string
): CreateRecordOptions | null => {
    if (isNullLike(contactOptions)) {
        log.warn(`pruneContact(${(label || '')}): contactOptions is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_CONTACT_FIELDS = ['firstname']
    try {
        let fieldDict = contactOptions.fieldDict as FieldDictionary;
        for (const requiredField of REQUIRED_CONTACT_FIELDS) {
            if (!fieldDict?.valueFields?.some((field) => field.fieldId === requiredField && field.value)) {
                // print({
                //     label: `pruneContact(${(label || '')}):\n\tSetFieldValueOptions is missing field "${requiredField}", returning null`, 
                //     printToConsole: false
                // });
                return null;
            }
        }
        contactOptions = pruneAddressBook(contactOptions, `${(label || '')}, pruneContact calling pruneAddressBook `) as CreateRecordOptions;
        return contactOptions;
    } catch (error) {
        log.error(`Error in pruneContact(${(label || '')}):`, error);
        return contactOptions;
    }
}

/**@deprecated */
export const pruneAddressBook = (
    options: CreateRecordOptions,
    label?: string
): CreateRecordOptions | null => {
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
                if (!subrecValueFields?.some((field) => field.fieldId === requiredField)) {
                    // print({
                    //     label: `pruneAddressBook(${(label || '')}):`,
                    //     details: `subrecordFields[${index}]: SetSubrecordOptions is missing address field "${requiredField}", removing it from subrecordFields`,
                    //     printToConsole: false,
                    // });
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
        log.error(`pruneAddressBook(${(label || '')}): Error in pruneAddressBook: ${error}`);
    }
    return null;
};