/**
 * @file src/misc.ts
 * @description handle miscellaneous objectives
 */
import * as fs from "node:fs";
import path from "node:path";
import {
    initializeData, 
    STOP_RUNNING, 
    DELAY, simpleLogger as slog,
    miscLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    getLogFiles,
    initializeEnvironment,
    getProjectFolders,
} from "./config";
import {
    readJsonFileAsObject as read,
    writeObjectToJsonSync as write,
    trimFile,
    clearFile, 
    getCurrentPacificTime,
    autoFormatLogsOnExit,
    getSourceString,
} from "typeshi:utils/io";
import { 
    isRecordResult,
} from "./api";
import { 
    RecordTypeEnum, RecordResult,
    instantiateAuthManager
} from "./api";
import { 
    reconcileItems, 
    appendUpdateHistory, isDependentUpdateHistory, 
    sublistReferenceDictionary,
    getItemRecordOptions
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
    const startTime = Date.now();
    /* ===================================================================== */


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
 * moved stuff from main to here to work on other thing
 */
async function runItemReconciler(): Promise<any> {  
    const source = getSourceString(__filename, runItemReconciler.name);
    let wDir = path.join(getProjectFolders().dataDir, 'workspace');
    try {
        validate.existingDirectoryArgument(source, {wDir});
        let reconcilerDir = path.join(wDir, 'reconciler', RecordTypeEnum.INVENTORY_ITEM);
        validate.existingDirectoryArgument(source, {reconcilerDir});
        const placeholderPath = path.join(wDir, 'reconciler', 'item_placeholders.json');
        const newItemsPath = path.join(reconcilerDir, `${RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM}_options.json`);
        const historyPath = path.join(reconcilerDir, `${RecordTypeEnum.INVENTORY_ITEM}_update_history.json`);
        validate.multipleExistingFileArguments(source, '.json', {
            placeholderPath, newItemsPath, historyPath
        });
        let initialItemKeys = Object.keys(read(path.join(wDir, 'item_to_salesorders.json')));
        
        let placeholders = (read(placeholderPath) as { placeholders: Required<RecordResult>[] }).placeholders;
        validate.arrayArgument(source, {placeholders, isRecordResult});
        let placeholderIds = placeholders.map(p=>p.internalid);

        let newItems = await getItemRecordOptions(newItemsPath);
        let updateHistory = read(historyPath);
        validate.objectArgument(source, {updateHistory, isDependentUpdateHistory});
        await DELAY(1000, `${source} calling ${reconcileItems.name}()...`);
        let newHistory = await reconcileItems(RecordTypeEnum.INVENTORY_ITEM, initialItemKeys,
            placeholderIds, newItems, sublistReferenceDictionary, updateHistory
        );
        updateHistory = appendUpdateHistory(updateHistory, newHistory);
        write(updateHistory, historyPath);
    } catch (error: any) {
        mlog.error([`${source} reconciliation failed: ${error}`
        ].join(NL));
    }
}
