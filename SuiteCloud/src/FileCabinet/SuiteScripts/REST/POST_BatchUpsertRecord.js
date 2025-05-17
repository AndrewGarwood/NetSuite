/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName POST_BatchUpsertRecord
 * @ProdNScriptId NOT_DEPLOYED
 * @ProdDeployId NOT_DEPLOYED
 * @SbNScriptId 172
 * @SbDeployId 1
 */


define(['N/record', 'N/log', 'N/search'], (record, log, search) => {
    /**
     * @type {LogStatement[]} - `Array<`{@link LogStatement}`>` = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
     * @see {@link writeLog}`(type, title, ...details)`
     * @description return logArray in post response so can process in client
     * */
    const logArray = [];

    /**
     * **`upsertRecordArray`** and **`upsertRecordDict`** are ***mutually exclusive***
     * @param {BatchUpsertRecordRequest} reqBody - {@link BatchUpsertRecordRequest} = `{ upsertRecordArray`: {@link UpsertRecordOptions}`[], upsertRecordDict: {[K in `{@link RecordTypeEnum}`]?: Array<`{@link UpsertRecordOptions}`>}, responseProps: string | string[] }`
     * @param {Array<UpsertRecordOptions>} [reqBody.upsertRecordArray] `METHOD 1 —`
     * `Array<`{@link UpsertRecordOptions}`>` = `{ recordType`: {@link RecordTypeEnum}, `isDynamic`?: boolean=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }[]`
     * - for `req` in `reqBody.upsertRecordArray`
     * > run function {@link processUpsertRecordOptions}(`req`)
     * @param {{[K in RecordTypeEnum]?: Array<UpsertRecordOptions>}} [reqBody.upsertRecordDict] `METHOD 2 — `
     * `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link UpsertRecordOptions}`>>`
     * - for `recordType` in `Object.keys(reqBody.upsertRecordDict)`
     * - - for `req` in `reqBody.upsertRecordDict[recordType]`
     * - - - run function {@link processUpsertRecordOptions}(`req`)
     * @param {string | string[]} reqBody.responseProps - `(optional)` the properties to include in the response in addition to the upserted records' IDs.
     * @returns {BatchUpsertRecordResponse} .{@link BatchUpsertRecordResponse}
     */
    const post = (reqBody) => {
        const { upsertRecordArray, upsertRecordDict, responseProps } = reqBody;
        const upsertRecordArrayIsInvalid = !upsertRecordArray || !Array.isArray(upsertRecordArray);
        const upsertRecordDictIsInvalid = !upsertRecordDict || typeof upsertRecordDict !== 'object' || Array.isArray(upsertRecordDict);
        if (upsertRecordArrayIsInvalid && upsertRecordDictIsInvalid) { // both invalid
            writeLog(LogTypeEnum.ERROR, 'Invalid request body', 'upsertRecordArray or upsertRecordDict is required');
            return { success: false, message: 'upsertRecordArray or upsertRecordDict is required', error: 'Invalid request body', logArray, results: [] };
        } else if (!upsertRecordArrayIsInvalid && !upsertRecordDictIsInvalid) { // both valid
            writeLog(LogTypeEnum.ERROR, 'Invalid request body', 'upsertRecordArray and upsertRecordDict are mutually exclusive');
            return { success: false, message: 'upsertRecordArray and upsertRecordDict are mutually exclusive', error: 'Invalid request body', logArray, results: [] };
        }
        /**@type {PostRecordResult[]} */
        let results = [];
        try {
            if (upsertRecordArray && isNonEmptyArray(upsertRecordArray)) {
                writeLog(LogTypeEnum.AUDIT, 'upsertRecordArray.length', upsertRecordArray.length);
                for (let i = 0; i < upsertRecordArray.length; i++) {
                    const options = upsertRecordArray[i];
                    const result = processUpsertRecordOptions(options, responseProps);
                    if (!result) {
                        writeLog(LogTypeEnum.ERROR, `post.processUpsertRecordOptions() failed for upsertRecordArray[${i}]`);//, options);
                        continue;
                    }
                    results.push(result);
                }
            }
            if (upsertRecordDict && isNonEmptyArray(Object.keys(upsertRecordDict))) {
                writeLog(LogTypeEnum.AUDIT, 'Object.keys(upsertRecordDict).length', Object.keys(upsertRecordDict).length);
                for (let recordType of Object.keys(upsertRecordDict)) {
                    writeLog(LogTypeEnum.AUDIT, `upsertRecordDict[${recordType}].length`, upsertRecordDict[recordType].length);
                    const optionsArray = upsertRecordDict[recordType];
                    if (!isNonEmptyArray(optionsArray)) {
                        writeLog(LogTypeEnum.ERROR, `post.upsertRecordDict[${recordType}] is not an array`, optionsArray);
                        continue;
                    }
                    for (let i = 0; i < optionsArray.length; i++) {
                        const options = optionsArray[i];
                        const result = processUpsertRecordOptions(options, responseProps);
                        if (!result) {
                            writeLog(LogTypeEnum.ERROR, `post.processUpsertRecordOptions() failed for upsertRecordDict[${recordType}][${i}]`);//, options);
                            continue;
                        }
                        results.push(result);
                    }
                }
            }
            writeLog(LogTypeEnum.AUDIT, 'End of POST_BatchUpsertRecord', { numRecordsProcessed: results.length });
            /**@type {BatchUpsertRecordResponse} */
            return {
                success: true,
                message: 'Batch upsert completed, numRecordsProcessed: ' + results.length,
                logArray,
                results
            }
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, 'Error in POST_BatchUpsertRecord', JSON.stringify(e));
            /**@type {BatchUpsertRecordResponse} */
            return {
                success: false,
                message: 'Error in POST_BatchUpsertRecord: Batch upsert failed after processing ' + results.length + ' records',
                error: String(e),
                logArray,
                results
            }
        }
    }
    /**
     * 
     * @param {UpsertRecordOptions} options {@link UpsertRecordOptions} = `{ recordType`: {@link RecordTypeEnum}, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }`
     * @param {string} options.recordType - The record type to create, see {@link RecordTypeEnum}
     * @param {FieldDictionary} [options.fieldDict]
     * - {@link FieldDictionary} = `{ valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`.
     * - an object containing field IDs and their corresponding values.
     * @param {SublistDictionary} [options.sublistDict]
     * - {@link SublistDictionary} = `Record<[sublistId`: string], {@link SublistFieldDictionary}`>` = `{ sublistId`: `{ valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> } }`.
     * - an object containing sublist IDs and their corresponding field IDs and values.
     * @param {string | string[]} responseProps - `(optional) string | string[]` the properties to include in the response in addition to the created record ID.
     * @returns {PostRecordResult | undefined} `result`: {@link PostRecordResult} = `{ internalId`: number, `[fieldId: string in responseProps]`: {@link FieldValue}` }`
     * or `undefined` if an error occurs.
     */
    function processUpsertRecordOptions(options, responseProps) {
        let { recordType, fieldDict, sublistDict } = options;
        if (!recordType || typeof recordType !== 'string' || (!fieldDict && !sublistDict)) {
            writeLog(LogTypeEnum.ERROR,
                'processUpsertRecordOptions() Invalid UpsertRecordOptions',
                'recordType and (fieldDict or sublistDict) are required properties of UpsertRecordOptions');
            return;
        }
        recordType = recordType.toLowerCase();
        if (Object.keys(RecordTypeEnum).includes(recordType.toUpperCase())) {
            recordType = RecordTypeEnum[recordType.toUpperCase()];
        } else if (!Object.values(RecordTypeEnum).includes(recordType)) {
            writeLog(LogTypeEnum.ERROR, 'processUpsertRecordOptions() Invalid recordType',
                `Invalid recordType: '${recordType}'. Must be a RecordTypeEnum key or one of RecordTypeEnum's values.`);
            return;
        }
        /**@type {Record<[idPropertyEnum: string], string | number>} */
        const idPropDict = {};
        if (fieldDict && Array.isArray(fieldDict.valueFields)) {
            for (const { fieldId, value } of fieldDict.valueFields) {
                if (Object.values(idPropertyEnum).includes(fieldId)) {
                    idPropDict[fieldId] = value;
                }
            }
        }
        writeLog(LogTypeEnum.DEBUG, 
            `idPropDict`, idPropDict,
        );
        /**@type {object | undefined} */
        let rec = undefined;
        let isExistingRecord = false;
        const recId = searchForRecordById(recordType, idPropDict);
        if (!recId) {
            writeLog(LogTypeEnum.DEBUG, 
                `processUpsertRecordOptions() No record found for ${recordType}`, 
                `with idPropDict = ${JSON.stringify(idPropDict)}`, `Creating new record...`);
            rec = record.create({type: recordType, isDynamic: NOT_DYNAMIC});
        } else {
            rec = record.load({type: recordType, id: recId, isDynamic: NOT_DYNAMIC});
            isExistingRecord = true;
            writeLog(LogTypeEnum.DEBUG, `Loaded Existing ${recordType} record`, `Loaded Existing ${recordType} record with recId: ${recId}`);
            // remove idPropertyEnum fields from fieldDict.valueFields because 
            // will get an error saying the record already exists with that id
            if (fieldDict && Array.isArray(fieldDict.valueFields)) {
                fieldDict.valueFields = fieldDict.valueFields.filter(({ fieldId, value }, index) => {
                    return ![idPropertyEnum.INTERNAL_ID, idPropertyEnum.ENTITY_ID, idPropertyEnum.ITEM_ID].includes(fieldId);
                });
            }
        }
        try {
            if (fieldDict) {
                rec = processFieldDictionary(rec, recordType, fieldDict, FieldDictTypeEnum.FIELD_DICT);
            }
            if (sublistDict) {
                /**@type {string[]} */
                const validSublistIds = rec.getSublists();
                for (let [sublistId, sublistFieldDict] of Object.entries(sublistDict)) {
                    sublistId = sublistId.toLowerCase();
                    if (!validSublistIds.includes(sublistId)) {
                        writeLog(LogTypeEnum.ERROR, 
                            `WARNING! processUpsertRecordOptions() Invalid sublistId: ${sublistId}`, 
                            `processUpsertRecordOptions() Invalid sublistId: ${sublistId}`, 
                            `Sublist ID '${sublistId}' not found in ${recordType} record.`);
                        continue; // continue to next sublist
                    } else if (!hasNonTrivialKeys(sublistFieldDict)) {
                        writeLog(LogTypeEnum.ERROR, 
                            `processUpsertRecordOptions() Invalid sublistDict[${sublistId}]`, 
                            `processUpsertRecordOptions()'s options.sublistDict[${sublistId}]: SublistFieldDictionary is undefined or null or not an object or empty.`);
                        continue; // continue to next sublist
                    }
                    rec = processFieldDictionary(rec, recordType, sublistFieldDict, FieldDictTypeEnum.SUBLIST_FIELD_DICT);
                }
            }
            /**@type {PostRecordResult} = `{ internalId`: number, `recordType`: {@link RecordTypeEnum}, `[fieldId: string]`: {@link FieldValue}` }`*/
            const result = {
                recordType,
                internalId: isExistingRecord ? recId : rec.save({ enableSourcing: true, ignoreMandatoryFields: true }),
            };
            if (!responseProps) {return result;}
            if (isNonEmptyArray(responseProps)) {
                for (let [index, fieldId] of Object.entries(responseProps)) {
                    try {
                        fieldId = fieldId.toLowerCase();
                        result[fieldId] = rec.getValue({ fieldId });
                    } catch(e) {
                        writeLog(LogTypeEnum.ERROR, `Error fetching rec.getValue(responseProps[${index}])`, `responseProps[${index}]='${fieldId}' not found in ${recordType} record.`, e);
                        continue;
                    }
                };
            } else if (typeof responseProps === 'string') {
                result[responseProps] = rec.getValue({ fieldId: responseProps });
            } else {
                writeLog(LogTypeEnum.ERROR, 'Invalid responseProps', 
                    `responseProps must be a string or an array of strings.`, 
                    `received type: '${typeof responseProps}'`);
            }
            return result;
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, 
                `processUpsertRecordOptions() Error processing fieldDict or sublistDict`, JSON.stringify(e));
            return;
        }
    }
    /**
     * 
     * @param {RecordTypeEnum} recordType {@link RecordTypeEnum} = record type of parent record
     * @param {Record<[idPropertyEnum: string], string | number>} idPropDict `Record<[`{@link idPropertyEnum}`: string], string | number>`
     * @returns {string | undefined} `recId` = {@link SearchResult.id} = the internalid of the record if found in the search, undefined if not found.
     */
    function searchForRecordById(recordType, idPropDict) {
        if (!recordType || !idPropDict) {
            writeLog(LogTypeEnum.ERROR, 
                `searchForRecordById() Invalid parameters`, 
                `recordType and idPropDict are required`);
            return;
        }
        if (Object.keys(idPropDict).length === 0) {
            writeLog(LogTypeEnum.DEBUG, 
                `searchForRecordById() Invalid parameters`, 
                `idPropDict is empty`, `fieldDict.valueFields must contain at least one element with fieldId in idPropertyEnum`,
            );
            return;
        }
        for (const idProp in idPropDict) {
            const equalityOperator = idProp === idPropertyEnum.INTERNAL_ID 
                ? SearchOperatorEnum.RECORD.ANY_OF : SearchOperatorEnum.TEXT.IS;
            const idValue = idProp === idPropertyEnum.INTERNAL_ID 
                ? Number(idPropDict[idProp]) : String(idPropDict[idProp]);
            try {
                const recSearch = search.create({
                    type: recordType,
                    filters: [
                        [idProp, equalityOperator, idValue],
                    ],
                });
                /** @type {ResultSet} */
                const resultSet = recSearch.run();
                /** @type {SearchResult[]} */
                const resultRange = resultSet.getRange({ start: 0, end: 10 });
                if (resultRange.length > 1) {
                    writeLog(LogTypeEnum.ERROR,
                        'searchForRecordById() Multiple records found',
                        `Multiple '${recordType}' records found with ${idProp}='${idValue}'`,
                        `recSearch:`, recSearch);
                    return;
                } else if (resultRange.length === 0) {
                    writeLog(LogTypeEnum.DEBUG,
                        'searchForRecordById() No records found',
                        `No '${recordType}' records found with ${idProp}='${idValue}'`,);
                    return;
                }
                const searchResult = resultRange[0];
                const recId = searchResult.id;
                writeLog(LogTypeEnum.DEBUG,
                    'searchForRecordById() Record found',
                    `1 '${recordType}' record found with ${idProp}='${idValue}'`,);
                return recId;

            } catch (e) {
                writeLog(LogTypeEnum.ERROR,
                    `searchForRecordById() Error searching for ${recordType} record with ${idProp}='${idValue}'`, JSON.stringify(e));
                return;
            }
        }
    }
    /**
     * called by {@link processFieldDictionary} to set field values on the record or subrecord.
     * @param {object} rec - The current record or subrecord being processed.
     * @param {string} recordType - The record type {@link RecordTypeEnum}
     * @param {SetOptionsEnum} fieldType - flag indicating if the field's parent is a sublist or the main record itself ({@link SetOptionsEnum})
     * @param {Array<SetFieldValueOptions | SetSublistValueOptions>} fieldOptions
     * - {@link SetFieldOptionsType} = `Array<`{@link SetFieldValueOptions} | {@link SetSublistValueOptions}`>`.
     * @returns {object} rec - The record with the field values set.
     */
    function setFieldsByOptionType(rec, recordType, fieldType, fieldOptions) {
        if (!rec || !fieldType || !fieldOptions) {
            writeLog(LogTypeEnum.ERROR, 
                'Invalid setFieldsByOptionType() parameters', 
                'rec, fieldType, fieldOptions are required');
            return rec;
        }
        /**@type {string[]} */
        let validFieldIds = undefined
        if (fieldType === SetOptionsEnum.FIELD_VALUE) {
            validFieldIds = rec.getFields();
            fieldOptions.forEach((
                /**@type {SetFieldValueOptions}*/
                setFieldValueOps, 
                index
            ) => {
                let {fieldId, value} = setFieldValueOps;
                fieldId = fieldId.toLowerCase();
                if (!validFieldIds.includes(fieldId)) {
                    writeLog(LogTypeEnum.ERROR, `WARNING! possibly Invalid ${SetOptionsEnum.FIELD_VALUE} fieldId: '${fieldId}'`, `valueFields[${index}][${fieldId}] not found in ${recordType} record.getFields()`);
                    // return; // continue to next valueField
                }
                try {
                    writeLog(LogTypeEnum.DEBUG, 
                        `setFieldsByOptionType() attempting rec.setValue();`,
                        `setFieldsByOptionType() attempting rec.setValue({ fieldId: '${fieldId}', value: '${value}' });`,
                        `newValue === previousValue ? ${rec.getValue({ fieldId }) === value}`,
                        `previousValue: '${rec.getValue({ fieldId })}'`, 
                        `newValue:      '${value}'`, 
                    ); 
                    rec.setValue({ fieldId, value });
                } catch (e) {
                    writeLog(LogTypeEnum.ERROR, `Error setting ${recordType} fieldId: '${fieldId}'`, 
                        `rec.setValue({ fieldId: ${fieldId}, value: ${value} })`, e);
                    return; // continue to next valueField
                }
            });
        } else if (fieldType === SetOptionsEnum.SUBLIST_VALUE) {
            fieldOptions.forEach((
                /**@type {SetSublistValueOptions}*/
                setSublistValueOps, 
                index
            ) => {
                let {sublistId, fieldId, line, value} = setSublistValueOps;
                fieldId = fieldId.toLowerCase();
                validFieldIds = rec.getSublistFields({ sublistId });
                if (!validFieldIds.includes(fieldId)) {
                    writeLog(LogTypeEnum.ERROR, `WARNING! possibly Invalid ${SetOptionsEnum.SUBLIST_VALUE} fieldId: '${fieldId}'`, `valueFields[${index}][${fieldId}] not found in ${recordType} record.getSublistFields(${sublistId})`);
                    // return; // continue to next valueField
                }
                line = validateSublistLine(rec, sublistId, line);
                try { 
                    writeLog(LogTypeEnum.DEBUG, 
                        `setFieldsByOptionType() attempting rec.setSublistValue();`,
                        `setFieldsByOptionType() attempting rec.setSublistValue({ sublistId: '${sublistId}', fieldId: '${fieldId}', line: ${line}, value: '${value}' });`, 
                        `newValue === previousValue ? ${rec.getSublistValue({ sublistId, fieldId, line }) === value}`,
                        `previousValue: '${rec.getSublistValue({ sublistId, fieldId, line })}'`, 
                        `newValue:      '${value}'`
                    );
                    rec.setSublistValue({ sublistId, fieldId, line, value });
                } catch (e) {
                    writeLog(LogTypeEnum.ERROR, `Error when ${recordType}.setSublistValue() sublistId: '${sublistId}' fieldId: '${fieldId}'`, `rec.setSublistValue({ sublistId: ${sublistId}, fieldId: ${fieldId}, line: ${line}, value: ${value} })`, e);
                    return;
                }
            });
        } else {
            writeLog(LogTypeEnum.ERROR, 
                `setFieldsByOptionType() Invalid field type: ${fieldType}`, 
                `setFieldsByOptionType(recordType=${recordType}, fieldType=${fieldType}, fieldOptions=${fieldOptions})`,
            );
        }
        return rec;
    }

    /**
     * @description Process the field dictionary and set the field values on the record or subrecord.
     * - calls {@link setFieldsByOptionType}(`dict.key`) for key in `[valueFields]` if {@link isNonEmptyArray}(`dict.key`) is `true`.
     * - calls {@link processSubrecordOptions}(`rec, recordType, dict.subrecordFields.subrecordOptions`) for each subrecordOptionbs in `dict.subrecordFields` if {@link isNonEmptyArray}(`dict.subrecordFields`) is true.
     * @param {object} rec - The current record being processed.
     * @param {string} recordType - The record type {@link RecordTypeEnum}
     * @param {FieldDictionary | SublistFieldDictionary} dict either a {@link FieldDictionary} or a {@link SublistFieldDictionary}
     * @param {FieldDictTypeEnum} dictType - The type of dictionary being processed must be either `'fieldDict'` ({@link FieldDictTypeEnum.FIELD_DICT}) or `'sublistFieldDict'` ({@link FieldDictTypeEnum.SUBLIST_FIELD_DICT}). 
     * @returns {object} `rec`: `{object}` - The record with the field values set.
     */
    function processFieldDictionary(rec, recordType, dict, dictType) {
        if (!rec || !recordType || !dict || !dictType) {
            writeLog(LogTypeEnum.ERROR, 'Invalid processFieldDictionary() parameters', 
                'rec, recordType, dict, dictType are required');
            return rec;
        }
        if (dictType !== FieldDictTypeEnum.FIELD_DICT && dictType !== FieldDictTypeEnum.SUBLIST_FIELD_DICT) {
            writeLog(LogTypeEnum.ERROR, 'processFieldDictionary() Invalid dictType', 
                `received dictType=${dictType} but dictType must be either ${FieldDictTypeEnum.FIELD_DICT} or ${FieldDictTypeEnum.SUBLIST_FIELD_DICT}`);
            return rec;
        }
        try {
            if (rec && dict && dictType === FieldDictTypeEnum.FIELD_DICT) {
                if (isNonEmptyArray(dict.valueFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.FIELD_VALUE, dict.valueFields);
                }
                if (isNonEmptyArray(dict.subrecordFields)) {
                    for (let [index, subrecOptions] of dict.subrecordFields.entries()) {
                        // writeLog(LogTypeEnum.DEBUG, `Processing fieldDict.subrecordFields[${index}]`);
                        rec = processSubrecordOptions(rec, recordType, subrecOptions);
                    }
                }
            } else if (rec && dict && dictType === FieldDictTypeEnum.SUBLIST_FIELD_DICT) {
                if (isNonEmptyArray(dict.valueFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.SUBLIST_VALUE, dict.valueFields);
                }
                if (isNonEmptyArray(dict.subrecordFields)) {
                    for (let [index, subrecOptions] of Object.entries(dict.subrecordFields)) {
                        // writeLog(LogTypeEnum.DEBUG, `Processing sublistFieldDict.subrecordFields[${index}]`);
                        rec = processSubrecordOptions(rec, recordType, subrecOptions);
                    }
                }
            }
            return rec;
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, `Error in processFieldDictionary(recordType=${recordType}, dictType=${dictType})`, e);
            return rec;
        }
    }

    /**
     * @note does not yet support isDynamic being true
     * @param {object} rec - the parent record
     * @param {string} recordType {@link RecordTypeEnum} = record type of parent record
     * @param {SetSubrecordOptions} subrecordOptions {@link SetSubrecordOptions} = { `sublistId`?: string, `line`?: number, `fieldId`: string, `subrecordType`: string,  `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}>.
     * @param {string} subrecordOptions.sublistId - `(optional)` the sublistId of the subrecord. If not provided, assume that the subrecord corresponds to a body field of the main record.
     * @param {string} subrecordOptions.fieldId - the fieldId of the subrecord. This is a required property.
     * @param {string} subrecordOptions.subrecordType - the subrecord type
     * @param {number} subrecordOptions.line - `(optional)` the line index of the subrecord in the sublist. This is only used if `sublistId` is provided.
     * @param {FieldDictionary} subrecordOptions.fieldDict - `(optional)` a {@link FieldDictionary} for the subrecord's body fields.
     * @param {SublistDictionary} subrecordOptions.sublistDict - `(optional)` a {@link SublistDictionary} for the subrecord's sublist fields.
     * @returns {object} rec - The record with the its subrecord values set.
     * @description **(Options A and B are mutually exclusive)**
     * - `Option A:` sublistId is not provided, assume that the subrecord is a subrecord of the main record. 
     *   - `1.` let `subrec = rec.getSubrecord({ fieldId })` to get the subrecord. `if` subrec is `null` or `undefined`, `return` rec without processing subrecordOptions.
     *   - `2.` `if` {@link hasNonTrivialKeys}(`subrecordOptions.fieldDict`): 
     *      > `update` subrec = {@link processFieldDictionary}(`subrec`, `subrecordType`, `subrecordOptions.fieldDict`, {@link FieldDictTypeEnum.FIELD_DICT}) to set the subrecord's field values.
     *   - `3.` `if` {@link hasNonTrivialKeys}(`subrecordOptions.sublistDict`):
     *      > `for` each `[subrecSublistId, subrecSublistFieldDict]` in `subrecordOptions.sublistDict.entries()`:
     *      > > `update` `subrec` = {@link processFieldDictionary}(`subrec`, `subrecordType`, `subrecSublistFieldDict`, {@link FieldDictTypeEnum.SUBLIST_FIELD_DICT}) to set the subrecord's sublist field values.
     *   - `4.` `return` rec
     * - `Option B:` assume that the subrecord pertains to a sublistField in one of the main record's sublists.
     *   - `1.` let `sublistSubrec = rec.getSublistSubrecord({ sublistId, fieldId, line })` to get the subrecord. `if` sublistSubrec is `null` or `undefined`, `return` rec without processing subrecordOptions.
     *   - `2.` `if` {@link hasNonTrivialKeys}(`subrecordOptions.fieldDict`): 
     *      > `update` sublistSubrec = {@link processFieldDictionary}(`sublistSubrec`, `subrecordType`, `subrecordOptions.fieldDict`, {@link FieldDictTypeEnum.FIELD_DICT}) to set the subrecord's field values.
     *   - `3.` `if` {@link hasNonTrivialKeys}(`subrecordOptions.sublistDict`):
     *      > `for` each `[subrecSublistId, subrecSublistFieldDict]` in `subrecordOptions.sublistDict.entries()`:
     *      > > `update` `sublistSubrec` = {@link processFieldDictionary}(`sublistSubrec`, `subrecordType`, `subrecSublistFieldDict`, {@link FieldDictTypeEnum.SUBLIST_FIELD_DICT}) to set the subrecord's sublist field values.
     *   - `4.` `return` rec
     */  
    function processSubrecordOptions(rec, recordType, subrecordOptions) {
        if (!rec || !subrecordOptions) {
            writeLog(LogTypeEnum.ERROR, `Invalid ${recordType} subrecordOptions`, 'rec and subrecordOptions are required');
            return rec;
        }

        let { parentSublistId, fieldId, subrecordType, line, fieldDict, sublistDict } = subrecordOptions;
        if (!fieldId || typeof fieldId !== 'string') {
            writeLog(LogTypeEnum.ERROR, `processSubrecordOptions() - Invalid ${recordType} processSubrecordOptions paramter`, '(fieldId: string) is required property of subrecordOptions');
            return rec;
        }
        fieldId = fieldId.toLowerCase();
        
        if (!parentSublistId) { // Option A - The subrecord corresponds to a body field of the main record.
            let subrec = rec.getSubrecord({ fieldId }); // A.3
            if (!subrec) {
                writeLog(LogTypeEnum.ERROR, 
                    `processSubrecordOptions() - BODY SUBRECORD - Invalid rec.getSubrecord({fieldId}) parameter for recordType: ${recordType}`, 
                    `subrec = rec.getSubrecord({ fieldId: ${fieldId} }) is null/undefined -> return rec without processing subrecordOptions`
                );
                return rec; // return rec without processing subrecord
            }
            if (hasNonTrivialKeys(fieldDict)) { // A.4 - rec.subrec.bodyFields - Process the body subrecord's body fields
                subrec = processFieldDictionary(subrec, subrecordType, fieldDict, FieldDictTypeEnum.FIELD_DICT);
            }
            if (hasNonTrivialKeys(sublistDict)) { // A.5 - rec.subrec.sublists - Process the body subrecord's sublist fields
                for (let [index, subrecordSublistId] of Object.entries(Object.keys(sublistDict))) {
                    let sublistFieldDict = sublistDict[subrecordSublistId];
                    subrecordSublistId = subrecordSublistId.toLowerCase();
                    writeLog(LogTypeEnum.DEBUG, 
                        `processSubrecordOptions() - BODY SUBRECORD - sublistDict.keys()[${index}] Processing body subrecord's sublist fields`, 
                        `sublist's Grandparent's recordType=${recordType}, sublist's Parent's recordType=${subrecordType}, (subrecordSublistId: ${subrecordSublistId})`,
                        `Attempting to set values in the following sublists of (subrecordType=${subrecordType}): ${Object.keys(sublistFieldDict)}`
                    );
                    subrec = processFieldDictionary(subrec, subrecordType, sublistFieldDict, FieldDictTypeEnum.SUBLIST_FIELD_DICT);
                }
            }
        } else if (parentSublistId && typeof parentSublistId === 'string') { // Option B
            let sublistSubrec = rec.getSublistSubrecord({ sublistId: parentSublistId, fieldId, line });
            if (!sublistSubrec) {
                writeLog(LogTypeEnum.ERROR, 
                    `processSubrecordOptions() - SUBLIST SUBRECORD - Invalid rec.getSublistSubrecord(sublistId, fieldId, line) parameter(s) for recordType: ${recordType}`, 
                    `sublistSubrec = rec.getSublistSubrecord({ sublistId: ${parentSublistId}, fieldId: ${fieldId}, line: ${line} }) is null/undefined -> return rec without processing subrecordOptions`
                );
                return rec; // return rec without processing subrecord
            }
            if (hasNonTrivialKeys(fieldDict)) { // rec.sublist.subrec.bodyFields - Process the parentSublistSubrecord's body fields
                sublistSubrec = processFieldDictionary(sublistSubrec, subrecordType, fieldDict, FieldDictTypeEnum.FIELD_DICT);
            }
            if (hasNonTrivialKeys(sublistDict)) { // rec.sublist.subrec.sublists - Process the parentSublistSubrecord's sublistDict
                for (let [index, subrecordSublistId] of Object.entries(Object.keys(sublistDict))) {
                    let sublistFieldDict = sublistDict[subrecordSublistId];
                    writeLog(LogTypeEnum.DEBUG, 
                        `processSubrecordOptions() - SUBLIST SUBRECORD - sublistDict.keys()[${index}] Processing parentSublistSubrecord's sublist fields`, 
                        `sublist's Grandparent recordType: ${recordType}, sublist's Parent recordType = subrecordType=${subrecordType}, (subrecordSublistId: ${subrecordSublistId})`,
                        `Attempting to set values in the following sublist(s) of (subrecordType=${subrecordType}): ${Object.keys(sublistFieldDict)}`
                    );
                    sublistSubrec = processFieldDictionary(sublistSubrec, subrecordType, sublistFieldDict, FieldDictTypeEnum.SUBLIST_FIELD_DICT);
                }
            }
        }
        return rec;
    }
    /**
     * @description Validate the line index for a sublist. 
     * `If` the line index is out of bounds, `insert` a new line at the end 
     * of the sublist and `return` it as the `new line index`.
     * @param {any} rec a record or subrecord object
     * @param {string} sublistId id of rec's sublist
     * @param {number} line index in sublist
     * @returns {number} the input `line {number}` if valid, otherwise `insert` a new line at the end of the sublist and `return` it as the new line index. 
     */
    function validateSublistLine(rec, sublistId, line) {
        if (!rec || !sublistId || (line === undefined || line === null || typeof line !== 'number')) {
            writeLog(LogTypeEnum.ERROR, 'Invalid validateSublistLine() parameters', 'params (rec: Record, sublistId: string, and line: number) are required');
        }
        const lineCount = rec.getLineCount({ sublistId });
        const lineIndexOutOfBounds = line < 0 || line >= lineCount;
        if (lineIndexOutOfBounds) {
            rec.insertLine({ sublistId, line: lineCount });
            return lineCount; // return the new line index
        }
        return line; // return the original line index because it is valid
    }
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
/**
 * - `name` = The name of the search column for which the minimal or maximal value should be found.
 * - `join` = The join id for the search column. 
 * @typedef {{ 
 * name: string, 
 * join: string 
 * }} SearchColumnSetWhenOrderedByOptions 
 * */

/**
 * @typedef {Object} SearchResultSetGetRangeOptions
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} SearchResultSetGetRangeFunction
 * @property {function(SearchResultSetGetRangeOptions): Promise<SearchResult[]>} promise
 * @property {function(SearchResultSetGetRangeOptions): SearchResult[]} [sync]
 */

/**
 * @typedef {Object} SearchResultSetEachFunction
 * @property {function(function(SearchResult): boolean): Promise<boolean>} promise
 * @property {function(function(SearchResult): boolean): void} [sync]
 */

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
 * @property {string} INTERNAL_ID - The `internalid` (for all records).
 * @property {string} EXTERNAL_ID - The `externalid` (for all records).
 * @property {string} ENTITY_ID - The `entityid` (for relationship records)
 * @property {string} ITEM_ID - The `itemid` (for inventory records)
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

/** create a record in standard mode by setting `isDynamic` = `false` = `NOT_DYNAMIC`*/
const NOT_DYNAMIC = false;
/**
 * Definition of Request body for the {@link post} function in POST_BatchUpsertRecord.js
 * @typedef {Object} BatchUpsertRecordRequest
 * @property {Array<UpsertRecordOptions>} [upsertRecordArray] 
 * `Array<`{@link UpsertRecordOptions}`>` to create records in NetSuite.
 * @property {{[K in RecordTypeEnum]?: Array<UpsertRecordOptions>}} [upsertRecordDict] 
 * `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link UpsertRecordOptions}`>>` to create records in NetSuite.
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internalids.
 */

/**
 * `{ internalId: number; [fieldId: string]:` {@link FieldValue}`; }`
 * @typedef {{
 * recordType: RecordTypeEnum | string;
 * internalId: number; 
 * [fieldId: string]: FieldValue;
 * }} PostRecordResult
 */

/**
 * Definition of Response for the post function in POST_BatchUpsertRecord.js
 * @typedef {Object} BatchUpsertRecordResponse
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} [results] - an `Array<`{@link PostRecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */

// UpsertRecordOptions
/**
 * @typedef {Object} UpsertRecordOptions
 * @property {RecordTypeEnum} recordType - The record type to create, see {@link RecordTypeEnum}
 * @property {FieldDictionary} [fieldDict] a dictionary of field IDs and values.
 * - {@link FieldDictionary} = `{ valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`.
 * @property {SublistDictionary} [sublistDict] an object containing sublist IDs mapped to a dictionary of field IDs and values.
 * - {@link SublistDictionary} = `Record<[sublistId: string]`, {@link SublistFieldDictionary}`>` 
 * - - = `{ sublistId`: `{ valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> } }`.
 */


// FieldDictionary
/**
 * Fields organized by the fields' value type
 * @typedef {Object} FieldDictionary
 * @property {Array<SetFieldValueOptions>} [valueFields] 
 * - `Array<`{@link SetFieldValueOptions}`>` = `Array<{ fieldId`: string, `value`: {@link FieldValue}` }>` 
 * - For record fields: `record.setValue(fieldId, value)`
 * @property {Array<SetSubrecordOptions>} [subrecordFields] 
 * - `Array<`{@link SetSubrecordOptions}`>` = `Array<{sublistId`: string=undefined, `fieldId`: string, `subrecordType`: string, `line`: number=undefined, `fieldDict`: {@link FieldDictionary}, `sublistFieldDict`: {@link SublistFieldDictionary}` }>`.
 * - subrecords corresponding to a body field in the main record
 */

/**
 * @typedef {Record<string, SublistFieldDictionary>} SublistDictionary 
 * = `Record<[sublistId: string]`, {@link SublistFieldDictionary}`>` 
 * - an object containing sublist IDs mapped to a dictionary of field IDs and values.
 */

// SublistFieldDictionary
/**
 * Set a record's sublist's field values organized by field type
 * @typedef {Object} SublistFieldDictionary
 * @property {Array<SetSublistValueOptions>} [valueFields]  
 * - `Array<`{@link SetSublistValueOptions}`>` = `Array<{sublistId`: string, `fieldId`: string, `line`: number, `value`: {@link FieldValue}}>. 
 * - For record sublist fields: `rec.setSublistValue(sublistId, fieldId, line, value)`
 * @property {Array<SetSubrecordOptions>} [subrecordFields]
 * - `Array<`{@link SetSubrecordOptions}`>` = `Array<{sublistId`: string, `fieldId`: string, `subrecordType`: string, `line`: number, `fieldDict`: {@link FieldDictionary}, `sublistFieldDict`: {@link SublistFieldDictionary}}>.
 * - subrecords corresponding to a field in a record's sublist
 */

// FieldValue
/**
 * The value type must correspond to the field type being set. For example:
 * - **`Text`**, **`Radio`** and **`Select`** fields accept `string` values.
 * - **`Checkbox`** fields accept `Boolean` values.
 * - **`Date`** and **`DateTime`** fields accept `Date` values.
 * - **`Integer`**, **`Float`**, **`Currency`** and **`Percent`** fields accept `number` values.
 * - \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Date | number | number[] | string | string[] | boolean | null
 * } FieldValue 
 */

// SetFieldValueOptions
/**
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetFieldValueOptions
 * @property {string} fieldId - The `internalid` of a standard or custom field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the field to. 
 * - = `{Date | number | number[] | string | string[] | boolean | null}`
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */

/**
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetSublistValueOptions
 * @property {string} sublistId - The `internalid` of the sublist.
 * @property {string} fieldId - The `internalid` of a standard or custom sublist field.
 * @property {number} line - The line number for the field. (i.e. index of the sublist row) (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the sublist field to.
 * - = `{Date | number | number[] | string | string[] | boolean | null}`
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */

/**
 * \@reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4687606306.html}
 *  ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetSubrecordOptions
 * @property {string} [parentSublistId] - (If setting subrecord of a sublist) The internalid of the parent record's sublist that contains a subrecord field. (e.g. vendor (the parent) has a sublist id 'addressbook')
 * @property {string} fieldId - The `internalid` of the field or sublistField that is a subrecord. (e.g. 'addressbookaddress'), 
 * - If the subrecord is on the main record, use `rec.getSubrecord({fieldId})` = getSubrecord(options: GetFieldOptions): Omit<Record, 'save'>;
 * - If the subrecord is in a sublist, use `rec.getSublistSubrecord({sublistId, fieldId})`
 * @property {string} [subrecordType] - The record type of the subrecord.
 * @property {number} [line] - The line number for the field. (i.e. index of the sublist row) defaults to new line. (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {FieldDictionary} [fieldDict] - {@link FieldDictionary} = `{ valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`.
 * @property {SublistDictionary} [sublistDict] - {@link SublistDictionary} = `Record<[sublistId: string]`, {@link SublistFieldDictionary}`>` 
 * - = `{ sublistId`: `{ valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> } }`.
 * - (if subrecord has own sublists) an object containing sublist IDs mapped to a dictionary of field IDs and values.
 */


    /**
     * @TODO - decide if this is necessary abstraction or if should just use Array.isArray() and arr.length > 0 everywhere
     * @param {any} arr 
     * @returns {boolean} true if arr is an array and has at least one element, false otherwise.
     */
    function isNonEmptyArray(arr) {
        return Array.isArray(arr) && arr.length > 0;
    }
    /**
     * @description Check if an object has any non-empty keys (not undefined, null, or empty string). 
     * - passing in an array will return `false`.
     * @param {Object} obj - The object to check.
     * @param {Object} [objName=undefined] - `(optional)` The object name for logging purposes.
     * @returns {boolean} `true` if the object has any non-empty keys, `false` otherwise.
     */
    function hasNonTrivialKeys(obj, objName = undefined) {
        if (typeof obj !== 'object' || !obj || Array.isArray(obj) || Object.keys(obj).length === 0) {
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
                if (objName) {
                    writeLog(LogTypeEnum.DEBUG, `hasNonTrivialKeys(${objName}) === true`, `obj[${key}] = ${value}`);
                }
                return true;
            }
        }
        if (objName) {
            writeLog(LogTypeEnum.DEBUG, `hasNonTrivialKeys(${objName}) === false`, `obj = ${JSON.stringify(obj, null, 4)}`);
        }
        return false;
    }

    /**
     * Calls NetSuite log module and pushes log with timestamp={@link getCurrentPacificTime}() to {@link logArray} to return at end of post request.
     * @reference ~\node_modules\@hitc\netsuite-types\N\log.d.ts
     * @param {LogTypeEnum} type {@link LogTypeEnum}
     * @param {string} title 
     * @param {any[]} [details]
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
        const payload = details
            .map(d => (typeof d === 'string' ? d : JSON.stringify(d, null, 4)))
            .join(' ');
        switch (type) {
            case LogTypeEnum.DEBUG:
                log.debug(title, payload);
                break;
            case LogTypeEnum.ERROR:
                log.error(title, payload);
                break;
            case LogTypeEnum.AUDIT:
                log.audit(title, payload);
                break;
            case LogTypeEnum.EMERGENCY:
                log.emergency(title, payload);
                break;
        }
        logArray.push({ timestamp: getCurrentPacificTime(), type, title, details });//, message: payload });
    }

    /**
     * Gets the current date and time in Pacific Time
     * @returns {string} The current date and time in Pacific Time
     */
    function getCurrentPacificTime() {
        const currentDate = new Date();
        const pacificTime = currentDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        return pacificTime;
    }

    /**
     * @enum {string} **`FilterOperatorEnum`**
     * @readonly
     * @property {string} AND = `'and'`
     * @property {string} OR = `'or'`
     */
    const FilterOperatorEnum = {
        AND: 'and',
        OR: 'or',
    };
/**
 * @enum {string} **`SetOptionsEnum`**
 * @description `Enum` used in {@link setFieldsByOptionType}`()` to indicate which function to call for setting field values in the record.
 * @property {string} FIELD_VALUE - fieldValue ({@link SetFieldValueOptions}) set value field of record
 * @property {string} SUBLIST_VALUE - sublistValue ({@link SetSublistValueOptions}) set value field of record's sublist
 */
const SetOptionsEnum = {
    FIELD_VALUE: 'FIELD_VALUE',
    SUBLIST_VALUE: 'SUBLIST_VALUE',
}
/**
 * @enum {string} **`FieldDictTypeEnum`**
 * @description Enum for field dictionary types used in {@link processFieldDictionary} and {@link processSubrecordOptions}
 * @property {string} FIELD_DICT - indicates a dictionary is a {@link FieldDictionary}, with values for a record's main body fields
 * @property {string} SUBLIST_FIELD_DICT - indicates a dictionary is a {@link SublistFieldDictionary}, with values for a record's sublist fields
 */
const FieldDictTypeEnum = {
    /** indicates a dictionary is a {@link FieldDictionary}, with values for a record's main body fields */
    FIELD_DICT: 'FIELD_DICT',
    /** indicates a dictionary is a {@link SublistFieldDictionary}, with values for a record's sublist fields */
    SUBLIST_FIELD_DICT: 'SUBLIST_FIELD_DICT'
}
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
 * @enum {string} **`SearchOperatorEnum`**
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
 * @typedef {Object} LogStatement
 * @property {string} timestamp - The timestamp of the log entry.
 * @property {LogTypeEnum} type - The type of log entry (see {@link LogTypeEnum}).
 * @property {string} title - The title of the log entry.
 * @property {any} details - The details of the log entry.
 * @property {string} [message] - The message of the log entry = concatenated string of details's contents (if details is an array).
 * @description typedef for elements of the {@link logArray} array
 */

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
    DEBUG: 'debug',
    ERROR: 'error',
    AUDIT: 'audit',
    EMERGENCY: 'emergency',
};


/**
 * @enum {string} **`RecordTypeEnum`**
 * @readonly
 * @description supported NetSuite API record types As of 4 June 2024
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
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