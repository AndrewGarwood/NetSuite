/**
 * @file src/parse_configurations/evaluators/account.ts
 */
import { 
    mainLogger as mlog, NEW_LINE as NL, INDENT_LOG_LINE as TAB, 
} from "../../config";
import { extractLeaf, equivalentAlphanumericStrings } from "typeshi:utils/regex";
import { getAccountDictionary } from "../../config/dataLoader";
import { AccountDictionary, AccountTypeEnum } from "../../utils/ns";
import { isEmpty } from "typeshi:utils/typeValidation";
import { FieldDictionary, RecordOptions } from "@api/types";
import { getSourceString } from "@typeshi/io";

export const accountInternalId = async (
    fields: FieldDictionary, 
    row: Record<string, any>,
    accountColumn: string,
    ...accountTypes: AccountTypeEnum[]
): Promise<number | undefined> => {
    const source = getSourceString(__filename, accountInternalId.name, accountColumn)
    let accountName = extractLeaf(String(row[accountColumn]), true, ':');
    const accountDict = getAccountDictionary() as AccountDictionary;
    const targetAccounts: { [accountName: string]: string } = {}
    for (const acctType of accountTypes) {
        let subDict = accountDict[acctType];
        if (isEmpty(subDict)) {
            mlog.error(`${source} Invalid Account Type: '${acctType}'`);
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
    // let message = [`${source} Unrecognized account name`,
    //     `accountColumn: '${accountColumn}'`, 
    //     ` accountTypes:  ${JSON.stringify(accountTypes)}`,
    //     `String(row[accountColumn]: '${String(row[accountColumn])}'`,
    //     `    extracted accountName: '${accountName}'`
    // ].join(TAB);
    // mlog.warn(message);
    return undefined
    // throw new Error(message);
}