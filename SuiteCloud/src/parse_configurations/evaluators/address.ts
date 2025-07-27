import { parseLogger as plog, mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, DEBUG_LOGS as DEBUG, 
    STOP_RUNNING
} from "../../config";
import { 
    FieldValue, 
} from "../../api/types";
import { 
    extractPhone, clean, extractEmail, extractName, stringEndsWithAnyOf, RegExpFlagsEnum,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, COMPANY_KEYWORDS_PATTERN, COMPANY_ABBREVIATION_PATTERN,
    SALUTATION_REGEX, ATTN_SALUTATION_PREFIX_PATTERN, LAST_NAME_COMMA_FIRST_NAME_PATTERN,
    REMOVE_ATTN_SALUTATION_PREFIX, ENSURE_SPACE_AROUND_HYPHEN, REPLACE_EM_HYPHEN,
    equivalentAlphanumericStrings as equivalentAlphanumeric,
    stringContainsAnyOf, JOB_TITLE_SUFFIX_PATTERN, extractJobTitleSuffix,
    REMOVE_JOB_TITLE_SUFFIX, KOREA_ADDRESS_LATIN_TEXT_PATTERN,
} from "../../utils/regex";
import { checkForOverride, } from "../../utils/io";
import { ENTITY_VALUE_OVERRIDES, entityId, firstName, lastName, middleName, salutation, jobTitleSuffix } from "./entity";
import { SUPPRESS } from "./common";
import { CountryAbbreviationEnum, StateAbbreviationEnum } from "src/utils/ns/Enums";



/** 
 * arguments for the {@link attention}`(row, args)` function 
 * to find the name of the person expected to receive the parcel from the `row` data. 
 * */
export type AttentionArguments = {
    entityIdColumn: string;
    salutationColumn?: string;
    firstNameColumn?: string;
    middleNameColumn?: string;
    lastNameColumn?: string;
    nameColumns?: string[];
}

/**
 * `if fullName.includes(`{@link entityId}`(row, args.entityIdColumn))`, 
 * - `then` the attention value is redundant because the addressee value is already set to entityId -> return an empty string.
 * @param row `Record<string, any>` - the `row` of data to look for the attention person name in
 * @param args {@link AttentionArguments} - arguments of column names to look for the attention person name in the `row` data.
 * @returns **`result`** `string` - the name of the person expected to receive the parcel from the `row` data.
 */
export const attention = (
    row: Record<string, any>,
    args: AttentionArguments
): string => {
    if (!row || !args.entityIdColumn) {
        return '';
    }
    const entity = entityId(row, args.entityIdColumn);
    const salutationValue = (args.salutationColumn 
        ? salutation(row, args.salutationColumn, ...(args.nameColumns || []))
        : ''
    );
    const first = firstName(row, args.firstNameColumn, ...args.nameColumns || []);
    const middle = middleName(row, args.middleNameColumn, ...args.nameColumns || []);
    const last = lastName(row, args.lastNameColumn, ...args.nameColumns || []);
    const title = jobTitleSuffix(row, 'Job Title', ...args.nameColumns || []);
    SUPPRESS.push(NL+`[evaluate.attention()]`,
        TAB+ `salutationValue: '${salutationValue}'`,
        TAB+ `entity: '${entity}'`,
        TAB+ ` first: '${first}'`,
        TAB+ `middle: '${middle}'`,
        TAB+ `  last: '${last}'`,
        TAB+ ` title: '${title}'`,
    );
    let alreadyHasJobTitleSuffix = (
        stringEndsWithAnyOf(last, new RegExp(`,? ?${title}`))
        || stringEndsWithAnyOf(last.replace(/\./, ''), new RegExp(`,? ?${title}`))
    );
    let fullName = ((
        salutationValue
        .replace(/\.\s*$/, '') 
        + `. ${first} ${middle} ${last}` 
        + (alreadyHasJobTitleSuffix ? '' : `, ${title}`)
        )
        .replace(/^\.\s(?=[A-Za-z])/, '') // removes the leading dot+space if no salutation value
        .replace(/\s+/g, ' ')
        .replace(/^\s*(,)\s*$/, '')
        .trim()
    );
    fullName = clean(fullName, {strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION});
    // const result = (fullName.includes(entity)) ? '' : fullName;
    SUPPRESS.push(NL+`[END evaluate.attention]()`,
        // NL+`attention(entityIdColumn='${args.entityIdColumn}', salutationColumn='${args.salutationColumn}', nameColumns.length=${args.nameColumns?.length || 0})`,
        TAB + `    entity: '${entity}'`,
        TAB + `salutation: '${salutationValue}'`,
        TAB + `  fullName: '${fullName}'`,
        TAB + `fullName.includes(entity) ? ${Boolean(entity) && fullName.includes(entity)}`,
        // TAB + `-> return result: '${result}'`
    );
    return fullName;
    // return result;
}

/**
 * @param row `Record<string, any>`
 * @param entityIdColumn `string`
 * @param companyNameColumn `string`
 * @returns **`addressee`** `string` - the name of the addressee based on the `row` data.
 * - i.e. the entity/company's name
 */
export const addressee = (
    row: Record<string, any>,
    entityIdColumn: string,
    companyNameColumn?: string
): string => {
    if (!row || !entityIdColumn) {
        mlog.error(`addressee() called with invalid parameters.`,
            TAB + `addressee() requires row, entityIdColumn, and companyNameColumn`,
        );
        return '';
    }
    let entity = entityId(row, entityIdColumn);
    let companyName = (companyNameColumn 
        ? checkForOverride(
            clean(row[companyNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION), 
            companyNameColumn, 
            ENTITY_VALUE_OVERRIDES
        ) as string
        : ''
    );
    return companyName ? companyName : entity;   
}

export type StreetArguments = {
    streetLineOneColumn: string;
    streetLineTwoColumn: string;
    companyNameColumn?: string;
    addresseeFunction: (row: Record<string, any>, entityIdColumn: string, companyNameColumn?: string) => string;
} & AttentionArguments;

/**
 * - `if` streetLineNumber === 1 and (row[streetLineOneColumn].includes(attention(row)) || row[streetLineOneColumn].includes(customerCompany(row)))
 * - - `return` row[streetLineTwoColumn]
 * - `else if` streetLineNumber === 1: return row[streetLineOneColumn]
 * - `else if` streetLineNumber === 2 and (row[streetLineOneColumn].includes(attention(row)) || row[streetLineOneColumn].includes(customerCompany(row)))
 * - - `return` '' because already returned the value for row[streetlineTwoColumn] for when street() was called with line number 1
 * - `else if` streetLineNumber === 2: return row[streetLineTwoColumn]
 * @param row `Record<string, any>` - the `row` of data to look for the street line in
 * @param streetLineNumber `1 | 2` - the street line number to return, either 1 or 2
 * @param args {@link StreetArguments} - the arguments to use for the street evaluation
 * @returns **`streetLineValue`** `string` - the street line value based on the `streetLineNumber` and the content of the `row` object.
 */
export const street = (
    row: Record<string, any>,
    streetLineNumber: 1 | 2,
    args: StreetArguments
): string => {
    const invalidStreetArguments = Boolean(!row || !args
        || ![1, 2].includes(streetLineNumber) 
        || !args.streetLineOneColumn 
        || !args.streetLineTwoColumn 
        || !args.entityIdColumn
    );
    if (invalidStreetArguments) {
        mlog.error(`street() called with invalid parameters.`,
            TAB + `street() requries row, streetLineNumber, and`,
            TAB + `args object with defined args.streetLineOneColumn, args.streetLineTwoColumn, args.entityIdColumn`,
        );
        return '';
    }        
    const attentionValue = attention(row, args);
    const addresseeValue = args.addresseeFunction(
        row, args.entityIdColumn, args.companyNameColumn
    );
    const streetLineOneValue = clean(row[args.streetLineOneColumn], {
        replace: [
            {searchValue: /^\s*(,|\.)+\s*$/, replaceValue: ''}, 
            REMOVE_ATTN_SALUTATION_PREFIX
        ]}
    );
    const streetLineTwoValue = clean(row[args.streetLineTwoColumn], {
        replace: [
            {searchValue: /^\s*(,|\.)+\s*$/, replaceValue: ''}, 
            REMOVE_ATTN_SALUTATION_PREFIX
        ]}
    );
    // mlog.debug(`[evaluators/address.street()]`,
    //     TAB+`original streetLineTwoValue: '${row[args.streetLineTwoColumn]}'`,
    //     TAB+` cleaned streetLineTwoValue: '${streetLineTwoValue}'`,
    // );
    const lineOneIsRedundant: boolean = (
        (Boolean(attentionValue) && (streetLineOneValue.includes(attentionValue)
            || equivalentAlphanumeric(streetLineOneValue, attentionValue)
            || equivalentAlphanumeric(
                streetLineOneValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
                attentionValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
            )
        )) 
        || 
        (Boolean(addresseeValue) && (streetLineOneValue.includes(addresseeValue)
            || equivalentAlphanumeric(streetLineOneValue, addresseeValue)
            || equivalentAlphanumeric(
                streetLineOneValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
                addresseeValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
            )
        ))
    );
    const lineTwoIsRedundant: boolean = (
        (Boolean(attentionValue) && (streetLineTwoValue.includes(attentionValue)
            || equivalentAlphanumeric(streetLineTwoValue, attentionValue)
            || equivalentAlphanumeric(
                streetLineTwoValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
                attentionValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
            )
        )) 
        || 
        (Boolean(addresseeValue) && (streetLineTwoValue.includes(addresseeValue)
            || equivalentAlphanumeric(streetLineTwoValue, addresseeValue)
            || equivalentAlphanumeric(
                streetLineTwoValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
                addresseeValue.replace(JOB_TITLE_SUFFIX_PATTERN, ''),
            )
        ))
    );
    switch (streetLineNumber) {
        case 1: {
            if (lineOneIsRedundant && !lineTwoIsRedundant) {
                return streetLineTwoValue;
            } else if (lineOneIsRedundant && lineTwoIsRedundant) {
                return '';
            }
            break;
        }
        case 2: {
            if (lineOneIsRedundant || lineTwoIsRedundant) {
                return ''; 
                // return empty string because already set value of 
                // addr1 to streetLineTwoValue
            }
            break;
        }
    }
    return '';
}

export const state = (
    row: Record<string, any>, 
    stateColumn: string
): FieldValue => {
    let state = clean(row[stateColumn], undefined, { toUpper: true});
    if (Object.keys(StateAbbreviationEnum).includes(state)) {
        return StateAbbreviationEnum[state as keyof typeof StateAbbreviationEnum];
    } else if (Object.values(StateAbbreviationEnum).includes(state as StateAbbreviationEnum)) {
        return state;
    } else {
        plog.warn(`Invalid state: '${state}'`);
        return '';
    }
}

export const country = (
    row: Record<string, any>, 
    countryColumn: string, 
    stateColumn: string
): FieldValue => {
    let country = clean(row[countryColumn], undefined, { toUpper: true});
    let state = clean(row[stateColumn], undefined, { toUpper: true});
    if (Object.keys(CountryAbbreviationEnum).includes(country)) {
        return CountryAbbreviationEnum[country as keyof typeof CountryAbbreviationEnum];
    } else if (Object.values(CountryAbbreviationEnum).includes(country as CountryAbbreviationEnum)) {
        return country;
    } else if (Object.keys(StateAbbreviationEnum).includes(state) || Object.values(StateAbbreviationEnum).includes(state as StateAbbreviationEnum)) {
        return CountryAbbreviationEnum.UNITED_STATES; 
        // Default to United StateAbbreviationEnum if state is valid but country is not
    } else {
        plog.warn(`Invalid country: '${country}' or state: '${state}'`);
        return '';
    }
}



