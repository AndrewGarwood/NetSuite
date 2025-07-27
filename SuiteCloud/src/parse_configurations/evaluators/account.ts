/**
 * @file src/parse_configurations/evaluators/account.ts
 */
import { 
    mainLogger as mlog, NEW_LINE as NL, INDENT_LOG_LINE as TAB 
} from "../../config";
import { extractLeaf, equivalentAlphanumericStrings } from "../../utils/regex";
import { getAccountDictionary } from "../../config/dataLoader";
import { AccountDictionary, AccountTypeEnum } from "src/utils/ns";
import * as validate from "../../utils/argumentValidation";
import { isNonEmptyString } from "src/utils/typeValidation";

export const accountInternalId = async (
    row: Record<string, any>,
    accountColumn: string,
    ...accountTypes: AccountTypeEnum[]
): Promise<number> => {
    const source = `${__dirname}.${__filename}.accountInternalId`
    validate.stringArgument(source, {accountColumn});
    validate.arrayArgument(source, {accountTypes}, 'string', isNonEmptyString);
    const accountName = extractLeaf(String(row[accountColumn]));
    const coaDict = await getAccountDictionary();
    const targetAccounts: { [accountName: string]: string } = {}
    for (const acctType of accountTypes) {
        Object.assign(targetAccounts, 
            coaDict[acctType.toUpperCase() as keyof typeof AccountTypeEnum]
        );
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
    let message = [`[${source}()] Unrecognized account name`,
        `accountColumn: '${accountColumn}'`, 
        ` accountTypes:  ${JSON.stringify(accountTypes)}`,
        `String(row[accountColumn]: '${String(row[accountColumn])}'`,
        `    extracted accountName: '${accountName}'`
    ].join(TAB);
    mlog.error(message);
    throw new Error(message);
}