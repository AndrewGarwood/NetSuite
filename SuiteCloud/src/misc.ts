/**
 * @file src/misc.ts
 * @description separate workspace script
 */
import * as fs from "node:fs";
import path from "node:path";
import {
    getBinDictionary, getSkuDictionary, initializeData, 
    STOP_RUNNING, 
    DELAY, simpleLogger as slog,
    miscLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    getWarehouseRows,
    getLogFiles,
    getAccountDictionary,
    initializeEnvironment,
    getProjectFolders
} from "./config";
import {
    readJsonFileAsObject as read,
    writeObjectToJsonSync as write,
    writeRowsToCsvSync as writeRows,
    trimFile,
    clearFile, 
    getCurrentPacificTime,
    formatDebugLogFile, 
    concatenateFiles,
    getRows,
    getColumnValues,
    getIndexedColumnValues, validatePath,
    indentedStringify,
    getDirectoryFiles,
    isRowSourceMetaData,
    isDirectory,
    getFileNameTimestamp,
    autoFormatLogsOnExit,
    getSourceString,
} from "typeshi:utils/io";
import { 
    FindSublistLineWithValueOptions, getAccessToken, isRecordOptions, 
    isRelatedRecordRequest, partitionArrayBySize, SublistFieldValueUpdate, SublistLine 
} from "./api";
import { 
    equivalentAlphanumericStrings, CleanStringOptions, clean, 
    stringContainsAnyOf, RegExpFlagsEnum, 
    extractLeaf,
    extractFileName
} from "typeshi:utils/regex";
import { SalesOrderColumnEnum } from "./parse_configurations/salesorder/salesOrderConstants";
import { CustomerColumnEnum } from "./parse_configurations/customer/customerConstants";
import { ItemColumnEnum } from "./parse_configurations/item/itemConstants";
import { 
    LN_INVENTORY_ITEM_PARSE_OPTIONS, 
    LN_INVENTORY_ITEM_POST_PROCESSING_OPTIONS 
} from "src/parse_configurations/item/itemParseDefinition";
import { 
    hasKeys, isEmptyArray, isInteger, isIntegerArray, isNonEmptyArray, 
    isNonEmptyString, isNullLike 
} from "typeshi:utils/typeValidation";
import { search as fuzzySearch, MatchData } from "fast-fuzzy";
import { idPropertyEnum, LogTypeEnum, RecordOptions, 
    RecordResponse, RecordTypeEnum, RecordResponseOptions, RecordResult,
    SearchOperatorEnum, getRecordById, 
    instantiateAuthManager, idSearchOptions, 
    SingleRecordRequest, RecordRequest, RelatedRecordRequest, ChildSearchOptions, getRelatedRecord
} from "./api";
import { SuiteScriptError, TaxScheduleEnum, encodeExternalId } from "./utils/ns";
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators/item";
import {
    WarehouseDictionary, WarehouseColumnEnum, WarehouseRow,
    putEntities, DEFAULT_ITEM_RESPONSE_OPTIONS,
    putItems
} from "src/pipelines";
import { extractTargetRows, reconcile } from "src/DataReconciler";
import { 
    parseRecordCsv, processParseResults, 
    ParseResults, ValidatedParseResults, ParseDictionary, 
    PostProcessDictionary, getCompositeDictionaries 
} from "src/services";
import * as validate from "typeshi:utils/argumentValidation";

/**
 * @TODO test if PUT_Record still works with findSublistLineWithValue() changes...
 * need to see if it works with string or number for item internalid
 */
const F = extractFileName(__filename);
const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}

let replacementDictionary: {
    [soInternalId: string]: {itemId: string, placeholderId: number}[]
} = {};
async function main(): Promise<void> {
    const source = getSourceString(F, main.name)
    await initializeEnvironment();
    let logFiles = getLogFiles();
    await clearFile(...logFiles);
    await initializeData();
    await instantiateAuthManager();
    mlog.info(`${source} START at ${getCurrentPacificTime()}`);

    let { logDir, dataDir } = getProjectFolders();
    let wDir = path.join(dataDir, 'workspace');
    const relatedRecordResults = read(
        path.join(logDir, 'items', 'related_record_dict.json')
    ) as { [itemId: string]: RecordResult[] };
    const safeToDelete: string[] = Object.keys(relatedRecordResults).filter(
        k=>!isNonEmptyArray(relatedRecordResults[k])
    ).sort();
    const itemsToProcess = (Object.keys(relatedRecordResults)
        .filter(k=>!safeToDelete.includes(k))
        .sort()
    );
    const targetItemDict: { [itemId: string]: RecordResult[] } = {}    
    for (let itemId of itemsToProcess) {
        targetItemDict[itemId] = relatedRecordResults[itemId];
    }
    let minLen = Math.min(...Object.values(targetItemDict).map(v=>v.length))
    mlog.info(`minLength RecordResult[] = ${minLen}`);
    write({itemIds: safeToDelete}, path.join(wDir, 'safe_to_delete.json'));
    write(targetItemDict, path.join(wDir, 'items_to_salesorders.json'));
    mlog.info([`${source} let's check real quick`,
        `relatedRecordResults.keys.length ${Object.keys(relatedRecordResults).length}`,
        `  safeToDelete.length: ${safeToDelete.length}`,
        `itemsToProcess.length: ${itemsToProcess.length}`
    ].join(TAB));


    await trimFile(5, ...logFiles);
    autoFormatLogsOnExit(logFiles)
    STOP_RUNNING(0);
}
main().catch(error => {
    mlog.error(`ERROR [${F}.main()]:`, JSON.stringify(error as any));
    STOP_RUNNING(1);
});


/**
 * @deprecated
 */
async function handleSalesOrderBatch(
    /**map salesorder internalid to list of itemIds to replace with placeholders */
    soDict: { [salesOrderInternalId: string]: string[] },
    batches: string[][],
    batchIndex: number, 
    placeholderIds: number[]
): Promise<{
    [soInternalId: string]: { itemId: string, placeholderId: number }[]
}> {
    const source = getSourceString(F, handleSalesOrderBatch.name, `${batchIndex+1}/${batches.length}`);
    validate.arrayArgument(source, {placeholderIds, isInteger});
    mlog.info(`${source} START`);
    let salesOrderIds = batches[batchIndex];
    let skuDictionary = getSkuDictionary();
    for (let soId of salesOrderIds) {
        const recordOptions: Required<RecordOptions> = {
            recordType: RecordTypeEnum.INVENTORY_ITEM,
            isDynamic: false,
            idOptions: [{
                idProp: idPropertyEnum.INTERNAL_ID,
                idValue: Number(soId),
                searchOperator: SearchOperatorEnum.RECORD.ANY_OF
            }] as idSearchOptions[],
            fields: {},
            sublists: {item: []},
            meta: {
                dataSource: 'misc.ts',
                sourceType: 'PUT_PLACEHOLDER'
            }
        }
        /**@consideration alt shape: {itemId: string; placeholderId: number}[] = []; */
        const replacements: { itemId: string; placeholderId: number }[] = [];
        const itemIdsToReplace = soDict[soId];
        for (let j = 0; j < itemIdsToReplace.length; j++) {
            let itemId = itemIdsToReplace[j];
            let itemInternalId = skuDictionary[itemId];
            if (!isNonEmptyString(itemInternalId)) {
                throw new Error(`${source} encountered itemId not in skuDictionary`)
            }
            replacements.push({itemId, placeholderId: placeholderIds[j]});
            // @TODO finish replacement logic and make api call to put endpoint after testing...
            recordOptions.sublists.item.push({
                item: { 
                    newValue: placeholderIds[j],
                    lineIdOptions: {
                        sublistId: 'item',
                        fieldId: 'item',
                        value: itemInternalId
                    } as FindSublistLineWithValueOptions
                } as SublistFieldValueUpdate
            } as SublistLine);
            
        }
        replacementDictionary[soId] = replacements;
    }
    return replacementDictionary;

}

/**
 * @TODO parameterize
 * @returns 
 */
async function makePlaceholders(
    salesOrderToItemDictPath: string,
    /**where to send response from making the placeholders */
    outputDir: string
): Promise<any> {
    const source = getSourceString(F, makePlaceholders.name);
    const accountDict = getAccountDictionary();
    let cogsDict = accountDict["Cost of Goods Sold"] ?? {};
    let assetDict = accountDict["Other Current Asset"] ?? {};
    const DEFAULT_COGS = cogsDict["Testing"];
    const DEFAULT_ASSET = assetDict["Inventory"];
    validate.multipleStringArguments(source, {DEFAULT_COGS, DEFAULT_ASSET});
    const responseOptions = { fields: ['itemid'] }

    validate.existingFileArgument(source, '.json', {salesOrderToItemDictPath});
    const soTargetItems = read(salesOrderToItemDictPath) as { [soInternalId: string]: string[] };
    let numPlaceholdersToMake = Math.max(...Object.values(soTargetItems).map(items=>items.length));
    mlog.info(`numPlaceholdersToMake: ${numPlaceholdersToMake}`); // 33
    const placeholders: any[] = [];
    for (let i = 0; i < numPlaceholdersToMake; i++) {
        let record: Required<RecordOptions> = {
            recordType: RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM,
            isDynamic: false,
            idOptions: [],
            fields: {
            },
            sublists: {},
            meta: {
                dataSource: 'misc.ts',
                sourceType: 'DUMMY_TEMPLATE'
            }
        };
        record.fields.itemid = `PLACEHOLDER_${i}`;
        record.fields.cogsaccount = Number(DEFAULT_COGS);
        record.fields.assetaccount = Number(DEFAULT_ASSET);
        record.fields.taxschedule = TaxScheduleEnum.DEFAULT;
        try {
            const [response] = await putItems([record], responseOptions);
            if (!isNonEmptyArray(response.results)) {
                mlog.error(`response undefined or has empty results...`);
                break;
            }
            const [recordResult] = response.results;
            placeholders.push(recordResult);
        } catch (error: any) {
            mlog.error([`${source} Error occurred when calling putItems()`, 
                `caught: ${error}`
            ].join(TAB));
            break;
        }
        await DELAY(1000, null);
    }
    mlog.info(`placeholders.length: ${placeholders.length}`)
    if (outputDir) write({placeholders}, path.join(outputDir, `item_placeholders.json`));

}

/**
 * @TODO parameterize
 * @returns 
 */
async function getRemainingItems(
    items: RecordOptions[]
): Promise<string[]> {
    const source = getSourceString(F, getRemainingItems.name);
    let itemIds = items
        .map(record => (record.fields ?? {}).itemid)
        .filter(idValue=>isNonEmptyString(idValue))
    let skuDict = await getSkuDictionary();
    let remainingItems: any[] = [];

    for (let itemId of itemIds) {
        let internalId = skuDict[itemId];
        if (!internalId) {
            mlog.warn([`${source} Invalid itemId`,
                `No existing internalid found for item with itemid = '${itemId}'`,
            ].join(TAB));
            continue;
        }
        const idOptions: idSearchOptions[] = [
            {
                idProp: idPropertyEnum.INTERNAL_ID,
                idValue: Number(internalId),
                searchOperator: SearchOperatorEnum.RECORD.ANY_OF
            },
            {
                idProp: idPropertyEnum.ITEM_ID,
                idValue: itemId,
                searchOperator: SearchOperatorEnum.TEXT.IS
            }
        ];
        let getReq: SingleRecordRequest = {
            recordType: RecordTypeEnum.INVENTORY_ITEM,
            idOptions: idOptions,
            responseOptions: DEFAULT_ITEM_RESPONSE_OPTIONS
        }
        let getRes = await getRecordById(getReq) as RecordResponse;
        await DELAY(1000, null);
        if (!getRes) {
            mlog.error([`${source} null/undefined response from getRecordById()`,
                `itemId: '${itemId}'`
            ].join(TAB));
            continue;
        }
        if (isNonEmptyArray(getRes.results)) {
            remainingItems.push(...getRes.results)
        }
    }
    mlog.info([`${source} Finished searching for items that still need to be deleted...`,
        `number of target items: ${itemIds.length}`,
        ` remainingItems.length: ${remainingItems.length}`
    ].join(TAB));
    return remainingItems;
}

/**
 * @TODO parameterize
 * @returns 
 */
async function extractLotNumberedItemRows(
    itemSourceFile: string,
    locationBins: WarehouseDictionary
): Promise<Record<string, any>[]> {
    const source = getSourceString(F, extractLotNumberedItemRows.name);
    let itemRows = await getRows(itemSourceFile);
    let targetItems: string[] = [];
    for (let [locId, binDict] of Object.entries(locationBins)) {
        let initialLength = targetItems.length
        for (let binId in binDict) {
            let binContent = binDict[binId];
            targetItems.push(...Object.keys(binContent).filter(
                itemId => !targetItems.includes(itemId) 
                && isNonEmptyArray(binContent[itemId].lotNumbers)
            ));
        
        }
        slog.debug([`${source} handled locId '${locId}'`,
            `added ${targetItems.length - initialLength} item(s) from ${locId}'s bin(s)`
        ].join(TAB));
    }
    const {rows: targetRows, remainingValues } = await extractTargetRows(
        itemRows, ItemColumnEnum.ITEM_ID, targetItems, itemIdExtractor
    );
    mlog.debug([`${source} finished getting rows from itemSourceFile`,
        // `targetItems.length: ${targetItems.length}`,
        // ` targetRows.length: ${targetRows.length}`,
        // `       difference = ${targetItems.length - targetRows.length}`
    ].join(TAB));
    return targetRows;



}


type RejectInfo = {
    timestamp: string;
    sourceFile: string;
    numRejects: number;
    rejectResponses: RecordResponse[];
}

/**
 * @param inputDir `string` directory path to look files ending with `targetSuffix` 
 * @param targetSuffix `string` e.g. `'_putRejects.json'`
 * @param outputDir `string` `optional` directory path to write two files:
 * 1. actual source data rows based on metadata in RejectInfo
 * 2. reasons the source data's generated request objects were rejected
 * @returns `Promise<void>`
 */
async function isolateFailedRequests(
    inputDir: string, 
    targetSuffix: string,
    outputDir?: string
): Promise<void> {
    const source = getSourceString(F, isolateFailedRequests.name);
    validate.existingDirectoryArgument(source, {inputDir});
    validate.stringArgument(source, {targetSuffix});
    if (outputDir) validate.existingDirectoryArgument(source, {outputDir});
    const rejectFiles = getDirectoryFiles(inputDir, '.json')
        .filter(f => f.endsWith(targetSuffix));
    if (!isEmptyArray(rejectFiles)) {
        mlog.warn([`${source} No reject files found with provided arguments`,
            `    inputDir: '${inputDir}'`,
            `targetSuffix: '${targetSuffix}'`
        ].join(TAB));
        return;
    }
    mlog.debug(`${source} rejectFiles.length: ${rejectFiles.length}`);
    const isoErrors: any[] = [];
    const rejectReasons: any[] = [];
    const issueDict: { [filePath: string]: number[] } = {};
    fileLoop:
    for (const filePath of rejectFiles) {
        const jsonData = read(filePath);
        let { sourceFile, rejectResponses } = jsonData as RejectInfo;
        let correctedPath = sourceFile.replace(/\.dev/, 'dev');
        issueDict[correctedPath] = [];
        responseLoop:
        for (const res of rejectResponses) {
            const logDetails = (res.logs
                .filter(l => l.type === LogTypeEnum.ERROR)
                .map(l => JSON.parse(l.details))
            );
            rejectReasons.push(...logDetails);
            const rejects: RecordOptions[] = res.rejects ?? [];
            rejectLoop:
            for (let i = 0; i < rejects.length; i++) {
                const record = rejects[i];
                if (isNullLike(record.meta)) { continue }
                let dataSource = record.meta.dataSource;
                if (!isRowSourceMetaData(dataSource)) { continue }
                if (!hasKeys(dataSource, sourceFile)) {
                    mlog.error(`${source} RejectInfo.sourceFile not in dataSource.keys()`)
                    isoErrors.push(res);
                    break responseLoop;
                }
                issueDict[correctedPath].push(...dataSource[sourceFile])
            }
        }
    }
    const issueRows: Record<string, any>[] = [];
    for (const [sourceFile, rowIndices] of Object.entries(issueDict)) {
        const rows = await getRows(sourceFile);
        issueRows.push(...rowIndices.map(i => rows[i]));
    }
    mlog.debug([`${source} Isolated problematic rows`,
        `isolation errors: ${isoErrors.length}`,
        `issueRows.length: ${issueRows.length}`,
        `num transactions: ${(
            await getColumnValues(issueRows, SalesOrderColumnEnum.SO_ID)
        ).length}`
    ].join(TAB));
    
    if (outputDir) {
        writeRows(issueRows, path.join(outputDir, `${path.basename(inputDir)}_reject_rows.tsv`));
        write({rejectReasons}, path.join(outputDir, `${path.basename(inputDir)}_reject_reasons.json`));
    }
}

/**
 * @TODO parameterize
 * @returns 
 */
async function storeReadableErrors(
    errorResolutionDir: string,
    fileName: string,
): Promise<void> {
    const jsonData = read(
        path.join(errorResolutionDir, fileName)
    ) as { rejectReasons: SuiteScriptError[] }; 
    const errors = jsonData.rejectReasons ?? [];
    const errorDict: Record<string, any> = {};
    for (const e of errors) {
        if (!hasKeys(errorDict, e.name)) {
            errorDict[e.name] = [];
        }
        if (!errorDict[e.name].includes(e.message)) {
            errorDict[e.name].push(e.message)
        }
    }
    write(errorDict, path.join(errorResolutionDir, 'readable_errors.json'))
}

enum SourceColumnEnum {
    ENTITY = 'Entity',
    ADDRESS = 'Address'
}

async function searchInCustomers(
    targetEntFile: string,
    customerFile: string,
    outputDir?: string,
): Promise<void> {
    const source = getSourceString(F, searchInCustomers.name);
    validate.multipleExistingFileArguments(source, '.tsv', {customerFile, targetEntFile})
    
    const customerRows = await getRows(customerFile);
    const entRows = await getRows(targetEntFile);
    const targetEntDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ENTITY);
    const targetAddressDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ADDRESS);
    
    slog.debug([`${source} Pause after init`, 
        `     num unique ents: ${Object.keys(targetEntDict).length}`,
        `num unique addresses: ${Object.keys(targetAddressDict).length}`,
    ].join(TAB));
    STOP_RUNNING(1);
    const POTENTIAL_ENT_COLUMNS = [
        CustomerColumnEnum.PRIMARY_CONTACT, 
        CustomerColumnEnum.ENTITY_ID, 
        CustomerColumnEnum.STREET_ONE, CustomerColumnEnum.STREET_TWO, 
        CustomerColumnEnum.BILL_TO_ONE, CustomerColumnEnum.BILL_TO_TWO,
        CustomerColumnEnum.SHIP_TO_STREET_ONE, CustomerColumnEnum.SHIP_TO_STREET_TWO, 
        CustomerColumnEnum.SHIP_TO_ONE, CustomerColumnEnum.SHIP_TO_TWO, 
        CustomerColumnEnum.SECONDARY_CONTACT,
    ];
    const entSearchResults: { [entity: string]: { [colName: string]: MatchData<string>[] } } = {}
    for (const targetEnt in targetEntDict) {
        entSearchResults[targetEnt] = {};
        for (let entCol of POTENTIAL_ENT_COLUMNS) {
            let potentialEnts = await getIndexedColumnValues(customerRows, entCol);
            let searchResults = fuzzySearch(targetEnt, Object.keys(potentialEnts), {returnMatchData: true})
            if (isNonEmptyArray(searchResults) && searchResults[0].score > 0.6) {
                entSearchResults[targetEnt][entCol] = searchResults;
            }
        }
    }
    if (isNonEmptyString(outputDir) && isDirectory(outputDir)) {
        write(entSearchResults, path.join(outputDir, `entity_fuzzy_search.json`));
    }
}

async function searchInSalesOrders(
    targetEntFile: string,// = path.join(DATA_DIR, 'reports', 'client_entity_list.tsv'),
    soDirectory: string,// = path.join(DATA_DIR, 'salesorders', 'all'),
    entTolerance: number = 0.9,
    addrTolerance: number = 0.8,
    outputDir?: string,
): Promise<void> {
    const source = getSourceString(F, searchInSalesOrders.name);
    validate.existingFileArgument(source, '.tsv', {targetEntFile});
    validate.existingDirectoryArgument(source, {soDirectory});

    const stateToAbbreviation = read(
        path.join(getProjectFolders().dataDir, 'reports', 'state_to_abbreviation.json')
    );
    validate.objectArgument(`misc.main`, {stateToAbbreviation});
    // const abbreviationToState: Record<string, string> = {};
    // for (const [state, abbr] of Object.entries(stateToAbbreviation)) {
    //     abbreviationToState[abbr] = state;
    // }

    const concatStart = new Date();
    const compositeRows = await concatenateFiles(soDirectory);
    mlog.debug(
        `Finished concatenateFiles() after ${
            ((new Date().getTime() - concatStart.getTime()) / 1000).toFixed(5)
        } seconds.`,
        NL+`Total Number of Sales Order Rows (# of line items): ${compositeRows.length}`
    );

    const SHIP_TO_COLUMN = 'Ship To Address';
    compositeRows.forEach(row => addConcatenatedAddressColumn(row, 
        SHIP_TO_COLUMN, {
            street1: SalesOrderColumnEnum.SHIP_TO_STREET_ONE,
            street2: SalesOrderColumnEnum.SHIP_TO_STREET_TWO,
            city: SalesOrderColumnEnum.SHIP_TO_CITY,
            state: SalesOrderColumnEnum.SHIP_TO_STATE,
            zip: SalesOrderColumnEnum.SHIP_TO_ZIP
        }
    ));
    const compositeFieldDict: Record<SourceColumnEnum, {
        [label: string]: Record<string, number[]>
    }> = {
        [SourceColumnEnum.ENTITY]: { // try to match target ent to row value in these columns...
            entityId: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.ENTITY_ID),
            street1: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.STREET_ONE),
            street2: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.STREET_TWO),
            shipTo1: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.SHIP_TO_STREET_ONE),
            shipTo2: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.SHIP_TO_STREET_TWO)
        },
        [SourceColumnEnum.ADDRESS]: {
            billing: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.NAME_ADDRESS),
            shipping: await getIndexedColumnValues(compositeRows, SHIP_TO_COLUMN)
        }
    }

    // indices in the number[] values of the composite dicts all refer to rows in compositeRows
    // const compositeEntDict = await getIndexedColumnValues(
    //     compositeRows, SalesOrderColumnEnum.ENTITY_ID
    // ) as Record<string, number[]>;
    mlog.debug(`Number of Unique Entities From SO Directory Files: ${
        Object.keys(compositeFieldDict.Entity.entityId).length
        // Object.keys(compositeEntDict).length
    }`);
    
    const indexedMatches: { [matchedEntity: string]: number[] } = {};
    const entRows = await getRows(targetEntFile);
    const targetEntDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ENTITY);
    const targetAddressDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ADDRESS);
    // mlog.info([`Let's see for how many ppl we gotta search for...`,
    //     `     num unique ents: ${Object.keys(targetEntDict).length}`,
    //     `num unique addresses: ${Object.keys(targetAddressDict).length}`
    // ].join(TAB))
    let stats: { [key: string]: any} = {
        // tolerance: `${indentedStringify({ENT_TOLERANCE, ADDR_TOLERANCE})}`,
        // entityExactMatchCount: 0,
        // entityLevenshteinCount: 0,
        // foundByFuzzySearch: 0,
        // foundByBilling: 0,
        // foundByShipping: 0
    }
    for (const targetEnt in targetEntDict) {
        let matchFound = false;
        entityFieldLoop:
        for (const entityField of Object.keys(compositeFieldDict.Entity)) {
            const indexedValues = compositeFieldDict.Entity[entityField];
            // mlog.debug([`start entityFieldLoop for field '${entityField}'`,
            //     `entity: '${targetEnt}'`,
            //     `num '${entityField}' values to compare: ${Object.keys(indexedValues).length}`
            // ].join(TAB));
            if (isIntegerArray(indexedValues[targetEnt])) { 
                // exact match with row value at SalesOrderColumnEnum.ENTITY_ID
                indexedMatches[targetEnt] = indexedValues[targetEnt];
                // stats.entityExactMatchCount++;
                stats[entityField] = (stats[entityField] || 0) + 1;
                matchFound = true;
                break entityFieldLoop;
            }
            let entMatch: string | undefined = Object.keys(indexedValues).find(val => {
                return equivalentAlphanumericStrings(targetEnt, val, entTolerance);
            });
            if (entMatch) {
                indexedMatches[targetEnt] = indexedValues[entMatch];
                // stats.levenshteinCount++
                stats[entityField] = (stats[entityField] || 0) + 1;
                matchFound = true;
                break entityFieldLoop;
            }
        }
        if (matchFound) continue;
        // try matching by address string
        let sourceRows = targetEntDict[targetEnt].map(
            sourceRowIndex => entRows[sourceRowIndex]
        ) as { Entity: string, Address: string }[];
        let sourceAddresses: string[] = Array.from(new Set(sourceRows.map(r => r.Address)));
        const targetAddresses: string[] = [...sourceAddresses];
        addToTargetAddressesLoop:
        for (const addr of sourceAddresses) {
            stateRegexLoop:
            for (const [state, abbrev] of Object.entries(stateToAbbreviation)) {
                let stateRegex = new RegExp(state, RegExpFlagsEnum.IGNORE_CASE);
                let abbrevRegex = new RegExp(abbrev, RegExpFlagsEnum.IGNORE_CASE);
                if (stateRegex.test(addr)) {
                    let altAddr = addr.replace(stateRegex, abbrev);
                    targetAddresses.push(altAddr);
                    break stateRegexLoop;
                } else if (abbrevRegex.test(addr)) {
                    let altAddr = addr.replace(abbrevRegex, state);
                    targetAddresses.push(altAddr);
                    break stateRegexLoop;
                }
            }
        }
        // mlog.debug([`address search info for entity '${targetEnt}'`,
        //     `(original) sourceAddresses.length: ${sourceAddresses.length}`,
        //     `(expanded) targetAddresses.length: ${targetAddresses.length}`
        // ].join(TAB));
        addressSearchLoop:
        for (const targetAddr of targetAddresses) {
            addressComparisonLoop:
            for (const addressField of Object.keys(compositeFieldDict.Address)) {
                const indexedValues = compositeFieldDict.Address[addressField];
                let addrMatch = Object.keys(indexedValues).find(addr => 
                    equivalentAlphanumericStrings(targetAddr, addr, addrTolerance)
                );
                if (addrMatch) {
                    indexedMatches[targetEnt] = indexedValues[addrMatch];
                    matchFound = true;
                    stats[addressField] = (stats[addressField] || 0) + 1;
                    break addressComparisonLoop;
                }
            }
            if (matchFound) break addressSearchLoop;
        }
    }
    let numFound = Object.keys(indexedMatches).length;
    let diff = Object.keys(targetEntDict).length - numFound;
    mlog.debug([`${source} Finished searching for entity matches...`, 
        indentedStringify(stats),
        `     num unique ents:  ${Object.keys(targetEntDict).length}`,
        `num unique addresses:  ${Object.keys(targetAddressDict).length}`,
        `   num of ents found:  ${numFound}`,
        `  remainder to find =  ${diff}`
        ].join(TAB),
        NL+`${diff === 0 ? `wow` : `oh no`}`
    );
    const unmatchedEnts: string[] = Object.keys(targetEntDict)
        .filter(ent => !(ent in indexedMatches));
    let pairedNames: { nameInQuickBooks: string, nameFromEmail: string }[] = []
    for (const ent in indexedMatches) {
        let rows = indexedMatches[ent].map(rowIndex => compositeRows[rowIndex]);
        const qbName = rows[0][SalesOrderColumnEnum.ENTITY_ID] ?? 'MISSING_ENTITY_ID';
        pairedNames.push({
            nameInQuickBooks: qbName,
            nameFromEmail: ent
        })
    }
    if (isNonEmptyString(outputDir) && isDirectory(outputDir)) {
        write({
            unmatchedNames: unmatchedEnts,
            pairedNames
        }, path.join(outputDir, 'misc_entity_match_results.json'));
    }
}


type AddressColumns = {
    street1: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
}

function addConcatenatedAddressColumn(
    row: Record<string, any>,
    outputColumn: string, 
    addr: AddressColumns,
    separator: string = ' '
): void {
    let source = `[${F}.addConcatenatedAddressColumn]`;
    validate.objectArgument(source, {row});
    validate.stringArgument(source, {outputColumn});
    if (!row || !outputColumn) return;
    if (!hasKeys(row, Object.values(addr))) {
        throw new Error(`${source} row is missing address column key(s)...`)
    }
    row[outputColumn] = [
        row[addr.street1],
        row[addr.street2],
        row[addr.city] + ',',
        row[addr.state],
        row[addr.zip]
    ].map(part => clean(part)).join(separator)
}

