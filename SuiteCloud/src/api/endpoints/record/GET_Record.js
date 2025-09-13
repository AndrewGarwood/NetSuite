/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName GET_Record
 * @PROD_ScriptId 
 * @PROD_DeployId 
 * @SB_ScriptId 1
 * @SB_DeployId 1
 */

define(['N/record', 'N/search', 'N/log'], (record, search, log) => {
/**
 * @type {LogStatement[]} - `Array<`{@link LogStatement}`>` = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
 * @see {@link writeLog}`(type, title, ...details)`
 * */
const logArray = [];
const EP = `GET_Record`;
/**
 * @param {{ recordType: string; idOptions: string; responseOptions: string; }} reqParams {@link SingleRecordRequest}
 * - use {@link unpackRequestParameters}`(reqParams)` to get {@link SingleRecordRequest}
 * @returns {RecordResponse} **`response`** {@link RecordResponse}
 */
const get = (reqParams) => {
    const source = getSourceString(EP, get.name);
    const unpackResult = unpackRequestParameters(reqParams);
    if (isRecordResponse(unpackResult)) { // if error unpacking
        return unpackResult;
    }
    writeLog(LogTypeEnum.AUDIT, 
        `${source} Successfully unpacked reqParams to SingleRecordRequest`
    );
    const { recordType, idOptions, responseOptions } = unpackResult;
    if (isNonEmptyArray(idOptions)) { 
        return getById(recordType, idOptions, responseOptions);
    } else if (!idOptions || isEmptyArray(idOptions)) {
        return getAll(recordType, responseOptions);
    } // else 
    return {
        status: 400,
        message: 'Bad Request',
        error: `Invalid request parameters: reqParams.idOptions; received: '${reqParams.idOptions}'`,
        logs: logArray,
        results: [],
        rejects: [reqParams]
    }; // as `RecordResponse`
};

/**
 * @param {{ recordType: string; idOptions: string; responseOptions: string; }} reqParams
 * @returns {SingleRecordRequest | RecordResponse} **`unpackResult`** `DeleteRecordRequest | RecordResponse`
 */
function unpackRequestParameters(reqParams) {
    const source = getSourceString(EP, unpackRequestParameters.name);
    if (!isObject(reqParams) 
        || !hasKeys(reqParams, 
            ['recordType', 'idOptions', 'responseOptions'], 
            false, true)) {
        return handleError(reqParams, source, [
            `Invalid Request Parameters Object: reqParams undefined or is not an object or is missing required keys`,
            `Expected: object with keys ['recordType', 'idOptions', 'responseOptions'(optional)]`,
            `Received: ${typeof reqParams} = '${reqParams}'`
        ]);
    }
    let recordType = reqParams.recordType;
    if (!isRecordTypeEnum(recordType)) {
        return handleError(reqParams, source, [
            `Invalid Request Parameter 'recordType'`,
            `Expected: RecordTypeEnum (string enum value)`,
            `Received: '${recordType}'`
        ]);
    }
    /**@type {idSearchOptions[]} */
    let idOptions = [];
    try {
        idOptions = JSON.parse(reqParams.idOptions);
        if (isIdSearchOptions(idOptions)) {
            idOptions = [idOptions]
        } else if (!(isNonEmptyArray(idOptions) 
            && idOptions.every(el=>isIdSearchOptions(el))
            )) {
            return handleError(reqParams, source, [
                `reqParams.idOptions is not a valid Array<idSearchOptions>`,
                `Expected: { idProp: string, idValue: any, searchOperator: string }[]`,
                `Received: ${typeof idOptions} = ${JSON.stringify(idOptions)}`
            ]);
        }
    } catch (error) {
        return handleError(reqParams, source, [
            `JSON.parse(reqParams.idOptions) failed`,
            `param 'idOptions' is not valid JSON string`,
            `caught: ${error}`
        ]);
    }
    /**@type {SingleRecordRequest} */
    const request = {recordType, idOptions};
    if (!reqParams.responseOptions 
        || isEmpty(reqParams.responseOptions) 
        || reqParams.responseOptions === 'undefined'
    ) { return request }
    /**@type {RecordResponseOptions} */
    let responseOptions = {}
    try {
        responseOptions = JSON.parse(reqParams.responseOptions);
        if (!isRecordResponseOptions(responseOptions)) {
            return handleError(reqParams, source, [
                `reqParams.responseOptions is not a valid RecordResponseOptions object`,
                `Expected: { fields?: string | string[] | undefined; sublists?: Record<string, string | string[]> | undefined; }[]`,
                `Received: ${typeof idOptions} = ${JSON.stringify(idOptions)}`
            ]);
        }
        request.responseOptions = responseOptions;
    } catch (error) {
        return handleError(reqParams, source, [
            `JSON.parse(reqParams.responseOptions) failed`,
            `param 'responseOptions' is not valid JSON string`,
            `caught: ${error}`
        ]);
    }
    return request;
}
/**
 * @param {string} source 
 * @param {Record<string, any>} requestContent 
 * @param {any[]} errorDetails
 * @param {number} status
 * @param {string} message
 * @returns {RecordResponse} **`errorResponse`** {@link RecordResponse}
 */
function handleError(
    requestContent,
    source,
    errorDetails,
    status = 400,
    message = `Bad Request: Invalid Parameter(s)`,
) {
    writeLog(LogTypeEnum.ERROR,
        `${source} -> ${message}`,
        ...errorDetails, 
        `requestContent: ${JSON.stringify(requestContent)}`
    );
    /**@type {RecordResponse} */
    let errorResponse = {
        status,
        message,
        error: `${source} ${errorDetails.join(', ')}`,
        logs: logArray,
        results: [],
        rejects: [requestContent]
    }
    return errorResponse;
}
/**
 * @param {RecordTypeEnum | string} recordType 
 * @param {idSearchOptions[]} idOptions 
 * @param {RecordResponseOptions} responseOptions 
 * @returns {RecordResponse}
 */
function getById(recordType, idOptions, responseOptions) {
    /**@type {RecordResponse} {@link RecordResponse} */
    const response = {}
    /**@type {object | undefined} */
    let rec = undefined;
    const recId = searchForRecordById(recordType, idOptions);
    if (isNaN(recId) || recId === null) {
        writeLog(LogTypeEnum.AUDIT,
            'GET_Record.getById() No record found',
            `No record found for recordType '${recordType}' with idOptions.values() = ${JSON.stringify(Object.values(idOptions))}`
        );
        response.status = 404;
        response.error = 'Record Not Found';
        response.message = `No '${recordType}' record found with idOptions.values() = ${JSON.stringify(Object.values(idOptions))}`;
        response.logs = logArray;
        response.results = [];
        response.rejects = [{recordType, idOptions, responseOptions}];
        return response;
    }
    response.status = 200;
    response.message = `Found '${recordType}' record with idOptions.values() = ${JSON.stringify(Object.values(idOptions))}`;
    response.results = [{
        internalid: recId, 
        recordType, 
        fields: {}, 
        sublists: {}
    }];
    rec = record.load({type: recordType, id: recId, isDynamic: NOT_DYNAMIC });
    writeLog(LogTypeEnum.DEBUG, 
        `Loading Existing ${recordType} record with internalid: '${recId}'`, 
    );
    if (responseOptions && responseOptions.fields) {
        response.results[0].fields = getResponseFields(rec, responseOptions.fields);
    }
    if (responseOptions && responseOptions.sublists) {
        response.results[0].sublists = getResponseSublists(rec, responseOptions.sublists);
    }
    response.logs = logArray;
    writeLog(LogTypeEnum.AUDIT, 
        `GET_Record.getById() Successfully retrieved record`, 
        `recordType: '${recordType}', internalid: '${recId}'`,
    );
    return response;
}

/**
 * @notimplemented probably have to return paginated results or something.
 * @param {RecordTypeEnum | string} recordType 
 * @param {RecordResponseOptions} responseOptions 
 * @returns {RecordResponse}
 */
function getAll(recordType, responseOptions) {
    const records = [];
    /**@type {RecordResponse} {@link RecordResponse} */
    const response = {
        status: 500,
        message: 'Internal Server Error',
        error: `getAll() not yet implemented`,
        logs: logArray,
        results: records
    }
    return response;
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
/**max number of times allowed to call `log.debug(title, details)` per `get()` call */
const MAX_LOGS_PER_LEVEL = 10;
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
            // log.debug(title, payload);
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
 * @param {any} arr 
 * @returns {arr is Array<any> & { length: number }} `arr is Array<any> & { length: number }`
 * - **`true`** `if` `arr` is an array and has at least one element, 
 * - **`false`** `otherwise`.
 */
function isNonEmptyArray(arr) {return Array.isArray(arr) && arr.length > 0; }
/**
 * @param {any} val 
 * @returns {arr is Array<any> & { length: 0 }} `arr is Array<any> & { length: 0 }` 
 * - **`true`** `if` `arr` is an array and has length = `0` (no elements), 
 * - **`false`** `otherwise`.
 */
function isEmptyArray(val) { return Array.isArray(val) && val.length === 0; }
/**
 * @param {any} value 
 * @returns {value is string[]}
 */
function isStringArray(value) { 
    return isNonEmptyArray(value) 
    && value.every(el => typeof el === 'string') 
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
 * @param {any} value
 * @return {value is RecordTypeEnum} 
 */
function isRecordTypeEnum(value) {
    return (isNonEmptyString(value) 
        && Object.values(RecordTypeEnum).includes(value)
    );
}
/**
 * @param {any} value 
 * @returns {value is RecordResponse} **`isRecordResponse`** `boolean`
 */
function isRecordResponse(value) {
    return (isObject(value)
        && hasKeys(value, 
            ['status', 'message', 'error', 'logs', 'results', 'rejects'],
            false, true
        )
    )
}
/**
 * @param {any} value
 * @returns {value is RecordResponseOptions} 
 */
function isRecordResponseOptions(value) {
    return Boolean(value && typeof value === 'object'
        && (!value.fields 
            || (isNonEmptyString(value.fields)
                || isEmptyArray(value.fields) 
                || isStringArray(value.fields)
            )
        )
        && (!value.sublists 
            || (typeof value.sublists === 'object'
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
 * - {@link RecordTypeEnum}
 * - {@link idSearchOptions}
 * - {@link RecordResponseOptions}
 * @typedef {{
 * recordType: string | RecordTypeEnum;
 * idOptions: idSearchOptions[],
 * responseOptions?: RecordResponseOptions,
 * }} SingleRecordRequest
 */

/**
 * @typedef {{
 * status: number;
 * message: string;
 * error?: string;
 * logs: LogStatement[];
 * results?: RecordResult[];
 * rejects?: any[]; 
 * }} RecordResponse
 */

/**
 * @typedef {Object} RecordResult
 * @property {number} internalid
 * @property {string | RecordTypeEnum} recordType
 * @property {FieldDictionary} fields
 * @property {SublistDictionary} sublists
 */
/**
 * @typedef {Object} RecordResponseOptions
 * @property {string | string[]} [fields] - `fieldId(s)` of the main record to return in the response.
 * @property {Record<string, string | string[]>} [sublists] `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response.
 */


/** Type: **`idSearchOptions`** {@link idSearchOptions} */
/**
 * options to search for an existing record to upsert 
 * @typedef {Object} idSearchOptions
 * @property {idPropertyEnum} idProp - The property to search for. See {@link idPropertyEnum}
 * @property {string | number | string[] | number[]} idValue - The value(s) of `idProp` to search for using `searchOperator`.
 * @property {RecordOperatorEnum} searchOperator - The operator to use for the search. See {@link RecordOperatorEnum}
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
 * [sublistId: string]: Array<SublistLine>
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
 * @typedef { { [fieldId: string]: FieldValue } | SetFieldSubrecordOptions | SetSublistSubrecordOptions} SubrecordValue 
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
 * - extends {@link SetFieldSubrecordOptions}
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

/**
 * @typedef {{
 * name: string;
 * join?: string;
 * operator: SearchOperatorEnum | string;
 * values?: FieldValue | FieldValue[] | string | Date | number | string[] | Date[] | number[] | boolean;
 * formula?: string;
 * summary?: ColumnSummaryEnum | string;
 * }} CreateSearchFilterOptions
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
 * @property {string} TRANSACTION_ID - The `'tranid'` (for transaction records)
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
 * values are fieldIds or sublistFieldIds where hasSubrecord() is `true`
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
    return { get };
});