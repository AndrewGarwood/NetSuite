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
    getProjectFolders,
    getUnitTypeDictionary,
    getBomRows,
    getInventoryRows,
    getClassDictionary
} from "./config";
import {
    readJsonFileAsObject as read,
    writeObjectToJsonSync as write,
    writeRowsToCsvSync as writeRows,
    trimFile,
    clearFile, 
    getCurrentPacificTime,
    getRows,
    getIndexedColumnValues,
    isRowSourceMetaData,
    autoFormatLogsOnExit,
    getSourceString,
    RowSourceMetaData,
    extractTargetRows,
    indentedStringify,
} from "typeshi:utils/io";
import { 
    Factory,
    isRecordOptions,
    isRecordResult,
    putSingleRecord, 
} from "./api";
import { 
    equivalentAlphanumericStrings, CleanStringOptions, clean, 
    stringContainsAnyOf, RegExpFlagsEnum, 
    extractLeaf,
    extractFileName,
    stringStartsWithAnyOf
} from "typeshi:utils/regex";
import { SalesOrderColumnEnum } from "./parse_configurations/salesorder/salesOrderConstants";
import { CustomerColumnEnum } from "./parse_configurations/customer/customerConstants";
import { ItemColumnEnum } from "./parse_configurations/item/itemConstants";
import { 
    LN_INVENTORY_ITEM_PARSE_OPTIONS, 
    LN_INVENTORY_ITEM_POST_PROCESSING_OPTIONS 
} from "src/parse_configurations/item/itemParseDefinition";
import { 
    hasKeys, isEmpty, isEmptyArray, isInteger, isIntegerArray, isNonEmptyArray, 
    isNonEmptyString, 
    isNumeric, 
    isObject
} from "typeshi:utils/typeValidation";
import { idPropertyEnum, RecordOptions, 
    RecordResponse, RecordTypeEnum, RecordResponseOptions, RecordResult,
    SearchOperatorEnum, getRecordById, 
    instantiateAuthManager, idSearchOptions, 
    SingleRecordRequest, RecordRequest, 
    RelatedRecordRequest, ChildSearchOptions, getRelatedRecord
} from "./api";
import { 
    CLEAN_ITEM_ID_OPTIONS, itemId, unitType 
} from "src/parse_configurations/evaluators/item";
import { 
    reconcileInventoryItems, 
    appendUpdateHistory, isDependentUpdateHistory, 
    DependentUpdateHistory, 
    sublistReferenceDictionary,
    ReconcilerState
} from "src/services/maintenance";
import * as validate from "typeshi:utils/argumentValidation";

/**
 * @TODO test if PUT_Record still works with findSublistLineWithValue() changes...
 * need to see if it works with string or number for item internalid
 */
async function main(): Promise<void> {
    const source = getSourceString(__filename, main.name);
    await initializeEnvironment();
    let logFiles = getLogFiles();
    await clearFile(...logFiles);
    await initializeData();
    await instantiateAuthManager();
    mlog.info(`${source} START at ${getCurrentPacificTime()}`);    
    let wDir = path.join(getProjectFolders().dataDir, 'workspace');
    const startTime = Date.now();
    /* ===================================================================== */

    try {
        validate.existingDirectoryArgument(source, {wDir});
        let statePath = path.join(wDir, `${RecordTypeEnum.INVENTORY_ITEM}_reconcile_state.json`);
        validate.existingFileArgument(source, '.json', {statePath});
        let state = read(statePath) as ReconcilerState;
        
        let soData = read(
            path.join(wDir, 'item_to_salesorders.json')
        ) as { [itemId: string]: RecordResult[] } ?? {};
        let initialItemKeys = Object.keys(soData);
        
        const placeholderPath = path.join(wDir, 'item_placeholders.json');
        let placeholders = (read(placeholderPath) as { placeholders: Required<RecordResult>[] }).placeholders;
        validate.arrayArgument(source, {placeholders, isRecordResult});
        let placeholderIds = placeholders.map(p=>p.internalid);

        const newItemsPath = path.join(wDir, `${RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM}_options.json`);
        let newItems = await getItemRecordOptions(newItemsPath);

        const historyPath = path.join(wDir, `${RecordTypeEnum.INVENTORY_ITEM}_update_history.json`);
        validate.existingFileArgument(source, '.json', {historyPath});
        let updateHistory = read(historyPath);
        validate.objectArgument(source, {updateHistory, isDependentUpdateHistory});
        await DELAY(1000, `calling ${reconcileInventoryItems.name}()...`);
        let newHistory = await reconcileInventoryItems(initialItemKeys,
            placeholderIds, newItems, sublistReferenceDictionary, updateHistory
        );
        updateHistory = appendUpdateHistory(updateHistory, newHistory);
        write(updateHistory, historyPath);
    } catch (error: any) {
        mlog.error([`${source} reconciliation failed...`,
            indentedStringify(error)
        ].join(NL));
    }
    /* ===================================================================== */
    let elapsedTimeMinutes = ((Date.now() - startTime) / (1000 * 60)).toFixed(3); 
    mlog.info([`${source} END at ${getCurrentPacificTime()}`,
        `Elapsed time: ${elapsedTimeMinutes} minutes`, 
        `handling logs...`
    ].join(TAB));
    await trimFile(5, ...logFiles);
    autoFormatLogsOnExit(logFiles);
    STOP_RUNNING(0);
}
if (require.main === module) {
    main().catch(error => {
        mlog.error(`${getSourceString(__filename, main.name)}.catch:`, JSON.stringify(error as any));
        STOP_RUNNING(1);
    });
}
/**
 * just wanted to move this code block out of main()
 * @TODO parameterize
 * @param filePath `string` path to json `{ items: Required<RecordOptions>[] }`
 */
async function getItemRecordOptions(filePath: string): Promise<Required<RecordOptions>[]> {
    const source = getSourceString(__filename, getItemRecordOptions.name);
    validate.existingFileArgument(source, '.json', {filePath});
    let lnii_data = read(filePath) as { items: Required<RecordOptions>[] };
    validate.arrayArgument(source, {items: lnii_data.items, isRecordOptions});
    let inventoryRows = getInventoryRows();
    let indexedInventoryRows = await getIndexedColumnValues(
        inventoryRows, 'Name', itemIdExtractor
    );
    let newItems = lnii_data.items;
    let dataSource = newItems[0].meta.dataSource ?? {};
    const [ogParseSourcePath] = Object.keys(dataSource);
    let fileName = extractFileName(ogParseSourcePath, false);
    let parseSourcePath = path.join(getProjectFolders().dataDir, 'accounting', 'items', fileName);
    validate.existingFileArgument(source, '.tsv', {parseSourcePath});
    let sourceRows = await getRows(parseSourcePath);
    let setClassCount = 0;
    mlog.debug(`${source} modifying RecordOptions[]...`)
    recordLoop:
    for (let record of newItems) {            
        if (isEmpty(record.sublists.price)) {
            record.sublists.price = [{
                pricelevel: 1, 
                price_1_: 0.00
            }]
        } 
        if (isEmpty(record.fields.unitstype)) {
            let dataSource = record.meta.dataSource as RowSourceMetaData;
            validate.objectArgument(source, {dataSource, isRowSourceMetaData});
            let [sourceIndex] = dataSource[ogParseSourcePath];
            validate.numberArgument(source, {rowIndex: sourceIndex}, true);
            let row = sourceRows[sourceIndex];
            record.fields.unitstype = await unitType(row, ItemColumnEnum.UNIT_OF_MEASUREMENT);
        }
        if (isEmpty(record.fields.class) && isNonEmptyString(record.fields.itemid)) {
            if (!hasKeys(indexedInventoryRows, record.fields.itemid)) {
                slog.warn([` -- item not in inventory export rows`,
                    `itemId: '${record.fields.itemid}'`
                ].join(', '));
                if (stringStartsWithAnyOf(record.fields.itemid, /MAT|US-LET/)) {
                    record.fields.class = Number(getClassDictionary()['Marketing Materials']);
                    setClassCount++;
                }
                continue recordLoop;
            }
            let [rowIndex] = indexedInventoryRows[record.fields.itemid];
            let row = inventoryRows[rowIndex];
            let classValue = extractLeaf(String(row['Class'])).trim();
            if (isEmpty(classValue)) continue;
            if (classValue in getClassDictionary()) {
                record.fields.class = Number(getClassDictionary()[classValue]);
                setClassCount++;
            } else {
                mlog.error([`${source} encountered class not in classDictionary`,
                    `itemId: '${record.fields.itemid}'`,
                    ` class: '${classValue}'`
                ].join(TAB));
                STOP_RUNNING(1);
            }
        }
        if (isEmpty(record.fields.location) && isNonEmptyString(record.fields.itemid)) {
            const wRow = getWarehouseRows().find(r=>
                itemIdExtractor(r["Item ID"]) === record.fields.itemid
            );
            if (wRow && isNumeric(wRow["Location Internal ID"], true)) {
                record.fields.location = Number(wRow["Location Internal ID"]);
            }
        }
        if (record.sublists.binnumber) { 
            delete record.sublists.binnumber;
        }
    }
    slog.info(` -- setClassCount: ${setClassCount} / ${newItems.length}`);
    return newItems;
}


const itemIdExtractor = (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): string => {
    return clean(extractLeaf(value), cleanOptions);
}