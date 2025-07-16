/**
 * @file src/parse_configurations/evaluators/common.ts
 * @description evaluators to use across multiple record types
 */
import { parseLogger as plog, mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, DEBUG_LOGS as DEBUG 
} from '../../config/setupLog';
import { 
    FieldValue, 
    TermBase as Term,
    RecordTypeEnum,
    SB_TERM_DICTIONARY as TERM_DICT,
} from "../../utils/api/types";
import { 
    clean,
} from "../../utils/io/regex/index";
import { ColumnSliceOptions } from '../../utils/io';
import * as validate from "../../utils/argumentValidation";

export const SUPPRESS: any[] = [];
/**
 * @param row - `Record<string, any>` the `row` of data
 * @param extractor - `(fieldValue: string) => RegExpMatchArray | null | string[]` - a function that extracts the field value from the `row` data
 * @param columnOptions `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for the fieldValue in
 * @returns **`matchResults[minIndex]`** `string` - or an empty string if none is found.
 */
export const field = (
    row: Record<string, any>,
    extractor: (fieldValue: string) => RegExpMatchArray | null | string[],
    ...columnOptions: ColumnSliceOptions[] | string[] | Array<string | ColumnSliceOptions>
): string => {
    if (!row || !extractor || !columnOptions || columnOptions.length === 0) {
        return '';
    }
    SUPPRESS.push(NL + `[START evaluate.field()] - extractor: ${extractor.name}()`,
        TAB+`columnOptions: ${JSON.stringify(columnOptions)}`
    );
    let result = '';
    for (const colOption of columnOptions) {
        const col = (typeof colOption === 'string' 
            ? colOption : colOption.colName
        );
        let initialVal = clean(row[col]);
        SUPPRESS.push(NL + `colOption: ${JSON.stringify(colOption)}`,
            TAB+`col: '${col}', initialVal: '${initialVal}'`
        );
        if (!initialVal) { continue; }
        const minIndex = (typeof colOption === 'object' && colOption.minIndex 
            ? colOption.minIndex : 0
        );
        const matchResults = extractor(initialVal);
        SUPPRESS.push(NL + `matchResults after ${extractor.name}('${initialVal}'): ${JSON.stringify(matchResults)}`,
            TAB + `matchResults.length: ${matchResults ? matchResults.length : undefined}`,
            TAB + `matchResults[minIndex=${minIndex}]: '${matchResults ? matchResults[minIndex] : undefined}'`,        
        );
        if (!matchResults || matchResults.length <= minIndex || matchResults[minIndex] === null || matchResults[minIndex] === undefined) {
            SUPPRESS.push(NL + `continue to next column option because at least one of the following is true:`,
                TAB+`   !matchResults === ${!matchResults}`,
                TAB+`|| matchResults.length <= minIndex === ${matchResults && matchResults.length <= minIndex}`,
                TAB+`|| !matchResults[${minIndex}] === ${matchResults && !matchResults[minIndex]}`,
            );
            continue;
        }
        result = (matchResults[minIndex] as string);
        break;
    }
    SUPPRESS.push(NL+`[END evaluate.field()] - extractor: ${extractor.name}(), RETURN result: '${result}'`,);
    return result
}

export const externalId = async (
    row: Record<string, any>, 
    recordType: RecordTypeEnum,
    idEvaluator: (row: Record<string, any>, ...args: string[]) => string | Promise<string>,
    ...idEvaluatorArgs: string[]
): Promise<string> => {
    validate.objectArgument(`evaluators.common.externalId`, `row`, row);
    validate.stringArgument(`evaluators.common.externalId`, `recordType`, recordType);
    validate.functionArgument(`evaluators.common.externalId`, `idEvaluator`, idEvaluator);
    let id = await idEvaluator(row, ...idEvaluatorArgs);
    if (!id) {
        mlog.warn(`[externalId()]: idEvaluator returned falsey value for recordType '${recordType}' with args: ${JSON.stringify(idEvaluatorArgs)}`);
        return '';
    }
    // Ensure the ID is in the format 'entity<recordType>'
    return `${id}<${recordType}>`;
}

/**
 * @param row 
 * @param termsColumn 
 * @param termsDict 
 * @returns `number | null` - the internalid of the terms, or `null` if not found.
 */
export const terms = (
    row: Record<string, any>,
    termsColumn: string,
    termsDict: Record<string, Term>=TERM_DICT
): number | null => {
    if (!row || !termsColumn || !termsDict) {
        mlog.error('[terms()]: Invalid params. Cannot evaluate terms.');
        return null;
    }
    let termsRowValue = clean(row[termsColumn]);
    if (termsRowValue && Object.keys(termsDict).includes(termsRowValue)) {
        return termsDict[termsRowValue].internalid as number;
    } 
    let key = Object.keys(termsDict).find(
        (key) => termsDict[key].name === termsRowValue
    );
    if (!key) {
        plog.warn(`Invalid terms: '${termsRowValue}'`);
        return null;
    }
    return termsDict[key].internalid as number;
}
