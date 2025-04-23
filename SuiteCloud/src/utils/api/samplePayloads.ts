/**
 * @file src/utils/api/samplePayloads.ts
 * @description Sample payloads for testing API calls
 */
import { 
    SublistDictionary, CreateRecordOptions, FieldDictionary, 
    SetSublistTextOptions, SetSubrecordOptions, SublistFieldDictionary, 
    SetSublistValueOptions 
} from "src/types/api/Api"
import { NetSuiteCountryEnum } from "src/types/NS/Enums"
import { RecordTypeEnum } from "src/types/NS/Record"

export const subrecOptions: SetSubrecordOptions = {
    sublistId: 'addressbook',
    fieldId: 'addressbookaddress',
    subrecordType: 'address',
    fieldDict: {
        valueFields: [
            { fieldId: 'country', value: 'US'},//NetSuiteCountryEnum.UNITED_STATES },
            { fieldId: 'addr1', value: 'test addr1' },
            { fieldId: 'addressee', value: 'test addressee' },
            { fieldId: 'city', value: 'test city' },
            { fieldId: 'state', value: 'test state' },
            { fieldId: 'zip', value: 'test zip' },
        ]
    } as FieldDictionary,
    line: 0,
}
export const singleReq: CreateRecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    isDynamic: false,
    fieldDict: {
        textFields: [
            { fieldId: 'companyname', text: 'test vendor company name' },
            { fieldId: 'entityid', text: 'Test Vendor entityid' },
            { fieldId: 'externalid', text: 'test vendor externalid' },
        ],
        valueFields: [
            { fieldId: 'isinactive', value: false },
        ],
    },
    sublistDict: {
        'addressbook': {
            textFields: [
                { 
                    sublistId: 'addressbook', 
                    fieldId: 'label', 
                    line: 0, 
                    text: 'test label from recOptions.sublistDict.addressbook.textFields[0].text' 
                } as SetSublistTextOptions,
            ],
            subrecordFields: [subrecOptions]
        } as SublistFieldDictionary
    },
}

export const alternateSingleReq: CreateRecordOptions = {
    recordType: RecordTypeEnum.VENDOR,
    isDynamic: false,
    fieldDict: {
        valueFields: [
            { fieldId: 'isinactive', value: false },
            { fieldId: 'companyname', value: 'CoolTest Company' },
            { fieldId: 'externalid', value: 'coolExternalId' },
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
            ],
            subrecordFields: [
                {
                    sublistId: 'addressbook',
                    fieldId: 'addressbookaddress',
                    subrecordType: 'address',
                    line: 0,
                    fieldDict: {
                        valueFields: [
                            { fieldId: 'country', value: 'US' },
                            { fieldId: 'addr1', value: '4060 George Washington Ln.' },
                            { fieldId: 'addr2', value: 'Room 326' },
                            { fieldId: 'addressee', value: 'dubs' },
                            { fieldId: 'addrphone', value: '999-999-9999' },
                            { fieldId: 'city', value: 'Seattle' },
                            { fieldId: 'state', value: 'WA' },
                            { fieldId: 'zip', value: '98105' },
                        ]
                    } as FieldDictionary,
                } as SetSubrecordOptions
            ],
        } as SublistFieldDictionary
    } as Record<string, SublistFieldDictionary>,
}