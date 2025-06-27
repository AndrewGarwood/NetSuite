/**
 * @file src/parseResultsProcessor.ts
 * @description handle post processing options of csvParser ParseResults.
 * @TODO add another post processing options object.. something like "ComputeOptions" for fields whose values can only be determined after parse is complete.
 */

import { 
    mainLogger as mlog,
    parseLogger as plog,
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL, 
    DEBUG_LOGS,
    indentedStringify,
    STOP_RUNNING,
} from "./config";
import {
    isNonEmptyArray, isEmptyArray, isNullLike, hasNonTrivialKeys,
    areEquivalentObjects,
    hasKeys
} from "./utils/typeValidation";
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    RecordOptions, RecordTypeEnum,
    EntityRecordTypeEnum, 
} from "./utils/api";
import { 
    cleanString, equivalentAlphanumericStrings as equivalentAlphanumeric,
    ParseResults, RecordPostProcessingOptions, CloneOptions, ComposeOptions,
    isRecordOptions, isCloneOptions, isComposeOptions,
    ValidatedParseResults,
    ProcessParseResultsOptions,
    PostProcessingOperationEnum as OperationEnum
} from "./utils/io";
import { cloneDeep } from "lodash";



/**
 * = `[OperationEnum.CLONE, OperationEnum.COMPOSE, OperationEnum.PRUNE]`
 * @description
 * Default operation order if none is specified
 */
const DEFAULT_OPERATION_ORDER: OperationEnum[] = [
    OperationEnum.CLONE,
    OperationEnum.COMPOSE,
    OperationEnum.PRUNE
];

/**
 * @TODO maybe change shape of 'options' param to not map recordType to RecordPostProcessingOptions 
 * because some records' cloneOptions might depend on another's (e.g. trying to clone a field that has been pruned)
 * ... maybe make a dependency graph or something...
 * @param initialResults {@link ParseResults}
 * @param options {@link ProcessParseResultsOptions} 
 * - = `{ [recordType: string]: `{@link RecordPostProcessingOptions}` }`
 * @returns **`results`** {@link ValidatedParseResults} 
 * - = `{ [recordType: string]: {valid:` {@link RecordOptions}`[]; invalid: RecordOptions[]; } }`
 */
export function processParseResults(
    initialResults: ParseResults,
    options: ProcessParseResultsOptions,
): ValidatedParseResults {
    if (!initialResults || !hasNonTrivialKeys(initialResults) || !options) {
        mlog.error(`processParseResults() Invalid arguments:`,
            TAB+`expected: 'initialResults' (ParseResults object) and 'options' (array of ProcessParseResultsOptions).`,
            TAB+`received: initialResults=${indentedStringify(initialResults)}, options=${indentedStringify(options)}`
        )
        return {};
    }
    // Initialize results structure
    const results: ValidatedParseResults = {};
    for (const recordType of Object.keys(initialResults)) {
        const isInvalidParseResultsEntry = (!recordType 
            || typeof recordType !== 'string' 
            || !isNonEmptyArray(initialResults[recordType])
            || initialResults[recordType].some(
                element => !isRecordOptions(element)
            )
        );
        if (isInvalidParseResultsEntry) {
            mlog.error(`processParseResults() Invalid argument: 'initialResults'`,
                TAB+`expected: 'initialResults' (ParseResults) to have keys as record type strings and values as non-empty array of RecordOptions.`,
                TAB+`received: ${typeof recordType} = '${recordType}' with value: ${indentedStringify(initialResults[recordType])}`,
                TAB+`returning empty results...`
            );
            return {};
        }
        results[recordType] = { valid: [], invalid: [] };
    }

    // Process each record type according to its operation order
    for (const recordType of Object.keys(options)) {
        if (!recordType || typeof recordType !== 'string' || !hasKeys(initialResults, recordType)) {
            mlog.error(`processParseResults() Invalid ProcessParseResultsOptions.recordType:`,
                TAB+`expected: 'recordType' (string) to be a valid record type key in initialResults.`,
                TAB+`received: ${typeof recordType} = '${recordType}'`,
                TAB+`needed key in initialResults keys: ${JSON.stringify(Object.keys(initialResults))}`,
                TAB+`continuing to next processOptions...`,
            );
            continue;
        }
        const processes = options[recordType] as RecordPostProcessingOptions;
        const operationOrder = processes.operationOrder || DEFAULT_OPERATION_ORDER;
        const orderIsInvalid = Boolean(operationOrder.length !== 3 
            || Array.from(new Set(operationOrder)).length !== 3 
            || operationOrder.some(op => !Object.values(OperationEnum).includes(op))
        );
        if (orderIsInvalid) {
            mlog.error(`[processParseResults()] Invalid operationOrder. Expected exactly 3 operations`,
                TAB+`Expected permutation of ${JSON.stringify(Object.values(OperationEnum))}.`,
                TAB+`Received: ${JSON.stringify(operationOrder)}`,
            );
            throw new Error(`[processParseResults()] Invalid operationOrder. Expected exactly 3 operations`,);
        }
        for (const operation of operationOrder) {
            switch (operation) {
                case OperationEnum.CLONE:
                    if (!isCloneOptions(processes.cloneOptions)) { break; }
                    for (let i = 0; i < initialResults[recordType].length; i++) {
                        initialResults[recordType][i] = processCloneOptions(
                            initialResults, recordType, i, processes.cloneOptions
                        );
                    }
                    break;
                case OperationEnum.COMPOSE:
                    if (!isComposeOptions(processes.composeOptions)) { break; }
                    for (let i = 0; i < initialResults[recordType].length; i++) {
                        initialResults[recordType][i] = processComposeOptions(
                            initialResults[recordType][i], processes.composeOptions
                        );
                    }
                    break;
                case OperationEnum.PRUNE:
                    if (!processes.pruneFunc || typeof processes.pruneFunc !== 'function') {
                        // If no prune function, all records are considered valid 
                        results[recordType].valid.push(...initialResults[recordType]);
                        break;
                    }
                    for (const record of initialResults[recordType]) {
                        const pruneResult = processes.pruneFunc(record);
                        if (!pruneResult) {
                            results[recordType].invalid.push(record);
                            continue;
                        }
                        results[recordType].valid.push(pruneResult);
                    }
                    break;
                default:
                    mlog.warn(`[processParseResults()] WARNING: Invalid operation:`,
                        TAB+ `received unknown operation '${operation}' for recordType: ${recordType}`
                    );
                    break;
            }
        }
    }
    const summary: Record<string, any> = Object.keys(results).reduce((acc, recordType) => {
        acc[recordType] = {
            initialCount: initialResults[recordType] ? initialResults[recordType].length : 0,    
            validCount: results[recordType].valid.length,
            pruneCount: results[recordType].invalid.length,
        };
        return acc;
    }, {} as Record<string, any>);
    mlog.info(`[END processParseResults()]`,
        TAB+`summary: ${indentedStringify(summary)}`,
    );
    return results;
}

/**
 * @TODO maybe modify so that can clone values from self to other fields on own record
 * @param parseResults {@link ParseResults}
 * @param recordType {@link RecordTypeEnum} | {@link EntityRecordTypeEnum} | `string` - the recipient record type
 * @param index `number` - index of the recipient {@link RecordOptions} in `parseResults[recordType]`
 * @param cloneOptions {@link CloneOptions}
 * @returns **`recipientOptions`** {@link RecordOptions}
 */
function processCloneOptions(
    parseResults: ParseResults,
    recordType: RecordTypeEnum | EntityRecordTypeEnum | string,
    index: number,
    cloneOptions: CloneOptions
): RecordOptions {
    const recipientOptions = parseResults[recordType][index];
    if (!isRecordOptions(recipientOptions)) {
        mlog.error(`processCloneOptions() Invalid recipientOptions at index ${index} for recordType '${recordType}':`,
            TAB+`expected: RecordOptions object, received: ${typeof recipientOptions} = '${indentedStringify(recipientOptions)}'`,
            TAB+`Returning postOptions unchanged.`
        );
        return recipientOptions;
    }
    const { 
        donorType, recipientType, idProp, fieldIds, sublistIds 
    } = cloneOptions;
    if (!idProp || !donorType || !recipientType || recordType !== recipientType
        || !hasKeys(parseResults, [donorType, recipientType])
        || (!isNonEmptyArray(fieldIds) && !isNonEmptyArray(sublistIds))
    ) {
        mlog.error(`processCloneOptions() Invalid CloneOptions - returning postOptions unchanged:`,);
        return recipientOptions;
    }
    const recipientId = getRecordId(recipientOptions, idProp);
    if (!recipientId) {
        mlog.error(`processCloneOptions() Could not find recipient record id in parseResults:`,
            TAB+`  recipientType: '${recipientType}', idProp: '${idProp}'`,
            TAB+`Returning postOptions unchanged.`
        );
        return recipientOptions;
    }
    const donorOptions = parseResults[donorType].find((donor: RecordOptions) => {
        return (getRecordId(donor, idProp) === recipientId);
    });
    if (!donorOptions) {
        mlog.error(`processCloneOptions() Could not find donor record in parseResults:`,
            TAB+`  donorType: '${donorType}', recipientType: '${recipientType}', idProp: '${idProp}'`,
            TAB+`recipientId: '${recipientId}'`,
            TAB+`Returning postOptions unchanged.`
        );
        return recipientOptions;
    }
    // mlog.debug(`[processCloneOptions()] - found donor for recipient`,
    //     TAB+`recipient number of fields before cloning: ${recipientOptions.fields ? Object.keys(recipientOptions.fields).length : 0}`,
    // );
    if (isNonEmptyArray(fieldIds) && hasNonTrivialKeys(donorOptions.fields)) {
        if (!recipientOptions.fields) {
            recipientOptions.fields = {} as FieldDictionary;
        }
        for (const fieldId of fieldIds) {
            if (!(fieldId in donorOptions.fields)) {
                plog.warn(`processCloneOptions() Field '${fieldId}' not found in donor record:`,
                    TAB+`  donorType: '${donorType}', recipientType: '${recipientType}', idProp: '${idProp}'`,
                    TAB+`recipientId: '${recipientId}'`,
                    // TAB+`donorOptions.fields: ${indentedStringify(donorOptions.fields)}`,
                    TAB+`Skipping field....`
                );
                // STOP_RUNNING(1);
            }
            recipientOptions.fields[fieldId] = cloneDeep(donorOptions.fields[fieldId]);
        }
    }
    // mlog.debug(`[processCloneOptions()] - cloned fields from donor to recipient`,
    //     TAB+`recipient number of fields after cloning: ${recipientOptions.fields ? Object.keys(recipientOptions.fields).length : 0}`,
    // );
    // STOP_RUNNING(1);
    if (isNonEmptyArray(sublistIds) && hasNonTrivialKeys(donorOptions.sublists)) {
        for (const sublistId of sublistIds) {
            if (!recipientOptions.sublists) {
                recipientOptions.sublists = {};
            }
            if (!(sublistId in donorOptions.sublists)) {
                mlog.warn(`processCloneOptions() Sublist '${sublistId}' not found in donor record:`,
                    TAB+`  donorType: '${donorType}', recipientType: '${recipientType}', idProp: '${idProp}'`,
                    TAB+`recipientId: '${recipientId}'`,
                    TAB+`Skipping sublist....`
                );
                continue;
            }
            recipientOptions.sublists[sublistId] = cloneDeep(donorOptions.sublists[sublistId]);
        }
    }
    return recipientOptions as RecordOptions;
}

/**
 * @param record {@link RecordOptions} - the record options to compose additional fields/sublists for
 * @param composeOptions {@link ComposeOptions} - options for composing fields and sublists
 * @returns **`recordOptions`** {@link RecordOptions} - the modified record options
 */
function processComposeOptions(
    record: RecordOptions,
    composeOptions: ComposeOptions
): RecordOptions {
    if (!isRecordOptions(record)) {
        mlog.error(`[processComposeOptions()] Invalid RecordOptions:`,
            TAB+`expected: RecordOptions object, received: ${typeof record} = '${indentedStringify(record)}'`,
            TAB+`Returning record unchanged.`
        );
        return record;
    }
    if (composeOptions.fields && hasNonTrivialKeys(composeOptions.fields)) {
        if (!record.fields) {
            record.fields = {};
        }
        
        for (const [fieldId, fieldConfig] of Object.entries(composeOptions.fields)) {
            try {
                if (fieldConfig.composer && typeof fieldConfig.composer === 'function') {
                    const composedValue = fieldConfig.composer(record);
                    record.fields[fieldId] = composedValue;
                }
            } catch (error) {
                mlog.error(`[processComposeOptions()] Error composing field '${fieldId}':`,
                    TAB+`Error: ${error}`,
                    TAB+`Skipping field composition...`
                );
            }
        }
    }
    if (composeOptions.idOptions 
        && typeof composeOptions.idOptions.composer === 'function'
    ) {
        record.idOptions = composeOptions.idOptions.composer(record);
    }
    if (composeOptions.sublists && hasNonTrivialKeys(composeOptions.sublists)) {
        if (!record.sublists) {
            record.sublists = {} as SublistDictionary;
        }
        for (const [sublistId, sublistConfig] of Object.entries(composeOptions.sublists)) {
            if (!record.sublists[sublistId] || isEmptyArray(record.sublists[sublistId])) {
                record.sublists[sublistId] = [{} as SublistLine];
            }
            // compose fields for each line
            for (let i = 0; i < record.sublists[sublistId].length; i++) {
                for (const [sublistFieldId, fieldConfig] of Object.entries(sublistConfig)) {
                    try {
                        if (fieldConfig.composer && typeof fieldConfig.composer === 'function') {
                            const composedValue = fieldConfig.composer(record);
                            record.sublists[sublistId][i][sublistFieldId] = composedValue;
                        }
                    } catch (error) {
                        mlog.error(`[processComposeOptions()] Error composing sublist field '${sublistId}.${sublistFieldId}':`,
                            TAB+`Error: ${error}`,
                            TAB+`Skipping sublist field composition...`
                        );
                    }
                }
            }
        }
    }
    return record;
}

/**
 * @param postOptions {@link RecordOptions} - the record options to get the id from
 * @param idProp `string` - the property to search for the id, see {@link idPropertyEnum}
 * @returns `string | undefined` - the id value if found, `undefined` otherwise
 */
function getRecordId(
    postOptions: RecordOptions, 
    idProp: string
): string | undefined {
    if (postOptions.idOptions) {
        const idOption = postOptions.idOptions.find(idOption => 
            idOption.idProp === idProp
        );
        return idOption ? idOption.idValue as string: undefined;
    } else if (postOptions.fields && hasKeys(postOptions.fields, idProp)) {
        return postOptions.fields[idProp] as string;
    }
    return undefined;
}