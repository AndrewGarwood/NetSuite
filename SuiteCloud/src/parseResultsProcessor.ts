/**
 * @file src/parseResultsProcessor.ts
 * @description handle post processing options of csvParser ParseResults.
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
    BOOLEAN_TRUE_VALUES,
    BOOLEAN_FALSE_VALUES,
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
    ParseResults, RecordPostProcessingOptions, CloneOptions,
    isPostRecordOptions, isCloneOptions,
    ValidatedParseResults,
    ProcessParseResultsOptions
} from "./utils/io";
import { cloneDeep } from "lodash";


/**
 * @param initialResults {@link ParseResults}
 * @param options {@link ProcessParseResultsOptions} 
 * - = `{ [recordType: string]: `{@link RecordPostProcessingOptions}` }`
 * @returns **`results`** {@link ValidatedParseResults} 
 * - = `{ [recordType: string]: {valid:` {@link RecordOptions}`[]; invalid: PostRecordOptions[]; } }`
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
    const results: ValidatedParseResults = {};
    for (const recordType of Object.keys(initialResults)) {
        const isInvalidParseResultsEntry = (!recordType 
            || typeof recordType !== 'string' 
            || !isNonEmptyArray(initialResults[recordType])
            || initialResults[recordType].some(
                element => !isPostRecordOptions(element)
            )
        );
        if (isInvalidParseResultsEntry) {
            mlog.error(`processParseResults() Invalid argument: 'initialResults'`,
                TAB+`expected: 'initialResults' (ParseResults) to have keys as record type strings and values as non-empty array of PostRecordOptions.`,
                TAB+`received: ${typeof recordType} = '${recordType}' with value: ${indentedStringify(initialResults[recordType])}`,
                TAB+`returning empty results...`
            );
            return {};
        }
        results[recordType] = { valid: [], invalid: [] };
    };
    for (const recordType of Object.keys(options)) { // cloning first
        const { cloneOptions } = options[recordType] as RecordPostProcessingOptions;
        if (!recordType || typeof recordType !== 'string' || !hasKeys(initialResults, recordType)) {
            mlog.error(`processParseResults() Invalid ProcessParseResultsOptions.recordType:`,
                TAB+`expected: 'recordType' (string) to be a valid record type key in parseResults.`,
                TAB+`received: ${typeof recordType} = '${recordType}'`,
                TAB+`needed key in parseResults keys: ${JSON.stringify(Object.keys(initialResults))}`,
                TAB+`continuing to next processOptions...`,
            );
            continue;
        }
        if (isCloneOptions(cloneOptions)) {
            for (let i = 0; i < initialResults[recordType].length; i++) {
                initialResults[recordType][i] = processCloneOptions(
                    initialResults, recordType, i, cloneOptions
                );
            }
        }
    }
    
    for (const recordType of Object.keys(options)) { // pruning second
        const { pruneFunc } = options[recordType] as RecordPostProcessingOptions;
        if (pruneFunc && typeof pruneFunc === 'function') {
            for (const postOptions of initialResults[recordType]) {
                let pruneResult = pruneFunc(postOptions);
                if (!pruneResult) {
                    results[recordType].invalid.push(postOptions);
                    continue;
                }
                results[recordType].valid.push(postOptions);
            }
        }
    }
    const summary: Record<string, any> = Object.keys(results).reduce((acc, recordType) => {
        acc[recordType] = {
            initialCount: initialResults[recordType].length,    
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
 * @param parseResults 
 * @param recordType 
 * @param index 
 * @param cloneOptions 
 * @returns **`recipientOptions`** {@link RecordOptions}
 */
function processCloneOptions(
    parseResults: ParseResults,
    recordType: RecordTypeEnum | EntityRecordTypeEnum | string,
    index: number,
    cloneOptions: CloneOptions
): RecordOptions {
    const recipientOptions = parseResults[recordType][index];
    if (!isPostRecordOptions(recipientOptions)) {
        mlog.error(`processCloneOptions() Invalid recipientOptions at index ${index} for recordType '${recordType}':`,
            TAB+`expected: PostRecordOptions object, received: ${typeof recipientOptions} = '${indentedStringify(recipientOptions)}'`,
            TAB+`Returning postOptions unchanged.`
        );
        return recipientOptions;
    }
    const { 
        donorType, recipientType, idProp, fieldIds, sublistIds 
    } = cloneOptions;
    if (!idProp || !donorType || !recipientType || recordType !== recipientType
        || !hasKeys(parseResults,[donorType, recipientType])
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
    if (isNonEmptyArray(fieldIds) && hasNonTrivialKeys(donorOptions.fields)) {
        if (!recipientOptions.fields) {
            recipientOptions.fields = {};
        }
        for (const fieldId of fieldIds) {
            if (!(fieldId in donorOptions.fields)) {
                plog.warn(`processCloneOptions() Field '${fieldId}' not found in donor record:`,
                    TAB+`  donorType: '${donorType}', recipientType: '${recipientType}', idProp: '${idProp}'`,
                    TAB+`recipientId: '${recipientId}'`,
                    TAB+`Skipping field....`
                );
                continue;
            }
            recipientOptions.fields[fieldId] = cloneDeep(donorOptions.fields[fieldId]);
        }
    }
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

function getRecordId(
    postOptions: RecordOptions, 
    idProp: string
): string | undefined {
    if (postOptions.idOptions) {
        const idOption = postOptions.idOptions.find(idOption => 
            idOption.idProp === idProp);
        return idOption ? idOption.idValue as string: undefined;
    } else if (postOptions.fields && hasKeys(postOptions.fields, idProp)) {
        return postOptions.fields[idProp] as string;
    }
    return undefined;
}