/**
 * @file src/pipelines/types/Transaction.typeGuards.ts
 */

import { hasKeys } from "typeshi:utils/typeValidation";
import { TransactionEntityMatchOptions } from "./Transaction";
import { MatchSourceEnum } from "./Pipeline";



/**
 * - {@link TransactionEntityMatchOptions}
 * - {@link LocalFileMatchOptions}
 * @param value the value to check
 * @returns **`isTransactionEntityMatchOptions`** `boolean` = `value is TransactionEntityMatchOptions`
 * - `true` `if` the value is a valid `TransactionEntityMatchOptions` object
 * - `false` `otherwise`
 */
export function isTransactionEntityMatchOptions(
    value: any
): value is TransactionEntityMatchOptions {
    return (value 
        && typeof value === 'object'
        && hasKeys(value, 
            ['entityType', 'entityFieldId', 'matchMethod'], true, false
        )
        && Object.values(MatchSourceEnum).includes(value.matchMethod)
        && (!value.localFileOptions 
            || (value.localFileOptions && hasKeys(value.localFileOptions, 
                ['filePath', 'targetValueColumn', 'internalIdColumn'], true, true
            ))
        )
    );
}