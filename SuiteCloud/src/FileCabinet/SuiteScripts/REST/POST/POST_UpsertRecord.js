/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName POST_UpsertRecord
 * @PROD_ScriptId NOT_DEPLOYED
 * @PROD_DeployId NOT_DEPLOYED
 * @SB_ScriptId 174
 * @SB_DeployId 1
 */

/**
 * @consideration (for SetSublistValue and/or SetSublistSubrecord) 
 * - could make a prop called "lineIdProp" so user can use a 
 * `sublistFieldId` and parameterized value + operator to edit sublist lines 
 * instead of relying just on the `line` or `id` property
 * @consideration could  make the `value` property of {@link SetFieldValueOptions} also accept SetFieldSubrecordOptions, 
 * but I'm hesitant to mix together then untangle that logic. (and for SetSublistValueOptions) 
 * - or rather, typeof `value` is currently FieldValue, but I could also allow for it to be typeof { fields: FieldDictionary, sublists: SublistDictionary }
 * @consideration make an enum for subrecord fieldIds so don't have to use less robust isSubrecordValue()
 * @consideration make an enum for sublistIds (of non static sublists) {@link https://stoic.software/articles/types-of-sublists/#:~:text=Lastly%2C%20the-,Static%20List,-sublists%20are%20read} 
 */
define(['N/record', 'N/log', 'N/search'], (record, log, search) => {
    /**
     * @type {LogStatement[]} - `Array<`{@link LogStatement}`>` = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
     * @see {@link writeLog}`(type, title, ...details)`
     * @description return logArray in response so can process in client
     * */
    const logArray = [];

    
    /**
     * @param {PostRecordRequest} reqBody {@link PostRecordRequest} 
     * - = `{ postOptions: `{@link PostRecordOptions}` | Array<`{@link PostRecordOptions}`>, responseOptions: `{@link PostResponseOptions}` }`
     * @returns {PostRecordResponse} **`response`** {@link PostRecordResponse} = `{ success: boolean, message: string, results?: `{@link PostRecordResult}`[], rejects?: `{@link PostRecordOptions}`[], error?: string, logArray: `{@link LogStatement}`[] }`
     */
    const post = (reqBody) => {
        const { postOptions, responseOptions } = reqBody;
        if (!postOptions || !isNonEmptyArray(postOptions)) {
            writeLog(LogTypeEnum.ERROR, 'post() Invalid Request Parameter', 'non-empty postOptions is required');
            return { status: false, message: 'post() Invalid Request Parameter', error: 'non-empty postOptions is required', logArray };
        }
        if (!Array.isArray(postOptions)) {
            postOptions = [postOptions];
        }
        /**@type {PostRecordResult[]} */
        const results = [];
        /**@type {PostRecordOptions[]} */
        const rejects = [];
        writeLog(LogTypeEnum.AUDIT, `post() received valid postOptions of length: ${postOptions.length}`);
        try {
            for (let i = 0; i < postOptions.length; i++) {
                const options = postOptions[i];
                const result = processPostRecordOptions(options, responseOptions);
                if (!result) {
                    writeLog(LogTypeEnum.ERROR,
                        `post() Invalid PostRecordOptions at index ${i}:`,
                    )
                    rejects.push(options);
                    continue;
                }
                results.push(result);
            }
            
            writeLog(LogTypeEnum.AUDIT, `End of POST_UpsertRecord:`, 
                { 
                    numRecordsProcessed: results.length,
                    numRejects: rejects.length,
                    numErrorLogs: logArray.filter(log => log.type === LogTypeEnum.ERROR).length,
                },
            );
            /**@type {PostRecordResponse} */
            return {
                status: 200,
                message: 'POST_UpsertRecord completed, numRecordsProcessed:' + results.length,
                results: results,
                rejects: rejects,
                logArray: logArray,
            };
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, `Error in POST_UpsertRecord:`, { 
                numRecordsProcessed: results.length,
                numRejects: rejects.length,
                numErrorLogs: logArray.filter(log => log.type === LogTypeEnum.ERROR).length,
            }, JSON.stringify(e));
            /**@type {PostRecordResponse} */
            return {
                status: 500,
                message: 'Error in POST_UpsertRecord: upsert failed after processing ' + results.length + ` records.`,
                error: String(e),
                logArray: logArray,
                results: results,
                rejects: rejects
            }
        }
    }

    /**
     * @param {PostRecordOptions} options 
     * @param {PostResponseOptions} [responseOptions]
     * @returns {PostRecordResult | null} **`result`** {@link PostRecordResult} = `{ internalid: number, recordType: string | RecordTypeEnum, fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
     */
    function processPostRecordOptions(options, responseOptions) {
        if (!options || typeof options !== 'object') {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: processPostRecordOptions() Invalid Options:`, 
                `options must be an object of type PostRecordOptions`,
                `= { recordType: RecordTypeEnum, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
            );
            return null;
        }
        let { recordType, isDynamic, idOptions, fields, sublists } = options;
        recordType = validateRecordType(recordType);
        if (!recordType) {
            writeLog(LogTypeEnum.ERROR,
                `ERROR: processPostRecordOptions() Invalid Options:`,
                `options is Missing 'recordType' property`,
                `= { recordType: RecordTypeEnum, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
            );
            return null;
        }
        const missingFieldsAndSublists = (
            (!fields || typeof fields !== 'object') 
            && (!sublists || typeof sublists !== 'object')
        );
        if (missingFieldsAndSublists) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: processPostRecordOptions() Invalid Options`,
                `options is Missing 'fields' and 'sublists' property (must have at least one)`, 
                `options must be an object of type PostRecordOptions`,
                `= { recordType: RecordTypeEnum, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
            );
            return null;
        }
        /**@type {object | undefined} */
        let rec = undefined;
        isDynamic = typeof isDynamic !== 'boolean' ? NOT_DYNAMIC : isDynamic;
        const recId = searchForRecordById(recordType, idOptions, fields);
        let isExistingRecord = typeof recId === 'number' && recId > 0;
        if (isExistingRecord && fields && isNonEmptyArray(Object.keys(fields))) { 
            //remove idPropertyEnum values from keys of fields
            for (const idPropFieldId of Object.values(idPropertyEnum)) {
                if (fields[idPropFieldId]) { 
                    delete fields[idPropFieldId];
                }
            }
            rec = record.load({type: recordType, id: recId, isDynamic });
            writeLog(LogTypeEnum.DEBUG, 
                `Loading Existing ${recordType} record with internalid: '${recId}'`, 
            );
        } else {
            writeLog(LogTypeEnum.DEBUG, 
                `processPostRecordOptions() creating new '${recordType}' record`, 
                `processPostRecordOptions() No existing '${recordType}' record found.`,
                `-> Creating new '${recordType}' record...`
            );
            rec = record.create({type: recordType, isDynamic });
        }
        if (fields && isNonEmptyArray(Object.keys(fields))) {
            rec = processFieldDictionary(rec, recordType, fields);
        }
        if (sublists && isNonEmptyArray(Object.keys(sublists))) {
            rec = processSublistDictionary(rec, recordType, sublists);
        }
        /**@type {PostRecordResult} {@link PostRecordResult} */
        const result = {
            recordType,
            internalid: isExistingRecord ? recId : rec.save({ enableSourcing: true, ignoreMandatoryFields: true }),
        };
        if (responseOptions && responseOptions.responseFields) {
            result.fields = getResponseFields(rec, responseOptions.responseFields);
        }
        if (responseOptions && responseOptions.responseSublists) {
            result.sublists = getResponseSublists(rec, responseOptions.responseSublists);
        }
        return result;   
    }

    /**
     * @note does not yet handle searching for multiple records and returning their ids
     * @param {RecordTypeEnum | string} recordType 
     * @param {idSearchOptions[]} [idOptions] `Array<`{@link idSearchOptions}`>` = `{ idProp`: {@link idPropertyEnum}, `searchOperator`: {@link RecordOperatorEnum}, `idValue`: string | number` }[]`
     * @param {FieldDictionary} [fields] - `object` extract idProperty values from `fields` `if` `idOptions` not provided
     * @returns {number | null} **`recordId`** - the `'internalid'` of the record 
     * `if` found in the search, or `null` `if` no record was found.
     */
    function searchForRecordById(recordType, idOptions, fields) {
        if (!recordType || typeof recordType !== 'string' || (!idOptions && !fields)) {
            writeLog(LogTypeEnum.ERROR,
                `ERROR: searchForRecordById() Invalid Parameters:`,
                `recordType must be a valid RecordTypeEnum or string, and idOptions or fields (with idProps) must be provided`,
            );
            return null;
        }
        // if no idOptions provided, extract idProperty values from fields
        if (fields && (!idOptions || isEmptyArray(idOptions))) {
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
        if (!Array.isArray(idOptions) || isEmptyArray(idOptions)) { 
            return null;
        }
        let recordId = null;
        for (let i = 0; i < idOptions.length; i++) {
            const { idProp, searchOperator, idValue } = idOptions[i];
            if (!idProp || !searchOperator || !idValue) {
                writeLog(LogTypeEnum.ERROR,
                    `ERROR: searchForRecordById() Invalid idOptions element.`,
                    `Invalid idSearchOptions element at idOptions[${i}]`,
                )
                continue;
            }
            try {
                const recSearch = search.create({
                    type: recordType,
                    filters: [
                        [idProp, searchOperator, idValue],
                    ],
                });
                /** @type {ResultSet} */
                const resultSet = recSearch.run();
                /** @type {SearchResult[]} */
                const resultRange = resultSet.getRange({ start: 0, end: 10 });
                if (resultRange.length === 0) {
                    writeLog(LogTypeEnum.DEBUG,
                        `searchForRecordById() 0 records found for idSearchOption ${i+1}/${idOptions.length}`,
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
                    writeLog(LogTypeEnum.ERROR,
                        'WARNING: searchForRecordById() Multiple records found.',
                        `${resultRange.length} '${recordType}' records found with ${idProp}='${idValue}' and operator='${searchOperator}'`,
                        `tentatively storing id of first record found,'${recordId}' then continuing to next idOptions element`
                    );
                    recordId = resultRange[0].id;
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
        }
        return recordId ? Number(recordId) : null; // null if no record found
    }
    /**
     * 
     * @param {object} rec 
     * @param {RecordTypeEnum} recordType 
     * @param {string} fieldId 
     * @param {FieldValue} value
     * @returns {object} **`rec`** - the record object with field value set or unchanged if `originalValue === value`. 
     */
    function upsertFieldValue(rec, recordType, fieldId, value) {
        if (!rec || !recordType || !fieldId || typeof fieldId !== 'string') {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: upsertFieldValue() Invalid Parameters:`,
                `rec, recordType, fieldId, and value are required parameters`,
                `received { recordType: ${recordType}, fieldId: ${fieldId}, value: ${value} }`,
            );
            return rec;
        }
        /**@type {SetFieldValueOptions} */
        const setOptions = { fieldId, value };
        try {
            const originalValue = rec.getValue({ fieldId });
            if (originalValue === value) {
                return rec;
            }
            writeLog(LogTypeEnum.DEBUG, 
                `upsertFieldValue() attempting <${recordType}>rec.setValue();`,
                `<${recordType}>rec.setValue({ fieldId: '${fieldId}', value: '${value}' });`,
                `originalValue === newValue ? ${originalValue === value}`,
                `originalValue: '${originalValue}'`, 
                `     newValue: '${value}'`, 
            ); 
            rec.setValue(setOptions);
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: upsertFieldValue() Error setting value for fieldId '${fieldId}' on recordType '${recordType}':`,
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
        if (!rec || !recordType || !sublistId || !fieldId ) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: upsertSublistFieldValue() Invalid Parameters:`,
                `rec, recordType, sublistId, fieldId, and value are required parameters`,
                `received { recordType: ${recordType}, sublistId: ${sublistId}, fieldId: ${fieldId}, value: ${value} }`,
            );
            return rec;
        }
        /**@type {SetSublistValueOptions} */
        const setOptions = {sublistId, fieldId, value, line: lineIndex};
        try {
            const originalValue = rec.getSublistValue({ sublistId, fieldId, line: lineIndex });
            if (originalValue === value) {
                return rec;
            }
            writeLog(LogTypeEnum.DEBUG, 
                `upsertFieldValue() attempting <${recordType}>rec.setSublistValue();`,
                `<${recordType}>rec.setSublistValue({ sublistId: '${sublistId}', fieldId: '${fieldId}', value: '${value}', line: ${lineIndex} });`,
                `originalValue === newValue ? ${originalValue === value}`,
                `originalValue: '${originalValue}'`, 
                `     newValue: '${value}'`, 
            );
            rec.setSublistValue(setOptions); 
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: upsertSublistFieldValue() Error setting value for fieldId '${fieldId}' on sublistId '${sublistId}' of recordType '${recordType}':`,
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
        if (!rec || !recordType || !fields || isEmptyArray(Object.keys(fields))) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: processFieldDictionary() Invalid Parameters:`,
                `rec, recordType, and fields are required parameters`,
            );
            return rec;
        }
        for (const fieldId in fields) {
            const value = fields[fieldId];
            if (isSubrecord(value)){
                rec = processFieldSubrecordOptions(rec, recordType, value);
            } else {
                rec = upsertFieldValue(rec, recordType, fieldId, value);
            }
        }
        return rec;
    }

    /**
     * @param {object} rec 
     * @param {RecordTypeEnum | string} recordType 
     * @param {SublistDictionary} sublists 
     * @returns {object} **`rec`**
     */
    function processSublistDictionary(rec, recordType, sublists) {
        if (!rec || !recordType || !sublists || isEmptyArray(Object.keys(sublists))) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: processSublistDictionary() Invalid Parameters:`,
                `rec, recordType, and sublists are required parameters`,
            );
            return rec;
        }
        for (const sublistId in sublists) {
            if (!sublistId || !rec.getSublist({sublistId})) {
                writeLog(LogTypeEnum.ERROR, 
                    `ERROR: processSublistDictionary() Invalid sublistId:`,
                    `sublistId '${sublistId}' not found on record type '${recordType}'`
                );
                continue;
            }
            const sublistLines = sublists[sublistId];
            if (!sublistLines || isEmptyArray(sublistLines)) {
                continue;
            }
            for (let i = 0; i < sublistLines.length; i++) {
                /**@type {SublistLine} */
                const sublistLine = sublistLines[i];
                let { line, lineIdProp } = sublistLine;
                const remainingSublistFieldIds = Object.keys(sublistLine).filter(
                    key => key !== 'line' && key !== idPropertyEnum.INTERNAL_ID
                );
                let lineIndices = [];
                const wantToEditExistingLine = (
                    typeof line !== 'number' 
                    && lineIdProp !== undefined 
                    && sublistLine[lineIdProp] !== undefined
                );
                if (typeof line === 'number') { 
                    lineIndices.push(line); 
                } else if (wantToEditExistingLine) {
                    lineIndices.push(...getSublistLineIndexByFieldValue(
                        rec, 
                        sublistId, 
                        sublistLine[lineIdProp], 
                        lineIdProp || idPropertyEnum.INTERNAL_ID
                    ));
                } else if (typeof line !== 'number') {
                    lineIndices.push(i); 
                }
                if (lineIndices.length === 0) { 
                    // default to new line if no line specified or no existing lines found
                    lineIndices.push(rec.getLineCount({sublistId})); 
                }
                lineIndices = lineIndices.map(index => 
                    validateSublistLineIndex(rec, sublistId, index)
                );
                for (const lineIndex of lineIndices) {
                    for (const fieldId of remainingSublistFieldIds) {
                        const value = sublistLine[fieldId];
                        if (isSubrecord(value)) {
                            rec = processSublistSubrecordOptions(
                                rec, recordType, sublistId, fieldId, lineIndex, value
                            );
                            continue;
                        }
                        rec = upsertSublistFieldValue(
                            rec, recordType, sublistId, fieldId, lineIndex, value
                        );
                    }
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
        if (!rec || !parentRecordType || typeof parentSublistId !== 'string' || typeof parentFieldId !== 'string'
            || typeof lineIndex !== 'number' || !subrecordOptions || isEmptyArray(Object.keys(subrecordOptions))) {
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
        if (fields && isNonEmptyArray(Object.keys(fields))) {
            sublistSubrec = processFieldDictionary(sublistSubrec, subrecordType, fields);
        }
        if (sublists && isNonEmptyArray(Object.keys(sublists))) {
            sublistSubrec = processSublistDictionary(sublistSubrec, subrecordType, sublists);
        }
        return rec;
    }

    /**
     * @param {object} rec 
     * @param {RecordTypeEnum} parentRecordType 
     * @param {SetFieldSubrecordOptions} subrecordOptions 
     * @returns {object} **`rec`**
     */
    function processFieldSubrecordOptions(rec, parentRecordType, subrecordOptions) {
        if (!rec || !parentRecordType || !subrecordOptions || isEmptyArray(Object.keys(subrecordOptions))) {
            writeLog(LogTypeEnum.ERROR, 
                `ERROR: processFieldSubrecordOptions() Invalid Parameters:`,
                `rec, parentRecordType, and subrecordOptions are required parameters`,
            );
            return rec;
        }
        let { fieldId, fields, sublists, subrecordType } = subrecordOptions;
        if (!fieldId || typeof fieldId !== 'string') {
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
        if (fields && isNonEmptyArray(Object.keys(fields))) {
            subrec = processFieldDictionary(subrec, subrecordType, fields);
        }
        if (sublists && isNonEmptyArray(Object.keys(sublists))) {
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
        if (!rec || !responseFields) {
            writeLog(LogTypeEnum.ERROR, 
                'getResponseFields() Invalid parameters', 
                'rec and responseProps are required'
            );
            return {};
        }
        /**@type {FieldDictionary} */
        const fields = {};
        if (responseFields && typeof responseFields === 'string') {
            responseFields = [responseFields];
        }
        if (isNonEmptyArray(responseFields)) {
            for (let fieldId of responseFields) {
                fieldId = fieldId.toLowerCase();
                const fieldValue = rec.getValue({ fieldId });
                if (!fieldValue) {
                    continue;
                }
                fields[fieldId] = fieldValue;
            };
        } else {
            writeLog(LogTypeEnum.ERROR, 'Invalid responseProps', 
                `responseProps must be a string or an array of strings.`, 
                `received type: '${typeof responseFields}'`);
        }
        return fields;
    }
    /**
     * @param {object} rec 
     * @param {{[sublistId: string]: string | string[]}} responseSublists
     * @returns {SublistDictionary | {[sublistId: string]: SublistLine[]}} **`sublists`** = {@link SublistDictionary}
     */
    function getResponseSublists(rec, responseSublists) {
        if (!rec || !responseSublists || isEmptyArray(Object.keys(responseSublists))) {
            writeLog(LogTypeEnum.ERROR, 
                'getResponseSublists() Invalid parameters', 
                'rec and responseSublists are required'
            );
            return {};
        }
        /**@type {SublistDictionary | {[sublistId: string]: SublistLine[]}} */
        const sublists = {};    
        for (const sublistId in responseSublists) {
            if (!rec.getSublist({ sublistId })) {
                writeLog(LogTypeEnum.ERROR, 
                    `getResponseSublists() Invalid sublistId:`, 
                    `sublistId '${sublistId}' not found on record`
                );
                continue;
            }
            sublists[sublistId] = [];
            const lineCount = rec.getLineCount({ sublistId });
            if (lineCount === 0) {
                writeLog(LogTypeEnum.DEBUG, 
                    `getResponseSublists() No lines found for sublistId '${sublistId}'`, 
                );
                continue;
            }
            for (let i = 0; i < lineCount; i++) {
                /**@type {SublistLine} */
                const sublistLine = {
                    line: i,
                    internalid: rec.getSublistValue({ 
                        sublistId, fieldId: idPropertyEnum.INTERNAL_ID, line: i 
                    })
                };
                const responseFields = responseSublists[sublistId];
                if (typeof responseFields === 'string') {
                    responseFields = [responseFields];
                }
                
                for (const fieldId of responseFields) {
                    const fieldValue = rec.getSublistValue({ sublistId, fieldId, line: i });
                    if (fieldValue !== undefined && fieldValue !== null) {
                        sublistLine[fieldId] = fieldValue;
                    }
                }
                
                sublists[sublistId].push(sublistLine);
            }
        }
        return sublists;
    }

/*---------------------------- [ Helper Functions ] ----------------------------*/

/**
 * @TODO decide if this is necessary abstraction or if should just use `Array.isArray() and arr.length > 0` everywhere
 * @param {any} arr 
 * @returns {boolean} **`true`** `if` `arr` is an array and has at least one element, **`false`** `otherwise`.
 */
function isNonEmptyArray(arr) {
    return Array.isArray(arr) && arr.length > 0;
}
function isEmptyArray(arr) { return !isNonEmptyArray(arr); }

/**
 * @description Check if an object has any non-empty keys (not undefined, null, or empty string). 
 * - passing in an array will return `false`.
 * @param {object} obj - The `object` to check.
 * @returns {boolean} **`true`** if the object has any non-empty keys, **`false`** `otherwise`.
 */
function hasNonTrivialKeys(obj) {
    if (!obj || typeof obj !== 'object' || isEmptyArray(Object.keys(obj))) {
        return false;
    }
    for (const key in obj) { // return true if any key is non-empty
        let value = obj[key];
        let valueIsNonTrivial = (obj.hasOwnProperty(key)
            && value !== undefined
            && value !== null
            && (value !== ''
                || isNonEmptyArray(value)
                || (typeof value === 'object' && isNonEmptyArray(Object.entries(value)))
            )
        );
        if (valueIsNonTrivial) {
            return true;
        }
    }
    return false;
}
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
/**max number of times allowed to call `log.debug(title, details)` per `post()` call */
const MAX_LOGS_PER_LEVEL = 1000;
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
    if (!type || !title) {
        log.error('Invalid log', 'type and title are required');
        return;
    }
    if (!Object.values(LogTypeEnum).includes(type)) {
        log.error('Invalid log type', `type must be one of ${Object.values(LogTypeEnum).join(', ')}`);
        return;
    }
    details = details && details.length > 0 ? details : [title];
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
 * Gets the current date and time in Pacific Time
 * @returns {string} The current date and time in Pacific Time
 */
function getCurrentPacificTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
}
/**
 * @consideration make an enum for subrecord types
 * assumes that the input value is a subrecord object if it is an object and not an array and not a Date object
 * @param {any | SubrecordValue} value 
 * @returns **`isSubrecord`** `boolean` = **`true`** `if` `value` is a subrecord object, **`false`** `otherwise`.
 */
function isSubrecord(value) {
    const isNonEmptyObject = Boolean(value 
        && typeof value === 'object' 
        && !Array.isArray(value) 
        && isNonEmptyArray(Object.keys(value))
    );
    const isNotDate = Boolean(value 
        && !value.hasOwnProperty('getVarDate') 
        && !value.hasOwnProperty('toLocaleString')
    );
    const isSetSubrecordOptions = Boolean(value 
        && value.hasOwnProperty('fieldId') 
        && (value.hasOwnProperty('fields') || value.hasOwnProperty('sublists'))
    );
    const isSubrecord = Boolean(isNonEmptyObject 
        && (isSetSubrecordOptions || isNotDate)
    );
    return isSubrecord;
}


/**
 * @param {RecordTypeEnum | string} recordType {@link RecordTypeEnum} | `string`
 * @returns {RecordTypeEnum | null} **`recordType`** - the validated record type as a `RecordTypeEnum` value, or `null` if the record type is invalid.
 */
function validateRecordType(recordType) {
    if (!recordType || typeof recordType !== 'string') {
        return null;
    }
    const isKey = Object.keys(RecordTypeEnum).includes(recordType.toUpperCase());
    const isValue = Object.values(RecordTypeEnum).includes(recordType.toLowerCase());
    if (isKey) { return RecordTypeEnum[recordType.toUpperCase()]; }
    if (isValue) { return recordType.toLowerCase(); }
    return null;
}

/**
 * get all line indices with sublist[idProp] === idValue
 * @param {object} rec 
 * @param {string} sublistId 
 * @param {FieldValue} idValue 
 * @param {string} lineIdProp 
 * @returns {number[]} **`lineIndices`**
 */
function getSublistLineIndexByFieldValue(rec, sublistId, idValue, lineIdProp = idPropertyEnum.INTERNAL_ID) {
    if (!rec || !sublistId || !idValue) {
        writeLog(LogTypeEnum.ERROR, 
            `ERROR: getSublistLineIndexById() Invalid Parameters:`,
            `rec, sublistId, and lineId are required parameters`,
        );
        return [];
    }
    /**@type {number[]} */
    const lineIndices = [];
    const lineCount = rec.getLineCount({ sublistId });
    for (let i = 0; i < lineCount; i++) {
        const sublistValue = rec.getSublistValue({ sublistId, fieldId: lineIdProp, line: i });
        if (sublistValue === idValue) {
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

/*------------------------ [ Types, Enums, Constants ] ------------------------*/
/** create a record in standard mode by setting `isDynamic` = `false` = `NOT_DYNAMIC`*/
const NOT_DYNAMIC = false;

/**Type: PostRecordRequest {@link PostRecordRequest} */
/**
 * @typedef {Object} PostRecordRequest
 * @property {PostRecordOptions | Array<PostRecordOptions>} postOptions = {@link PostRecordOptions} | `Array<`{@link PostRecordOptions}`>`
 * - {@link PostRecordOptions} = `{ recordType: `{@link RecordTypeEnum}`, isDynamic?: boolean, idOptions?: `{@link idSearchOptions}`[], fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
 * @property {PostResponseOptions} [responseOptions] = {@link PostResponseOptions} = `{ responseFields: string | string[], responseSublists: Record<string, string | string[]> }`
 */

/**Type: PostRecordResponse {@link PostRecordResponse} */
/**
 * @typedef {Object} PostRecordResponse
 * @property {string | number} status - Indicates status of the request.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} [results] - an `Array<`{@link PostRecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {PostRecordOptions[]} [rejects] - an `Array<`{@link PostRecordOptions}`>` containing the record options that were not successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */


/**
 * @typedef {Object} PostResponseOptions
 * @property {string | string[]} [responseFields] - `fieldId(s)` of the main record to return in the response.
 * @property {Record<string, string | string[]>} [responseSublists] `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response.
 */

/**
 * = `{ recordType: RecordTypeEnum, isDynamic?: boolean, idOptions?: idSearchOptions[], fields?: FieldDictionary, sublists?: SublistDictionary }`
 * @typedef {Object} PostRecordOptions
 * @property {RecordTypeEnum} recordType - The record type to post, see {@link RecordTypeEnum}
 * @property {boolean} [isDynamic=false] - Indicates if the record should be created/loaded in dynamic mode. (defaults to {@link NOT_DYNAMIC} = `false`)
 * @property {idSearchOptions[]} [idOptions] options to search for an existing record to upsert 
 * - = `Array<`{@link idSearchOptions}`>` 
 * - = `{ idProp`: {@link idPropertyEnum}, `searchOperator`: {@link RecordOperatorEnum}, `idValue`: string | number` }[]`
 * @property {FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue } } [fields]
 * @property {SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> } } [sublists]
 */

/**
 * @typedef {Object} PostRecordResult
 * @property {number} internalid
 * @property {string | RecordTypeEnum} recordType
 * @property {FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue } } fields
 * @property {SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> } } sublists
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
 * body fields a record.
 * @typedef {{[fieldId: string]: FieldValue | SubrecordValue}} FieldDictionary
 */

/** Type: **`SublistDictionary`** {@link SublistDictionary} */
/**
 * sublistIds mapped to an `Array<`{@link SublistLine}`>` = `{ [sublistFieldId: string]: `{@link FieldValue}`; line?: number; internalid?: number; }[]`
 * - {@link SublistLine}'s `sublistFieldId`s specified in the {@link BatchPostRecordRequest.responseSublists} request property.
 * @typedef {{
 * [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}>
 * }} SublistDictionary
 */

/** Type: **`SublistLine`** {@link SublistLine} */
/**
 * \@TODO  (Need to determine if `getSublistValue('id')` exists and returns same as `getSublistValue('internalid')`)
 * @typedef {{
 * [sublistFieldId: string]: FieldValue | SubrecordValue
 * line?: number;
 * lineIdProp?: string;
 * }} SublistLine
 * @property {number} [line] `number` - the `lineIndex` of the list entry
 * @property {number} [lineIdProp] `string` - the `'fieldId'` of the list entry 
 * with definded value for SublistLine[fieldId] that you want to use to search for existing lines
 */

/** Type: **`SubrecordDictionary`** {@link SubrecordDictionary} */
/**
 * - each key in SubrecordDictionary is the fieldId (`body` or `sublist`) of a field that holds a subrecord object
 * - distinguish between body subrecords and sublist subrecords by checking if the mapped object has property `'sublistId'`
 * - - i.e. `mappedObject = SubrecordDictionary[fieldId]; `
 * - - `if 'sublistId' in mappedObject.keys()`, `then` it's a `sublist` subrecord and vice versa
 * - {@link SetFieldSubrecordOptions} for body subrecords
 * - {@link SetSublistSubrecordOptions} for sublist subrecords
 * @typedef {{
 * [fieldId: string]: SetFieldSubrecordOptions | SetSublistSubrecordOptions
 * }} SubrecordDictionary
 */

/**
 * @typedef {{[subrecordFieldId: string]: FieldValue} | SetFieldSubrecordOptions | SetSublistSubrecordOptions} SubrecordValue 
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
 * @property {string} INTERNAL_ID - The `'internalid'` (for all records).
 * @property {string} EXTERNAL_ID - The `'externalid'` (for all records).
 * @property {string} ENTITY_ID - The `'entityid'` (for relationship records)
 * @property {string} ITEM_ID - The `'itemid'` (for inventory records)
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
 * @description operations for Date fields
 * @enum {string} **`DateOperatorEnum`**
 * @property {string} AFTER - The date is after the specified date.
 * @property {string} NOT_AFTER - The date is not after the specified date.
 * @property {string} BEFORE - The date is before the specified date.
 * @property {string} NOT_BEFORE - The date is not before the specified date.
 * @property {string} IS_EMPTY - The date field is empty.
 * @property {string} IS_NOT_EMPTY - The date field is not empty.
 * @property {string} ON - The date is on the specified date.
 * @property {string} NOT_ON - The date is not on the specified date.
 * @property {string} ON_OR_AFTER - The date is on or after the specified date.
 * @property {string} NOT_ON_OR_AFTER - The date is not on or after the specified date.
 * @property {string} ON_OR_BEFORE - The date is on or before the specified date.
 * @property {string} NOT_ON_OR_BEFORE - The date is not on or before the specified date.
 * @property {string} WITHIN - The date is within the specified date range.
 * @property {string} NOT_WITHIN - The date is not within the specified date range.
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
 * @property {string} TEXT `'text'`
 * @property {string} RADIO `'radio'`
 * @property {string} SELECT `'select'`
 * @property {string} MULTISELECT `'multiselect'`
 * @property {string} CHECKBOX `'checkbox'`
 * @property {string} DATE `'date'`
 * @property {string} INTEGER `'integer'`
 * @property {string} FLOAT `'float'`
 * @property {string} CURRENCY `'currency'`
 * @property {string} PERCENT `'percent'`
 * @property {string} INLINE_HTML `'inlinehtml'`
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
    return { post };
});