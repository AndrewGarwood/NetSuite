/**
 * @file src/parseResultsProcessor.ts
 * @description handle post processing options of csvParser ParseResults.
 */

import { 
    mainLogger as mlog,
    simpleLogger as slog,
    parseLogger as plog,
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
    STOP_RUNNING,
} from "../../config"
import {
    isNonEmptyArray, isEmptyArray, isNullLike, hasNonTrivialKeys,
    areEquivalentObjects,
    hasKeys,
    isNonEmptyString
} from "typeshi:utils/typeValidation";
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    RecordOptions, RecordTypeEnum,
    EntityRecordTypeEnum,
    idSearchOptions,
    isRecordOptions, 
} from "../../api";
import { 
    RecordPostProcessingOptions, CloneOptions, ComposeOptions,
    PostProcessDictionary, 
    PostProcessingOperationEnum as OperationEnum, 
} from "./types/PostProcessing";
import * as validate from "typeshi:utils/argumentValidation";
import { cloneDeep } from "lodash";
import { indentedStringify } from "typeshi:utils/io";
import { ParseResults, ValidatedParseResults } from "../parse/types/index";
import { isParseResults } from "../parse/types/index";
import { isCloneOptions, isComposeOptions, isCompositeSublistComposer } from "src/services/post_process/types/PostProcessing.typeGuards";
import path from "node:path";

const F = path.basename(__filename);

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
 * @param initialResults {@link ParseResults}
 * @param processDictionary {@link PostProcessDictionary} 
 * - = `{ [recordType: string]: `{@link RecordPostProcessingOptions}` }`
 * @returns **`results`** {@link ValidatedParseResults} 
 * - = `{ [recordType: string]: {valid:` {@link RecordOptions}`[]; invalid: RecordOptions[]; } }`
 */
export async function processParseResults(
    initialResults: ParseResults,
    processDictionary?: PostProcessDictionary,
): Promise<ValidatedParseResults> {
    const source = `[parseResultsProcessor.processParseResults()]`
    const results: ValidatedParseResults = {};
    validate.objectArgument(source, {initialResults, isParseResults});
    if (isNullLike(processDictionary)) {
        for (const recordType in initialResults) {
            results[recordType] = {
                valid: initialResults[recordType],
                invalid: []
            }
        }
        return results;
    }
    // Process each record type according to its operation order
    for (const recordType of Object.keys(processDictionary)) {
        if (!isNonEmptyString(recordType) || !hasKeys(initialResults, recordType)) {
            mlog.error([`${source} Invalid ProcessParseResultsOptions.recordType:`,
                `expected: 'recordType' (string) to be a valid record type key in initialResults.`,
                `received: ${typeof recordType} = '${recordType}'`,
                `needed key in initialResults keys: ${JSON.stringify(Object.keys(initialResults))}`,
                `continuing to next processOptions...`,
            ].join(TAB));
            continue;
        }
        results[recordType] = { valid: [], invalid: [] };
        const processes = processDictionary[recordType] as RecordPostProcessingOptions;
        const operationOrder = processes.operationOrder || DEFAULT_OPERATION_ORDER;
        const orderIsInvalid = Boolean(operationOrder.length !== 3 
            || Array.from(new Set(operationOrder)).length !== 3 
            || operationOrder.some(op => !Object.values(OperationEnum).includes(op))
        );
        if (orderIsInvalid) {
            mlog.error(`${source} Invalid operationOrder. Expected exactly 3 operations`,
                TAB+`Expected permutation of ${JSON.stringify(Object.values(OperationEnum))}.`,
                TAB+`Received: ${JSON.stringify(operationOrder)}`,
            );
            throw new Error(`${source} Invalid operationOrder. Expected exactly 3 operations`,);
        }
        let invalidIndices: number[] = []
        for (const operation of operationOrder) {
            switch (operation) {
                case OperationEnum.CLONE:
                    if (!processes.cloneOptions) { break; }
                    for (let i = 0; i < initialResults[recordType].length; i++) {
                        try {
                            initialResults[recordType][i] = await processCloneOptions(
                                initialResults, recordType, i, processes.cloneOptions
                            );
                        } catch(e: any) {
                            mlog.error([`${source} Error occurred when calling processCloneOptions`,
                                `at index ${i} of initialResults['${recordType}'] (RecordOptions[])`,
                                ].join(TAB), 
                                NL+`Caught: ${e}`
                            );
                            if (!invalidIndices.includes(i)) invalidIndices.push(i);
                            
                            results[recordType].invalid.push(initialResults[recordType][i]);
                            continue;
                        }
                    }
                    break;
                case OperationEnum.COMPOSE:
                    if (!processes.composeOptions) { break; }
                    for (let i = 0; i < initialResults[recordType].length; i++) {
                        try {
                            initialResults[recordType][i] = await processComposeOptions(
                                initialResults[recordType][i], processes.composeOptions
                            );
                        } catch (e: any) {
                            mlog.error([`${source} Error occurred when calling processComposeOptions`,
                                `at index ${i} of initialResults['${recordType}'] (RecordOptions[])`,
                                ].join(TAB), 
                                NL+`Caught: ${e}`
                            );
                            if (!invalidIndices.includes(i)) invalidIndices.push(i);
                            
                            continue;
                        }
                    }
                    break;
                case OperationEnum.PRUNE:
                    if (!processes.pruneFunc || typeof processes.pruneFunc !== 'function') {
                        // mlog.debug(`no pruneFunc found`)
                        // If no prune function, all records are considered valid 
                        results[recordType].valid.push(...initialResults[recordType]);
                        break;
                    }
                    // mlog.debug(`pruneFunc is defined, starting iteration over initialResults[${recordType}]`)
                    for (let i = 0; i < initialResults[recordType].length; i++) {
                        const record = initialResults[recordType][i];
                        const pruneResult = await processes.pruneFunc(
                            record, ...(processes.pruneArgs || [])
                        );
                        if (!pruneResult) {
                            if (!invalidIndices.includes(i)) invalidIndices.push(i);
                            
                            // results[recordType].invalid.push(record);
                            continue;
                        }
                        results[recordType].valid.push(pruneResult);
                    }
                    break;
                default:
                    mlog.warn(`${source} WARNING: Invalid operation:`,
                        TAB+ `received unknown operation '${operation}' for recordType: ${recordType}`
                    );
                    break;
            }
        }
        for (let arrIndex of invalidIndices) {
            results[recordType].invalid.push(initialResults[recordType][arrIndex]);
        }
    }
    slog.debug(`${source} Writing summary...`)
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
export async function processCloneOptions(
    parseResults: ParseResults,
    recordType: RecordTypeEnum | EntityRecordTypeEnum | string,
    index: number,
    cloneOptions: CloneOptions
): Promise<RecordOptions> {
    const source = `[${F}.processCloneOptions()]`
    const recipientOptions = parseResults[recordType][index];
    validate.objectArgument(source, {recipientOptions, isRecordOptions});
    validate.objectArgument(source, {cloneOptions, isCloneOptions});
    const { 
        donorType, recipientType, idProp, fieldIds, sublistIds 
    } = cloneOptions;
    if (!idProp || !donorType || !recipientType || recordType !== recipientType
        || !hasKeys(parseResults, [donorType, recipientType])
        || (!isNonEmptyArray(fieldIds) && !isNonEmptyArray(sublistIds))) {
        mlog.error(`[processCloneOptions() ]Invalid CloneOptions - returning postOptions unchanged:`,);
        return recipientOptions;
    }
    const recipientId = getRecordId(recipientOptions, idProp);
    if (!recipientId) {
        mlog.error([`[processCloneOptions()] Could not find recipient record id in parseResults:`,
            `  recipientType: '${recipientType}', idProp: '${idProp}'`,
            `Returning postOptions unchanged.`
        ].join(TAB));
        return recipientOptions;
    }
    const donorOptions = parseResults[donorType].find((donor: RecordOptions) => {
        return (getRecordId(donor, idProp) === recipientId);
    });
    if (!donorOptions) {
        mlog.error([`[processCloneOptions()] Could not find donor record in parseResults:`,
            `  donorType: '${donorType}', recipientType: '${recipientType}', idProp: '${idProp}'`,
            `recipientId: '${recipientId}'`,
            `Returning postOptions unchanged.`
        ].join(TAB));
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
                mlog.warn([`[processCloneOptions()] Sublist '${sublistId}' not found in donor record:`,
                    `  donorType: '${donorType}', recipientType: '${recipientType}', idProp: '${idProp}'`,
                    `recipientId: '${recipientId}'`,
                    `Skipping sublist....`
                ].join(TAB));
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
export async function processComposeOptions(
    record: RecordOptions,
    composeOptions: ComposeOptions
): Promise<RecordOptions> {
    const source = `[${F}.processComposeOptions()]`;
    try {
        validate.objectArgument(source, {record, isRecordOptions});
        validate.objectArgument(source, {composeOptions, isComposeOptions});
    } catch (error: any) {
        mlog.error(error);
        return record;
    }
    if (composeOptions.fields && typeof composeOptions.fields.composer === 'function') {
        record.fields = await composeOptions.fields.composer(record, record.fields ?? {});
    }
    if (composeOptions.idOptions 
        && typeof composeOptions.idOptions.composer === 'function') {
        record.idOptions = await composeOptions.idOptions.composer(record, record.idOptions ?? []);
    }
    
    if (isCompositeSublistComposer(composeOptions.sublists)) {
        record.sublists = await composeOptions.sublists.composer(record, record.sublists ?? {})
    } else if (composeOptions.sublists && hasNonTrivialKeys(composeOptions.sublists)) {
        if (!record.sublists) {
            record.sublists = {} as SublistDictionary;
        }
        for (const [sublistId, sublistConfig] of Object.entries(composeOptions.sublists)) {
            if (!record.sublists[sublistId] || isEmptyArray(record.sublists[sublistId])) {
                record.sublists[sublistId] = [{} as SublistLine];
            }
            // let composer handle each line, just pass in the sublist lines
            if (typeof sublistConfig.composer !== 'function') { continue }
            record.sublists[sublistId] = await sublistConfig.composer(record, record.sublists[sublistId])
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

export function getCompositeDictionaries(validatedResults: ValidatedParseResults): { 
    validDict: { [recordType: string]: RecordOptions[] }, 
    invalidDict: { [recordType: string]: RecordOptions[]} 
} {
    const source = `[${F}.getCompositeDictionaries()]`
    validate.objectArgument(source, {validatedResults});
    const invalidDict = Object.keys(validatedResults).reduce((acc, key) => {
        if (isNonEmptyArray(validatedResults[key].invalid)) acc[key] = validatedResults[key].invalid;
        return acc;
    }, {} as { [recordType: string]: RecordOptions[] });
    const validDict = Object.keys(validatedResults).reduce((acc, key) => {
        acc[key] = validatedResults[key].valid;
        return acc;
    }, {} as { [recordType: string]: RecordOptions[] });
    return { validDict, invalidDict }
}