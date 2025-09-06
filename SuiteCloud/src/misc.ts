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
} from "typeshi:utils/io";
import { 
    isRecordOptions,
    isRecordResult, 
} from "./api";
import { 
    equivalentAlphanumericStrings, CleanStringOptions, clean, 
    stringContainsAnyOf, RegExpFlagsEnum, 
    extractLeaf,
    extractFileName,
    stringStartsWithAnyOf
} from "typeshi:utils/regex";
import { ItemColumnEnum } from "./parse_configurations/item/itemConstants";
import { 
    hasKeys, isEmpty, isEmptyArray, isInteger, isIntegerArray, isNonEmptyArray, 
    isNonEmptyString, 
    isObject
} from "typeshi:utils/typeValidation";
import { idPropertyEnum, RecordOptions, 
    RecordResponse, RecordTypeEnum, RecordResponseOptions, RecordResult,
    SearchOperatorEnum, getRecordById, 
    instantiateAuthManager, idSearchOptions, 
    SingleRecordRequest, RecordRequest, RelatedRecordRequest, ChildSearchOptions, getRelatedRecord
} from "./api";
import { CLEAN_ITEM_ID_OPTIONS, unitType } from "src/parse_configurations/evaluators/item";
import { 
    reconcileInventoryItems, 
    appendUpdateHistory, isDependentUpdateHistory, 
    DependentUpdateHistory 
} from "src/services/maintenance";
import * as validate from "typeshi:utils/argumentValidation";



async function main(): Promise<void> {
    const source = getSourceString(__filename, main.name);
    await initializeEnvironment();
    let logFiles = getLogFiles();
    await clearFile(...logFiles);
    await initializeData();
    await instantiateAuthManager();
    mlog.info(`${source} START at ${getCurrentPacificTime()}`);    
    let wDir = path.join(getProjectFolders().dataDir, 'workspace');
    /* ===================================================================== */

    try {
        validate.existingDirectoryArgument(source, {wDir});
        let placeholders = (read(path.join(wDir, 'item_placeholders.json')) as { placeholders: Required<RecordResult>[] }).placeholders;
        validate.arrayArgument(source, {placeholders, isRecordResult});
        let placeholderIds = placeholders.map(p=>p.internalid);

        const newItemsPath = path.join(wDir, 'lnii_options.json');
        let newItems = await getItemRecordOptions(newItemsPath);

        const historyPath = path.join(wDir, 'inventory_item_update_history.json')
        let updateHistory = read(historyPath);
        validate.objectArgument(source, {updateHistory, isDependentUpdateHistory});
        await DELAY(1000, null)
        let newHistory = await reconcileInventoryItems(placeholderIds, newItems, undefined, updateHistory);
        updateHistory = appendUpdateHistory(updateHistory, newHistory);
        write(updateHistory, historyPath)
    } catch (error: any) {
        mlog.error([`${source} reconcileItems failed...`,
            error
        ]);
    }
    /* ===================================================================== */
    mlog.info([`${source} END at ${getCurrentPacificTime()}`,
        `handling logs...`
    ].join(TAB));
    await trimFile(5, ...logFiles);
    autoFormatLogsOnExit(logFiles)
    STOP_RUNNING(0);
}
main().catch(error => {
    mlog.error(`${getSourceString(__filename, main.name)}.catch:`, JSON.stringify(error as any));
    STOP_RUNNING(1);
});

/**
 * just wanted to move this code block out of main()
 * @TODO parameterize
 * @param filePath 
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
    let [parseSourcePath] = Object.keys(dataSource);
    let fileName = extractFileName(parseSourcePath, false);
    parseSourcePath = path.join(getProjectFolders().dataDir, 'accounting', 'items', fileName);
    validate.existingFileArgument(source, '.tsv', {filePath});
    let sourceRows = await getRows(filePath);
    let setClassCount = 0;
    recordLoop:
    for (let record of newItems) {
        if (!record.fields.unitstype) {
            let dataSource = record.meta.dataSource as RowSourceMetaData;
            validate.objectArgument(source, {dataSource, isRowSourceMetaData});
            let [sourceIndex] = dataSource[parseSourcePath];
            validate.numberArgument(source, {rowIndex: sourceIndex}, true);
            let row = sourceRows[sourceIndex];
            record.fields.unitstype = await unitType(row, ItemColumnEnum.UNIT_OF_MEASUREMENT);
        }
        if (isEmpty(record.fields.class) && isNonEmptyString(record.fields.itemid)) {
            if (!hasKeys(indexedInventoryRows, record.fields.itemid)) {
                slog.warn([`${source} itemid not in inventory export rows...`,
                    `itemId: '${record.fields.itemid}'`
                ].join(TAB));
                if (stringStartsWithAnyOf(record.fields.itemid, /MAT|US-LET/)) {
                    record.fields.class = Number(getClassDictionary()['Marketing Materials'])
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
        if (record.sublists.binnumber) {
            delete record.sublists.binnumber;
        }
    }
    slog.info(` -- setClassCount: ${setClassCount}`);
    return newItems;
}


const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}