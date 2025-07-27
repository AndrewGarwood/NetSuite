/**
 * @file src/parse_configurations/evaluators/item.ts
 */
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config";
import { clean, 
    CleanStringOptions, 
    StringReplaceParams, StringCaseOptions, 
    extractLeaf, REPLACE_EM_HYPHEN,
    isCleanStringOptions
} from "../../utils/regex";
import * as validate from "../../utils/argumentValidation"
import { isNonEmptyString } from "../../utils/typeValidation";

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
        { searchValue: /\s*-\s*/g, replaceValue: '-' },
        { searchValue: /\s+/g, replaceValue: '_' },
        { searchValue: /(%|,|&)*/g, replaceValue: '' },
        { searchValue: /\s*(ml|oz)\s*$/ig, replaceValue: '' },
    ] as StringReplaceParams[]
} as CleanStringOptions

export const itemId = async (
    row: Record<string, any>, 
    itemIdColumn: string,
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    let source = `${__filename}.itemId`;
    validate.objectArgument(source, {row});
    validate.objectArgument(source, {cleanOptions})
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
    return itemId;
}

export const displayName = async (
    row: Record<string, any>,
    descriptionColumn: string,
    itemIdColumn: string,
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    let source = `${__filename}.displayName`;
    validate.multipleStringArguments(source, 
        {descriptionColumn, itemIdColumn}
    );
    validate.objectArgument(source, {row});
    validate.objectArgument(source, {cleanOptions}, 
        'CleanStringOptions', isCleanStringOptions
    );
    let itemIdValue = itemId(row, itemIdColumn, cleanOptions);
    let desc = clean(row[descriptionColumn]);
    let result = itemIdValue + (!isNonEmptyString(desc) ? ` (${desc})` : '');
    return result;
}

export const description = async (
    row: Record<string, any>,
    descriptionColumn: string,
    altDescriptionColumn: string,
): Promise<string> => {
    let source = `${__filename}.description`;
    validate.multipleStringArguments(source, 
        {descriptionColumn, purchaseDescriptionColumn: altDescriptionColumn}
    );
    validate.objectArgument(source, {row});
    let desc = clean(row[descriptionColumn]);
    let altDesc = clean(row[altDescriptionColumn]);
    return JSON.stringify(
        {descriptionColumn: desc, altDescriptionColumn: altDesc}
    );
}