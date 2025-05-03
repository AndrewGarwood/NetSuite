/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName POST_BatchCreateRecord
 * @ProdNScriptId number
 * @ProdDeployId number
 * @SbNScriptId number
 * @SbDeployId number
 */

define(['N/record', 'N/log', 'N/search'], (record, log, search) => {
    /**
     * @type {LogStatement[]} - Array<{@link LogStatement}> = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
     * @see {@link writeLog}(type, title, ...details)
     * @description return logArray in post response so can process in client
     * e.g. in client write logArray to a json or txt file in a readable format
     * or use logArray to display in a UI component (e.g. table, list, etc.)
     * */
    const logArray = [];
    
    /**
     * createRecordArray and createRecordDict are mutually exclusive
     * @param {BatchCreateRecordRequest} reqBody - {@link BatchCreateRecordRequest} = `{ createRecordArray`: {@link CreateRecordOptions}`[], createRecordDict: {[K in `{@link RecordTypeEnum}`]?: Array<`{@link CreateRecordOptions}`>} }`
     * @description POST function to create multiple records in NetSuite. Can create record in batches by defining the request's body, reqBody, in two ways: 
     * @param {Array<CreateRecordOptions>} [reqBody.createRecordArray] `METHOD 1 —`
     * `Array<`{@link CreateRecordOptions}`>` = `{ recordType`: {@link RecordTypeEnum}, `isDynamic`?: boolean=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }[]`
     * - for `req` in `reqBody.createRecordArray`
     * > run function {@link processCreateRecordOptions}(`req`)
     * @param {{[K in RecordTypeEnum]?: Array<CreateRecordOptions>}} [reqBody.createRecordDict] `METHOD 2 — `
     * `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link CreateRecordOptions}`>>`
     * - for recordType in Object.keys(reqBody.createRecordDict)
     * - - for req in reqBody.createRecordDict[recordType]
     * - - - run function {@link processCreateRecordOptions}(`req`)
     * @param {string | string[]} reqBody.responseProps - (optional) the properties to include in the response in addition to the created records' IDs.
     * @returns {BatchCreateRecordResponse} .{@link BatchCreateRecordResponse}
     */
    const post = (/**@description request body of {@link post}*/reqBody) => {
        let { createRecordArray, createRecordDict, responseProps } = reqBody;
        let createRecordArrayIsInvalid = !createRecordArray || !Array.isArray(createRecordArray);
        let createRecordDictIsInvalid = !createRecordDict || typeof createRecordDict !== 'object';
        if (createRecordArrayIsInvalid && createRecordDictIsInvalid) {
            writeLog(LogTypeEnum.ERROR, 'Invalid request body', 'Body must contain either "createRecordArray"?: Array<CreateRecordOptions>; or "createRecordDict"?: {[K in RecordTypeEnum]?: Array<CreateRecordOptions>;};');
            throw new Error('Invalid request body: Body must contain either "createRecordArray"?: Array<CreateRecordOptions>; or "createRecordDict"?: {[K in RecordTypeEnum]?: Array<CreateRecordOptions>;};.');
        } else if (!createRecordArrayIsInvalid && !createRecordDictIsInvalid) {
            writeLog(LogTypeEnum.ERROR, 'Invalid request body, createRecordArray and createRecordDict are mutually exclusive', 'Body must contain either "createRecordArray"?: Array<CreateRecordOptions>; or "createRecordDict"?: {[K in RecordTypeEnum]?: Array<CreateRecordOptions>;}; but not both.');
            throw new Error('Invalid request body: Body must contain either "createRecordArray"?: Array<CreateRecordOptions>; or "createRecordDict"?: {[K in RecordTypeEnum]?: Array<CreateRecordOptions>;}; but not both.');
        }
        /**@type {number[]} */
        let resultsArray = [];
        try {
            if (createRecordArray && createRecordArray.length > 0) {
                writeLog(LogTypeEnum.AUDIT, 'reqBody.createRecordArray.length:', createRecordArray.length);
                for (let i = 0; i < createRecordArray.length; i++) {
                    let createReq = createRecordArray[i];
                    let result = processCreateRecordOptions(createReq);
                    if (!result) {
                        writeLog(LogTypeEnum.ERROR, `Error Processing createRecordArray[${i}]`, `element ${i} CreateRecordOptions`);
                        continue;
                    } 
                    resultsArray.push(result);
                }
            }
            if (createRecordDict && Object.keys(createRecordDict).length > 0) {   
                writeLog(LogTypeEnum.AUDIT, 'Object.keys(reqBody.createRecordDict).length:', Object.keys(createRecordDict).length, Object.keys(createRecordDict));
                Object.keys(createRecordDict).forEach((recordType, index) => {
                    if (Object.keys(RecordTypeEnum).includes(recordType.toUpperCase())) {
                        recordType = RecordTypeEnum[recordType.toUpperCase()];
                    } else if (!Object.values(RecordTypeEnum).includes(recordType.toLowerCase())) {
                        writeLog(LogTypeEnum.ERROR, 
                            `Invalid recordType in createRecordDict[${recordType}] i.e. createRecordDict.keys()[${index}]`, 
                            `Invalid recordType: "${recordType}". Must be a RecordTypeEnum key or one of RecordTypeEnum's values: [${Object.values(RecordTypeEnum).join(', ')}].`);
                        return;
                    }
                    let reqArray = createRecordDict[recordType];
                    if (!Array.isArray(reqArray)) {
                        writeLog(LogTypeEnum.ERROR, `Invalid createRecordDict[${recordType}]`, 'createReqArray is not an array or is empty');
                        return;
                    }
                    writeLog(LogTypeEnum.AUDIT, `createRecordDict[key=${recordType}, keyIndex=${index}].length:`, reqArray.length);
                    for (let i = 0; i < reqArray.length; i++) {
                        let createReq = reqArray[i];
                        let results = processCreateRecordOptions(createReq);
                        if (!results) {
                            writeLog(LogTypeEnum.ERROR, `Error Processing createRecordDict[${recordType}][${i}]`, `value.element ${i} CreateRecordOptions`);
                            continue;
                        } 
                        resultsArray.push(results);
                    }
                });
            }      
            writeLog(LogTypeEnum.DEBUG, 'POST (BatchCreateRecordRequest) End', { recIdArrayLength: resultsArray.length });
            /**@type {BatchCreateRecordResponse}*/
            return { 
                success: true,
                message: 'Records created successfully',
                results: resultsArray,
                logArray: logArray
            }
        } catch (/**@type {Error}*/e) {
            writeLog(LogTypeEnum.ERROR, 'post.catch(e): Error processing request in POST_BatchCreateRecord', JSON.stringify(e, null, 4));
            /**@type {BatchCreateRecordResponse}*/
            return { 
                success: false,
                message: 'Error processing POST_BatchCreateRecord request',
                results: resultsArray,
                error: e.toString(),
                logArray: logArray
            }
        }
    }

    /**
     * @param {CreateRecordOptions} createReq {@link CreateRecordOptions} = { `recordType`, `isDynamic`=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary} }.
     * @param {string} createReq.recordType - The record type to create, see {@link RecordTypeEnum} (e.g. 'assemblyitem')
     * @param {boolean} [createReq.isDynamic=false] - Indicates if the record should be created in dynamic mode. Default is `false`.
     * @param {FieldDictionary} [createReq.fieldDict]
     * - {@link FieldDictionary} = { `priorityFields`: Array<{@link SetFieldValueOptions}>, `textFields`: Array<{@link SetFieldTextOptions}>, `valueFields`: Array<{@link SetFieldValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> }.
     * - an object containing field IDs and their corresponding values.
     * @param {SublistDictionary} [createReq.sublistDict]
     * - {@link SublistDictionary} = Record<[`sublistId`: string], {@link SublistFieldDictionary}> = { `sublistId`: { `priorityFields`: Array<{@link SetSublistValueOptions}>, `textFields`: Array<{@link SetSublistTextOptions}>, `valueFields`: Array<{@link SetSublistValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> } }.
     * - an object containing sublist IDs and their corresponding field IDs and values.
     * @param {string|string[]} [responseProps] - (optional) the properties to include in the response in addition to the created record ID.
     * @returns {null | CreateRecordResults} `results` {@link CreateRecordResults} = 
     * or `null` if error
     */
    function processCreateRecordOptions(createReq, responseProps) {
        let {recordType, isDynamic, fieldDict, sublistDict} = createReq;
        if (!recordType || (!fieldDict && !sublistDict)) {
            writeLog(LogTypeEnum.ERROR, 'Input Error in Post_BatchCreateRecordRequest.processRecordRequest(createReq)', 
                'createReq {CreateRecordOptions} is missing required parameters: recordType and one of (fieldDict, sublistDict)');
            return null;
        }
        recordType = recordType.toLowerCase();
        if (Object.keys(RecordTypeEnum).includes(recordType.toUpperCase())) {
            recordType = RecordTypeEnum[recordType.toUpperCase()];
        } else if (!Object.values(RecordTypeEnum).includes(recordType)) {
            writeLog(LogTypeEnum.ERROR, 'Invalid recordType', 
                `Invalid recordType: "${recordType}". Must be a RecordTypeEnum key or one of RecordTypeEnum's values: ${Object.values(RecordTypeEnum).join(', ')}.`);
            return null;
        }
        
        try {
            let rec = record.create({ type: recordType, isDynamic });
            writeLog(LogTypeEnum.DEBUG, `processCreateRecordOptions().try Creating "${recordType}" record`, 
                `record.create({ type: ${recordType}, isDynamic: ${isDynamic} });`
            );
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
                            `WARNING! Invalid sublistId: ${sublistId}`, 
                            `processCreateRecordOptions.try.if(sublistDict).for[index].if Invalid sublistId: ${sublistId}`, 
                            `Sublist ID '${sublistId}' not found in ${recordType} record.`);
                        continue; // continue to next sublist
                    } else if (!hasNonTrivialKeys(sublistFieldDict)) {
                        writeLog(LogTypeEnum.ERROR, `Invalid sublistDict[${sublistId}]`, 
                            `sublistDict[${sublistId}]: SublistFieldDictionary is undefined or null or not an object or empty.`);
                        continue; // continue to next sublist
                    }
                    rec = processFieldDictionary(rec, recordType, sublistFieldDict, FieldDictTypeEnum.SUBLIST_FIELD_DICT);
                }
            }
            /**@type {CreateRecordResults} */
            const results = {};
            /**@type {number} */
            const recId = rec.save();
            writeLog(LogTypeEnum.AUDIT, `Successfully created ${recordType} record`, { recordId: recId });
            results.recordId = recId;
            if (responseProps) {
                if (isNonEmptyArray(responseProps)) {
                    responseProps.forEach((fieldId, index) => {
                        try {
                            fieldId = fieldId.toLowerCase();
                            results[fieldId] = rec.getValue({ fieldId });
                        } catch(e) {
                            writeLog(LogTypeEnum.ERROR, `Invalid responseProps[${index}]`, `responseProps[${index}]: ${fieldId} not found in ${recordType} record.`, e);
                            return;
                        }
                    });
                } else if (typeof responseProps === 'string') {
                    results[responseProps] = rec.getValue({ fieldId: responseProps });
                } else {
                    writeLog(LogTypeEnum.ERROR, 'Invalid responseProps', `responseProps must be a string or an array of strings.`);
                }
            }
            return results;
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, `processCreateRecordOptions().catch(e) Error creating "${recordType} record"`, e);
            return null;
        }
    }

    /**
     * called by {@link processFieldDictionary} to set field values on the record or subrecord.
     * @param {Object} rec - The current record or subrecord being processed.
     * @param {string} recordType - The record type {@link RecordTypeEnum} (e.g., 'assemblyitem', 'bom', 'bomrevision', 'inventoryitem', 'customer', 'salesorder', 'invoice', etc.)
     * @param {SetOptionsEnum} fieldType - The type of field to set ({@link SetOptionsEnum}) ( FIELD_TEXT, FIELD_VALUE, SUBLIST_TEXT, SUBLIST_VALUE).
     * @param {Array<SetFieldOptionsType>} fieldOptions - {@link SetFieldOptionsType} = Array<{@link SetFieldTextOptions} | {@link SetFieldValueOptions} | {@link SetSublistTextOptions} | {@link SetSublistValueOptions}>.
     * @param {OptionsArrayLabelEnum} [arrayLabel=OptionsArrayLabelEnum.DEFAULT_LABEL] The label of the field options array ("priorityFields", "textFields", "valueFields").
     * @returns {Object} rec - The record with the field values set.
     */
    function setFieldsByOptionType(
        rec, 
        recordType, 
        fieldType, 
        fieldOptions, 
        arrayLabel=OptionsArrayLabelEnum.DEFAULT_LABEL,
    ) {
        if (!rec || !fieldType || !fieldOptions) {
            writeLog(LogTypeEnum.ERROR, 'Invalid setFieldsByOptionType() parameters', 'rec, fieldType, fieldOptions are required');
            return rec;
        }
        try {
            /**@type {string[]} */
            let validFieldIds = undefined
            if (fieldType === SetOptionsEnum.FIELD_TEXT) {
                validFieldIds = rec.getFields();
                fieldOptions.forEach(({fieldId, text}, index) => {
                    fieldId = fieldId.toLowerCase();
                    if (!validFieldIds.includes(fieldId)) {
                        writeLog(LogTypeEnum.ERROR, `WARNING! possibly Invalid ${SetOptionsEnum.FIELD_TEXT} fieldId: '${fieldId}'`, `${arrayLabel}[${index}][${fieldId}] not found in ${recordType} record.getFields()`);
                        // return; // continue to next textField
                    } 
                    rec.setText({ fieldId, text });
                });
            } else if (fieldType === SetOptionsEnum.FIELD_VALUE) {
                validFieldIds = rec.getFields();
                fieldOptions.forEach(({fieldId, value}, index) => {
                    fieldId = fieldId.toLowerCase();
                    if (!validFieldIds.includes(fieldId)) {
                        writeLog(LogTypeEnum.ERROR, `WARNING! possibly Invalid ${SetOptionsEnum.FIELD_VALUE} fieldId: '${fieldId}'`, `${arrayLabel}[${index}][${fieldId}] not found in ${recordType} record.getFields()`);
                        // return; // continue to next valueField
                    }
                    rec.setValue({ fieldId, value });
                });
            } else if (fieldType === SetOptionsEnum.SUBLIST_TEXT) {
                fieldOptions.forEach(({sublistId, fieldId, line, text}, index) => {
                    fieldId = fieldId.toLowerCase();
                    validFieldIds = rec.getSublistFields({ sublistId });
                    if (!validFieldIds.includes(fieldId)) {
                        writeLog(LogTypeEnum.ERROR, `WARNING! possibly Invalid ${SetOptionsEnum.SUBLIST_TEXT} fieldId: ${fieldId}`, `${arrayLabel}[${index}][${fieldId}] not found in ${recordType} record.getSublistFields(${sublistId})`);
                        // return; // continue to next textField
                    }
                    line = validateSublistLine(rec, sublistId, line);
                    rec.setSublistText({ sublistId, fieldId, line, text });
                });
            } else if (fieldType === SetOptionsEnum.SUBLIST_VALUE) {
                fieldOptions.forEach(({sublistId, fieldId, line, value}, index) => {
                    fieldId = fieldId.toLowerCase();
                    validFieldIds = rec.getSublistFields({ sublistId });
                    if (!validFieldIds.includes(fieldId)) {
                        writeLog(LogTypeEnum.ERROR, `WARNING! possibly Invalid ${SetOptionsEnum.SUBLIST_VALUE} fieldId: '${fieldId}'`, `${arrayLabel}[${index}][${fieldId}] not found in ${recordType} record.getSublistFields(${sublistId})`);
                        // return; // continue to next valueField
                    }
                    line = validateSublistLine(rec, sublistId, line);
                    rec.setSublistValue({ sublistId, fieldId, line, value });
                });
            } else {
                writeLog(LogTypeEnum.ERROR, 
                    `setFieldsByOptionType() Invalid field type: ${fieldType}`, 
                    `setFieldsByOptionType(recordType=${recordType}, fieldType=${fieldType}, fieldOptions=${fieldOptions}, arrayLabel=${arrayLabel})`,
                );
            }
            return rec;
        } catch (e) {
            // writeLog(LogTypeEnum.ERROR, `Error in setFieldsByOptionType()`, e.message ? e.stack : e.toString());
            writeLog(LogTypeEnum.ERROR, `Error in setFieldsByOptionType()`, e);
            return rec;
        }
    }


    /**
     * @description Process the field dictionary and set the field values on the record or subrecord.
     * - calls {@link setFieldsByOptionType}(`dict.key`) for key in `[priorityFields, textFields, valueFields]` if {@link isNonEmptyArray}(dict.key) is true.
     * - calls {@link processSubrecordOptions}(`rec, recordType, dict.subrecordFields.subrecordOptions`) for each subrecordOptionbs in `dict.subrecordFields` if {@link isNonEmptyArray}(`dict.subrecordFields`) is true.
     * @param {Object} rec - The current record being processed.
     * @param {string} recordType - The record type {@link RecordTypeEnum}
     * @param {FieldDictionary | SublistFieldDictionary} dict either a {@link FieldDictionary} or a {@link SublistFieldDictionary}
     * @param {FieldDictTypeEnum} dictType - The type of dictionary being processed must be either `"fieldDict"` ({@link FieldDictTypeEnum.FIELD_DICT}) or `"sublistFieldDict"` ({@link FieldDictTypeEnum.SUBLIST_FIELD_DICT}). 
     * @returns {Object} rec - {Object} - The record with the field values set.
     */
    function processFieldDictionary(rec, recordType, dict, dictType) {
        if (!rec || !recordType || !dict || !dictType) {
            writeLog(LogTypeEnum.ERROR, 'Invalid processFieldDictionary() parameters', 'rec, recordType, dict, dictType are required');
            return rec;
        }
        if (dictType !== FieldDictTypeEnum.FIELD_DICT && dictType !== FieldDictTypeEnum.SUBLIST_FIELD_DICT) {
            writeLog(LogTypeEnum.ERROR, 'processFieldDictionary() Invalid dictType', `received dictType=${dictType} but dictType must be either ${FieldDictTypeEnum.FIELD_DICT} or ${FieldDictTypeEnum.SUBLIST_FIELD_DICT}`);
            return rec;
        }
        try {
            if (rec && dict && dictType === FieldDictTypeEnum.FIELD_DICT) {
                if (isNonEmptyArray(dict.priorityFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.FIELD_VALUE, dict.priorityFields, OptionsArrayLabelEnum.PRIORITY);
                }
                if (isNonEmptyArray(dict.textFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.FIELD_TEXT, dict.textFields, OptionsArrayLabelEnum.TEXT);
                }
                if (isNonEmptyArray(dict.valueFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.FIELD_VALUE, dict.valueFields, OptionsArrayLabelEnum.VALUE);
                }
                if (isNonEmptyArray(dict.subrecordFields)) {
                    for (let [index, subrecOptions] of dict.subrecordFields.entries()) {
                        writeLog(LogTypeEnum.DEBUG, `Processing fieldDict.subrecordFields[${index}]`);
                        rec = processSubrecordOptions(rec, recordType, subrecOptions);
                    }
                }
            } else if (rec && dict && dictType === FieldDictTypeEnum.SUBLIST_FIELD_DICT) {
                if (isNonEmptyArray(dict.priorityFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.SUBLIST_VALUE, dict.priorityFields, OptionsArrayLabelEnum.PRIORITY);
                }
                if (isNonEmptyArray(dict.textFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.SUBLIST_TEXT, dict.textFields, OptionsArrayLabelEnum.TEXT);
                }
                if (isNonEmptyArray(dict.valueFields)) {
                    rec = setFieldsByOptionType(rec, recordType, SetOptionsEnum.SUBLIST_VALUE, dict.valueFields, OptionsArrayLabelEnum.VALUE);
                }
                if (isNonEmptyArray(dict.subrecordFields)) {
                    for (let [index, subrecOptions] of Object.entries(dict.subrecordFields)) {
                        writeLog(LogTypeEnum.DEBUG, `Processing sublistFieldDict.subrecordFields[${index}]`);
                        rec = processSubrecordOptions(rec, recordType, subrecOptions);
                    }
                }
            }
            return rec;
        } catch (e) {
            // writeLog(LogTypeEnum.ERROR, `Error in processFieldDictionary()`, e.message ? e.stack : e.toString());
            writeLog(LogTypeEnum.ERROR, `Error in processFieldDictionary()`, e);
            return rec;
        }
    }

    /**
     * @note does not yet support isDynamic being true
     * @param {Object} rec - the parent record
     * @param {string} recordType {@link RecordTypeEnum} = record type of parent record
     * @param {SetSubrecordOptions} subrecordOptions {@link SetSubrecordOptions} = { `sublistId`?: string, `line`?: number, `fieldId`: string, `subrecordType`: string,  `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}>.
     * @param {string} subrecordOptions.sublistId - (optional) the sublist ID of the subrecord. If not provided, assume that the subrecord corresponds to a body field of the main record.
     * @param {string} subrecordOptions.fieldId - the field ID of the subrecord. This is a required property.
     * @param {string} subrecordOptions.subrecordType - the subrecord type
     * @param {number} subrecordOptions.line - (optional) the line index of the subrecord in the sublist. This is only used if `sublistId` is provided.
     * @param {FieldDictionary} subrecordOptions.fieldDict - (optional) a {@link FieldDictionary} for the subrecord's body fields.
     * @param {SublistDictionary} subrecordOptions.sublistDict - (optional) a {@link SublistDictionary} for the subrecord's sublist fields.
     * @returns {Object} rec - The record with the its subrecord values set.
     * @description (Option A and B are mutually exclusive)
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
            // writeLog(LogTypeEnum.DEBUG, `validateSublistLine(rec, sublistId=${sublistId}, line=${line})`, 
            //     `line: ${line} is out of bounds for sublistId: ${sublistId} with lineCount: ${lineCount}`,
            //     `inserting a new line at index ${lineCount}`
            // );
            rec.insertLine({ sublistId, line: lineCount });
            return lineCount; // return the new line index
        }
        return line; // return the original line index because it is valid
    }

    /**
     * @TODO - decide if this is necessary abstraction or if should just use Array.isArray() and arr.length > 0 everywhere
     * @param {any} arr 
     * @returns {boolean} true if arr is an array and has at least one element, false otherwise.
     */
    const isNonEmptyArray = (arr) => {
        return Array.isArray(arr) && arr.length > 0;
    }
    /**
     * @description Check if an object has any non-empty keys (not undefined, null, or empty string). 
     * - passing in an array will return `false`.
     * @param {Object} obj - The object to check.
     * @param {Object} [objName=undefined] - `(optional)` The object name for logging purposes.
     * @returns {boolean} `true` if the object has any non-empty keys, `false` otherwise.
     */
    const hasNonTrivialKeys = (obj, objName=undefined) => {
        if (typeof obj !== 'object' || !obj || Array.isArray(obj)) {
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
     * @param {any} [details]
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
        logArray.push({ timestamp: getCurrentPacificTime(), type, title, details, message: payload });
    }

    /**
     * Gets the current date and time in Pacific Time
     * @returns {string} The current date and time in Pacific Time
     */
    function getCurrentPacificTime() {
        const currentDate = new Date();
        const pacificTime = currentDate.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
        return pacificTime;
    }

/**
 * @enum {string} FieldDictTypeEnum
 * @description Enum for field dictionary types used in {@link processFieldDictionary} and {@link processSubrecordOptions}
 * @property {string} FIELD_DICT - indicates a dictionary is a {@link FieldDictionary}, with values for a record's main body fields
 * @property {string} SUBLIST_FIELD_DICT - indicates a dictionary is a {@link SublistFieldDictionary}, with values for a record's sublist fields
 */
const FieldDictTypeEnum = {
    /** indicates a dictionary is a {@link FieldDictionary}, with values for a record's main body fields */
    FIELD_DICT: 'fieldDict',
    /** indicates a dictionary is a {@link SublistFieldDictionary}, with values for a record's sublist fields */
    SUBLIST_FIELD_DICT: 'sublistFieldDict'
}
/**
 * Definition of Request body for the POST function in POST_BatchCreateRecord.js
 * @typedef {Object} BatchCreateRecordRequest
 * @property {Array<CreateRecordOptions>} [createRecordArray] 
 * `Array<`{@link CreateRecordOptions}`>` to create records in NetSuite.
 * @property {{[K in RecordTypeEnum]?: Array<CreateRecordOptions>}} [createRecordDict] 
 * `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link CreateRecordOptions}`>>` to create records in NetSuite.
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internal IDs.
 */


/**
 * @typedef {{recordId: number; [fieldId: string]: FieldValue;}} CreateRecordResults
 */

/**
 * Definition of Response for the POST function in POST_BatchCreateRecord.js
 * @typedef {Object} BatchCreateRecordResponse
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {CreateRecordResults[]} resultsArray - an `Array<`{@link CreateRecordResults}`>` containing the record ids and any additional properties specified in the request for all the records successfully created.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */

// CreateRecordOptions
/**
 * \@notimplemented CreateRecordOptions.defaultValues - {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4267255811.html#bridgehead_4423371543:~:text=the%20sublist%20type.-,N/record%20Default%20Values,-You%20can%20specify}
 * 
 * @typedef {Object} CreateRecordOptions
 * @property {RecordTypeEnum} recordType - The record type to create, see {@link RecordTypeEnum} (e.g., 'assemblyitem', 'bom', 'inventoryitem', 'customer', 'salesorder', etc.)
 * @property {boolean} [isDynamic=false] - (optional) Indicates if the record should be created in dynamic mode. Default is false. see {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4296707316.html}
 * @property {FieldDictionary} [fieldDict] a dictionary of field IDs and values.
 * - {@link FieldDictionary} = { `priorityFields`: Array<{@link SetFieldValueOptions}>, `textFields`: Array<{@link SetFieldTextOptions}>, `valueFields`: Array<{@link SetFieldValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> }.
 * @property {SublistDictionary} [sublistDict] an object containing sublist IDs mapped to a dictionary of field IDs and values.
 * - {@link SublistDictionary} = Record<[sublistId: string], {@link SublistFieldDictionary}> = { `sublistId`: { `priorityFields`: Array<{@link SetFieldValueOptions}>, `textFields`: Array<{@link SetSublistTextOptions}>, `valueFields`: Array<{@link SetSublistValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> } }.
 */

/**
 * @typedef {Record<string, SublistFieldDictionary>} SublistDictionary = Record\<[`sublistId`: string], {@link SublistFieldDictionary}> an object containing sublist IDs mapped to a dictionary of field IDs and values.
 */

/**
 * \@reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4687606306.html}
 *  ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetSubrecordOptions
 * @property {string} [parentSublistId] - (If setting subrecord of a sublist) The internal ID of the parent record's sublist that contains a subrecord field. (e.g. vendor (the parent) has a sublist id 'addressbook')
 * @property {string} fieldId - The internal ID of the field or sublistField that is a subrecord. (e.g. 'addressbookaddress'), 
 * - If the subrecord is on the main record, use `rec.getSubrecord({fieldId})` = getSubrecord(options: GetFieldOptions): Omit<Record, "save">;
 * - If the subrecord is in a sublist, use `rec.getSublistSubrecord({sublistId, fieldId})`
 * @property {string} [subrecordType] - The record type of the subrecord. (e.g. 'address', 'inventorydetail', etc.)
 * @property {number} [line] - The line number for the field. (i.e. index of the sublist row) defaults to new line. (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {FieldDictionary} [fieldDict] - {@link FieldDictionary} = { `priorityFields`: Array<{@link SetFieldValueOptions}>, `textFields`: Array<{@link SetFieldTextOptions}>, `valueFields`: Array<{@link SetFieldValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> }.
 * @property {SublistDictionary} [sublistDict] - {@link SublistDictionary} = Record<[`sublistId`: string], {@link SublistFieldDictionary}> = { `sublistId`: { `priorityFields`: Array<{@link SetSublistValueOptions}>, `textFields`: Array<{@link SetSublistTextOptions}>, `valueFields`: Array<{@link SetSublistValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> } }.
 * - (if subrecord has own sublists) an object containing sublist IDs mapped to a dictionary of field IDs and values.
 */

/**
 * @typedef {Object} LogStatement
 * @property {string} timestamp - The timestamp of the log entry.
 * @property {LogTypeEnum} type - The type of log entry (see {@link LogTypeEnum}).
 * @property {string} title - The title of the log entry.
 * @property {any} details - The details of the log entry.
 * @property {string} message - The message of the log entry = concatenated string of details's contents (if details is an array).
 * @description typedef for elements of the {@link logArray} array
 */

/**
 * @enum {string} `LogTypeEnum`
 * @description `Enum` for NetSuite's log module types
 * @property {string} DEBUG - Debug log type
 * @property {string} ERROR - Error log type
 * @property {string} AUDIT - Audit log type
 * @property {string} EMERGENCY - Emergency log type
 * @readonly
 */
const LogTypeEnum = {
    DEBUG: 'debug',
    ERROR: 'error',
    AUDIT: 'audit',
    EMERGENCY: 'emergency',
};

/**
 * @enum {string} `SetOptionsEnum`
 * @description `Enum` used in {@link setFieldsByOptionType}() to indicate which function to call for setting field values in the record.
 * @property {string} FIELD_TEXT - fieldText ({@link SetFieldTextOptions}) set text field of record
 * @property {string} FIELD_VALUE - fieldValue ({@link SetFieldValueOptions}) set value field of record
 * @property {string} SUBLIST_TEXT - sublistText ({@link SetSublistTextOptions}) set text field of record's sublist
 * @property {string} SUBLIST_VALUE - sublistValue ({@link SetSublistValueOptions}) set value field of record's sublist
 */
const SetOptionsEnum = {
    FIELD_TEXT: 'fieldText',
    FIELD_VALUE: 'fieldValue',
    SUBLIST_TEXT: 'sublistText',
    SUBLIST_VALUE: 'sublistValue',
}

/**
 * @typedef {SetFieldTextOptions | SetFieldValueOptions | SetSublistTextOptions | SetSublistValueOptions | SetSubrecordOptions} SetFieldOptionsType 
 * */

/**
 * @description `Enum` for the label of the field options array, used in {@link setFieldsByOptionType} and {@link processFieldDictionary}
 * @enum {string} `OptionsArrayLabelEnum` 
 * @property {string} PRIORITY - priorityFields are set first
 * @property {string} VALUE - valueFields
 * @property {string} SUBRECORD - subrecordFields
 * @property {string} DEFAULT_LABEL - default label for field options array
 */
const OptionsArrayLabelEnum = {
    PRIORITY: 'priorityFields',
    TEXT: 'textFields',
    VALUE: 'valueFields',
    SUBRECORD: 'subrecordFields',
    DEFAULT_LABEL: 'optionsArray'
}
/** 
 * @enum {string} FieldInputTypeEnum
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html}
 * @property {string} TEXT `Text` fields accept `string` values. 
 * @property {string} RADIO `Radio` fields accept `string` values.
 * @property {string} SELECT `Select` fields accept `string` and `number` values.
 * @property {string} MULTISELECT `Multi-Select` fields accept `arrays` of `string` or `number` values.
 * @property {string} CHECKBOX `Checkbox` fields accept `boolean` values.
 * @property {string} DATE `Date` and `DateTime` fields accept {@link Date} values.
 * @property {string} INTEGER `Integer` fields accept `number` values.
 * @property {string} FLOAT `Float` fields accept `number` values.
 * @property {string} CURRENCY `Currency` fields accept `number` values.
 * @property {string} PERCENT `Percent` fields accept `number` values.
 * @property {string} INLINE_HTML `Inline HTML` fields accept `strings`. Strings containing HTML tags are represented as HTML entities in UI. {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html#:~:text=The%20following%20code%20sample%20shows%20the%20syntax%20for%20INLINEHTML%20fields%20and%20what%20is%20returned.}
 */
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

// FieldDictionary
/**
 * Fields organized by the fields' value type
 * - priorityFields (optional) are set first
 * @typedef {Object} FieldDictionary
 * @property {Array.<SetFieldValueOptions>} [priorityFields] - priorityFields are set first. Useful if creating records in dynamic mode {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4296707316.html}
 * - Array<{@link SetFieldValueOptions}> = Array<{`fieldId`: string, `value`: {@link FieldValue}}>. 
 * - For record fields: record.setValue(fieldId, value)
 * @property {Array.<SetFieldTextOptions>} [textFields] 
 * - Array<{@link SetFieldTextOptions}> = Array<{`fieldId`: string, `text`: string}>. 
 * - For record fields: record.setText(fieldId, text)
 * @property {Array.<SetFieldValueOptions>} [valueFields] 
 * - Array<{@link SetFieldValueOptions}> = Array<{`fieldId`: string, `value`: {@link FieldValue}}>. 
 * - For record fields: record.setValue(fieldId, value)
 * @property {Array.<SetSubrecordOptions>} [subrecordFields] 
 * - Array<{@link SetSubrecordOptions}> = Array<{`sublistId`: string=undefined, `fieldId`: string, `subrecordType`: string, `line`: number=undefined, `fieldDict`: {@link FieldDictionary}, `sublistFieldDict`: {@link SublistFieldDictionary}}>.
 * - subrecords corresponding to a body field in the main record
 */

// SublistFieldDictionary
/**
 * Set a record's sublist's field values organized by field type
 * - priorityFields `(optional)` are set first
 * @typedef {Object} SublistFieldDictionary
 * @property {Array.<SetFieldValueOptions>} [priorityFields] - `(optional)` priorityFields are set first. Useful if creating records in dynamic mode {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4296707316.html}
 * - Array<{@link SetFieldValueOptions}> = Array<{`fieldId`: string, `value`: {@link FieldValue}}>. 
 * - For record fields: record.setSublistValue(fieldId, value)
 * @property {Array.<SetSublistTextOptions>} [textFields] 
 * - Array<{@link SetSublistTextOptions}> = Array<{`sublistId`: string, `fieldId`: string, `line`: number, `text`: string}>. 
 * - For record sublist fields: rec.setSublistText(sublistId, fieldId, line, text)
 * @property {Array.<SetSublistValueOptions>} [valueFields]  
 * - Array<{@link SetSublistValueOptions}> = Array<{`sublistId`: string, `fieldId`: string, `line`: number, `value`: {@link FieldValue}}>. 
 * - For record sublist fields: rec.setSublistValue(sublistId, fieldId, line, value)
 * @property {Array.<SetSubrecordOptions>} [subrecordFields]
 * - Array<{@link SetSubrecordOptions}> = Array<{`sublistId`: string, `fieldId`: string, `subrecordType`: string, `line`: number, `fieldDict`: {@link FieldDictionary}, `sublistFieldDict`: {@link SublistFieldDictionary}}>.
 * - subrecords corresponding to a field in a record's sublist
 */

// FieldValue
/**
 * The value type must correspond to the field type being set. For example:
 * - Text, Radio and Select fields accept string values.
 * - Checkbox fields accept Boolean values.
 * - Date and DateTime fields accept Date values.
 * - Integer, Float, Currency and Percent fields accept number values.
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Date | number | number[] | string | string[] | boolean | null} FieldValue 
 */

// SetFieldValueOptions
/**
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetFieldValueOptions
 * @property {string} fieldId - The internal ID of a standard or custom field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the field to. 
 * - = {Date | number | number[] | string | string[] | boolean | null}
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */

/**
 * Sets the value of the field by a text representation.
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetFieldTextOptions
 * @property {string} fieldId - The internal ID of a standard or custom field.
 * @property {string} text - The text to set the value to.
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */

/**
 * Sets the value of the field by a text representation.
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetSublistTextOptions
 * @property {string} sublistId - The internal ID of the sublist.
 * @property {string} fieldId - (i.e. sublistFieldId) The internal ID of a standard or custom sublist field.
 * @property {number} line - The line number for the field. (i.e. index of the sublist row) (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {string} text - The text to set the value to.
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */

/**
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Object} SetSublistValueOptions
 * @property {string} sublistId - The internal ID of the sublist.
 * @property {string} fieldId - The internal ID of a standard or custom sublist field.
 * @property {number} line - The line number for the field. (i.e. index of the sublist row) (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the sublist field to.
 * - = {Date | number | number[] | string | string[] | boolean | null}
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */



/**
 * @enum {string} RecordTypeEnum
 * @readonly
 * @description supported NetSuite API record types As of 4 June 2024
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * 
 * @property {string} ACCOUNT - account
 * @property {string} ACCOUNTING_BOOK - accountingbook
 * @property {string} ACCOUNTING_CONTEXT - accountingcontext
 * @property {string} ACCOUNTING_PERIOD - accountingperiod
 * @property {string} ADV_INTER_COMPANY_JOURNAL_ENTRY - advintercompanyjournalentry
 * @property {string} ALLOCATION_SCHEDULE - allocationschedule
 * @property {string} AMORTIZATION_SCHEDULE - amortizationschedule
 * @property {string} AMORTIZATION_TEMPLATE - amortizationtemplate
 * @property {string} ASSEMBLY_BUILD - assemblybuild
 * @property {string} ASSEMBLY_ITEM - assemblyitem
 * @property {string} ASSEMBLY_UNBUILD - assemblyunbuild
 * @property {string} AUTOMATED_CLEARING_HOUSE - automatedclearinghouse
 * @property {string} BALANCE_TRX_BY_SEGMENTS - balancetrxbysegments
 * @property {string} BILLING_ACCOUNT - billingaccount
 * @property {string} BILLING_CLASS - billingclass
 * @property {string} BILLING_RATE_CARD - billingratecard
 * @property {string} BILLING_REVENUE_EVENT - billingrevenueevent
 * @property {string} BILLING_SCHEDULE - billingschedule
 * @property {string} BIN - bin
 * @property {string} BIN_TRANSFER - bintransfer
 * @property {string} BIN_WORKSHEET - binworksheet
 * @property {string} BLANKET_PURCHASE_ORDER - blanketpurchaseorder
 * @property {string} BOM - bom
 * @property {string} BOM_REVISION - bomrevision
 * @property {string} BONUS - bonus
 * @property {string} BONUS_TYPE - bonustype
 * @property {string} BUDGET_EXCHANGE_RATE - budgetexchangerate
 * @property {string} BULK_OWNERSHIP_TRANSFER - bulkownershiptransfer
 * @property {string} BUNDLE_INSTALLATION_SCRIPT - bundleinstallationscript
 * @property {string} CALENDAR_EVENT - calendarevent
 * @property {string} CAMPAIGN - campaign
 * @property {string} CAMPAIGN_RESPONSE - campaignresponse
 * @property {string} CAMPAIGN_TEMPLATE - campaigntemplate
 * @property {string} CARDHOLDER_AUTHENTICATION - cardholderauthentication
 * @property {string} CASH_REFUND - cashrefund
 * @property {string} CASH_SALE - cashsale
 * @property {string} CHARGE - charge
 * @property {string} CHARGE_RULE - chargerule
 * @property {string} CHECK - check
 * @property {string} CLASSIFICATION - classification
 * @property {string} CLIENT_SCRIPT - clientscript
 * @property {string} CMS_CONTENT - cmscontent
 * @property {string} CMS_CONTENT_TYPE - cmscontenttype
 * @property {string} CMS_PAGE - cmspage
 * @property {string} COMMERCE_CATEGORY - commercecategory
 * @property {string} COMPETITOR - competitor
 * @property {string} CONSOLIDATED_EXCHANGE_RATE - consolidatedexchangerate
 * @property {string} CONTACT - contact
 * @property {string} CONTACT_CATEGORY - contactcategory
 * @property {string} CONTACT_ROLE - contactrole
 * @property {string} COST_CATEGORY - costcategory
 * @property {string} COUPON_CODE - couponcode
 * @property {string} CREDIT_CARD_CHARGE - creditcardcharge
 * @property {string} CREDIT_CARD_REFUND - creditcardrefund
 * @property {string} CREDIT_MEMO - creditmemo
 * @property {string} CURRENCY - currency
 * @property {string} CUSTOMER - customer
 * @property {string} CUSTOMER_CATEGORY - customercategory
 * @property {string} CUSTOMER_DEPOSIT - customerdeposit
 * @property {string} CUSTOMER_MESSAGE - customermessage
 * @property {string} CUSTOMER_PAYMENT - customerpayment
 * @property {string} CUSTOMER_PAYMENT_AUTHORIZATION - customerpaymentauthorization
 * @property {string} CUSTOMER_REFUND - customerrefund
 * @property {string} CUSTOMER_STATUS - customerstatus
 * @property {string} CUSTOMER_SUBSIDIARY_RELATIONSHIP - customersubsidiaryrelationship
 * @property {string} CUSTOM_PURCHASE - custompurchase
 * @property {string} CUSTOM_RECORD - customrecord
 * @property {string} CUSTOM_SALE - customsale
 * @property {string} CUSTOM_TRANSACTION - customtransaction
 * @property {string} DEPARTMENT - department
 * @property {string} DEPOSIT - deposit
 * @property {string} DEPOSIT_APPLICATION - depositapplication
 * @property {string} DESCRIPTION_ITEM - descriptionitem
 * @property {string} DISCOUNT_ITEM - discountitem
 * @property {string} DOWNLOAD_ITEM - downloaditem
 * @property {string} EMAIL_TEMPLATE - emailtemplate
 * @property {string} EMPLOYEE - employee
 * @property {string} EMPLOYEE_CHANGE_REQUEST - employeechangerequest
 * @property {string} EMPLOYEE_CHANGE_REQUEST_TYPE - employeechangerequesttype
 * @property {string} EMPLOYEE_EXPENSE_SOURCE_TYPE - employeeexpensesourcetype
 * @property {string} EMPLOYEE_STATUS - employeestatus
 * @property {string} EMPLOYEE_TYPE - employeetype
 * @property {string} ENTITY_ACCOUNT_MAPPING - entityaccountmapping
 * @property {string} ESTIMATE - estimate
 * @property {string} EXPENSE_AMORTIZATION_EVENT - expenseamortizationevent
 * @property {string} EXPENSE_CATEGORY - expensecategory
 * @property {string} EXPENSE_PLAN - expenseplan
 * @property {string} EXPENSE_REPORT - expensereport
 * @property {string} EXPENSE_REPORT_POLICY - expensereportpolicy
 * @property {string} FAIR_VALUE_PRICE - fairvalueprice
 * @property {string} FINANCIAL_INSTITUTION - financialinstitution
 * @property {string} FIXED_AMOUNT_PROJECT_REVENUE_RULE - fixedamountprojectrevenuerule
 * @property {string} FOLDER - folder
 * @property {string} FORMAT_PROFILE - formatprofile
 * @property {string} FULFILLMENT_REQUEST - fulfillmentrequest
 * @property {string} GENERAL_TOKEN - generaltoken
 * @property {string} GENERIC_RESOURCE - genericresource
 * @property {string} GIFT_CERTIFICATE - giftcertificate
 * @property {string} GIFT_CERTIFICATE_ITEM - giftcertificateitem
 * @property {string} GL_NUMBERING_SEQUENCE - glnumberingsequence
 * @property {string} GLOBAL_ACCOUNT_MAPPING - globalaccountmapping
 * @property {string} GLOBAL_INVENTORY_RELATIONSHIP - globalinventoryrelationship
 * @property {string} GOAL - goal
 * @property {string} IMPORTED_EMPLOYEE_EXPENSE - importedemployeeexpense
 * @property {string} INBOUND_SHIPMENT - inboundshipment
 * @property {string} INTERCOMP_ALLOCATION_SCHEDULE - intercompallocationschedule
 * @property {string} INTER_COMPANY_JOURNAL_ENTRY - intercompanyjournalentry
 * @property {string} INTER_COMPANY_TRANSFER_ORDER - intercompanytransferorder
 * @property {string} INVENTORY_ADJUSTMENT - inventoryadjustment
 * @property {string} INVENTORY_COST_REVALUATION - inventorycostrevaluation
 * @property {string} INVENTORY_COUNT - inventorycount
 * @property {string} INVENTORY_DETAIL - inventorydetail
 * @property {string} INVENTORY_ITEM - inventoryitem
 * @property {string} INVENTORY_NUMBER - inventorynumber
 * @property {string} INVENTORY_STATUS - inventorystatus
 * @property {string} INVENTORY_STATUS_CHANGE - inventorystatuschange
 * @property {string} INVENTORY_TRANSFER - inventorytransfer
 * @property {string} INVENTORY_WORKSHEET - inventoryworksheet
 * @property {string} INVOICE - invoice
 * @property {string} INVOICE_GROUP - invoicegroup
 * @property {string} ISSUE - issue
 * @property {string} ISSUE_PRODUCT - issueproduct
 * @property {string} ISSUE_PRODUCT_VERSION - issueproductversion
 * @property {string} ITEM_ACCOUNT_MAPPING - itemaccountmapping
 * @property {string} ITEM_COLLECTION - itemcollection
 * @property {string} ITEM_COLLECTION_ITEM_MAP - itemcollectionitemmap
 * @property {string} ITEM_DEMAND_PLAN - itemdemandplan
 * @property {string} ITEM_FULFILLMENT - itemfulfillment
 * @property {string} ITEM_GROUP - itemgroup
 * @property {string} ITEM_LOCATION_CONFIGURATION - itemlocationconfiguration
 * @property {string} ITEM_PROCESS_FAMILY - itemprocessfamily
 * @property {string} ITEM_PROCESS_GROUP - itemprocessgroup
 * @property {string} ITEM_RECEIPT - itemreceipt
 * @property {string} ITEM_REVISION - itemrevision
 * @property {string} ITEM_SUPPLY_PLAN - itemsupplyplan
 * @property {string} JOB - job
 * @property {string} JOB_STATUS - jobstatus
 * @property {string} JOB_TYPE - jobtype
 * @property {string} JOURNAL_ENTRY - journalentry
 * @property {string} KIT_ITEM - kititem
 * @property {string} LABOR_BASED_PROJECT_REVENUE_RULE - laborbasedprojectrevenuerule
 * @property {string} LEAD - lead
 * @property {string} LOCATION - location
 * @property {string} LOT_NUMBERED_ASSEMBLY_ITEM - lotnumberedassemblyitem
 * @property {string} LOT_NUMBERED_INVENTORY_ITEM - lotnumberedinventoryitem
 * @property {string} MANUFACTURING_COST_TEMPLATE - manufacturingcosttemplate
 * @property {string} MANUFACTURING_OPERATION_TASK - manufacturingoperationtask
 * @property {string} MANUFACTURING_ROUTING - manufacturingrouting
 * @property {string} MAP_REDUCE_SCRIPT - mapreducescript
 * @property {string} MARKUP_ITEM - markupitem
 * @property {string} MASSUPDATE_SCRIPT - massupdatescript
 * @property {string} MEM_DOC - memdoc
 * @property {string} MERCHANDISE_HIERARCHY_LEVEL - merchandisehierarchylevel
 * @property {string} MERCHANDISE_HIERARCHY_NODE - merchandisehierarchynode
 * @property {string} MERCHANDISE_HIERARCHY_VERSION - merchandisehierarchyversion
 * @property {string} MESSAGE - message
 * @property {string} MFG_PLANNED_TIME - mfgplannedtime
 * @property {string} NEXUS - nexus
 * @property {string} NON_INVENTORY_ITEM - noninventoryitem
 * @property {string} NOTE - note
 * @property {string} NOTE_TYPE - notetype
 * @property {string} OPPORTUNITY - opportunity
 * @property {string} ORDER_RESERVATION - orderreservation
 * @property {string} ORDER_SCHEDULE - orderschedule
 * @property {string} ORDER_TYPE - ordertype
 * @property {string} OTHER_CHARGE_ITEM - otherchargeitem
 * @property {string} OTHER_NAME - othername
 * @property {string} OTHER_NAME_CATEGORY - othernamecategory
 * @property {string} PARTNER - partner
 * @property {string} PARTNER_CATEGORY - partnercategory
 * @property {string} PAYCHECK - paycheck
 * @property {string} PAYCHECK_JOURNAL - paycheckjournal
 * @property {string} PAYMENT_CARD - paymentcard
 * @property {string} PAYMENT_CARD_TOKEN - paymentcardtoken
 * @property {string} PAYMENT_ITEM - paymentitem
 * @property {string} PAYMENT_METHOD - paymentmethod
 * @property {string} PAYROLL_ITEM - payrollitem
 * @property {string} PCT_COMPLETE_PROJECT_REVENUE_RULE - pctcompleteprojectrevenuerule
 * @property {string} PERFORMANCE_METRIC - performancemetric
 * @property {string} PERFORMANCE_REVIEW - performancereview
 * @property {string} PERFORMANCE_REVIEW_SCHEDULE - performancereviewschedule
 * @property {string} PERIOD_END_JOURNAL - periodendjournal
 * @property {string} PHONE_CALL - phonecall
 * @property {string} PICK_STRATEGY - pickstrategy
 * @property {string} PICK_TASK - picktask
 * @property {string} PLANNED_ORDER - plannedorder
 * @property {string} PLANNING_ITEM_CATEGORY - planningitemcategory
 * @property {string} PLANNING_ITEM_GROUP - planningitemgroup
 * @property {string} PLANNING_RULE_GROUP - planningrulegroup
 * @property {string} PLANNING_VIEW - planningview
 * @property {string} PORTLET - portlet
 * @property {string} PRICE_BOOK - pricebook
 * @property {string} PRICE_LEVEL - pricelevel
 * @property {string} PRICE_PLAN - priceplan
 * @property {string} PRICING_GROUP - pricinggroup
 * @property {string} PROJECT_EXPENSE_TYPE - projectexpensetype
 * @property {string} PROJECT_IC_CHARGE_REQUEST - projecticchargerequest
 * @property {string} PROJECT_TASK - projecttask
 * @property {string} PROJECT_TEMPLATE - projecttemplate
 * @property {string} PROMOTION_CODE - promotioncode
 * @property {string} PROSPECT - prospect
 * @property {string} PURCHASE_CONTRACT - purchasecontract
 * @property {string} PURCHASE_ORDER - purchaseorder
 * @property {string} PURCHASE_REQUISITION - purchaserequisition
 * @property {string} REALLOCATE_ITEM - reallocateitem
 * @property {string} RECEIVE_INBOUND_SHIPMENT - receiveinboundshipment
 * @property {string} RESOURCE_ALLOCATION - resourceallocation
 * @property {string} RESTLET - restlet
 * @property {string} RETURN_AUTHORIZATION - returnauthorization
 * @property {string} REVENUE_ARRANGEMENT - revenuearrangement
 * @property {string} REVENUE_COMMITMENT - revenuecommitment
 * @property {string} REVENUE_COMMITMENT_REVERSAL - revenuecommitmentreversal
 * @property {string} REVENUE_PLAN - revenueplan
 * @property {string} REV_REC_FIELD_MAPPING - revrecfieldmapping
 * @property {string} REV_REC_SCHEDULE - revrecschedule
 * @property {string} REV_REC_TEMPLATE - revrectemplate
 * @property {string} SALES_CHANNEL - saleschannel
 * @property {string} SALES_ORDER - salesorder
 * @property {string} SALES_ROLE - salesrole
 * @property {string} SALES_TAX_ITEM - salestaxitem
 * @property {string} SCHEDULED_SCRIPT - scheduledscript
 * @property {string} SCHEDULED_SCRIPT_INSTANCE - scheduledscriptinstance
 * @property {string} SCRIPT_DEPLOYMENT - scriptdeployment
 * @property {string} SERIALIZED_ASSEMBLY_ITEM - serializedassemblyitem
 * @property {string} SERIALIZED_INVENTORY_ITEM - serializedinventoryitem
 * @property {string} SERVICE_ITEM - serviceitem
 * @property {string} SHIP_ITEM - shipitem
 * @property {string} SOLUTION - solution
 * @property {string} STATISTICAL_JOURNAL_ENTRY - statisticaljournalentry
 * @property {string} STORE_PICKUP_FULFILLMENT - storepickupfulfillment
 * @property {string} SUBSCRIPTION - subscription
 * @property {string} SUBSCRIPTION_CHANGE_ORDER - subscriptionchangeorder
 * @property {string} SUBSCRIPTION_LINE - subscriptionline
 * @property {string} SUBSCRIPTION_PLAN - subscriptionplan
 * @property {string} SUBSCRIPTION_TERM - subscriptionterm
 * @property {string} SUBSIDIARY - subsidiary
 * @property {string} SUBSIDIARY_SETTINGS - subsidiarysettings
 * @property {string} SUBTOTAL_ITEM - subtotalitem
 * @property {string} SUITELET - suitelet
 * @property {string} SUPPLY_CHAIN_SNAPSHOT - supplychainsnapshot
 * @property {string} SUPPLY_CHAIN_SNAPSHOT_SIMULATION - supplychainsnapshotsimulation
 * @property {string} SUPPLY_CHANGE_ORDER - supplychangeorder
 * @property {string} SUPPLY_PLAN_DEFINITION - supplyplandefinition
 * @property {string} SUPPORT_CASE - supportcase
 * @property {string} TASK - task
 * @property {string} TAX_ACCT - taxacct
 * @property {string} TAX_GROUP - taxgroup
 * @property {string} TAX_PERIOD - taxperiod
 * @property {string} TAX_TYPE - taxtype
 * @property {string} TERM - term
 * @property {string} TIME_BILL - timebill
 * @property {string} TIME_ENTRY - timeentry
 * @property {string} TIME_OFF_CHANGE - timeoffchange
 * @property {string} TIME_OFF_PLAN - timeoffplan
 * @property {string} TIME_OFF_REQUEST - timeoffrequest
 * @property {string} TIME_OFF_RULE - timeoffrule
 * @property {string} TIME_OFF_TYPE - timeofftype
 * @property {string} TIME_SHEET - timesheet
 * @property {string} TOPIC - topic
 * @property {string} TRANSFER_ORDER - transferorder
 * @property {string} UNITS_TYPE - unitstype
 * @property {string} UNLOCKED_TIME_PERIOD - unlockedtimeperiod
 * @property {string} USAGE - usage
 * @property {string} USEREVENT_SCRIPT - usereventscript
 * @property {string} VENDOR - vendor
 * @property {string} VENDOR_BILL - vendorbill
 * @property {string} VENDOR_CATEGORY - vendorcategory
 * @property {string} VENDOR_CREDIT - vendorcredit
 * @property {string} VENDOR_PAYMENT - vendorpayment
 * @property {string} VENDOR_PREPAYMENT - vendorprepayment
 * @property {string} VENDOR_PREPAYMENT_APPLICATION - vendorprepaymentapplication
 * @property {string} VENDOR_RETURN_AUTHORIZATION - vendorreturnauthorization
 * @property {string} VENDOR_SUBSIDIARY_RELATIONSHIP - vendorsubsidiaryrelationship
 * @property {string} WAVE - wave
 * @property {string} WBS - wbs
 * @property {string} WEBSITE - website
 * @property {string} WORKFLOW_ACTION_SCRIPT - workflowactionscript
 * @property {string} WORK_ORDER - workorder
 * @property {string} WORK_ORDER_CLOSE - workorderclose
 * @property {string} WORK_ORDER_COMPLETION - workordercompletion
 * @property {string} WORK_ORDER_ISSUE - workorderissue
 * @property {string} WORKPLACE - workplace
 * @property {string} ZONE - zone
 */
const RecordTypeEnum = { // As of 4 June 2024
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