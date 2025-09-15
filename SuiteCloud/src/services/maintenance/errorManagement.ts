
/**
 * @file src/DataReconciler.ts
 */
import * as fs from "node:fs";
import { 
    EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum,
    CustomerStatusEnum, SearchOperatorEnum, 
    SuiteScriptError
} from "../../utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull,
    isNonEmptyString, 
    isStringArray,
    isIntegerArray,
    isObject,
    isEmpty,
    isNumeric,
    isInteger
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, parseLogger as plog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, 
    getSkuDictionary,
    DELAY,
    getProjectFolders, isEnvironmentInitialized, isDataInitialized,
    setSkuInternalId,
    getClassDictionary
} from "../../config";
import { getColumnValues, getRows, 
    writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument, 
    isValidCsvSync,
    getFileNameTimestamp,
    indentedStringify,
    isFile,
    getSourceString, clearFile, trimFile,
    getCurrentPacificTime,
    autoFormatLogsOnExit,
    RowSourceMetaData,
    isRowSourceMetaData,
    getDirectoryFiles, writeRowsToCsvSync as writeRows
} from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { 
    LogTypeEnum,
    RecordOptions,
    RecordResponse,
} from "../../api";
import { SalesOrderColumnEnum } from "src/parse_configurations/salesorder";



export type RejectInfo = {
    timestamp: string;
    sourceFile: string;
    numRejects: number;
    rejectResponses: RecordResponse[];
}

/**
 * @deprecated - needs to handle change of where metadata is stored
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
    const source = getSourceString(__filename, isolateFailedRequests.name);
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
        // const jsonData = read(filePath);
        // let { sourceFile, rejectResponses } = jsonData as RejectInfo;
        // let correctedPath = sourceFile.replace(/\.dev/, 'dev');
        // issueDict[correctedPath] = [];
        // responseLoop:
        // for (const res of rejectResponses) {
        //     const logDetails = (res.logs
        //         .filter(l => l.type === LogTypeEnum.ERROR)
        //         .map(l => JSON.parse(l.details))
        //     );
        //     rejectReasons.push(...logDetails);
        //     const rejects: RecordOptions[] = res.rejects ?? [];
        //     rejectLoop:
        //     for (let i = 0; i < rejects.length; i++) {
        //         const record = rejects[i];
        //         if (isEmpty(record.meta)) { continue }
        //         let dataSource = record.meta.dataSource;
        //         if (!isRowSourceMetaData(dataSource)) { continue }
        //         if (!hasKeys(dataSource, sourceFile)) {
        //             mlog.error(`${source} RejectInfo.sourceFile not in dataSource.keys()`)
        //             isoErrors.push(res);
        //             break responseLoop;
        //         }
        //         issueDict[correctedPath].push(...dataSource[sourceFile])
        //     }
        // }
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
 * @param errorResolutionDir 
 * @param fileName 
 */
export async function storeReadableErrors(
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