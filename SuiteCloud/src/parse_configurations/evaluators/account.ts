/**
 * @file src/parse_configurations/evaluators/account.ts
 */
import { 
    mainLogger as mlog, NEW_LINE as NL, INDENT_LOG_LINE as TAB 
} from "../../config";
import { extractLeaf } from "../../utils/io"
import { getAccountDictionary } from "../../config/dataLoader";

/**@TODO update method to reflect new shape of AccountDictionary */
export const accountInternalId = async (
    row: Record<string, any>, 
    accountColumn: string
): Promise<number> => {
    const accountName = extractLeaf(String(row[accountColumn]));
    const coaDict = await getAccountDictionary();
    // if (!Object.keys(coaDict).includes(accountName)) {
    //     mlog.error(`[evaluators.account.accountColumn()] Unrecognized account found (not a key in coaDictionary)`,
    //         TAB+`accountColumn: '${accountColumn}'`,
    //         TAB+` original account value: '${String(row[accountColumn])}'`,
    //         TAB+`extracted account value: '${accountName}'`
    //     )
    //     throw new Error(`[evaluators.account.accountColumn()] Unrecognized account name`);
    // }
    return Number(coaDict[accountName]);
}