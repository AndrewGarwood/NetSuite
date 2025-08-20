/**
 * @file src/parse_configurations/evaluators/item.ts
 */
import path from "node:path";
import { mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, DATA_DIR, 
    simpleLogger as slog
} from "../../config";
import { clean, 
    CleanStringOptions, 
    StringReplaceParams, StringCaseOptions, 
    extractLeaf, REPLACE_EM_HYPHEN,
    isCleanStringOptions, UNCONDITIONAL_STRIP_DOT_OPTIONS
} from "typeshi:utils/regex";
import { getIndexedColumnValues, getRows } from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation"
import { hasKeys, isNonEmptyArray, isNonEmptyString } from "typeshi:utils/typeValidation";

/**
 * - convert to upper case
 * - replace em hyphen with regular hyphen
 * - remove space around hyphens
 * - replace spaces with underscores
 * - remove trailing dots/underscores
 */
export const CLEAN_ITEM_ID_OPTIONS = {
    strip: UNCONDITIONAL_STRIP_DOT_OPTIONS,
    case: { toUpper: true } as StringCaseOptions,
    replace: [
        REPLACE_EM_HYPHEN,
        { searchValue: /pacakage/ig, replaceValue: 'PACKAGE' },
        { searchValue: /\s*-\s*/g, replaceValue: '-' },
        { searchValue: /(?<=\d)\s*(ml|oz)\s*$/ig, replaceValue: '' },
        { searchValue: /(%|,|&|#)*/g, replaceValue: '' },
        { searchValue: /\s+(?=\w)/g, replaceValue: '_' },
        { searchValue: /_{2,}/g, replaceValue: '_' },
        { searchValue: /(_|\.)+\s*$/g, replaceValue: '' }, // partially redundant with strip options
    ] as StringReplaceParams[],
} as CleanStringOptions

export const itemId = async (
    row: Record<string, any>, 
    itemIdColumn: string,
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    const source = `[evaluators.item.itemId()]`;
    validate.objectArgument(source, {row});
    validate.objectArgument(source, {cleanOptions, isCleanStringOptions});
    validate.stringArgument(source, {itemIdColumn});
    const originalValue = String(row[itemIdColumn]);
    let itemId = clean(extractLeaf(String(row[itemIdColumn])), cleanOptions);
    if (!isNonEmptyString(itemId)) {
        mlog.warn([`${source} cleaned, extracted leaf is invalid string`,
            ` itemIdColumn: '${itemIdColumn}'`,
            `original value: '${String(row[itemIdColumn])}'`,
            `extracted leaf: '${extractLeaf(String(row[itemIdColumn]))}'`,
            `cleaned itemId: '${clean(extractLeaf(String(row[itemIdColumn])), cleanOptions)}'`
            ].join(TAB),
            NL+`-> returning original value`
        );
        return originalValue;
    }
    // @TODO move edge cases to post processing or parameterize
    if (itemId === 'SH') return 'S&H'
    if (itemId === 'SF') return 'S&F'
    return itemId;
}

/**
 * @note cache logic is temporary 
 * and should be moved to a new callable
 * but is temporary solution to current objective
 * @param row 
 * @param descriptionColumn 
 * @param itemIdColumn 
 * @param cleanOptions 
 * @returns 
 */
export const displayName = async (
    row: Record<string, any>,
    descriptionColumn: string,
    itemIdColumn: string,
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    let source = `[evaluators.item.displayName()]`;
    validate.multipleStringArguments(source, {descriptionColumn, itemIdColumn});
    validate.objectArgument(source, {row});
    validate.objectArgument(source, {cleanOptions, isCleanStringOptions});

    const itemIdExtractor = async (value: string,): Promise<string> => {
        return clean(extractLeaf(value), cleanOptions);
    }
    let cacheRows = await getRows(path.join(DATA_DIR, 'uploaded', 'inventory_item.tsv'));
    let itemIdCache = await getIndexedColumnValues(cacheRows, 'Name', itemIdExtractor);
    let itemIdValue = await itemId(row, itemIdColumn, cleanOptions);
    if (hasKeys(itemIdCache, itemIdValue) && isNonEmptyArray(itemIdCache[itemIdValue])) {
        let rowIndex = itemIdCache[itemIdValue][0];
        let cacheDisplayName = cacheRows[rowIndex]['Display Name'] ?? undefined;
        if (isNonEmptyString(cacheDisplayName)) {
            // slog.debug(`${source} found cacheDisplayName: '${cacheDisplayName}'`)
            return cacheDisplayName
        }
    }

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