/**
 * @file parseCsvToRequestBody.ts
 */
import { 
    CreateRecordOptions, 
    FieldDictionary,
    FieldValue,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistDictionary, 
    SublistFieldDictionary,  
    BatchCreateRecordRequest,  
    SetSubrecordOptions,

    ParseOptions,
    FieldDictionaryParseOptions, 
    FieldParentTypeEnum, 
    FieldSubrecordMapping, 
    FieldValueMapping, 
    SublistDictionaryParseOptions, 
    SublistFieldDictionaryParseOptions, 
    SublistFieldValueMapping, 
    SublistSubrecordMapping 
} from "./types/api";
import { RecordTypeEnum } from "./types/NS";
import {
    hasKeys
} from "./utils/typeValidation";
import csv from 'csv-parser';
import fs from 'fs';

const NOT_DYNAMIC = false;

/**
 * 
 * @param csvPath - The path to the CSV file.
 * @param parseOptionsArray - `Array<`{@link ParseOptions}`>` 
 * - = `{ recordType: `{@link RecordTypeEnum}, `fieldDictParseOptions: `{@link FieldDictionaryParseOptions}, `sublistDictParseOptions: `{@link SublistDictionaryParseOptions}` }[]`
 * @returns `results` - `Promise<Array<`{@link CreateRecordOptions}`>>` 
 * - = `{ recordType: `{@link RecordTypeEnum}, `isDynamic: boolean`, `fieldDict: `{@link FieldDictionary}, `sublistDict: `{@link SublistDictionary}` }[]`
 */
export async function parseCsvToCreateOptions(
    csvPath: string,
    parseOptionsArray: ParseOptions[]
): Promise<CreateRecordOptions[]> {
    return new Promise((resolve, reject) => {
        const results: CreateRecordOptions[] = [];
        // Validate parse options first
        if (!parseOptionsArray?.length) {
            throw new Error('parseOptionsArray must contain at least one ParseOptions configuration');
        }

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    // Process each parse configuration for every row
                    for (const options of parseOptionsArray) {
                        const { recordType, fieldDictParseOptions, sublistDictParseOptions } = options;
                        
                        // Validate required fields exist in CSV row
                        validateFieldMappings(row, fieldDictParseOptions, sublistDictParseOptions);
                        // Generate the CreateRecordOptions for this record type
                        const createOptions = generateCreateRecordOptions(
                            row,
                            recordType,
                            fieldDictParseOptions,
                            sublistDictParseOptions
                        );
                        results.push(createOptions);
                    }
                } catch (error) {
                    reject(error);
                }
            })
            .on('end', () => resolve(results))
            .on('error', reject);
        });
}

/**
 * @TODO maybe try to use {@link hasKeys} to validate the row object
 * @param row - The CSV row to validate.
 * @param fieldDict - {@link FieldDictionaryParseOptions} = `{ fieldValueMapArray: Array<`{@link FieldValueMapping}`>, subrecordMapArray: Array<`{@link FieldSubrecordMapping}`> }`
 * @param sublistDict - {@link SublistDictionaryParseOptions} = `{ [sublistId: string]: { fieldValueMapArray: Array<`{@link SublistFieldValueMapping}`>, subrecordMapArray: Array<`{@link SublistSubrecordMapping}`> } }`
 * @throws Error if any of the required fields are missing in the CSV row
 */
function validateFieldMappings(
    row: any,
    fieldDict: FieldDictionaryParseOptions,
    sublistDict: SublistDictionaryParseOptions
): void {
    // Validate body field mappings
    fieldDict.fieldValueMapArray?.forEach(({ colName }) => {
        if (!(colName in row)) {
            throw new Error(`Missing CSV column for field mapping: ${colName}`);
        }
    });

    // Validate sublist field mappings
    Object.values(sublistDict).forEach(sublist => {
    sublist.fieldValueMapArray?.forEach(({ colName }) => {
        if (!(colName in row)) {
                throw new Error(`Missing CSV column for sublist mapping: ${colName}`);
            }
        });
    });
}

/**
 * 
 * @param row 
 * @param recordType - {@link RecordTypeEnum}
 * @param fieldDictParseOptions - {@link FieldDictionaryParseOptions} 
 * - = `{ fieldValueMapArray: Array<`{@link FieldValueMapping}`>, subrecordMapArray: Array<`{@link FieldSubrecordMapping}`> }`
 * @param sublistDictParseOptions - {@link SublistDictionaryParseOptions} 
 * - = `{ [sublistId: string]: { fieldValueMapArray: Array<`{@link SublistFieldValueMapping}`>, subrecordMapArray: Array<`{@link SublistSubrecordMapping}`> } }`
 * @returns `createOptions` - {@link CreateRecordOptions} 
 * - = `{ recordType: `{@link RecordTypeEnum}, `isDynamic: boolean`, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }`
 */
export function generateCreateRecordOptions(
    row: Record<string, any>, 
    recordType: RecordTypeEnum, 
    fieldDictParseOptions: FieldDictionaryParseOptions, 
    sublistDictParseOptions: SublistDictionaryParseOptions
): CreateRecordOptions {
    let createOptions = { 
        recordType: recordType,
        isDynamic: NOT_DYNAMIC,
        fieldDict: generateFieldDictionary(row, fieldDictParseOptions) as FieldDictionary,
        sublistDict: generateSublistDictionary(row, sublistDictParseOptions) as SublistDictionary,
    }
    return createOptions as CreateRecordOptions;
}

/**
 * 
 * @param row 
 * @param sublistDictParseOptions {@link SublistDictionaryParseOptions} = { [`sublistId`: string]: {@link SublistFieldDictionaryParseOptions} }
 * = { [`sublistId`: string]: { `fieldValueMapArray`: `Array<`{@link SublistFieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link SublistSubrecordMapping}`>` } } 
 * @returns `sublistDict` — {@link SublistDictionary} = { [`sublistId`: string]: {@link SublistFieldDictionary} }
 * = { [`sublistId`: string]: { `valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`>` } } 
 */
export function generateSublistDictionary(
    row: Record<string, any>, 
    sublistDictParseOptions: SublistDictionaryParseOptions,
): SublistDictionary {
    const sublistDict = {} as SublistDictionary;
    for (let sublistId of Object.keys(sublistDictParseOptions)) {
        let sublistFieldDictOptions: SublistFieldDictionaryParseOptions = sublistDictParseOptions[sublistId];
        sublistDict[sublistId] = {
            valueFields: generateSetSublistValueOptionsArray(row, sublistFieldDictOptions.fieldValueMapArray) as SetSublistValueOptions[],
            subrecordFields: generateSetSubrecordOptionsArray(row, FieldParentTypeEnum.SUBLIST, sublistFieldDictOptions.subrecordMapArray) as SetSubrecordOptions[],
        } as SublistFieldDictionary;
    }
    return sublistDict;
}

/**
 * 
 * @param row 
 * @param fieldDictParseOptions {@link FieldDictionaryParseOptions} = { `fieldValueMapArray`: `Array<`{@link FieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link FieldSubrecordMapping}`>` }
 * @returns `fieldDict` — {@link FieldDictionary} = { `valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`>` }
 */
export function generateFieldDictionary(
    row: Record<string, any>,  // what type should the row be?
    fieldDictParseOptions: FieldDictionaryParseOptions, 
): FieldDictionary {
    const fieldDict = {
        valueFields: generateSetFieldValueOptionsArray(row, fieldDictParseOptions.fieldValueMapArray) as SetFieldValueOptions[],
        subrecordFields: generateSetSubrecordOptionsArray(row, FieldParentTypeEnum.BODY, fieldDictParseOptions.subrecordMapArray) as SetSubrecordOptions[],
    } as FieldDictionary;
    return fieldDict;
}

/**
 * 
 * @param row 
 * @param sublistFieldValueMapArray `Array<`{@link SublistFieldValueMapping}`>` = `{ sublistId`: string, `line`: number, `fieldId`: string, `colName`: string` }[]`
 * @returns `arr` — `Array<`{@link SetSublistValueOptions}`>` = `{ sublistId`: string, `line`: number, `fieldId`: string, `value`: string | number | boolean | Date` }[]`
 */
export function generateSetSublistValueOptionsArray(
    row: Record<string, any>,
    sublistFieldValueMapArray: SublistFieldValueMapping[],
): SetSublistValueOptions[] {
    const arr = [] as SetSublistValueOptions[];
    for (let [index, sublistFieldValueMap] of Object.entries(sublistFieldValueMapArray)) {
        let { sublistId, line, fieldId, colName } = sublistFieldValueMap;
        let rowValue: FieldValue = row[colName] || row[colName.toLowerCase()];
        if (rowValue === null || rowValue === undefined || rowValue === '') {
            continue;
        }
        arr.push({
            sublistId: sublistId, 
            line: line === undefined || line === null ? parseInt(index) : line, 
            fieldId: fieldId, 
            value: rowValue 
        } as SetSublistValueOptions);
    }
    return arr;
}


/**
 * 
 * @param row 
 * @param fieldValueMapArray `Array<`{@link FieldValueMapping}`>` = `{ fieldId`: string, `colName`: string` }[]` 
 * @returns `arr` — `Array<`{@link SetFieldValueOptions}`>` = `{ fieldId`: string, `value`: string | number | boolean | Date` }[]`
 */
export function generateSetFieldValueOptionsArray(
    row: Record<string, any>, 
    fieldValueMapArray: FieldValueMapping[]
): SetFieldValueOptions[] {
    const arr = [] as SetFieldValueOptions[];
    for (let fieldValueMap of fieldValueMapArray) {
        let { fieldId, colName } = fieldValueMap;
        let rowValue: FieldValue = row[colName] || row[colName.toLowerCase()];
        if (rowValue === null || rowValue === undefined || rowValue === '') {
            continue;
        }
        arr.push({fieldId: fieldId, value: rowValue })
    }
    return arr;
}

/**
 * 
 * @param row 
 * @param parentType {@link FieldParentTypeEnum} 
 * @param subrecordMapArray `Array<`{@link FieldSubrecordMapping}`> | Array<`{@link SublistSubrecordMapping}`>`
 * @returns `arr` — `Array<`{@link SetSubrecordOptions}`>` = `{ parentSublistId`?: string, `line`?: string, `fieldId`: string, `subrecordType`: string, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }[]`
 */
export function generateSetSubrecordOptionsArray(
    row: Record<string, any>, 
    parentType: FieldParentTypeEnum, 
    subrecordMapArray: FieldSubrecordMapping[] | SublistSubrecordMapping[]
): SetSubrecordOptions[] {
    const arr = [] as SetSubrecordOptions[];    
    if (parentType === FieldParentTypeEnum.BODY) {
        for (let subrecordMap of subrecordMapArray) {
            let { fieldId, subrecordType, fieldDictOptions, sublistDictOptions } = subrecordMap as FieldSubrecordMapping;
            let fieldSubrecOptions: SetSubrecordOptions = {
                fieldId: fieldId,
                subrecordType: subrecordType,
            }
            if (fieldDictOptions) {
                fieldSubrecOptions.fieldDict = generateFieldDictionary(row, fieldDictOptions);
            }
            if (sublistDictOptions) {
                fieldSubrecOptions.sublistDict = generateSublistDictionary(row, sublistDictOptions);
            }
            arr.push(fieldSubrecOptions);
        }
    } else if (parentType === FieldParentTypeEnum.SUBLIST) {
        for (let [index, subrecordMap] of Object.entries(subrecordMapArray)) {
            let { parentSublistId, line, fieldId, subrecordType, fieldDictOptions, sublistDictOptions } = subrecordMap as SublistSubrecordMapping;
            let sublistSubrecOptions: SetSubrecordOptions = {
                parentSublistId: parentSublistId,
                line: line === undefined || line === null ? parseInt(index) : line,
                fieldId: fieldId,
                subrecordType: subrecordType,
            }
            if (fieldDictOptions) {
                sublistSubrecOptions.fieldDict = generateFieldDictionary(row, fieldDictOptions);
            }
            if (sublistDictOptions) {
                sublistSubrecOptions.sublistDict = generateSublistDictionary(row, sublistDictOptions);
            }
            arr.push(sublistSubrecOptions);
        }
    } else {
        throw new Error(`generateSetSubrecordOptionsArray() Invalid parentType: ${parentType}`);
    }
    return arr;
}

// Example usage:
const vendorParseOptions: ParseOptions[] = [{
    recordType: RecordTypeEnum.VENDOR,
    fieldDictParseOptions: {
    fieldValueMapArray: [
        { fieldId: 'entityid', colName: 'Vendor Name' },
        { fieldId: 'email', colName: 'Primary Email' },
        { fieldId: 'phone', colName: 'Main Phone' }
    ],
    subrecordMapArray: [] // No body subrecords
    },
    sublistDictParseOptions: {
        addressbook: {
            fieldValueMapArray: [
                { 
                    sublistId: 'addressbook', 
                    line: 0, 
                    fieldId: 'addr1', 
                    colName: 'Street Address' 
                },
                { 
                    sublistId: 'addressbook', 
                    line: 0, 
                    fieldId: 'city', 
                    colName: 'City' 
                }
            ],
            subrecordMapArray: []
        }
    }
}];

// Parse CSV with multiple record types in single file
parseCsvToCreateOptions('vendors.csv', vendorParseOptions)
    .then(createOptions => {
        const batchRequest: BatchCreateRecordRequest = {
            createRecordArray: createOptions
        };
        console.log('Generated batch request:', batchRequest);
    })
    .catch(console.error);


