/**
 * @file src/parse_configurations/evaluators/common.ts
 * @description evaluators to use across multiple record types
 */
import { parseLogger as plog, mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL,
} from "../../config/setupLog";
import { 
    clean,
} from "typeshi:utils/regex";
import * as validate from "typeshi:utils/argumentValidation";
import { RecordTypeEnum } from "../../utils/ns/Enums";
import { SB_TERM_DICTIONARY, TermBase } from "../../utils/ns/record/accounting/Term";
import { ColumnSliceOptions } from "src/services/parse/types/ParseOptions";
import { FieldDictionary, RecordOptions } from "@api/types";
import { isNonEmptyString } from "@typeshi/typeValidation";

/**
 * @param row - `Record<string, any>` the `row` of data
 * @param extractor - `(fieldValue: string) => RegExpMatchArray | null | string[]` - a function that extracts the field value from the `row` data
 * @param columnOptions `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for the fieldValue in
 * @returns **`matchResults[minIndex]`** `string` - or an empty string if none is found.
 */
export const field = (
    fields: FieldDictionary,
    row: Record<string, any>,
    extractor: (fieldValue: string) => RegExpMatchArray | null | string[],
    ...columnOptions: ColumnSliceOptions[] | string[] | Array<string | ColumnSliceOptions>
): string => {
    if (!row || !extractor || !columnOptions || columnOptions.length === 0) {
        return '';
    }
    plog.debug([`[START evaluate.field()] - extractor: ${extractor.name}()`,
        `columnOptions: ${JSON.stringify(columnOptions)}`
    ].join(TAB));
    let result = '';
    for (const colOption of columnOptions) {
        const col = (typeof colOption === 'string' 
            ? colOption : colOption.colName
        );
        let initialVal = clean(row[col]);
        plog.debug([`colOption: ${JSON.stringify(colOption)}`,
            `col: '${col}', initialVal: '${initialVal}'`
        ].join(TAB));
        if (!initialVal) { continue; }
        const minIndex = (typeof colOption === 'object' && colOption.minIndex 
            ? colOption.minIndex : 0
        );
        const matchResults = extractor(initialVal);
        plog.debug([`matchResults after ${extractor.name}('${initialVal}'): ${JSON.stringify(matchResults)}`,
            `matchResults.length: ${matchResults ? matchResults.length : undefined}`,
            `matchResults[minIndex=${minIndex}]: '${matchResults ? matchResults[minIndex] : undefined}'`,        
        ].join(TAB));
        if (!matchResults || matchResults.length <= minIndex || matchResults[minIndex] === null || matchResults[minIndex] === undefined) {
            plog.debug([`continue to next column option because at least one of the following is true:`,
                `   !matchResults === ${!matchResults}`,
                `|| matchResults.length <= minIndex === ${matchResults && matchResults.length <= minIndex}`,
                `|| !matchResults[${minIndex}] === ${matchResults && !matchResults[minIndex]}`,
            ].join(TAB));
            continue;
        }
        result = (matchResults[minIndex] as string);
        break;
    }
    plog.debug(NL+`[END evaluate.field()] - extractor: ${extractor.name}(), RETURN result: '${result}'`,);
    return result
}

export const externalId = async (
    fields: FieldDictionary,
    row: Record<string, any>, 
    recordType: RecordTypeEnum,
    idEvaluator: (
        fields: FieldDictionary,
        row: Record<string, any>, 
        ...args: string[]
    ) => string | Promise<string>,
    ...idEvaluatorArgs: string[]
): Promise<string> => {
    if (isNonEmptyString(fields.externalid)) {
        return fields.externalid;
    }
    let id = await idEvaluator(fields, row, ...idEvaluatorArgs);
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
    fields: FieldDictionary,
    row: Record<string, any>,
    termsColumn: string,
    termsDict: Record<string, TermBase>
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
