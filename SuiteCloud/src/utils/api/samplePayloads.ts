/**
 * @file src/utils/api/samplePayloads.ts
 * @description Sample payloads for testing API calls
 */
import { 
    SublistDictionary, PostRecordOptions, FieldDictionary, 
    SetSubrecordOptions, SublistFieldDictionary, 
    SetSublistValueOptions, 
    SetFieldValueOptions
} from "src/utils/api/types"
import { RADIO_FIELD_FALSE } from "../typeValidation";
import { NetSuiteCountryEnum, CountryAbbreviationEnum as COUNTRIES, StateAbbreviationEnum as STATES } from "src/utils/NS"
import { RecordTypeEnum } from "src/utils/NS/Record/Record"

const NOT_INACTIVE = false;
const NOT_DYNAMIC = false;
// const IS_INACTIVE = true;


const ODEGAARD_ADDRESS_SUBRECORD_OPTIONS: SetSubrecordOptions = {
    parentSublistId: 'addressbook',
    line: 0,
    fieldId: 'addressbookaddress',
    subrecordType: 'address',
    fieldDict: {
        valueFields: [
            { fieldId: 'country', value: COUNTRIES.UNITED_STATES },
            { fieldId: 'addr1', value: '4060 George Washington Ln.' },
            { fieldId: 'addr2', value: 'Room 326' },
            { fieldId: 'addressee', value: 'dubs' },
            { fieldId: 'addrphone', value: '206-543-2990' },
            { fieldId: 'city', value: 'Seattle' },
            { fieldId: 'state', value: STATES.WASHINGTON },
            { fieldId: 'zip', value: '98105' },
        ]
    } as FieldDictionary,
} as SetSubrecordOptions

const SUZZALLO_ADDRESS_SUBRECORD_OPTIONS: SetSubrecordOptions = {
    parentSublistId: 'addressbook',
    line: 1,
    fieldId: 'addressbookaddress',
    subrecordType: 'address',
    fieldDict: {
        valueFields: [
            { fieldId: 'country', value: COUNTRIES.UNITED_STATES},
            { fieldId: 'addr1', value: '4000 15th Ave NE' },
            { fieldId: 'addr2', value: 'Room 102' },
            { fieldId: 'addressee', value: 'dubs' },
            { fieldId: 'addrphone', value: '206-543-0242' },
            { fieldId: 'city', value: 'Seattle' },
            { fieldId: 'state', value: STATES.WASHINGTON },
            { fieldId: 'zip', value: '98195' },
        ] as SetFieldValueOptions[],
    } as FieldDictionary,
}

export const UW_LIBRARIES_UPSERT_VENDOR_OPTIONS: PostRecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    fieldDict: {
        valueFields: [
            { fieldId: 'internalid', value: 5711 },
            { fieldId: 'phone', value: '206-543-2990' },
            { fieldId: 'email', value: 'awg1024@uw.edu' }
        ] as SetFieldValueOptions[],
    } as FieldDictionary,
}

export const UW_LIBRARIES_CREATE_VENDOR_OPTIONS: PostRecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    // isDynamic: NOT_DYNAMIC,
    fieldDict: {
        valueFields: [
            { fieldId: 'entityid', value: 'UW_LIBRARIES' },
            { fieldId: 'externalid', value: 'UW_LIBRARIES' },
            { fieldId: 'isperson', value: RADIO_FIELD_FALSE },  
            { fieldId: 'companyname', value: 'UW Libraries' },
            // { fieldId: 'isinactive', value: NOT_INACTIVE },
        ],
    } as FieldDictionary,
    sublistDict: {
        'addressbook': {
            valueFields: [
                { 
                    sublistId: 'addressbook', 
                    fieldId: 'label', 
                    line: 0, 
                    value: 'Odegaard Library' 
                } as SetSublistValueOptions,                
                { 
                    sublistId: 'addressbook', 
                    fieldId: 'label', 
                    line: 1, 
                    value: 'Suzzallo and Allen Libraries' 
                } as SetSublistValueOptions,
            ] as SetSublistValueOptions[],
            subrecordFields: [
                ODEGAARD_ADDRESS_SUBRECORD_OPTIONS, 
                SUZZALLO_ADDRESS_SUBRECORD_OPTIONS
            ] as SetSubrecordOptions[],
        } as SublistFieldDictionary
    } as SublistDictionary,
}

export const MISSION_VIEJO_LIBRARY_CREATE_VENDOR_OPTIONS: PostRecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    // isDynamic: NOT_DYNAMIC,
    fieldDict: {
        valueFields: [
            { fieldId: 'companyname', value: 'City of Mission Viejo' },
            { fieldId: 'isperson', value: RADIO_FIELD_FALSE },  
            { fieldId: 'isinactive', value: NOT_INACTIVE },
        ] as SetFieldValueOptions[],
    } as FieldDictionary,
    sublistDict: {
        'addressbook': {
            valueFields: [
                { 
                    sublistId: 'addressbook', 
                    fieldId: 'label', 
                    line: 0, 
                    value: 'Primary Address' 
                } as SetSublistValueOptions,    
            ],
            subrecordFields: [
                {
                    parentSublistId: 'addressbook',
                    line: 0,
                    fieldId: 'addressbookaddress',
                    subrecordType: 'address',
                    fieldDict: {
                        valueFields: [
                            { fieldId: 'country', value: COUNTRIES.UNITED_STATES},
                            { fieldId: 'addr1', value: '100 Civic Center' },
                            { fieldId: 'addressee', value: 'Library Addressee' },
                            { fieldId: 'attention', value: 'Library Attention' },
                            { fieldId: 'addrphone', value: '949-830-7100' },
                            { fieldId: 'city', value: 'Mission Viejo' },
                            { fieldId: 'state', value: STATES.CALIFORNIA },
                            { fieldId: 'zip', value: '92691' },
                        ]
                    } as FieldDictionary,
                } as SetSubrecordOptions
            ] as SetSubrecordOptions[],
        } as SublistFieldDictionary
    } as SublistDictionary,
}
