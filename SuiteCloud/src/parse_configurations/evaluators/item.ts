/**
 * @file src/parse_configurations/evaluators/item.ts
 */
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config";
import { clean, 
    CleanStringOptions, 
    StringReplaceParams, StringCaseOptions, 
    extractLeaf, REPLACE_EM_HYPHEN,
    isCleanStringOptions,
} from "../../utils/regex";
import * as validate from "../../utils/argumentValidation"
import { hasKeys, isNonEmptyString } from "../../utils/typeValidation";

/**
 * - convert to upper case
 * - replace em hyphen with regular hyphen
 * - remove space around hyphens
 * - replace spaces with underscores
 */
export const CLEAN_ITEM_ID_OPTIONS = {
    case: { toUpper: true } as StringCaseOptions,
    replace: [
        REPLACE_EM_HYPHEN,
        { searchValue: /pacakage/ig, replaceValue: 'PACKAGE' },
        { searchValue: /\s*-\s*/g, replaceValue: '-' },
        { searchValue: /(?<=\d)\s*(ml|oz)\s*$/ig, replaceValue: '' },
        { searchValue: /(%|,|&|#)*/g, replaceValue: '' },
        { searchValue: /\s+(?=\w)/g, replaceValue: '_' },
        { searchValue: /_{2,}/g, replaceValue: '_' },
        { searchValue: /(_|\.)$/g, replaceValue: '' },
        // { searchValue: /#(?=\d)$/ig, replaceValue: '' },
    ] as StringReplaceParams[],
} as CleanStringOptions

export const itemId = async (
    row: Record<string, any>, 
    itemIdColumn: string,
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    let source = `evaluators.item.itemId`;
    validate.objectArgument(source, {row});
    validate.objectArgument(source, {cleanOptions});
    validate.stringArgument(source, {itemIdColumn});
    const originalValue = String(row[itemIdColumn]);
    let itemId = clean(extractLeaf(String(row[itemIdColumn])), cleanOptions);
    if (!isNonEmptyString(itemId)) {
        mlog.warn(`[${source}()] cleaned, extracted leaf is falsey`,
            TAB+ ` itemIdColumn: '${itemIdColumn}'`,
            TAB+`original value: '${String(row[itemIdColumn])}'`,
            TAB+`extracted leaf: '${extractLeaf(String(row[itemIdColumn]))}'`,
            TAB+`cleaned itemId: '${clean(extractLeaf(String(row[itemIdColumn])), cleanOptions)}'`,
            NL+`-> returning original value`
        );
        return originalValue;
    }
    // @TODO parameterize these edge cases or find better way
    if (itemId === 'SH') return 'S&H'
    if (itemId === 'SF') return 'S&F'
    return itemId;
}

export const displayName = async (
    row: Record<string, any>,
    descriptionColumn: string,
    itemIdColumn: string,
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    let source = `evaluators.item.displayName`;
    validate.multipleStringArguments(source, 
        {descriptionColumn, itemIdColumn}
    );
    validate.objectArgument(source, {row});
    validate.objectArgument(source, {cleanOptions}, 
        'CleanStringOptions', isCleanStringOptions
    );
    let itemIdValue = await itemId(row, itemIdColumn, cleanOptions);
    let desc = clean(String(row[descriptionColumn]));
    let result = itemIdValue + (isNonEmptyString(desc) ? ` (${desc})` : '');
    return result;
}

export const description = async (
    row: Record<string, any>,
    descriptionColumn: string,
    altDescriptionColumn?: string,
): Promise<string> => {
    let source = `evaluators.item.description`;
    validate.stringArgument(source, {descriptionColumn});
    validate.objectArgument(source, {row});
    let result: Record<string, string> = {
        [descriptionColumn]: clean(row[descriptionColumn])
    };
    if (isNonEmptyString(altDescriptionColumn) && hasKeys(row, altDescriptionColumn)) {
        result[altDescriptionColumn] = clean(row[altDescriptionColumn]);
    }
    return JSON.stringify(result);
}