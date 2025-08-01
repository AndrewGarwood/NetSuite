/**
 * @file src/parse_configurations/evaluators/account.ts
 */
import { 
    mainLogger as mlog, NEW_LINE as NL, INDENT_LOG_LINE as TAB, STOP_RUNNING 
} from "../../config";
import { extractLeaf, equivalentAlphanumericStrings } from "../../utils/regex";
import { getAccountDictionary } from "../../config/dataLoader";
import { AccountDictionary, AccountTypeEnum } from "src/utils/ns";
import * as validate from "../../utils/argumentValidation";
import { isNonEmptyString, isNullLike } from "src/utils/typeValidation";
import { indentedStringify } from "src/utils/io";

export const accountInternalId = async (
    row: Record<string, any>,
    accountColumn: string,
    ...accountTypes: AccountTypeEnum[]
): Promise<number | undefined> => {
    const source = `evaluators.account.accountInternalId`
    validate.stringArgument(source, {accountColumn});
    validate.arrayArgument(source, {accountTypes}, 'string', isNonEmptyString);
    let accountName = extractLeaf(String(row[accountColumn]), true, ':');
    const accountDict = await getAccountDictionary();
    const targetAccounts: { [accountName: string]: string } = {}
    for (const acctType of accountTypes) {
        let subDict = accountDict[acctType];
        if (isNullLike(subDict)) {
            mlog.error(`[${source}()] Invalid Account Type: '${acctType}'`);
            continue;
        }
        Object.assign(targetAccounts, subDict);
    }
    if (accountName in targetAccounts) {
        return Number(targetAccounts[accountName])
    }
    let accountMatch: string | undefined = Object.keys(targetAccounts).find(
        acct => equivalentAlphanumericStrings(acct, accountName)
    );
    if (accountMatch) {
        return Number(targetAccounts[accountMatch])
    }
    // let message = [`[${source}()] Unrecognized account name`,
    //     `accountColumn: '${accountColumn}'`, 
    //     ` accountTypes:  ${JSON.stringify(accountTypes)}`,
    //     `String(row[accountColumn]: '${String(row[accountColumn])}'`,
    //     `    extracted accountName: '${accountName}'`
    // ].join(TAB);
    // mlog.warn(message);
    return undefined
    // throw new Error(message);
}