/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName PUT_Record
 * @PROD_ScriptId 
 * @PROD_DeployId 
 * @SB_ScriptId 2
 * @SB_DeployId 1
 */

/**
 * @consideration make an enum for sublistIds (of non static sublists) 
 * {@link https://stoic.software/articles/types-of-sublists/#:~:text=Lastly%2C%20the-,Static%20List,-sublists%20are%20read} 
 */
define(['N/record', 'N/log', 'N/search'], (record, log, search) => {
/**
 * @type {LogStatement[]} - `Array<`{@link LogStatement}`>` = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
 * @see {@link writeLog}`(type, title, ...details)`
 * */
const logArray = [];
const EP = `PUT_Record`;

/**
 * @param {RecordRequest} reqBody **{@link RecordRequest}**
 * - = `{ recordOptions: `{@link RecordOptions}` | Array<`{@link RecordOptions}`>, responseOptions: `{@link RecordResponseOptions}` }`
 * @returns {RecordResponse} **`response`** **{@link RecordResponse}** 
 * = `{ success: boolean, message: string, results?: `{@link RecordResult}`[], rejects?: `{@link RecordOptions}`[], error?: string, logs: `{@link LogStatement}`[] }`
 */
const put = (reqBody) => {
    const source = getSourceString(EP, put.name);
    let { recordOptions, responseOptions } = reqBody;
    if (!recordOptions && !isNonEmptyArray(recordOptions)) {
        writeLog(LogTypeEnum.ERROR, `${source} Invalid Request Body`, 
            'non-empty recordOptions is required'
        );
        return { 
            status: 400, 
            message: `${source} Invalid Request Body`, 
            error: 'Expected: reqBody.recordOptions: RecordOptions | RecordOptions[]',
            results: [],
            rejects: [reqBody], 
            logs: logArray 
        };
    }
    if (!Array.isArray(recordOptions)) {
        recordOptions = [recordOptions];
    }
    /**@type {RecordResult[]} */
    const results = [];
    /**@type {RecordOptions[]} */
    const rejects = [];
    writeLog(LogTypeEnum.AUDIT, `${source} received valid recordOptions of length: ${recordOptions.length}`);
    try {
        for (let i = 0; i < recordOptions.length; i++) {
            const options = recordOptions[i];
            try {
                // writeLog(LogTypeEnum.DEBUG, `calling processRecordOptions...`)
                const result = processRecordOptions(options, responseOptions);
                // writeLog(LogTypeEnum.DEBUG, `Back in put()...`)
                if (!result) {
                    writeLog(LogTypeEnum.ERROR,
                        `${source} Invalid '${options.recordType}' RecordOptions at index ${i}:`,
                    )
                    rejects.push(options);
                    continue;
                }
                results.push(result);
            } catch (e) {
                writeLog(LogTypeEnum.ERROR, 
                    `${source} Error processing '${options.recordType}' RecordOptions at index ${i}:`, 
                    String(e),
                );
                rejects.push(options);
                continue;
            }
        }
        
        writeLog(LogTypeEnum.AUDIT, `End of PUT_Record:`, { 
            numRecordsProcessed: results.length,
            numRejects: rejects.length,
            numErrorLogs: logArray.filter(log => log.type === LogTypeEnum.ERROR).length,
        });
        /**@type {RecordResponse} */
        return {
            status: 200,
            message: `PUT_Record completed, processed ${results.length} record(s)`,
            results: results,
            rejects: rejects,
            logs: logArray,
        };
    } catch (e) {
        writeLog(LogTypeEnum.ERROR, `Error in PUT_Record:`, { 
            numRecordsProcessed: results.length,
            numRejects: rejects.length,
            numErrorLogs: logArray.filter(log => log.type === LogTypeEnum.ERROR).length,
        }, e);
        /**@type {RecordResponse} */
        return {
            status: 500,
            message: 'Error in PUT_Record: upsert failed after processing ' + results.length + ` records.`,
            error: String(e),
            logs: logArray,
            results: results,
            rejects: rejects
        }
    }
}

/**
 * @param {RecordOptions} options 
 * @param {RecordResponseOptions} [responseOptions]
 * @returns {RecordResult | null} **`result`** {@link RecordResult} = `{ internalid: number, recordType: string | RecordTypeEnum, fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
 */
function processRecordOptions(options, responseOptions) {
    if (!isObject(options)) {
        writeLog(LogTypeEnum.ERROR, 
            `[ERROR processRecordOptions()] Invalid param 'options':`, 
            `options must be an object of type RecordOptions`,
            `= { recordType: RecordTypeEnum, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
        );
        return null;
    }
    let { recordType, isDynamic, idOptions, fields, sublists } = options;
    recordType = validateRecordType(recordType);
    if (!isRecordTypeEnum(recordType)) {
        writeLog(LogTypeEnum.ERROR,
            `[ERROR processRecordOptions()] Invalid param 'options':`,
            `options is Missing 'recordType' property`,
            `= { recordType: RecordTypeEnum, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
        );
        return null;
    }
    if (!isObject(fields) && !isObject(sublists)) {
        writeLog(LogTypeEnum.ERROR, 
            `[ERROR processRecordOptions()] Invalid param 'options'`,
            `options is Missing 'fields' and 'sublists' property (must have at least one)`, 
            `options must be an object of type RecordOptions`,
            `= { recordType: RecordTypeEnum, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
        );
        return null;
    }
    // writeLog(LogTypeEnum.DEBUG, `calling searchForRecordById...`)
    const deletions = [];
    /**@type {any | undefined} */
    let rec = undefined;
    isDynamic = typeof isDynamic === 'boolean' ? isDynamic : NOT_DYNAMIC;
    const recId = searchForRecordById(recordType, idOptions, fields) || null;
    const isExistingRecord = typeof recId === 'number' && recId > 0;
    if (isExistingRecord) { 
        rec = record.load({type: recordType, id: recId, isDynamic });
        writeLog(LogTypeEnum.AUDIT, 
            `Loading Existing ${recordType} record with internalid: '${recId}'`,
            // `deleted ${deletions.length} idPropField(s) from fields: ${JSON.stringify(deletions)}`,
            // `${Object.keys(fields).length} remaining field(s): ${JSON.stringify(Object.keys(fields))}`, 
        );
    } else {
        writeLog(LogTypeEnum.AUDIT, 
            `[processRecordOptions()] creating new '${recordType}' record`, 
            `[processRecordOptions()] No existing '${recordType}' record found.`,
            `-> Try Creating new '${recordType}' record...`
        );
        rec = record.create({type: recordType, isDynamic });
    }
    
    if (isExistingRecord) {
        // remove idPropertyEnum values from keys of fields to avoid DUP_ENTITY error.
        const unmutableIdFields = [idPropertyEnum.INTERNAL_ID, idPropertyEnum.TRANSACTION_ID, idPropertyEnum.ITEM_ID];
        for (const idPropFieldId of unmutableIdFields) { //Object.values(idPropertyEnum)
            if (fields[idPropFieldId]) { 
                deletions.push({idProp: idPropFieldId, value: fields[idPropFieldId]});
                delete fields[idPropFieldId];
            }
        } 
    }
    if (isObject(fields)) {
        try {
            rec = processFieldDictionary(rec, recordType, fields);
            writeLog(LogTypeEnum.AUDIT, `[processRecordOptions()] Completed processFieldDictionary`)
        } catch (error) {
            writeLog(LogTypeEnum.ERROR, `[processRecordOptions()] Error processing options.fields`,
                `recordType: ${recordType}`,
                `  recordId: '${recId}' (null/undefined if new record)`,
                `error: `, String(error)
            );
            return null;
        }
    }
    if (isObject(sublists)) {
        try {
            rec = processSublistDictionary(rec, recordType, sublists);
            writeLog(LogTypeEnum.AUDIT, 
                `[processRecordOptions()] Completed processSublistDictionary`
            );
        } catch (error) {
            writeLog(LogTypeEnum.ERROR, `[processRecordOptions()] Error processing options.sublists`,                
                `recordType: ${recordType}`,
                `recordId: '${recId}' (null/undefined if new record)`,
                `error: `, String(error)
            );
            return null;
        }
    }

    /**@type {RecordResult} {@link RecordResult} */
    const result = { recordType };
    //(isExistingRecord ? recId : rec.save({ enableSourcing: true, ignoreMandatoryFields: true })), 
    //rec.save({ enableSourcing: true, ignoreMandatoryFields: true }), //
    
    try {
        writeLog(LogTypeEnum.AUDIT, 
            `[processRecordOptions()] Now trying to save record and store in result: ${JSON.stringify(result)}`,
            // `String(rec.save()) = '${String(rec.save({ enableSourcing: true, ignoreMandatoryFields: true }))}'`
        );
        // result.internalid = rec.save();
        result.internalid = rec.save({ 
            enableSourcing: false,
            ignoreMandatoryFields: true 
        });
    } catch (error) {
        writeLog(LogTypeEnum.ERROR, `[processRecordOptions()] Error saving record`,
            `an error occurred when calling the save() function.`,
            `recordType: '${recordType}'`,
            `  recordId: '${recId}' (null/undefined if new record)`,
            `caught: ${error}`,
        );
        return null;
    }
    writeLog(LogTypeEnum.AUDIT, `[processRecordOptions()] Successfully saved record`);
    try {
        if (responseOptions && responseOptions.fields) {
            result.fields = getResponseFields(rec, responseOptions.fields);
            result.fields.recordType = recordType;
        }
        if (responseOptions && responseOptions.sublists) {
            result.sublists = getResponseSublists(rec, responseOptions.sublists);
        } 
    } catch (error) {
        writeLog(LogTypeEnum.ERROR, `[processRecordOptions()] Error processing ResponseOptions`,
            `recordType: ${recordType}`,
            `  recordId: '${recId}' (null/undefined if new record)`,
            `caught: ${error}`,
        );
        // return result;
    }
    writeLog(LogTypeEnum.AUDIT, `[processRecordOptions()] Completed processResponseOptions`)
    return result;   
}

/**
 * @note does not handle searching for multiple records and returning their ids
 * @param {RecordTypeEnum | string} recordType 
 * @param {idSearchOptions[]} [idOptions] `Array<`{@link idSearchOptions}`>` = `{ idProp`: {@link idPropertyEnum}, `searchOperator`: {@link RecordOperatorEnum}, `idValue`: string | number` }[]`
 * @param {FieldDictionary} [fields] - `object` extract idProperty values from `fields` `if` `idOptions` not provided
 * @returns {number | null} **`recordId`** - the `'internalid'` of the record 
 * `if` found in the search, or `null` `if` no record was found.
 */
function searchForRecordById(recordType, idOptions, fields) {
    if (!isRecordTypeEnum(recordType) || (!idOptions && !isObject(fields))) {
        writeLog(LogTypeEnum.ERROR,
            `[ERROR searchForRecordById()] Invalid Parameters:`,
            `recordType must be a valid RecordTypeEnum or string, and idOptions or fields (with idProps) must be provided`,
        );
        return null;
    }
    // if no idOptions provided && fields provided, extract idProperty values from fields
    if (isObject(fields) && !(isNonEmptyArray(idOptions))) {
        /**@type {idSearchOptions[]} */
        idOptions = [];
        for (const idPropFieldId of Object.values(idPropertyEnum)) {
            if (fields[idPropFieldId]) {
                const idValue = (idPropFieldId === idPropertyEnum.INTERNAL_ID 
                    ? Number(fields[idPropFieldId]) 
                    : String(fields[idPropFieldId])
                );
                const searchOperator = (idPropFieldId === idPropertyEnum.INTERNAL_ID 
                    ? SearchOperatorEnum.RECORD.ANY_OF 
                    : SearchOperatorEnum.TEXT.IS
                );
                idOptions.push({
                    idProp: idPropFieldId,
                    searchOperator: searchOperator,
                    idValue: idValue
                });
            }
        }
    }
    /** 
     * idOptions is invalid and fields does not have any idPropertyEnum values in its keys
     * -> unable to search for existing record -> return null
     * */
    if (!isNonEmptyArray(idOptions)) { 
        return null;
    }
    /**@type {number|null} */
    let recordId = null;
    for (let i = 0; i < idOptions.length; i++) {
        if (!isIdSearchOptions(idOptions[i])) {
            writeLog(LogTypeEnum.ERROR,
                `ERROR: searchForRecordById() Invalid idOptions idSearchOptions element.`,
                `Invalid idSearchOptions element at idOptions[${i}]`,
            );
            continue;
        }
        const { idProp, searchOperator, idValue } = idOptions[i];
        try {
            const recSearch = search.create({
                type: recordType,
                filters: [
                    // [idProp, searchOperator, idValue],
                    search.createFilter({
                        name: idProp,
                        operator: searchOperator,
                        values: isNonEmptyArray(idValue) ? idValue : [idValue]
                    }),
                    // search.createFilter({
                    //     name: 'mainline',
                    //     operator: SearchOperatorEnum.TEXT.IS,
                    //     values: ['T']
                    // })
                ],
            });
            /** @type {ResultSet} */
            const resultSet = recSearch.run();
            /** @type {SearchResult[]} */
            const resultRange = resultSet.getRange({ start: 0, end: 10 });
            if (resultRange.length === 0) {
                writeLog(LogTypeEnum.DEBUG,
                    `[searchForRecordById()] 0 records found for idSearchOption ${i+1}/${idOptions.length}`,
                    `0 '${recordType}' records found with ${idProp}='${idValue}' and operator='${searchOperator}'`,
                );
                continue;
            }
            const expectSingleResult = Boolean(
                typeof idValue === 'string' || 
                typeof idValue === 'number' || 
                (Array.isArray(idValue) && idValue.length === 1)
            );
            /** 
             * @consideration if want to be able to return multiple values, 
             * store recordIds = resultRange.map(result => result.id) 
             */
            if (resultRange.length > 1 && expectSingleResult) {
                recordId = Number(resultRange[0].id);
                writeLog(LogTypeEnum.DEBUG,
                    'WARNING: searchForRecordById() Multiple records found.',
                    `${resultRange.length} '${recordType}' records found with ${idProp}='${idValue}' and operator='${searchOperator}'`,
                    `tentatively storing id of first record found,'${recordId}' then continuing to next idOptions element`
                );
                continue;
            } else if (resultRange.length === 1) {
                writeLog(LogTypeEnum.DEBUG,
                    'searchForRecordById() Record found!',
                    `1 '${recordType}' record found with ${idProp}='${idValue}' and operator='${searchOperator}'`,
                );
                return Number(resultRange[0].id);
            }
        } catch (e) {
            writeLog(LogTypeEnum.ERROR,
                `ERROR: searchForRecordById() idOptions for loop`,
                `error occurred while searching for '${recordType}' record with ${idProp}='${idValue}' and operator='${searchOperator}'`, 
                JSON.stringify(e)
            );
            continue;
        }
        if (recordId !== null) {
            return recordId
        }
    }
    return recordId; // null if no record found
}

/**
 * @param {object} rec 
 * @param {RecordTypeEnum} recordType 
 * @param {string} fieldId 
 * @param {FieldValue} value
 * @returns {object} **`rec`** - the record object with field value set or unchanged if `originalValue === value`. 
 */
function upsertFieldValue(rec, recordType, fieldId, value) {
    if (!rec || !isNonEmptyString(recordType) || !isNonEmptyString(fieldId)) {
        writeLog(LogTypeEnum.ERROR, 
            `ERROR: upsertFieldValue() Invalid Parameters:`,
            `rec, recordType, fieldId, and value are required parameters`,
            `received { recordType: '${recordType}', fieldId: '${fieldId}', value: '${value}' }`,
        );
        return rec;
    }
    // if fieldId refers to a date field and the value is a string, 
    // try to make a new date object from the value
    if (fieldId.includes('date') && typeof value === 'string') {
        try {
            const dateValue = new Date(value);
            if (!isNaN(dateValue.getTime())) {
                value = dateValue; // update value to be a Date object
            } else {
                writeLog(LogTypeEnum.WARN, 
                    `[WARNING upsertFieldValue()] Invalid date string for fieldId '${fieldId}' on recordType '${recordType}':`,
                    `value: '${value}' is not a valid date string, keeping value as string`
                );
                return rec; // keep value as string if date parsing fails
            }
        } catch (e) {
            writeLog(LogTypeEnum.ERROR,
                `[ERROR upsertFieldValue()] Error parsing date string for fieldId '${fieldId}' on recordType '${recordType}':`,
                `value: '${value}' could not be parsed to a Date object, keeping value as string`,
            );
            return rec;
        }
    }
    /**@type {SetFieldValueOptions} */
    const setOptions = { fieldId, value };
    try {
        const originalValue = rec.getValue({ fieldId });
        if (String(originalValue) === String(value)) {
            return rec;
        }
        writeLog(LogTypeEnum.DEBUG, 
            `[upsertFieldValue()] attempting <${recordType}>rec.setValue()`,
            `<${recordType}>rec.setValue({ fieldId: '${fieldId}', value: '${value}' })`,
            `originalValue === newValue ? ${String(originalValue) === String(value)}`,
            `originalValue: '${originalValue}'`, 
            `     newValue: '${value}'`, 
        ); 
        rec.setValue(setOptions);
    } catch (e) {
        writeLog(LogTypeEnum.ERROR, 
            `[ERROR upsertFieldValue()] Error setting value for fieldId '${fieldId}' on recordType '${recordType}':`,
            `<${recordType}>rec.setValue({ fieldId: '${fieldId}', value: '${value}' })`,
            `originalValue: '${rec.getValue({ fieldId })}'`,
            `        Error: ${JSON.stringify(e)}`,
        );
    }
    return rec;
}

/**
 * @param {object} rec 
 * @param {RecordTypeEnum} recordType 
 * @param {string} sublistId 
 * @param {string} fieldId 
 * @param {number} lineIndex 
 * @param {FieldValue} value 
 * @returns **`rec`** - the record object with sublist field value set or unchanged if `originalValue === value`.
 */
function upsertSublistFieldValue(rec, recordType, sublistId, fieldId, lineIndex, value) {
    if (!rec || [recordType, sublistId, fieldId].some(param=>!isNonEmptyString(param))) {
        writeLog(LogTypeEnum.ERROR, 
            `[ERROR upsertSublistFieldValue()] Invalid Parameters:`,
            `rec, recordType, sublistId, fieldId, and value are required parameters`,
            `received { recordType: ${recordType}, sublistId: ${sublistId}, fieldId: ${fieldId}, value: ${value} }`,
        );
        return rec;
    }
    /**@type {SetSublistValueOptions} */
    const setOptions = {sublistId, fieldId, value, line: lineIndex};
    try {
        const originalValue = rec.getSublistValue({ sublistId, fieldId, line: lineIndex });
        if (String(originalValue) === String(value)) {
            return rec;
        }
        writeLog(LogTypeEnum.DEBUG, 
            `[upsertSublistFieldValue()] attempting <${recordType}>rec.setSublistValue();`,
            `<${recordType}>rec.setSublistValue({ sublistId: '${sublistId}', fieldId: '${fieldId}', value: '${value}', line: ${lineIndex} });`,
            `originalValue === newValue ? ${String(originalValue) === String(value)}`,
            `originalValue: '${originalValue}'`, 
            `     newValue: '${value}'`, 
        );
        rec.setSublistValue(setOptions); 
    } catch (e) {
        writeLog(LogTypeEnum.ERROR, 
            `[ERROR upsertSublistFieldValue()] Error setting value for fieldId '${fieldId}' on sublistId '${sublistId}' of recordType '${recordType}':`,
            `<${recordType}>rec.setSublistValue({ sublistId: '${sublistId}', fieldId: '${fieldId}', value: '${value}', line: ${lineIndex} })`,
            `originalValue: '${rec.getSublistValue({ sublistId, fieldId, line: lineIndex })}'`,
            `        Error: ${JSON.stringify(e)}`,
        );
    }
    return rec;
}

/**
 * @param {object} rec the record object created or loaded by the `record` module
 * @param {RecordTypeEnum | string} recordType {@link RecordTypeEnum} | `string`
 * @param {FieldDictionary} fields {@link FieldDictionary} = `{ [fieldId: string]: FieldValue | SubrecordValue }`
 * @returns {object} **`rec`** - the record object with field values set.
 */
function processFieldDictionary(rec, recordType, fields) {
    if (!rec || !isNonEmptyString(recordType) || !isObject(fields)) {
        writeLog(LogTypeEnum.ERROR, 
            `[ERROR processFieldDictionary()] Invalid Parameters:`,
            `rec, recordType, and fields are required parameters`,
        );
        return rec;
    }
    for (const fieldId in fields) {
        const value = fields[fieldId];
        let isSubrec = isSubrecord(value);
        try {
            rec = (isSubrec
                ? processFieldSubrecordOptions(rec, recordType, value) 
                : upsertFieldValue(rec, recordType, fieldId, value)
            );
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, 
            `[ERROR processFieldDictionary()] Error processing value for fieldId: '${fieldId}'`,
            `Caught error from ${isSubrec ? 'processFieldSubrecordOptions()' : 'upsertFieldValue()' }`,
            );
            continue;
        }
    }
    return rec;
}

/**
 * @TODO maybe add a param somewhere indicating whether to clear previous 
 * line entries for sublists when upserting
 * @param {object} rec 
 * @param {RecordTypeEnum | string} recordType 
 * @param {SublistDictionary} sublists 
 * @returns {object} **`rec`**
 */
function processSublistDictionary(rec, recordType, sublists) {
    const source = getSourceString(EP, processSublistDictionary.name, recordType)
    if (!rec || !isNonEmptyString(recordType) || !sublists || isEmptyArray(Object.keys(sublists))) {
        writeLog(LogTypeEnum.ERROR, 
            `${source} Invalid Parameters:`,
            `rec, recordType, and sublists are required parameters`,
        );
        return rec;
    }
    sublistIdLoop:
    for (let sublistId in sublists) {
        try {
            rec.getSublist({sublistId})
        } catch (error) {
            writeLog(LogTypeEnum.ERROR, 
                `${source} Invalid sublistId:`,
                `sublistId '${sublistId}' not found on record type '${recordType}'`,
                `caught: ${error}`
            );
            continue sublistIdLoop;
        }
        let dictEntryValue = sublists[sublistId];
        if (isSublistUpdateDictionary(dictEntryValue)) {
            try {
                rec = processSublistUpdateDictionary(rec, recordType, sublistId, dictEntryValue) 
            } catch (error) {
                writeLog(LogTypeEnum.ERROR,
                    `${source} Error when processing SublistUpdateDictionary`,
                    `sublistId '${sublistId}'`, `recordType '${recordType}'`, 
                    `caught: ${error}`
                );
                continue sublistIdLoop;
            }
        } else if (isNonEmptyArray(dictEntryValue) && dictEntryValue.every(v=>isObject(v))) {
            try {
                rec = processSublistLines(rec, recordType, sublistId, dictEntryValue) 
            } catch (error) {
                writeLog(LogTypeEnum.ERROR,
                    `${source} Error when processing SublistLine array`,
                    `sublistId '${sublistId}'`, `recordType '${recordType}'`, 
                    `caught: ${error}`
                );
                continue sublistIdLoop;
            } 
        } else {
            writeLog(LogTypeEnum.ERROR,
                `${source} Invalid value at sublists['${sublistId}']`,
                `sublistId '${sublistId}'`, `recordType '${recordType}'`, 
                `Expected: SublistUpdateDictionary or SublistLine[]`,
                `Received: ${typeof dictEntryValue} = ${dictEntryValue}`
            );
            continue sublistIdLoop;
        }
    }
    return rec;
}

/**
 * @note only performs each update entry once (i.e. at most 1 line affected)
 * @param {Record<string, any>} rec 
 * @param {RecordTypeEnum} recordType 
 * @param {string} sublistId 
 * @param {SublistUpdateDictionary} updateDictionary 
 * @returns {Record<string, any>} **`rec`**
 */
function processSublistUpdateDictionary(
    rec, 
    recordType, 
    sublistId, 
    updateDictionary
) {
    const source = getSourceString(EP, processSublistUpdateDictionary.name, sublistId)
    if (!isObject(rec) 
        || [recordType, sublistId].some(param=>!isNonEmptyString(param))
        || !isSublistUpdateDictionary(updateDictionary)) {
        writeLog(LogTypeEnum.ERROR, `${source} Invalid parameters`)
        return rec;
    }
    sublistFieldIdLoop:
    for (let fieldId in updateDictionary) {
        const { newValue, lineIdOptions } = updateDictionary[fieldId];
        let numUpdates = 0;
        // @consideration change back to while loop
        if (rec.findSublistLineWithValue(lineIdOptions) > -1) {
            try {
                rec = (isSetSublistSubrecordOptions(newValue) 
                    ? processSublistSubrecordOptions(rec, 
                        recordType, 
                        sublistId, 
                        fieldId, 
                        rec.findSublistLineWithValue(lineIdOptions), 
                        newValue
                    ) : upsertSublistFieldValue(rec, 
                        recordType, 
                        sublistId, 
                        fieldId, 
                        rec.findSublistLineWithValue(lineIdOptions), 
                        newValue
                    )
                );
                numUpdates++;
            } catch (error) {
                writeLog(LogTypeEnum.ERROR, 
                    `${source} Error processing sublistUpdateDictionary['${fieldId}']`,
                    `recordType: '${recordType}'`,
                    `sublistId: '${sublistId}'`,
                    `caught: ${error}`
                );
                continue sublistFieldIdLoop;
            }
        }
        // writeLog(LogTypeEnum.DEBUG, `${source} numUpdates for fieldId '${fieldId}' = ${numUpdates}`,
        //     `i.e. changed ${numUpdates} line(s) in ${recordType} sublist '${sublistId}'`
        // );
    }
    return rec;
}

/**
 * @param {Record<string, any>} rec 
 * @param {RecordTypeEnum} recordType 
 * @param {string} sublistId 
 * @param {SublistLine[]} sublistLines 
 * @returns {Record<string, any>}
 */
function processSublistLines(
    rec,
    recordType, 
    sublistId, 
    sublistLines
) {
    const source = getSourceString(EP, processSublistLines.name, sublistId);
    if (!isObject(rec) 
        || [recordType, sublistId].some(param=>!isNonEmptyString(param))
        || !isNonEmptyArray(sublistLines)) {
        writeLog(LogTypeEnum.ERROR, `${source} Invalid parameters`)
        return rec;
    }
    for (let i = 0; i < sublistLines.length; i++) {
        const sublistLine = sublistLines[i];
        sublistFieldIdLoop:
        for (let fieldId of Object.keys(sublistLine)
                .filter(k=>k !=='line' && k !== 'id')) {
            let value = sublistLine[fieldId];
            try {
                rec = isSetSublistSubrecordOptions(value) 
                    ? processSublistSubrecordOptions(rec,
                        recordType, 
                        sublistId, 
                        fieldId, 
                        sublistLine.line ?? validateSublistLineIndex(rec, sublistId, i), 
                        value // as SetSublistSubrecordOptions
                    ) : upsertSublistFieldValue(rec,
                        recordType,
                        sublistId,
                        fieldId,
                        sublistLine.line ?? validateSublistLineIndex(rec, sublistId, i),
                        value // as FieldValue
                    )
            } catch (error) {
                writeLog(LogTypeEnum.ERROR, 
                    `${source} Error processing sublistLine['${fieldId}'] at sublistLines[${i}]`,
                    `recordType: '${recordType}'`,
                    `sublistId: '${sublistId}'`,
                    `caught: ${error}`
                )
                continue sublistFieldIdLoop;
            }
        }
    }
    return rec;
}

/**
 * @param {object} rec 
 * @param {RecordTypeEnum} parentRecordType 
 * @param {string} parentSublistId
 * @param {string} parentFieldId 
 * @param {number} lineIndex
 * @param {SetSublistSubrecordOptions} subrecordOptions 
 * @returns {object} **`rec`**
 */
function processSublistSubrecordOptions(
    rec, 
    parentRecordType, 
    parentSublistId,
    parentFieldId, 
    lineIndex, 
    subrecordOptions
) {
    if (!rec 
        || [parentRecordType, parentSublistId, parentFieldId].some(param=>!isNonEmptyString(param))
        || !isInteger(lineIndex, true)
        || !isObject(subrecordOptions)) {
        writeLog(LogTypeEnum.ERROR, 
            `ERROR: processSublistSubrecordOptions() Invalid Parameters:`,
            `rec, parentRecordType, parentSublistId, fieldId, lineIndex, and subrecordOptions are required parameters`,
        );
        return rec;
    }
    const { sublistId, fieldId, fields, sublists, subrecordType } = subrecordOptions;
    if (sublistId !== parentSublistId || fieldId !== parentFieldId) {
        writeLog(LogTypeEnum.ERROR,
            `ERROR: processSublistSubrecordOptions() Invalid subrecordOptions:`,
            `sublistId '${sublistId}' and fieldId '${fieldId}' must match parentSublistId '${parentSublistId}' and parentFieldId '${parentFieldId}'`,
        );
        return rec;
    }
    let sublistSubrec = rec.getSublistSubrecord({ 
        sublistId: parentSublistId, fieldId: parentFieldId, line: lineIndex 
    });
    if (!sublistSubrec) {
        writeLog(LogTypeEnum.ERROR,
            `ERROR: processSublistSubrecordOptions() Invalid subrecord fieldId:`,
            `fieldId '${parentFieldId}' is not a subrecord field of a '${parentRecordType}' record's '${parentSublistId}' sublist`
        );
    }
    if (isObject(fields)) {
        sublistSubrec = processFieldDictionary(sublistSubrec, subrecordType, fields);
    }
    if (isObject(sublists)) {
        sublistSubrec = processSublistDictionary(sublistSubrec, subrecordType, sublists);
    }
    return rec;
}

/**
 * @TODO maybe add validation step with {@link SubrecordFieldEnum}
 * @param {object} rec 
 * @param {RecordTypeEnum} parentRecordType {@link RecordTypeEnum}
 * @param {SetFieldSubrecordOptions} subrecordOptions {@link SetFieldSubrecordOptions}
 * @returns {object} **`rec`**
 */
function processFieldSubrecordOptions(rec, parentRecordType, subrecordOptions) {
    if (!rec || !isRecordTypeEnum(parentRecordType) || !isObject(subrecordOptions)) {
        writeLog(LogTypeEnum.ERROR, 
            `ERROR: processFieldSubrecordOptions() Invalid Parameters:`,
            `rec, parentRecordType, and subrecordOptions are required parameters`,
        );
        return rec;
    }
    let { fieldId, fields, sublists, subrecordType } = subrecordOptions;
    if (!isNonEmptyString(fieldId)) {
        writeLog(LogTypeEnum.ERROR, 
            `processFieldSubrecordOptions() - Invalid parameter: subrecordOptions`, 
            '(fieldId: string) is required property of subrecordOptions'
        );
        return rec;
    }
    fieldId = fieldId.toLowerCase();
    let subrec = rec.getSubrecord({ fieldId });
    if (!subrec) {
        writeLog(LogTypeEnum.ERROR,
            `processFieldSubrecordOptions() - Invalid subrecord fieldId:`,
            `fieldId '${fieldId}' is not a subrecord field of a '${parentRecordType}' record`
        );
        return rec;
    }
    if (isObject(fields)) {
        subrec = processFieldDictionary(subrec, subrecordType, fields);
    }
    if (isObject(sublists)) {
        subrec = processSublistDictionary(subrec, subrecordType, sublists);
    }
    return rec;
}

/**
 * @param {object} rec 
 * @param {string | string[]} responseFields 
 * @returns {FieldDictionary} **`fields`** = {@link FieldDictionary}
 */
function getResponseFields(rec, responseFields) {
    if (!rec || (!isNonEmptyString(responseFields) && !isNonEmptyArray(responseFields))) {
        writeLog(LogTypeEnum.ERROR, 
            'getResponseFields() Invalid parameters', 
            'rec (object) and responseFields (string | string[]) are required'
        );
        return {};
    }
    /**@type {FieldDictionary} */
    const fields = {internalid: rec.getValue({ fieldId: idPropertyEnum.INTERNAL_ID })};
    /**@type {string[]} */
    responseFields = (typeof responseFields === 'string'
        ? [responseFields]
        : responseFields
    );
    for (let fieldId of responseFields) {
        try { 
            fieldId = fieldId.toLowerCase();
            /**@type {FieldValue | SubrecordValue} */
            const value = (Object.values(SubrecordFieldEnum).includes(fieldId) // && rec.hasSubrecord({fieldId}) 
                ? rec.getSubrecord({ fieldId }) // as Subrecord 
                : rec.getValue({ fieldId }) // as FieldValue
            );
            if (value === undefined) { continue }
            fields[fieldId] = value;
        } catch (error) {
            writeLog(LogTypeEnum.ERROR, 
                `[getResponseFields()] Error getting value for fieldId '${fieldId}'`, 
                `error: `, error
            );
            continue
        }
    };
    return fields;
}
/**
 * `if` a value of responseSublists is empty or undefined, `return` all fields of the sublist
 * @param {object} rec 
 * @param {{[sublistId: string]: string | string[]}} responseSublists
 * @returns {SublistDictionary | {[sublistId: string]: SublistLine[]}} **`sublists`** = {@link SublistDictionary}
 */
function getResponseSublists(rec, responseSublists) {
    if (!rec || !isObject(responseSublists)) {
        writeLog(LogTypeEnum.ERROR, 
            '[getResponseSublists()] Invalid parameters', 
            'rec and responseSublists are required'
        );
        return {};
    }
    /**@type {SublistDictionary} */
    const sublists = {};
    sublistLoop:    
    for (const sublistId in responseSublists) {
        if (!rec.getSublist({ sublistId })) {
            writeLog(LogTypeEnum.ERROR, 
                `[getResponseSublists()] Invalid sublistId:`, 
                `sublistId '${sublistId}' not found on record`
            );
            continue;
        }
        sublists[sublistId] = [];
        const lineCount = rec.getLineCount({ sublistId });
        if (lineCount === 0) {
            writeLog(LogTypeEnum.DEBUG, 
                `[getResponseSublists()] No lines found for sublistId '${sublistId}'`, 
            );
            continue;
        }
        /**@type {string[]} */
        const responseFields = (typeof responseSublists[sublistId] === 'string'
            ? [responseSublists[sublistId]]
            : (!responseSublists[sublistId] || isEmptyArray(responseSublists[sublistId])
                ? rec.getSublistFields({ sublistId }) // as string[]
                : responseSublists[sublistId] // as string[]
        ));
        sublistLineLoop:
        for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
            /**@type {SublistLine} @see {@link SublistLine}*/
            const sublistLine = {
                line: lineIndex,
                id: rec.getSublistValue({
                    sublistId, fieldId: 'id', line: lineIndex
                }),
                internalid: rec.getSublistValue({ 
                    sublistId, fieldId: idPropertyEnum.INTERNAL_ID, line: lineIndex 
                })
            };
            sublistFieldIdLoop:
            for (const fieldId of responseFields) {
                try {
                    /**@type {FieldValue | SubrecordValue} */
                    const value = (Object.values(SubrecordFieldEnum).includes(fieldId) // && rec.hasSublistSubrecord({ sublistId, fieldId, line: i }) 
                        ? rec.getSublistSubrecord({ sublistId, fieldId, line: lineIndex }) // as Subrecord 
                        : rec.getSublistValue({ sublistId, fieldId, line: lineIndex }) // as FieldValue
                    ); 
                    if (value === undefined || value === null) { continue; }
                    sublistLine[fieldId] = value;
                } catch(error) {
                    writeLog(LogTypeEnum.ERROR, `[getResponseSublists] Error getting sublist field value`,
                        `sublistId: '${sublistId}'`, 
                        `fieldId: '${fieldId}'`,
                        `lineIndex: ${lineIndex}.`,
                        `error: ${error}`
                    );
                    continue sublistFieldIdLoop;
                }
            }
            sublists[sublistId].push(sublistLine);
        }
    }
    return sublists;
}

/*---------------------------- [ Helper Functions ] ----------------------------*/
/**
 * @enum {string} **`LogTypeEnum`**
 * @description `Enum` for NetSuite's log module types
 * @property {string} DEBUG - `debug`
 * @property {string} ERROR - `error`
 * @property {string} AUDIT - `audit`
 * @property {string} EMERGENCY - `emergency`
 * @readonly
 */
const LogTypeEnum = {
    /** = `'debug'` */
    DEBUG: 'debug',
    /** = `'error'` */
    ERROR: 'error',
    /** = `'audit'` */
    AUDIT: 'audit',
    /** = `'emergency'` */
    EMERGENCY: 'emergency',
};
/**max number of times allowed to call `log.debug(title, details)` per `put()` call */
const MAX_LOGS_PER_LEVEL = 50;
/**@type {{[logType: LogTypeEnum]: {count: number, limit: number}}} */
const logDict = {
    [LogTypeEnum.DEBUG]: {count: 0, limit: MAX_LOGS_PER_LEVEL},
    [LogTypeEnum.ERROR]: {count: 0, limit: MAX_LOGS_PER_LEVEL},
    [LogTypeEnum.AUDIT]: {count: 0, limit: MAX_LOGS_PER_LEVEL},
    [LogTypeEnum.EMERGENCY]: {count: 0, limit: MAX_LOGS_PER_LEVEL}
}
/**
 * Calls NetSuite log module and pushes log with timestamp={@link getCurrentPacificTime}`()` to {@link logArray} to return at end of post request.
 * @param {LogTypeEnum} type {@link LogTypeEnum}
 * @param {string} title `string` - title of the log message.
 * @param {any[]} [details] `Array<any>` - additional details to log.
 * @returns {void} 
 */
function writeLog(type, title, ...details) {
    if (!type || !title || typeof title !== 'string') {
        log.error('Invalid log', 'type and title are required');
        return;
    }
    if (!Object.values(LogTypeEnum).includes(type)) {
        log.error('Invalid log type', `type must be one of ${Object.values(LogTypeEnum).join(', ')}`);
        return;
    }
    details = isNonEmptyArray(details) ? details : [title];
    const payload = details
        .map(d => (typeof d === 'string' ? d : JSON.stringify(d, null, 4)))
        .join(' ');
    switch (type) {
        case LogTypeEnum.DEBUG:
            if (logDict[LogTypeEnum.DEBUG].count >= logDict[LogTypeEnum.DEBUG].limit) {
                break;
            }
            log.debug(title, payload);
            logDict[LogTypeEnum.DEBUG].count++;
            break;
        case LogTypeEnum.ERROR:
            if (logDict[LogTypeEnum.ERROR].count >= logDict[LogTypeEnum.ERROR].limit) {
                break;
            }
            log.error(title, payload);
            logDict[LogTypeEnum.ERROR].count++;
            break;
        case LogTypeEnum.AUDIT:
            if (logDict[LogTypeEnum.AUDIT].count >= logDict[LogTypeEnum.AUDIT].limit) {
                break;
            }
            log.audit(title, payload);
            logDict[LogTypeEnum.AUDIT].count++;
            break;
        case LogTypeEnum.EMERGENCY:
            if (logDict[LogTypeEnum.EMERGENCY].count >= logDict[LogTypeEnum.EMERGENCY].limit) {
                break;
            }
            log.emergency(title, payload);
            logDict[LogTypeEnum.EMERGENCY].count++;
            break;
    }
    logArray.push({ timestamp: getCurrentPacificTime(), type, title, details });//, message: payload });
}

/**
 * @returns {string} The current date and time in Pacific Time
 */
function getCurrentPacificTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
}
/**
 * @consideration make an enum for subrecord fieldIds... see {@link SubrecordFieldEnum}
 * @description assumes that the input value is a subrecord object if it is an object 
 * and not an array and not a Date object
 * and not a {@link SublistFieldValueUpdate}
 * @goal get {@link SetFieldSubrecordOptions} from FieldDictionary or {@link SetSublistSubrecordOptions} from SublistDictionary
 * @param {any | SubrecordValue} value 
 * @returns {value is SubrecordValue} **`isSubrecord`** `boolean` = **`true`** `if` `value` is a subrecord object, **`false`** `otherwise`.
 */
function isSubrecord(value) {
    const isNonEmptyObject = Boolean(isObject(value) 
        && !Array.isArray(value)
        && !isSublistFieldValueUpdate(value)
    );
    const isNotDate = Boolean(value 
        && !value.hasOwnProperty('getVarDate') 
        && !value.hasOwnProperty('toLocaleString')
    );
    const isSubrecord = (isNonEmptyObject 
        && (isSetSublistSubrecordOptions(value)
            || isSetFieldSubrecordOptions(value)
            || isNotDate
        )
    );
    return isSubrecord;
}

/**
 * @param {any} value 
 * @returns {value is SetSublistSubrecordOptions}
 */
function isSetSublistSubrecordOptions(value)  {
    /**@type {SetSublistSubrecordOptions} */
    const candidate = value;
    return (isSetFieldSubrecordOptions(value)
        && isNonEmptyString(candidate.sublistId)
    );
}

/**
 * @param {any} value 
 * @returns {value is SetFieldSubrecordOptions}
 */
function isSetFieldSubrecordOptions(value)  {
    /**@type {SetFieldSubrecordOptions} */
    const candidate = value;
    return (isObject(candidate)
        && isNonEmptyString(candidate.fieldId)
        && isNonEmptyString(candidate.subrecordType)
        && (isObject(candidate.fields) || isObject(candidate.sublists))
    );
}


/**
 * @param {RecordTypeEnum | string} recordType {@link RecordTypeEnum} | `string`
 * @returns {RecordTypeEnum | null} **`recordType`** - the validated record type as a `RecordTypeEnum` value, or `null` if the record type is invalid.
 */
function validateRecordType(recordType) {
    if (!isNonEmptyString(recordType)) {
        return null;
    }
    const isKey = Object.keys(RecordTypeEnum).includes(recordType.toUpperCase());
    const isValue = Object.values(RecordTypeEnum).includes(recordType.toLowerCase());
    if (isKey) { return RecordTypeEnum[recordType.toUpperCase()]; }
    if (isValue) { return recordType.toLowerCase(); }
    return null;
}

/**
 * @deprecated
 * now using Record.findSublistLineWithValue(options) 
 * - https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273157398.html
 * @param {object} rec `object`
 * @param {string} sublistId `string`
 * @param {SublistLine} sublistLine {@link SublistLine} `object`
 * @param {string | string[]} idFields - `fieldId` or `Array<fieldId>` to search for equality with `idValue`
 * @returns {number[]} **`lineIndices`**
 */
function getSublistLineIndexByFieldEquality(
    rec, 
    sublistId,
    sublistLine,
    idFields
    ) {
    if (!rec || !sublistId || !sublistLine || typeof sublistLine !== 'object' || typeof sublistId !== 'string') {
        writeLog(LogTypeEnum.ERROR, 
            `ERROR: getSublistLineIndexById() Invalid Parameters:`,
            `'rec' (object) 'sublistId' (string) 'sublistLine' (SublistLine) are required parameters`,
        );
        return [];
    }
    if (!idFields || isEmptyArray(idFields)) { return []; }
    if (typeof idFields !== 'string' && !isNonEmptyArray(idFields)) {
        writeLog(LogTypeEnum.ERROR,
            `ERROR: getSublistLineIndexById() Invalid idFields parameter:`,
            `'idFields' must be a string or an array of strings, received '${typeof idFields}'`
        );
        return [];
    }
    if (idFields && typeof idFields === 'string') {
        idFields = [idFields]; // convert to array if a single string is passed
    }
    const lineCount = rec.getLineCount({ sublistId });
    if (lineCount === 0) { return []; }
    /**@type {number[]} */
    const lineIndices = [];
    for (let i = 0; i < lineCount; i++) {
        const allIdFieldValuesEqual = idFields.every(fieldId => {
            const sublistValue = rec.getSublistValue({ sublistId, fieldId, line: i });
            return String(sublistValue).toLowerCase() === String(sublistLine[fieldId]).toLowerCase();
        });
        if (allIdFieldValuesEqual) {
            lineIndices.push(i);
        }
    }
    return lineIndices;
}

/**
 * @description Validate the line index for a sublist. 
 * `If` the line index is out of bounds, `insert` a new line at the end 
 * of the sublist and `return` it as the `new line index`.
 * @param {object} rec a record or subrecord object
 * @param {string} sublistId id of rec's sublist
 * @param {number} line index in sublist
 * @returns {number} the input `line {number}` if valid, otherwise `insert` a new line at the end of the sublist and `return` it as the new line index. 
 */
function validateSublistLineIndex(rec, sublistId, line) {
    if (!rec || !sublistId || typeof sublistId !== 'string' || typeof line !== 'number') {
        writeLog(LogTypeEnum.ERROR, 
            'Invalid validateSublistLineIndex() parameters', 
            'params (rec: Record, sublistId: string, and line: number) are required'
        );
    }
    const lineCount = rec.getLineCount({ sublistId });
    const lineIndexOutOfBounds = line < 0 || line >= lineCount;
    if (lineIndexOutOfBounds) {
        writeLog(LogTypeEnum.DEBUG, 
            `validateSublistLine() Inserting new line.`,
            `Inserting new line at end of sublist because input line was out of bounds or sublist was empty`, 
            `rec: <rec>, sublistId: ${sublistId}, line: ${line}`
        );
        rec.insertLine({ sublistId, line: lineCount });
        return lineCount; // return the new line index
    }
    return line; // return the original line index because it is valid
}
/**
 * @param value `any` the value to check
 * @returns **`isEmpty`** `boolean` = `value is '' | (Array<any> & { length: 0 }) | null | undefined | Record<string, never>`
 * - **`true`** `if` the `value` is null, undefined, empty object (no keys), empty array, or empty string
 * - **`false`** `otherwise`
 */
function isEmpty(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return false;
    }
    // Check for empty object or array
    if (typeof value === 'object' && isEmptyArray(Object.keys(value))) {
        return true;
    }
    const isNullLikeString = (typeof value === 'string'
        && (value.trim() === ''
            || value.toLowerCase() === 'undefined'
            || value.toLowerCase() === 'null'));
    if (isNullLikeString) {
        return true;
    }
    return false;
}
/**
 * @param {any} value 
 * @returns {value is Array<any> & { length: number }} `value is Array<any> & { length: number }`
 * - **`true`** `if` `value` is an array and has at least one element, 
 * - **`false`** `otherwise`
 */
function isNonEmptyArray(value) { return Array.isArray(value) && value.length > 0; }
/**
 * @param {any} value 
 * @returns {value is Array<any> & { length: 0 }} `value is Array<any> & { length: 0 }` 
 * - **`true`** `if` `value` is an array and has length = `0` (no elements), 
 * - **`false`** `otherwise`
 */
function isEmptyArray(value) { return Array.isArray(value) && value.length === 0; }
/**
 * @param {any} value 
 * @returns {value is string[]}
 */
function isStringArray(value) { 
    return isNonEmptyArray(value) 
    && value.every(el => typeof el === 'string') 
}
/**
 * @description Check if an object has any non-empty keys (not undefined, null, or empty string). 
 * - passing in an array will return `false`.
 * @param {object} obj - The `object` to check.
 * @returns {obj is Record<string, any> | { [key: string]: any } |{ [key: string]: FieldValue }} **`true`** if the object has any non-empty keys, **`false`** `otherwise`.
 */
function hasNonTrivialKeys(obj) {
    if (typeof obj !== 'object' || !obj || Array.isArray(obj)) {
        return false;
    }
    const hasKeyWithNonTrivialValue = Object.values(obj).some(value => {
        return value !== undefined && value !== null &&
            (value !== '' || isNonEmptyArray(value) 
            || (isNonEmptyArray(Object.entries(value)))
        );
    });
return hasKeyWithNonTrivialValue;
}
/**
 * @param value `any`
 * @param requireNonNegative `boolean`
 * - `if` `true` then require that `value` be an integer `>= 0`
 * - `if` `false` then the sign of the number doesn't matter
 * @returns **`isInteger`** `boolean`
 */
function isInteger(value, requireNonNegative = false) {
    return (typeof value === 'number'
        && Number.isInteger(value)
        && (requireNonNegative ? value >= 0 : true));
}

/**
 * @param value `any`
 * @returns {value is string & { length: number }} **`isNonEmptyString`** `boolean`
 * - `true` `if` `value` is a non-empty string (not just whitespace),
 * - `false` `otherwise`.
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

/**
 * @note uses `key in obj` for each element of param `keys`
 * @param obj `T extends Object` the object to check
 * @param keys `Array<keyof T> | string[] | string` the list of keys that obj must have
 * @param requireAll `boolean` defaults to `true`
 * - `if` `true`, all keys must be present in the object;
 * - `if` `false`, at least one key must be present
 * @param restrictKeys `boolean` defaults to `false`
 * - `if` `true`, only the keys provided in the `keys` param are allowed in the object;
 * - `if` `false`, the object can keys not included in the `keys` param.
 * @returns **`hasKeys`** `boolean`
 * - **`true`** `if` `obj` is of type 'object' and has the required key(s),
 * - **`false`** `otherwise`
 */
function hasKeys(obj, keys, requireAll = true, restrictKeys = false) {
    if (!isObject(obj)) {
        return false;
    }
    if (keys === null || keys === undefined) {
        throw new Error('[hasKeys()] no keys provided: param `keys` must be defined');
    }
    if (!isNonEmptyArray(keys)) {
        keys = [keys]; // Convert string (assumed to be single key) to array of keys
    }
    let numKeysFound = 0;
    for (const key of keys) {
        if (key in obj) {
            numKeysFound++;
            if (!requireAll && !restrictKeys) {
                return true;
            }
        }
        else if (requireAll) { // and a key is not found
            return false;
        }
    }
    if (restrictKeys) {
        // If restrictKeys is true, check that no other keys are present in the object
        const objKeys = Object.keys(obj);
        const extraKeys = objKeys.filter(k => !keys.includes(k));
        if (extraKeys.length > 0) {
            return false; // Found keys not in the allowed list
        }
    }
    return requireAll ? numKeysFound === keys.length : numKeysFound > 0;
}

/**
 * @param value `any`
 * @param requireNonEmpty `boolean` `default = true`
 * - `if` `true` then `value` must have at least 1 key
 * - `if` `false` then `value` is allowed to be an empty object
 * @param requireNonArray `boolean` `default = true`
 * - `if` `true` then `value` must not be an array
 * - `if` `false` then `value` is allowed to be an array
 * @returns **`isObject`** `boolean` `value is Record<string, any>`
 */
function isObject(value, requireNonEmpty = true, requireNonArray = true) {
    return (value && typeof value === 'object'
        && (requireNonArray ? !Array.isArray(value) : true)
        && (requireNonEmpty ? Object.keys(value).length > 0 : true)
    );
}

/**
 * @param {any} value
 * @return {value is RecordTypeEnum} 
 */
function isRecordTypeEnum(value) {
    return (isNonEmptyString(value) 
        && Object.values(RecordTypeEnum).includes(value)
    );
}
/**
 * `isidSearchOptions`
 * @param {any} value
 * @returns {value is idSearchOptions} 
 */
function isIdSearchOptions(value) {
    return Boolean(isObject(value)
        && hasKeys(value, 
            ['idProp', 'idValue', 'searchOperator'], 
            true, true
        )
        && isNonEmptyString(value.idProp) // && Object.values(idPropertyEnum).includes(idProp)
        && isNonEmptyString(value.searchOperator) // validate it's a SearchOperatorEnum
    )
}
/**
 * @param {any} value
 * @returns {value is RecordResponseOptions} 
 */
function isRecordResponseOptions(value) {
    return Boolean(isObject(value)
        && (!value.fields 
            || (isNonEmptyString(value.fields)
                || isEmptyArray(value.fields) 
                || isStringArray(value.fields)
            )
        )
        && (!value.sublists 
            || (isObject(value.sublists)
                && Object.keys(value.sublists).every(k=>
                    isNonEmptyString(value.sublists[k]) 
                    || isEmptyArray(value.sublists[k])
                    || isStringArray(value.sublists[k])
                )
            )
        )
    )
}

/**
 * @param {any} value 
 * @returns {value is FindSublistLineWithValueOptions} **`isFindSublistLineWithValueOptions`** `boolean`
 */
function isFindSublistLineWithValueOptions(value) {
    return (isObject(value)
        && hasKeys(value, ['sublistId', 'fieldId', 'value'], true, true)
        && isNonEmptyString(value.sublistId)
        && isNonEmptyString(value.fieldId)
    )
}

/**
 * @param {any} value 
 * @returns {value is SublistUpdateDictionary}
 */
function isSublistUpdateDictionary(value) {
    /**@type {SublistUpdateDictionary} */
    const candidate = value;
    return (isObject(candidate)
        && Object.keys(candidate).every(k=>isNonEmptyString(k)
            && isObject(candidate[k])
            && candidate[k].newValue !== undefined
            && isFindSublistLineWithValueOptions(candidate[k].lineIdOptions)
        )
    );
}

/**
 * @param {any} value 
 * @returns {value is SublistFieldValueUpdate} **`isSublistFieldValueUpdate`** `boolean`
 */
function isSublistFieldValueUpdate(value) {
    return (isObject(value)
        && hasKeys(value, ['newValue', 'lineIdOptions'], true, true)
        && isFindSublistLineWithValueOptions(value.lineIdOptions)
    );
}
/**
 * @param fileName `string`
 * @param func `Function | string` - function name or function itself (to get Function.name)
 * @param funcInfo `any` `(optional)` - context or params of func (converted to string)
 * @param startLine `number` `(optional)`
 * @param endLine `number` `(optional)`
 * @returns **`sourceString`** `string` to use in log statements or argumentValidation calls
 */
function getSourceString(fileName, func, funcInfo, startLine, endLine) {
    let lineNumberText = (isInteger(startLine)
        ? `:${startLine}`
        : '');
    lineNumberText = (isNonEmptyString(lineNumberText)
        && isInteger(endLine)
        ? lineNumberText + `-${endLine}`
        : '');
    let funcName = typeof func === 'string' ? func : func.name;
    return `[${fileName}.${funcName}(${funcInfo ?? ''})${lineNumberText}]`;
}

/*------------------------ [ Types, Enums, Constants ] ------------------------*/
/** create/load a record in standard mode by setting `isDynamic` = `false` = `NOT_DYNAMIC`*/
const NOT_DYNAMIC = false;

/**
 * values are fieldIds or sublistFieldIds where hasSubrecord() is true
 * @enum {string} **`SubrecordFieldEnum`**
 */
const SubrecordFieldEnum = {
/**from the `'addressbook'` `sublist` on Relationship records */
ADDRESS_BOOK_ADDRESS: 'addressbookaddress',
/**from the `'billingaddress'` body `field` on Transaction records */
BILLING_ADDRESS: 'billingaddress',
/**from the `'shippingaddress'` body `field` on Transaction records */
SHIPPING_ADDRESS: 'shippingaddress',
/**from the `'{internalid}'` {type} `field` on {recordType} records */
INVENTORY_DETAIL: 'inventorydetail'
}

/**Type: RecordRequest {@link RecordRequest} */
/**
 * @typedef {Object} RecordRequest
 * @property {RecordOptions | Array<RecordOptions>} recordOptions = {@link RecordOptions} | `Array<`{@link RecordOptions}`>`
 * - {@link RecordOptions} = `{ recordType: `{@link RecordTypeEnum}`, isDynamic?: boolean, idOptions?: `{@link idSearchOptions}`[], fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
 * @property {RecordResponseOptions} [responseOptions] = {@link RecordResponseOptions}
 */

/**Type: RecordResponse {@link RecordResponse} */
/**
 * @typedef {Object} RecordResponse
 * @property {string | number} status - Indicates status of the request.
 * @property {string} message - A message indicating the result of the request.
 * @property {RecordResult[]} results - an `Array<`{@link RecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {RecordOptions[] | any[]} rejects - an `Array<`{@link RecordOptions}`>` containing the record options that were not successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logs - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */


/**
 * @typedef {Object} RecordResponseOptions
 * @property {string | string[]} [fields] - `fieldId(s)` of the main record to return in the response.
 * @property {Record<string, string | string[]>} [sublists] `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response.
 */

/**
 * = `{ recordType: RecordTypeEnum, isDynamic?: boolean, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
 * @typedef {Object} RecordOptions
 * @property {RecordTypeEnum} recordType - The record type to post, see {@link RecordTypeEnum}
 * @property {boolean} [isDynamic=false] - Indicates if the record should be created/loaded in dynamic mode. (defaults to {@link NOT_DYNAMIC} = `false`)
 * @property {idSearchOptions[]} [idOptions] options to search for an existing record to upsert 
 * - = `Array<`{@link idSearchOptions}`>` 
 * - = `{ idProp`: {@link idPropertyEnum}, `searchOperator`: {@link RecordOperatorEnum}, `idValue`: string | number` }[]`
 * @property {FieldDictionary} [fields]
 * @property {SublistDictionary} [sublists]
 */

/**
 * @typedef {Object} RecordResult
 * @property {number} internalid
 * @property {string | RecordTypeEnum} recordType
 * @property {FieldDictionary} fields
 * @property {{[fieldId: string]: FieldValue | SubrecordValue}} sublists
 */


/** Type: **`idSearchOptions`** {@link idSearchOptions} */
/**
 * options to search for an existing record to upsert 
 * @typedef {Object} idSearchOptions
 * @property {idPropertyEnum} idProp - The property to search for. See {@link idPropertyEnum}
 * @property {RecordOperatorEnum} searchOperator - The operator to use for the search. See {@link RecordOperatorEnum}
 * @property {string | number | string[] | number[]} idValue - The value(s) of `idProp` to search for using `searchOperator`.
 */

/** Type: **`FieldDictionary`** {@link FieldDictionary} */
/**
 * body fields of a record.
 * @typedef {{
 * [fieldId: string]: FieldValue | SubrecordValue
 * }} FieldDictionary
 */

/** Type: **`SublistDictionary`** {@link SublistDictionary} */
/**
 * @typedef {{
 * [sublistId: string]: Array<SublistLine> | SublistUpdateDictionary
 * }} SublistDictionary
 */

/** Type: **`SublistLine`** {@link SublistLine} */
/**
 * \@confirmed `'id'` is a prop of record sublists. e.g. for the `addressbook` sublist, TFAE
 * - = `rec.getSublistValue({sublistId: 'addressbook', fieldId: 'addressid', line: 0})` (type = string)
 * - = `rec.getSublistValue({sublistId: 'addressbook', fieldId: 'internalid', line: 0})` (type = number)
 * - = `rec.getSublistValue({sublistId: 'addressbook', fieldId: 'id', line: 0})` (type = number)
 * - (returns the `'internalid'` of the addressbook entry.)
 * @typedef {{
 * [fieldId: string]: FieldValue | SubrecordValue
 * }} SublistLine
 */

/**
 * @typedef {{
 * [fieldId: string]: {
 * newValue: FieldValue | SubrecordValue
 * lineIdOptions: FindSublistLineWithValueOptions
 * }
 * }} SublistUpdateDictionary
 */

/**
 * @typedef {{
 * newValue: FieldValue;
 * lineIdOptions: FindSublistLineWithValueOptions;
 * }} SublistFieldValueUpdate
 */

/**
 * @typedef {{
 * sublistId: string;
 * fieldId: string;
 * value: FieldValue;
 * }} FindSublistLineWithValueOptions
 */

/**
 * @typedef {{
 * [subrecordFieldId: string]: FieldValue | SetFieldSubrecordOptions | SetSublistSubrecordOptions
 * }} SubrecordValue 
 * */


/** Type: **`SetFieldSubrecordOptions`** {@link SetFieldSubrecordOptions} */
/**
 * @typedef {Object} SetFieldSubrecordOptions
 * @property {string} fieldId The `'internalid'` of the main record field that is a subrecord.
 * -  use `rec.getSubrecord({fieldId})` = `getSubrecord(options: GetFieldOptions): Omit<Record, 'save'>`;
 * @property {FieldDictionary} [fields] {@link FieldDictionary}
 * @property {SublistDictionary} [sublists] {@link SublistDictionary}
 * @property {string} [subrecordType] - The record type of the subrecord.
 */

/** Type: **`SetSublistSubrecordOptions`** {@link SetSublistSubrecordOptions} */
/**
 * \@extends {@link SetFieldSubrecordOptions}
 * @typedef {Object} SetSublistSubrecordOptions
 * @property {string} sublistId
 * @property {string} fieldId (i.e. `sublistFieldId`) The `internalid` of a sublist's field that holds a subrecord
 * - use `rec.getSublistSubrecord({sublistId, fieldId})`
 * @property {FieldDictionary} [fields] {@link FieldDictionary}
 * @property {SublistDictionary} [sublists] {@link SublistDictionary}
 * @property {string} [subrecordType] - The record type of the subrecord.
 */

/** Type: **`FieldValue`** {@link FieldValue} */
/**
 * The value type must correspond to the field type being set. For example:
 * - **`Text`**, **`Radio`** and **`Select`** fields accept `string` values.
 * - **`Checkbox`** fields accept `Boolean` values.
 * - **`Date`** and **`DateTime`** fields accept `Date` values.
 * - **`Integer`**, **`Float`**, **`Currency`** and **`Percent`** fields accept `number` values.
 * @typedef {Date | number | number[] | string | string[] | boolean | null
 * } FieldValue 
 */

/** Type: **`SetFieldValueOptions`** {@link SetFieldValueOptions} */
/**
 * @typedef {Object} SetFieldValueOptions
 * @property {string} fieldId - The `internalid` of a standard or custom field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the field to. 
 * - = `{Date | number | number[] | string | string[] | boolean | null}`
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */


/** Type: **`SetSublistValueOptions`** {@link SetSublistValueOptions} */
/**
 * - \@extends {@link SetFieldValueOptions}
 * @typedef {Object} SetSublistValueOptions
 * @property {string} sublistId - The `internalid` of the sublist.
 * @property {string} fieldId - The `internalid` of a standard or custom sublist field.
 * @property {number} [line] - The line number for the field. (i.e. index of the sublist row) (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the sublist field to.
 * - = `{Date | number | number[] | string | string[] | boolean | null}`
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */

/** Type: **`LogStatement`** {@link LogStatement} */
/**
 * @typedef {Object} LogStatement
 * @property {string} timestamp - The timestamp of the log entry.
 * @property {LogTypeEnum} type - The type of log entry (see {@link LogTypeEnum}).
 * @property {string} title - The title of the log entry.
 * @property {any} details - The details of the log entry.
 * @property {string} [message] - The message of the log entry = concatenated string of details's contents (if details is an array).
 * @description typedef for elements of the {@link logArray} array
 */



/** Type: **`SearchColumn`** {@link SearchColumn} */
/**
 * - `name` = Name of a search column as a string.
 * - `join` = Join id for the search column as a string.
 * @typedef {Object} SearchColumn
 * @property {function(SearchColumnSetWhenOrderedByOptions): SearchColumn} [setWhenOrderedBy]
 * @property {string} name - Name of a search column as a string.
 * @property {string} [join] - Join id for the search column as a string.
 * @property {ColumnSummaryEnum} [summary] - Returns the summary type for a search column see {@link ColumnSummaryEnum}.
 * @property {string} [formula] - Formula used for a search column as a string. To set this value, you must use formulatext, formulanumeric, formuladatetime, formulapercent, or formulacurrency.
 * @property {string} [label] - Label used for the search column. You can only get or set custom labels with this property
 * @property {string} [function] - Special function applied to values in a search column. See Help for Supported Functions.
 * @property {SearchSortEnum} [sort] - The sort order of the column.
 * @property {function(): string} toString
 */

/** Type: **`SearchResult`** {@link SearchResult} */
/**
 * @typedef {Object} SearchResult
 * @property {function(SearchColumn | string): (boolean | string | string[])} getValue
 * - `Result.getValue(SearchColumn)` Used on formula and non-formula (standard) fields. Returns the string value of a specified search result column. For convenience, this method takes a single search.Column Object.
 * - {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_46917053222.html}
 * - `Result.getValue(options)` Used on formula fields and non-formula (standard) fields to get the value of a specified search return column.
 * - {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_46917053222.html}
 * @property {function(SearchColumn | string): string} getText 
 * - `SearchResult.getText(SearchColumn)` The text value for a search.Column if it is a stored select field.
 * @property {function(): Record<string, boolean | string | LookupValueObject[]>} getAllValues
 * @property {function(): { recordType?: string, id?: string, values: Record<string, string | boolean> }} toJSON
 * @property {RecordTypeEnum | string} recordType - The type of record returned in a search result row.
 * @property {string} id - The internal ID for the record returned in a search result row.
 * @property {SearchColumn[]} columns
 * - `Array<`{@link SearchColumn}`>` objects that encapsulate the columns returned in the search result row.
 */

/**@typedef {{ value: string, text: string }} LookupValueObject */
/** Type: **`SearchColumnSetWhenOrderedByOptions`** {@link SearchColumnSetWhenOrderedByOptions} */
/**
 * - `name` = The name of the search column for which the minimal or maximal value should be found.
 * - `join` = The join id for the search column. 
 * @typedef {{ 
 * name: string, 
 * join: string 
 * }} SearchColumnSetWhenOrderedByOptions 
 * */

/** Type: **`SearchResultSetGetRangeOptions`** {@link SearchResultSetGetRangeOptions} */
/**
 * @typedef {Object} SearchResultSetGetRangeOptions
 * @property {number} start
 * @property {number} end
 */

/** Type: **`SearchResultSetGetRangeFunction`** {@link SearchResultSetGetRangeFunction} */
/**
 * @typedef {Object} SearchResultSetGetRangeFunction
 * @property {function(SearchResultSetGetRangeOptions): Promise<SearchResult[]>} promise
 * @property {function(SearchResultSetGetRangeOptions): SearchResult[]} [sync]
 */

/** Type: **`SearchResultSetEachFunction`** {@link SearchResultSetEachFunction} */
/**
 * @typedef {Object} SearchResultSetEachFunction
 * @property {function(function(SearchResult): boolean): Promise<boolean>} promise
 * @property {function(function(SearchResult): boolean): void} [sync]
 */

/** Type: **`ResultSet`** {@link ResultSet} */
/**
 * @typedef {Object} ResultSet
 * @property {SearchResultSetEachFunction} each 
 * - `ResultSet.each(callback)`: Use a developer-defined function to invoke on each row in the search results, up to 4000 results at a time.
 * - `ResultSet.each.promise(callback)`
 * @property {SearchResultSetGetRangeFunction} getRange 
 * - `ResultSet.getRange(options)`: Retrieve a slice of the search result as an `Array<`{@link SearchResult}`>`
 * - `ResultSet.getRange.promise(options)`
 * @property {SearchColumn[]} columns - An `Array<`{@link SearchColumn}`>` objects that represent the columns returned in the search results.
 */

/**
 * @enum {string} **`idPropertyEnum`**
 * @property {string} INTERNAL_ID - `'internalid'` (for all records).
 * @property {string} EXTERNAL_ID - `'externalid'` (for all records).
 * @property {string} ENTITY_ID - `'entityid'` (for relationship records)
 * @property {string} ITEM_ID - `'itemid'` (for inventory records)
 * @property {string} TRANSACTION_ID - `'tranid'` (for transaction records)
 * @readonly
 */
const idPropertyEnum = {
    /**`'internalid'` */
    INTERNAL_ID: 'internalid',
    /**`'externalid'` */
    EXTERNAL_ID: 'externalid',
    /**`'entityid'` (for relationship records) */
    ENTITY_ID: 'entityid',
    /**`'itemid'` (for inventory records) */
    ITEM_ID: 'itemid',
    /** `'tranid'` (for transaction records) */
    TRANSACTION_ID: 'tranid',
};

/**
 * @enum {string} **`ColumnSummaryEnum`**
 */
const ColumnSummaryEnum = {
    GROUP: 'group',
    COUNT: 'count',
    SUM: 'sum',
    AVG: 'avg',
    MIN: 'min',
    MAX: 'max',
}

/**
 * @enum {string} **`SearchSortEnum`**
 */
const SearchSortEnum = {
    ASC: 'asc',
    DESC: 'desc',
    NONE: 'none',
}

/**
 * @enum {string} **`DateOperatorEnum`**
 */
const DateOperatorEnum = {
    AFTER: 'after',
    NOT_AFTER: 'notafter',
    BEFORE: 'before',
    NOT_BEFORE: 'notbefore',
    IS_EMPTY: 'isempty',
    IS_NOT_EMPTY: 'isnotempty',
    ON: 'on',
    NOT_ON: 'noton',
    ON_OR_AFTER: 'onorafter',
    NOT_ON_OR_AFTER: 'notonorafter',
    ON_OR_BEFORE: 'onorbefore',
    NOT_ON_OR_BEFORE: 'notonorbefore',
    WITHIN: 'within',
    NOT_WITHIN: 'notwithin',
};

/**
 * @description operators for fields with the following input types:  
 * - `Currency`
 * - `Decimal`
 * - `Time of Day`
 * @enum {string} **`NumericOperatorEnum`**
 */
const NumericOperatorEnum = {
    ANY: 'any',
    BETWEEN: 'between',
    NOT_BETWEEN: 'notbetween',
    EQUAL_TO: 'equalto',
    NOT_EQUAL_TO: 'notequalto',
    GREATER_THAN: 'greaterthan',
    NOT_GREATER_THAN: 'notgreaterthan',
    GREATER_THAN_OR_EQUAL_TO: 'greaterthanorequalto',
    NOT_GREATER_THAN_OR_EQUAL_TO: 'notgreaterthanorequalto',
    LESS_THAN: 'lessthan',
    NOT_LESS_THAN: 'notlessthan',
    LESS_THAN_OR_EQUAL_TO: 'lessthanorequalto',
    NOT_LESS_THAN_OR_EQUAL_TO: 'notlessthanorequalto',
    IS_EMPTY: 'isempty',
    IS_NOT_EMPTY: 'isnotempty',
}

/**
 * @description operators for fields with the following input types: 
 * - `Email Address`
 * - `Free-Form Text`
 * - `Long Text`
 * - `Password`
 * - `Percent`
 * - `Phone Number`
 * - `Rich Text`
 * - `Text Area`
 * @enum {string} **`TextOperatorEnum`**
 */
const TextOperatorEnum = {
    ANY: 'any',
    CONTAINS: 'contains',
    DOES_NOT_CONTAIN: 'doesnotcontain',
    HAS_KEYWORDS: 'haskeywords',
    IS: 'is',
    IS_NOT: 'isnot',
    IS_EMPTY: 'isempty',
    IS_NOT_EMPTY: 'isnotempty',
    STARTS_WITH: 'startswith',
    DOES_NOT_START_WITH: 'doesnotstartwith',
}
/**
 * @description operators for fields with the following input types: 
 * - `Multi Select`
 * @enum {string} **`MultiSelectOperatorEnum`**
 */
const MultiSelectOperatorEnum = {
    ALL_OF: 'allof',
    NOT_ALL_OF: 'notallof',
    ANY_OF: 'anyof',
    NONE_OF: 'noneof',
}

/**
 * @enum {string} **`RecordOperatorEnum`**
 * @description operators for fields with the following input types: 
 * - `List, Record`
 * @reference https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0304061100.html#subsect_161114820748:~:text=id%3A%20%27customsearch_my_so_search%27%0A%20%20%20%20%20%20%20%20%7D)%3B%0A%20%20%20%20%7D%0A%0A%20%20%20%20deleteSearch()%3B%0A%7D)%3B-,Search%20Using%20a%20Specific%20Record%20Field,-The%20following%20sample
 */
const RecordOperatorEnum = {
    ANY_OF: 'anyof',
    NONE_OF: 'noneof',
}

/**
 * @typedef {Object} SearchOperatorEnum
 * @property {typeof RecordOperatorEnum} RECORD - Operators for record fields. use for 'internalid'
 * @property {typeof DateOperatorEnum} DATE - Operators for date fields.
 * @property {typeof NumericOperatorEnum} NUMERIC - Operators for numeric fields.
 * @property {typeof TextOperatorEnum} TEXT - Operators for text fields.
 * @property {typeof MultiSelectOperatorEnum} MULTI_SELECT - Operators for multi-select fields.
 */

/** 
 * @type {SearchOperatorEnum}
 * @description Composite of all operator enums.
 * @property {typeof RecordOperatorEnum} RECORD - **{@link RecordOperatorEnum}** Operators for record fields. use for 'internalid'
 * @property {typeof DateOperatorEnum} DATE - **{@link DateOperatorEnum}** for date fields.
 * @property {typeof NumericOperatorEnum} NUMERIC - **{@link NumericOperatorEnum}** for numeric fields.
 * @property {typeof TextOperatorEnum} TEXT - **{@link TextOperatorEnum}** for text fields.
 * @property {typeof MultiSelectOperatorEnum} MULTI_SELECT - **{@link MultiSelectOperatorEnum}** for multi-select fields.
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4094344956.html}
 */
const SearchOperatorEnum = {
    RECORD: RecordOperatorEnum,
    DATE: DateOperatorEnum,
    NUMERIC: NumericOperatorEnum,
    TEXT: TextOperatorEnum,
    MULTI_SELECT: MultiSelectOperatorEnum
};

/** 
 * @note not used in implementation yet
 * @enum {string} **`FieldInputTypeEnum`**
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html}
 * */
const FieldInputTypeEnum = {
    /** `Text` fields accept `string` values. */
    TEXT: 'text',
    /** `Radio` fields accept `string` values. */
    RADIO: 'radio',
    /** `Select` fields accept `string` and `number` values. */
    SELECT: 'select',
    /** `Multi-Select` fields accept `arrays` of `string` or `number` values. */
    MULTISELECT: 'multiselect',
    /** `Checkbox` fields accept `boolean` values. */
    CHECKBOX: 'checkbox',
    /** `Date` and `DateTime` fields accept {@link Date} values. */
    DATE: 'date',
    /** `Integer` fields accept `number` values. */
    INTEGER: 'integer',
    /** `Float` fields accept `number` values. */
    FLOAT: 'float',
    /** `Currency` fields accept `number` values. */
    CURRENCY: 'currency',
    /** `Percent` fields accept `number` values. */
    PERCENT: 'percent',
    /** `Inline HTML` fields accept `strings`. Strings containing HTML tags are represented as HTML entities in UI. {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html#:~:text=The%20following%20code%20sample%20shows%20the%20syntax%20for%20INLINEHTML%20fields%20and%20what%20is%20returned.} */
    INLINE_HTML: 'inlinehtml',
}

/**
 * @enum {string} **`RecordTypeEnum`**
 * @readonly
 * @description supported NetSuite API record types As of 4 June 2024
 */
const RecordTypeEnum = {
    ACCOUNT: 'account',
    ACCOUNTING_BOOK: 'accountingbook',
    ACCOUNTING_CONTEXT: 'accountingcontext',
    ACCOUNTING_PERIOD: 'accountingperiod',
    ADV_INTER_COMPANY_JOURNAL_ENTRY: 'advintercompanyjournalentry',
    ALLOCATION_SCHEDULE: 'allocationschedule',
    AMORTIZATION_SCHEDULE: 'amortizationschedule',
    AMORTIZATION_TEMPLATE: 'amortizationtemplate',
    ASSEMBLY_BUILD: 'assemblybuild',
    ASSEMBLY_ITEM: 'assemblyitem',
    ASSEMBLY_UNBUILD: 'assemblyunbuild',
    AUTOMATED_CLEARING_HOUSE: 'automatedclearinghouse',
    BALANCE_TRX_BY_SEGMENTS: 'balancetrxbysegments',
    BILLING_ACCOUNT: 'billingaccount',
    BILLING_CLASS: 'billingclass',
    BILLING_RATE_CARD: 'billingratecard',
    BILLING_REVENUE_EVENT: 'billingrevenueevent',
    BILLING_SCHEDULE: 'billingschedule',
    BIN: 'bin',
    BIN_TRANSFER: 'bintransfer',
    BIN_WORKSHEET: 'binworksheet',
    BLANKET_PURCHASE_ORDER: 'blanketpurchaseorder',
    BOM: 'bom',
    BOM_REVISION: 'bomrevision',
    BONUS: 'bonus',
    BONUS_TYPE: 'bonustype',
    BUDGET_EXCHANGE_RATE: 'budgetexchangerate',
    BULK_OWNERSHIP_TRANSFER: 'bulkownershiptransfer',
    BUNDLE_INSTALLATION_SCRIPT: 'bundleinstallationscript',
    CALENDAR_EVENT: 'calendarevent',
    CAMPAIGN: 'campaign',
    CAMPAIGN_RESPONSE: 'campaignresponse',
    CAMPAIGN_TEMPLATE: 'campaigntemplate',
    CARDHOLDER_AUTHENTICATION: 'cardholderauthentication',
    CASH_REFUND: 'cashrefund',
    CASH_SALE: 'cashsale',
    CHARGE: 'charge',
    CHARGE_RULE: 'chargerule',
    CHECK: 'check',
    CLASSIFICATION: 'classification',
    CLIENT_SCRIPT: 'clientscript',
    CMS_CONTENT: 'cmscontent',
    CMS_CONTENT_TYPE: 'cmscontenttype',
    CMS_PAGE: 'cmspage',
    COMMERCE_CATEGORY: 'commercecategory',
    COMPETITOR: 'competitor',
    CONSOLIDATED_EXCHANGE_RATE: 'consolidatedexchangerate',
    CONTACT: 'contact',
    CONTACT_CATEGORY: 'contactcategory',
    CONTACT_ROLE: 'contactrole',
    COST_CATEGORY: 'costcategory',
    COUPON_CODE: 'couponcode',
    CREDIT_CARD_CHARGE: 'creditcardcharge',
    CREDIT_CARD_REFUND: 'creditcardrefund',
    CREDIT_MEMO: 'creditmemo',
    CURRENCY: 'currency',
    CUSTOMER: 'customer',
    CUSTOMER_CATEGORY: 'customercategory',
    CUSTOMER_DEPOSIT: 'customerdeposit',
    CUSTOMER_MESSAGE: 'customermessage',
    CUSTOMER_PAYMENT: 'customerpayment',
    CUSTOMER_PAYMENT_AUTHORIZATION: 'customerpaymentauthorization',
    CUSTOMER_REFUND: 'customerrefund',
    CUSTOMER_STATUS: 'customerstatus',
    CUSTOMER_SUBSIDIARY_RELATIONSHIP: 'customersubsidiaryrelationship',
    CUSTOM_PURCHASE: 'custompurchase',
    CUSTOM_RECORD: 'customrecord',
    CUSTOM_SALE: 'customsale',
    CUSTOM_TRANSACTION: 'customtransaction',
    DEPARTMENT: 'department',
    DEPOSIT: 'deposit',
    DEPOSIT_APPLICATION: 'depositapplication',
    DESCRIPTION_ITEM: 'descriptionitem',
    DISCOUNT_ITEM: 'discountitem',
    DOWNLOAD_ITEM: 'downloaditem',
    EMAIL_TEMPLATE: 'emailtemplate',
    EMPLOYEE: 'employee',
    EMPLOYEE_CHANGE_REQUEST: 'employeechangerequest',
    EMPLOYEE_CHANGE_REQUEST_TYPE: 'employeechangerequesttype',
    EMPLOYEE_EXPENSE_SOURCE_TYPE: 'employeeexpensesourcetype',
    EMPLOYEE_STATUS: 'employeestatus',
    EMPLOYEE_TYPE: 'employeetype',
    ENTITY_ACCOUNT_MAPPING: 'entityaccountmapping',
    ESTIMATE: 'estimate',
    EXPENSE_AMORTIZATION_EVENT: 'expenseamortizationevent',
    EXPENSE_CATEGORY: 'expensecategory',
    EXPENSE_PLAN: 'expenseplan',
    EXPENSE_REPORT: 'expensereport',
    EXPENSE_REPORT_POLICY: 'expensereportpolicy',
    FAIR_VALUE_PRICE: 'fairvalueprice',
    FINANCIAL_INSTITUTION: 'financialinstitution',
    FIXED_AMOUNT_PROJECT_REVENUE_RULE: 'fixedamountprojectrevenuerule',
    FOLDER: 'folder',
    FORMAT_PROFILE: 'formatprofile',
    FULFILLMENT_REQUEST: 'fulfillmentrequest',
    GENERAL_TOKEN: 'generaltoken',
    GENERIC_RESOURCE: 'genericresource',
    GIFT_CERTIFICATE: 'giftcertificate',
    GIFT_CERTIFICATE_ITEM: 'giftcertificateitem',
    GL_NUMBERING_SEQUENCE: 'glnumberingsequence',
    GLOBAL_ACCOUNT_MAPPING: 'globalaccountmapping',
    GLOBAL_INVENTORY_RELATIONSHIP: 'globalinventoryrelationship',
    GOAL: 'goal',
    IMPORTED_EMPLOYEE_EXPENSE: 'importedemployeeexpense',
    INBOUND_SHIPMENT: 'inboundshipment',
    INTERCOMP_ALLOCATION_SCHEDULE: 'intercompallocationschedule',
    INTER_COMPANY_JOURNAL_ENTRY: 'intercompanyjournalentry',
    INTER_COMPANY_TRANSFER_ORDER: 'intercompanytransferorder',
    INVENTORY_ADJUSTMENT: 'inventoryadjustment',
    INVENTORY_COST_REVALUATION: 'inventorycostrevaluation',
    INVENTORY_COUNT: 'inventorycount',
    INVENTORY_DETAIL: 'inventorydetail',
    INVENTORY_ITEM: 'inventoryitem',
    INVENTORY_NUMBER: 'inventorynumber',
    INVENTORY_STATUS: 'inventorystatus',
    INVENTORY_STATUS_CHANGE: 'inventorystatuschange',
    INVENTORY_TRANSFER: 'inventorytransfer',
    INVENTORY_WORKSHEET: 'inventoryworksheet',
    INVOICE: 'invoice',
    INVOICE_GROUP: 'invoicegroup',
    ISSUE: 'issue',
    ISSUE_PRODUCT: 'issueproduct',
    ISSUE_PRODUCT_VERSION: 'issueproductversion',
    ITEM_ACCOUNT_MAPPING: 'itemaccountmapping',
    ITEM_COLLECTION: 'itemcollection',
    ITEM_COLLECTION_ITEM_MAP: 'itemcollectionitemmap',
    ITEM_DEMAND_PLAN: 'itemdemandplan',
    ITEM_FULFILLMENT: 'itemfulfillment',
    ITEM_GROUP: 'itemgroup',
    ITEM_LOCATION_CONFIGURATION: 'itemlocationconfiguration',
    ITEM_PROCESS_FAMILY: 'itemprocessfamily',
    ITEM_PROCESS_GROUP: 'itemprocessgroup',
    ITEM_RECEIPT: 'itemreceipt',
    ITEM_REVISION: 'itemrevision',
    ITEM_SUPPLY_PLAN: 'itemsupplyplan',
    JOB: 'job',
    JOB_STATUS: 'jobstatus',
    JOB_TYPE: 'jobtype',
    JOURNAL_ENTRY: 'journalentry',
    KIT_ITEM: 'kititem',
    LABOR_BASED_PROJECT_REVENUE_RULE: 'laborbasedprojectrevenuerule',
    LEAD: 'lead',
    LOCATION: 'location',
    LOT_NUMBERED_ASSEMBLY_ITEM: 'lotnumberedassemblyitem',
    LOT_NUMBERED_INVENTORY_ITEM: 'lotnumberedinventoryitem',
    MANUFACTURING_COST_TEMPLATE: 'manufacturingcosttemplate',
    MANUFACTURING_OPERATION_TASK: 'manufacturingoperationtask',
    MANUFACTURING_ROUTING: 'manufacturingrouting',
    MAP_REDUCE_SCRIPT: 'mapreducescript',
    MARKUP_ITEM: 'markupitem',
    MASSUPDATE_SCRIPT: 'massupdatescript',
    MEM_DOC: 'memdoc',
    MERCHANDISE_HIERARCHY_LEVEL: 'merchandisehierarchylevel',
    MERCHANDISE_HIERARCHY_NODE: 'merchandisehierarchynode',
    MERCHANDISE_HIERARCHY_VERSION: 'merchandisehierarchyversion',
    MESSAGE: 'message',
    MFG_PLANNED_TIME: 'mfgplannedtime',
    NEXUS: 'nexus',
    NON_INVENTORY_ITEM: 'noninventoryitem',
    NOTE: 'note',
    NOTE_TYPE: 'notetype',
    OPPORTUNITY: 'opportunity',
    ORDER_RESERVATION: 'orderreservation',
    ORDER_SCHEDULE: 'orderschedule',
    ORDER_TYPE: 'ordertype',
    OTHER_CHARGE_ITEM: 'otherchargeitem',
    OTHER_NAME: 'othername',
    OTHER_NAME_CATEGORY: 'othernamecategory',
    PARTNER: 'partner',
    PARTNER_CATEGORY: 'partnercategory',
    PAYCHECK: 'paycheck',
    PAYCHECK_JOURNAL: 'paycheckjournal',
    PAYMENT_CARD: 'paymentcard',
    PAYMENT_CARD_TOKEN: 'paymentcardtoken',
    PAYMENT_ITEM: 'paymentitem',
    PAYMENT_METHOD: 'paymentmethod',
    PAYROLL_ITEM: 'payrollitem',
    PCT_COMPLETE_PROJECT_REVENUE_RULE: 'pctcompleteprojectrevenuerule',
    PERFORMANCE_METRIC: 'performancemetric',
    PERFORMANCE_REVIEW: 'performancereview',
    PERFORMANCE_REVIEW_SCHEDULE: 'performancereviewschedule',
    PERIOD_END_JOURNAL: 'periodendjournal',
    PHONE_CALL: 'phonecall',
    PICK_STRATEGY: 'pickstrategy',
    PICK_TASK: 'picktask',
    PLANNED_ORDER: 'plannedorder',
    PLANNING_ITEM_CATEGORY: 'planningitemcategory',
    PLANNING_ITEM_GROUP: 'planningitemgroup',
    PLANNING_RULE_GROUP: 'planningrulegroup',
    PLANNING_VIEW: 'planningview',
    PORTLET: 'portlet',
    PRICE_BOOK: 'pricebook',
    PRICE_LEVEL: 'pricelevel',
    PRICE_PLAN: 'priceplan',
    PRICING_GROUP: 'pricinggroup',
    PROJECT_EXPENSE_TYPE: 'projectexpensetype',
    PROJECT_IC_CHARGE_REQUEST: 'projecticchargerequest',
    PROJECT_TASK: 'projecttask',
    PROJECT_TEMPLATE: 'projecttemplate',
    PROMOTION_CODE: 'promotioncode',
    PROSPECT: 'prospect',
    PURCHASE_CONTRACT: 'purchasecontract',
    PURCHASE_ORDER: 'purchaseorder',
    PURCHASE_REQUISITION: 'purchaserequisition',
    REALLOCATE_ITEM: 'reallocateitem',
    RECEIVE_INBOUND_SHIPMENT: 'receiveinboundshipment',
    RESOURCE_ALLOCATION: 'resourceallocation',
    RESTLET: 'restlet',
    RETURN_AUTHORIZATION: 'returnauthorization',
    REVENUE_ARRANGEMENT: 'revenuearrangement',
    REVENUE_COMMITMENT: 'revenuecommitment',
    REVENUE_COMMITMENT_REVERSAL: 'revenuecommitmentreversal',
    REVENUE_PLAN: 'revenueplan',
    REV_REC_FIELD_MAPPING: 'revrecfieldmapping',
    REV_REC_SCHEDULE: 'revrecschedule',
    REV_REC_TEMPLATE: 'revrectemplate',
    SALES_CHANNEL: 'saleschannel',
    SALES_ORDER: 'salesorder',
    SALES_ROLE: 'salesrole',
    SALES_TAX_ITEM: 'salestaxitem',
    SCHEDULED_SCRIPT: 'scheduledscript',
    SCHEDULED_SCRIPT_INSTANCE: 'scheduledscriptinstance',
    SCRIPT_DEPLOYMENT: 'scriptdeployment',
    SERIALIZED_ASSEMBLY_ITEM: 'serializedassemblyitem',
    SERIALIZED_INVENTORY_ITEM: 'serializedinventoryitem',
    SERVICE_ITEM: 'serviceitem',
    SHIP_ITEM: 'shipitem',
    SOLUTION: 'solution',
    STATISTICAL_JOURNAL_ENTRY: 'statisticaljournalentry',
    STORE_PICKUP_FULFILLMENT: 'storepickupfulfillment',
    SUBSCRIPTION: 'subscription',
    SUBSCRIPTION_CHANGE_ORDER: 'subscriptionchangeorder',
    SUBSCRIPTION_LINE: 'subscriptionline',
    SUBSCRIPTION_PLAN: 'subscriptionplan',
    SUBSCRIPTION_TERM: 'subscriptionterm',
    SUBSIDIARY: 'subsidiary',
    SUBSIDIARY_SETTINGS: 'subsidiarysettings',
    SUBTOTAL_ITEM: 'subtotalitem',
    SUITELET: 'suitelet',
    SUPPLY_CHAIN_SNAPSHOT: 'supplychainsnapshot',
    SUPPLY_CHAIN_SNAPSHOT_SIMULATION: 'supplychainsnapshotsimulation',
    SUPPLY_CHANGE_ORDER: 'supplychangeorder',
    SUPPLY_PLAN_DEFINITION: 'supplyplandefinition',
    SUPPORT_CASE: 'supportcase',
    TASK: 'task',
    TAX_ACCT: 'taxacct',
    TAX_GROUP: 'taxgroup',
    TAX_PERIOD: 'taxperiod',
    TAX_TYPE: 'taxtype',
    TERM: 'term',
    TIME_BILL: 'timebill',
    TIME_ENTRY: 'timeentry',
    TIME_OFF_CHANGE: 'timeoffchange',
    TIME_OFF_PLAN: 'timeoffplan',
    TIME_OFF_REQUEST: 'timeoffrequest',
    TIME_OFF_RULE: 'timeoffrule',
    TIME_OFF_TYPE: 'timeofftype',
    TIME_SHEET: 'timesheet',
    TOPIC: 'topic',
    TRANSFER_ORDER: 'transferorder',
    UNITS_TYPE: 'unitstype',
    UNLOCKED_TIME_PERIOD: 'unlockedtimeperiod',
    USAGE: 'usage',
    USEREVENT_SCRIPT: 'usereventscript',
    VENDOR: 'vendor',
    VENDOR_BILL: 'vendorbill',
    VENDOR_CATEGORY: 'vendorcategory',
    VENDOR_CREDIT: 'vendorcredit',
    VENDOR_PAYMENT: 'vendorpayment',
    VENDOR_PREPAYMENT: 'vendorprepayment',
    VENDOR_PREPAYMENT_APPLICATION: 'vendorprepaymentapplication',
    VENDOR_RETURN_AUTHORIZATION: 'vendorreturnauthorization',
    VENDOR_SUBSIDIARY_RELATIONSHIP: 'vendorsubsidiaryrelationship',
    WAVE: 'wave',
    WBS: 'wbs',
    WEBSITE: 'website',
    WORKFLOW_ACTION_SCRIPT: 'workflowactionscript',
    WORK_ORDER: 'workorder',
    WORK_ORDER_CLOSE: 'workorderclose',
    WORK_ORDER_COMPLETION: 'workordercompletion',
    WORK_ORDER_ISSUE: 'workorderissue',
    WORKPLACE: 'workplace',
    ZONE: 'zone'
};
    return { put };
});