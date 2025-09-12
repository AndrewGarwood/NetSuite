/**
 * @file src/services/maintenance/transactions.ts
 */
import { 
    RecordTypeEnum, 
} from "../../utils/ns";
import { 
    isNonEmptyArray, hasKeys,
    isNonEmptyString, 
    isNumeric,
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    getProjectFolders,
} from "../../config";
import { 
    writeObjectToJsonSync as write, 
    readJsonFileAsObject as read, 
    indentedStringify,
    isFile,
    getSourceString,
    getCurrentPacificTime,
} from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { 
    RecordOptions, 
    getRecordById, 
    idPropertyEnum,
    RecordResult, 
    FieldValue,
    putSingleRecord,
    LogTypeEnum,
    deleteRecord,
    RecordResponseOptions
} from "../../api";
import { Factory } from "../../api";
import {  
    matchTransactionEntity, 
    TransactionEntityMatchOptions 
} from "src/pipelines";
import { 
    TransactionReconcilerStageEnum,
    TransactionReconcilerState
} from "./types/Reconcile";

export { reconcileTransactions }

/** when defined:
 * = `path.join(getProjectFolders().dataDir, 'workspace', 
 * 'reconciler', parentRecordType)` 
 * */
let reconcilerDir: string | null = null;
let moduleState: TransactionReconcilerState | null = null;

const count = {
    fixedTotal: 0,
    stillWrong: 0,
    delFailed: 0,
    getFailed: 0,
    putFailed: 0
}

async function reconcileTransactions(
    tranType: RecordTypeEnum,
    transactions: Required<RecordOptions>[],
    idDict: { [tranExternalId: string]: string },
    matchOptions: TransactionEntityMatchOptions,
    saveInterval: number = 10
): Promise<any> {
    const source = getSourceString(__filename, reconcileTransactions, tranType);
    reconcilerDir = path.join(getProjectFolders().dataDir, 'workspace', 'reconciler', tranType);
    validate.existingDirectoryArgument(source, {reconcilerDir});
    const statePath = path.join(reconcilerDir, `${tranType}_state.json`);
    moduleState = (isFile(statePath) 
        ? read(statePath) as TransactionReconcilerState 
        : {
            currentStage: TransactionReconcilerStageEnum.PRE_PROCESS,
            deleted: [],
            created: [],
            validated: read(path.join(reconcilerDir, )),
            errors: []
        }
    );
    const state = getTransactionState();
    slog.debug([`total num ${tranType} records: ${transactions.length}`,
        `  deleted.length: ${state.deleted.length}`,
        `  created.length: ${state.created.length}`,
        `validated.length: ${Object.keys(state.validated).length}`,
    ].join(NL));
    const responseOptions: Required<RecordResponseOptions> = {
        fields: ['total'], 
        sublists: { item: ['amount' ] }
    }
    try {
        let targetRecords = await getTargetRecords(tranType, transactions, matchOptions)
        slog.debug([
            ` -- num targetRecords (matched): ${targetRecords.length}`
        ].join(NL));
        let indexCharLength = String(targetRecords.length).length;
        for (let i = 0; i < targetRecords.length; i++) {
            const txn = targetRecords[i];
            if (i > 1 && (i + 1) % saveInterval === 0) {
                slog.debug(` -- saving @ index ( ${
                String(i+1).padEnd(indexCharLength)} / ${targetRecords.length} )`)
                saveProgress()
            }
            let externalId = String(txn.fields.externalid);
            if (externalId in state.validated) { continue }
            if (!state.deleted.includes(externalId)) { // see if already deleted but not recorded in state
                state.currentStage = TransactionReconcilerStageEnum.CHECK_EXIST;
                let getRes = await getRecordById(Factory.SingleRecordRequest(
                    tranType, 
                    idPropertyEnum.INTERNAL_ID, 
                    idDict[externalId], 
                    responseOptions
                ));
                const result = getRes.results[0];
                let expectedTotal = getExpectedTotal(txn);
                if (!result && isNonEmptyArray(getRes.rejects)) {
                    slog.debug(` -- initial get failed txn ${externalId} ?`)
                    state.errors.push({
                        externalId, 
                        stage: state.currentStage, 
                        message: 'initial get request failed'
                    })
                    continue;
                } else if (!result) {
                    slog.debug(` -- already deleted txn ${externalId} ?`)
                    state.deleted.push(externalId)
                } else if (Math.round(Number(result.fields.total) * 100) 
                    === Math.round(expectedTotal * 100)) { // already validated
                    slog.debug(` -- already validated txn ${externalId}`)
                    state.validated[externalId] = expectedTotal;
                    continue;
                }
            }
            if (!state.deleted.includes(externalId)) {
                state.currentStage = TransactionReconcilerStageEnum.DELETE_TRANSACTION;
                let delRes = await deleteRecord(Factory.SingleRecordRequest(
                    tranType, 
                    idPropertyEnum.INTERNAL_ID, 
                    idDict[externalId],
                ))
                if (!delRes.results[0]) {
                    state.errors.push({externalId, 
                        reason: 'delete failed', stage: state.currentStage,
                        errorLogs: delRes.logs.filter(l=>l.type===LogTypeEnum.ERROR)
                    })
                    slog.error(` -- delete failed for txn @ index ( ${
                    String(i+1).padEnd(indexCharLength)} / ${targetRecords.length} ) w/ id: ${externalId}`);
                    count.delFailed++;
                    continue;
                }
                state.deleted.push(externalId);
            }
            if (state.deleted.includes(externalId) && !state.created.includes(externalId)) {
                state.currentStage = TransactionReconcilerStageEnum.CREATE_TRANSACTION;
                txn.idOptions = [];
                let putRes = await putSingleRecord(txn);
                if (!putRes.results[0]) {
                    state.errors.push({externalId, 
                        reason: 'create failed',
                        stage: state.currentStage, 
                        errorLogs: putRes.logs.filter(l=>l.type===LogTypeEnum.ERROR)
                    })
                    slog.error(` -- create failed for txn @ index ( ${
                        String(i+1).padEnd(indexCharLength)} / ${targetRecords.length} ) w/ id: ${externalId}`
                    );
                    count.putFailed++;
                    continue;
                }
                state.created.push(externalId);
                idDict[externalId] = String(putRes.results[0].internalid);
            }
            if (state.deleted.includes(externalId) && state.created.includes(externalId)) {
                state.currentStage = TransactionReconcilerStageEnum.VALIDATE_FINAL_STATE;
                const response = await getRecordById(Factory.SingleRecordRequest(
                    tranType, 
                    idPropertyEnum.INTERNAL_ID, 
                    idDict[externalId], 
                    responseOptions
                ))
                const result = response.results[0];
                if (!result) {
                    slog.error(`update failed, not able to read result`);
                    count.getFailed++;
                    state.errors.push({externalId, 
                        stage: state.currentStage, 
                        message: `update failed, not able to read result`
                    })
                    continue;
                }
                const actualTotal = Number(result.fields.total);
                let expectedTotal = getExpectedTotal(txn);
                if (Math.round(actualTotal * 100) !== Math.round(expectedTotal * 100)) {
                    mlog.error(`total still not correct for ${externalId}`);
                    count.stillWrong++;
                    state.errors.push({externalId, 
                        stage: state.currentStage, 
                        message: `total still not correct for ${externalId}`
                    })
                    continue;
                }
                count.fixedTotal++;
                state.validated[externalId] = expectedTotal;
            }
        }
        slog.debug(indentedStringify(count));
    } catch(error: any) {
        mlog.error(`${source} error: ${error}`);
    }
}

/**
 * get transactions where (txn.fields.externalid in getTransactionDictionary()) 
 * && !(txn.fields.externalid in state.validated)
 * then set txn.fields.entity to entity's internalid by matching with api...
 * @param tranType 
 * @param transactions 
 * @param matchOptions 
 * @returns **`targetRecords`**
 */
async function getTargetRecords(
    tranType: RecordTypeEnum,
    transactions: Required<RecordOptions>[],
    matchOptions: TransactionEntityMatchOptions,
): Promise<Required<RecordOptions>[]> {
    const source = getSourceString(__filename, getTargetRecords.name, tranType);
    const state = getTransactionState();
    const filePath = path.join(getReconcilerDir(), `${tranType}_matches.json`)
    let targetRecords: Required<RecordOptions>[] = [];
    if (isFile(filePath)) {
        slog.debug(`${source} reading matched records from file...`)
        targetRecords = read(filePath)[tranType];
    } else {        
        targetRecords = transactions.filter(txn=>
            isNonEmptyString(txn.fields.externalid) 
            && (txn.fields.externalid in getTransactionDictionary()) 
            && !(txn.fields.externalid in state.validated)
        );
        slog.debug(`calling ${
            matchTransactionEntity.name
        }( Array<RecordOptions>(${targetRecords.length}) )...`);
        const matchResult = await matchTransactionEntity(
            targetRecords, matchOptions
        );
        slog.debug(`Finished matching function...`,
        ` -- num errors (no match): ${matchResult.errors.length}`)
        targetRecords = matchResult.matches as Required<RecordOptions>[];
        write({[tranType]: targetRecords}, filePath);
    }
    return targetRecords;

}


/**
 * @notimplemented
 */
function saveProgress(): any {
    const source = getSourceString(__filename, saveProgress.name, getCurrentPacificTime())
    throw new Error(`${source} ${saveProgress.name}() Not Implemented`)
/*
    write(validatedTotals, totalsPath);
    write(idDict, extDictPath);
    write(state, statePath);
 */
}

/**
 * @param transaction 
 * @returns **`expectedTotal`** `number (float)`
 */
function getExpectedTotal(transaction: Required<RecordOptions>): number {
    const source = getSourceString(__filename, getExpectedTotal.name);
    let itemList = transaction.sublists.item as { [sublistFieldId: string]: FieldValue }[];
    let expectedTotal = itemList.reduce((acc, line)=> {
        if (!hasKeys(line, 'amount')) {
            throw new Error(`${source} Invalid lineItem (no amount field) for externalid '${transaction.fields.externalid}'`)
        }
        if (isNumeric(line.amount)) {
            acc += Number(line.amount)
        }
        return acc
    }, 0.0);
    return expectedTotal;
}

function getReconcilerDir(): string {
    if (!reconcilerDir) {
        throw new Error(`${getSourceString(__filename, getReconcilerDir.name)} reconcilerDir not defined`)
    }
    return reconcilerDir;
}














/**
 * placeholder function.
 * implement in dataLoader then import here
 */
function getTransactionDictionary(): { [txnExternalId: string]: string } {
    throw new Error(`getTransactionDictionary not implemented`)
    // return {}
}




function getTransactionState(
    tranType?: RecordTypeEnum
): TransactionReconcilerState {
    const source = getSourceString(__filename, getTransactionState.name, tranType);
    if (!moduleState) {
        throw new Error(`${source} state has not been loaded yet`);
    }
    return moduleState;
}