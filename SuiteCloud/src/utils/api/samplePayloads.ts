/**
 * @file src/utils/api/samplePayloads.ts
 * @description Sample payloads for testing API endpoints from src/FileCabinet/SuiteScripts/REST
 */

import { CountryAbbreviationEnum, StateAbbreviationEnum, RecordTypeEnum } from "../ns";
import { RADIO_FIELD_FALSE } from "../typeValidation";
import { SetSublistSubrecordOptions, FieldDictionary, SetFieldValueOptions, 
    RecordOptions, SetSublistValueOptions, SublistDictionary, SublistLine } from "./types";

const NOT_INACTIVE = false; // const IS_INACTIVE = true;
const NOT_DYNAMIC = false;

const ODEGAARD_ADDRESS_SUBRECORD_OPTIONS: SetSublistSubrecordOptions = {
    sublistId: 'addressbook',
    fieldId: 'addressbookaddress',
    subrecordType: 'address',
    fields: {
        country: CountryAbbreviationEnum.UNITED_STATES,
        addr1: '4060 George Washington Ln.',
        addr2: 'Room 326',
        attention: 'dubs',
        addrphone: '206-543-2990',
        city: 'Seattle',
        state: StateAbbreviationEnum.WASHINGTON,
        zip: '98105',
    } as FieldDictionary,
};

const SUZZALLO_ADDRESS_SUBRECORD_OPTIONS: SetSublistSubrecordOptions = {
    sublistId: 'addressbook',
    fieldId: 'addressbookaddress',
    subrecordType: 'address',
    fields: {
        country: CountryAbbreviationEnum.UNITED_STATES,
        addr1: '4000 15th Ave NE',
        addr2: 'Room 102',
        attention: 'dubs',
        addrphone: '206-543-0242',
        city: 'Seattle',
        state: StateAbbreviationEnum.WASHINGTON,
        zip: '98195',
    } as FieldDictionary,
};

export const SAMPLE_POST_CUSTOMER_OPTIONS: RecordOptions = {
    recordType: RecordTypeEnum.CUSTOMER,
    isDynamic: NOT_DYNAMIC,
    fields: {
        companyname: 'Sample Customer Company Name',
        entityid: 'Sample Customer Company Name',
        isperson: RADIO_FIELD_FALSE,  
        isinactive: NOT_INACTIVE,
        email: 'sample.customer@email.com'
    } as FieldDictionary,
    sublists: {
        addressbook: [
            { addressbookaddress: ODEGAARD_ADDRESS_SUBRECORD_OPTIONS },                
            { addressbookaddress: SUZZALLO_ADDRESS_SUBRECORD_OPTIONS } 
        ] as SublistLine[]
    } as SublistDictionary,
}

export const UW_LIBRARIES_POST_VENDOR_OPTIONS: RecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    isDynamic: NOT_DYNAMIC,
    fields: {
        entityid: 'UW_LIBRARIES',
        externalid: 'UW_LIBRARIES',
        isperson: RADIO_FIELD_FALSE,  
        companyname: 'UW Libraries',
    } as FieldDictionary,
    sublists: {
        addressbook: [
            {
                // label: 'Odegaard Library' , 
                addressbookaddress: ODEGAARD_ADDRESS_SUBRECORD_OPTIONS,
            },                
            { 
                // label: 'Suzzallo and Allen Libraries', 
                addressbookaddress: SUZZALLO_ADDRESS_SUBRECORD_OPTIONS, 
            } 
        ] as SublistLine[]
    } as SublistDictionary,
};

const MISSION_VIEJO_LIBRARY_ADDRESS_SUBRECORD_OPTIONS: SetSublistSubrecordOptions = {
    sublistId: 'addressbook',
    fieldId: 'addressbookaddress',
    subrecordType: 'address',
    fields: {
        country: CountryAbbreviationEnum.UNITED_STATES,
        addr1: '100 Civic Center',
        addressee: 'Library Addressee',
        attention: 'Library Attention',
        addrphone: '949-830-7100',
        city: 'Mission Viejo',
        state: StateAbbreviationEnum.CALIFORNIA,
        zip: '92691',
    } as FieldDictionary,
};

export const MISSION_VIEJO_LIBRARY_POST_VENDOR_OPTIONS: RecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    isDynamic: NOT_DYNAMIC,
    fields: {
        companyname: 'City of Mission Viejo',
        isperson: RADIO_FIELD_FALSE,  
        isinactive: NOT_INACTIVE,
    } as FieldDictionary,
    sublists: {
        addressbook: [
            {  
                /** label will default to subrecOptions.fields.addr1 after saving record in POST endpoint */
                // label: ${addr1}
                addressbookaddress: MISSION_VIEJO_LIBRARY_ADDRESS_SUBRECORD_OPTIONS,     
            }
        ] as SublistLine[],
    } as SublistDictionary,
};

