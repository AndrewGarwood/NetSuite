/**
 * @file src/parses/evaluatorFunctions.ts
 */

import { parseLogger as plog, mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, DEBUG_LOGS 
} from '../config';
import { HUMAN_VENDORS_TRIMMED } from './vendor/vendorConstants';
import { 
    FieldValue, 
    StateAbbreviationEnum as STATES, 
    CountryAbbreviationEnum as COUNTRIES, 
    TermBase as Term,
    RecordTypeEnum,
} from "../utils/api/types";
import { 
    extractPhone, cleanString, extractEmail, extractName, stringEndsWithAnyOf, RegExpFlagsEnum,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, COMPANY_KEYWORDS_PATTERN, COMPANY_ABBREVIATION_PATTERN,
    checkForOverride, isValidEmail,
    SALUTATION_REGEX, ATTN_SALUTATION_PREFIX_PATTERN, LAST_NAME_COMMA_FIRST_NAME_PATTERN,
    ValueMapping, REMOVE_ATTN_SALUTATION_PREFIX,
    ColumnSliceOptions, StringReplaceOptions, equivalentAlphanumericStrings as equivalentAlphanumeric,
    stringContainsAnyOf
} from "../utils/io";

/**@TODO maybe find way allow evaluator functions to reference fields that have already been parsed to prevent repeat function calls... */
/**temporarily put logs here instead of commenting out log statements */
const SUPPRESS: any[] = [];
export const ENTITY_VALUE_OVERRIDES: ValueMapping = {
} 

/** 
 * @param row `Record<string, any>` - the `row` of data
 * @param entityIdColumn `string`
 * @returns **`entity`** = {@link checkForOverride}`(`{@link cleanString}`(row[entityIdColumn],...),...)`
 * */
export const entityId = (
    row: Record<string, any>, 
    entityIdColumn: string
): string => {
    let entity = cleanString(
        row[entityIdColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION
    );
    return checkForOverride(
        entity, entityIdColumn, ENTITY_VALUE_OVERRIDES
    ) as string;
}

/**
 * @param row `Record<string, any>` - the `row` of data
 * @param recordType {@link RecordTypeEnum} - the type of record being parsed from the `row`
 * @param entityIdColumn `string` - the column of the `row` to look for the `'entityid'` in
 * @returns **`externalId`** `string` = `'${`{@link entity}`(entityIdColumn)}<${recordType}>'`
 */
export const externalId = (
    row: Record<string, any>, 
    recordType: RecordTypeEnum, 
    entityIdColumn: string
): string => {
    let entity = entityId(row, entityIdColumn);
    const externalId = `${entity}<${recordType}>`;
    return externalId;
}

/**
 * @description
 * Check if the entity is a person or a company based on the `row` context data 
 * using the following assumptions/rules:
 * - `If` the `entityId` is in the {@link HUMAN_VENDORS_TRIMMED} list, it is a person.
 * - `If` the `entityId` matches the {@link COMPANY_KEYWORDS_PATTERN} or ends with {@link COMPANY_ABBREVIATION_PATTERN}, consider it is a company.
 * - `If` `/[0-9@]+/.test(entityId)`, it is a company.
 * - `If` the `entityId` is a single word, it is a company.
 * - `If` the `company` name is empty, it is a person.
 * - `If` the `company` name is NOT the same as the `entityId`, it is a company (assume that the value in the company column is not a person's name).
 * - `else` assume it is a person.
 * @param row - `Record<string, any>` the `row` of data
 * @param entityIdColumn `string` - the column of the `row` to look for the entity ID in
 * @param companyColumn `string` - the column of the `row` to look for the company name in
 * @returns **`isPerson`** `boolean` 
 * - **`true`** `if` the entity is a person, 
 * - **`false`** `otherwise`
 */
export const isPerson = (
    row: Record<string, any>, 
    entityIdColumn: string, 
    companyColumn: string='Company'
): boolean => {
    let entity = entityId(row, entityIdColumn);
    let company = (companyColumn 
        ? cleanString(row[companyColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
        : ''
    );
    if (HUMAN_VENDORS_TRIMMED.includes(entity)) {
        // log.debug(...[...logArr, TAB + `-> return true`]);
        DEBUG_LOGS.push(NL + `-> return true because entity '${entity}' is in HUMAN_VENDORS_TRIMMED`);
        return true;
    }
    if (COMPANY_KEYWORDS_PATTERN.test(entity) 
        || stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
        || stringContainsAnyOf(entity, /[0-9@]+/, RegExpFlagsEnum.GLOBAL)
        || entity.split(' ').length === 1
        || (company
            && !LAST_NAME_COMMA_FIRST_NAME_PATTERN.test(company)
            && equivalentAlphanumeric(entity, company)
        )
        || (company && COMPANY_KEYWORDS_PATTERN.test(company))
    ) {
        // log.debug(...[...logArr, TAB + `-> return false`]);
        return false;
    }
    SUPPRESS.push(
        NL+ `isPerson():`,
        NL + `entityIdColumn = '${entityIdColumn}' -> entity = '${entity}'`,`companyColumn = '${companyColumn}'`, 
        TAB + `HUMAN_VENDORS_TRIMMED.includes('${entity}') = ${HUMAN_VENDORS_TRIMMED.includes(entity)}`,
        TAB + `COMPANY_KEYWORDS_PATTERN.test('${entity}')  = ${COMPANY_KEYWORDS_PATTERN.test(entity)}`,
        TAB + `'${entity}' ends with company abbreviation  = ${stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)}`,
        TAB + `/[0-9@]+/.test('${entity}')                 = ${/[0-9@&]+/.test(entity)}`,
        NL + `companyColumn = '${companyColumn}' -> company = '${company}'`,
        TAB + `Boolean('${company}')                       = ${Boolean(company)}`,
        TAB + `COMPANY_KEYWORDS_PATTERN.test('${company}') = ${company && COMPANY_KEYWORDS_PATTERN.test(company)}`, 

    );
    SUPPRESS.push(TAB + `Reached End of isPerson() -> return true`);
    return true;
}

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
        let initialVal = cleanString(row[col]);
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

/**
 * @param row - `Record<string, any>` the `row` of data to look for an phone number in
 * @param phoneColumnOptions `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for an phone number in
 * @returns **`phone`** - `string` - the first valid phone number found, or an empty string if none found.
 */
export const phone = (
    row: Record<string, any>, 
    ...phoneColumnOptions: Array<string | ColumnSliceOptions>
): string => {
    return field(row, extractPhone, ...phoneColumnOptions);
    // mlog.info(`evaluatorFunctions.phone() -> return phoneValue: '${phoneValue}'`,);
    // return phoneValue;
}

/**
 * @param row - `Record<string, any>` the `row` of data to look for an email address in
 * @param emailColumnOptions - `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for an email address in
 * @returns **`email`** - `string` - the first valid email address found, or an empty string if none found.
 */
export const email = (
    row: Record<string, any>,
    ...emailColumnOptions: Array<string | ColumnSliceOptions>
): string => {
    const emailValue: string = field(row, extractEmail, ...emailColumnOptions);
    SUPPRESS.push(NL+`evaluatorFunctions.email()`,
        TAB+`emailValue: '${emailValue}'`,
        TAB+`isValidEmail('${emailValue}') = ${isValidEmail(emailValue)}`,
        TAB+`-> return '${emailValue}'`
    );
    return isValidEmail(emailValue) ? emailValue : '';
}

export const salutation = (
    row: Record<string, any>,
    salutationColumn: string,
    ...nameColumns: string[]
): string => {
    let salutationValue = cleanString(row[salutationColumn]);
    if (salutationValue) return salutationValue;
    if (!nameColumns) return '';
    SUPPRESS.push(
        NL+`evaluate.salutation() cleanString(row['${salutationColumn}']) = '${salutationValue}'`,
    );
    for (const col of nameColumns) {
        let initialVal = cleanString(
            row[col], 
            STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, undefined, undefined, 
            [{searchValue: /^((attention|attn|atn):)?\s*/i, replaceValue: '' }]
        );
        SUPPRESS.push(
            TAB + `col: '${col}', initialVal: '${initialVal}'`,
        );
        if (!initialVal) { continue; } 
        if (SALUTATION_REGEX.test(initialVal)) {
            salutationValue = initialVal.match(SALUTATION_REGEX)?.[0] || '';
            SUPPRESS.push(
                TAB + `SALUTATION_REGEX.test('${initialVal}') = true`,
                TAB + `initialVal.match(SALUTATION_REGEX)?.[0] = '${initialVal.match(SALUTATION_REGEX)?.[0]}'`,
                TAB + `-> RETURN salutationValue: '${salutationValue}'`
            );
            return salutationValue;
        }
    }
    return '';
    
}

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
    const fullName = ((
        salutationValue
        .replace(/\.\s*$/, '') 
        + `. ${first} ${middle} ${last}`
        )
        .replace(/^\.\s(?=[A-Za-z])/, '') // removes the leading dot+space if no salutation value
        .replace(/\s+/g, ' ')
        .replace(/^\s*\.\s*$/, '')
        .trim()
    );
    // const result = (fullName.includes(entity)) ? '' : fullName;
    SUPPRESS.push(NL+`End of evaluate.attention()`,
        // NL+`attention(entityIdColumn='${args.entityIdColumn}', salutationColumn='${args.salutationColumn}', nameColumns.length=${args.nameColumns?.length || 0})`,
        TAB + `    entity: '${entity}'`,
        // TAB + `salutation: '${salutationValue}'`,
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
            cleanString(row[companyNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION), 
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
    const streetLineOneValue = cleanString(row[args.streetLineOneColumn], 
        undefined, undefined, undefined, [{searchValue: /^\s*(,|\.)+\s*$/, replaceValue: ''}]
    );
    const streetLineTwoValue = cleanString(row[args.streetLineTwoColumn], 
        undefined, undefined, undefined, [{searchValue: /^\s*(,|\.)+\s*$/, replaceValue: ''}]
    );
    const lineOneIsRedundant: boolean = (
        (Boolean(attentionValue) && (streetLineOneValue.includes(attentionValue)
            || equivalentAlphanumeric(streetLineOneValue, attentionValue)
        )) 
        || 
        (Boolean(addresseeValue) && (streetLineOneValue.includes(addresseeValue)
            || equivalentAlphanumeric(streetLineOneValue, addresseeValue)
        ))
    );
    if (streetLineNumber === 1 && lineOneIsRedundant) {
        SUPPRESS.push(NL + `streetLineNumber === 1 && lineOneIsRedundant is true!`,
            NL + `streetLineOneValue: '${streetLineOneValue}' is redundant...`,
            NL + `attentionValue: '${attentionValue}'`,
            TAB + `               streetLineOneValue.includes(attentionValue) ? ${Boolean(attentionValue) && streetLineOneValue.includes(attentionValue)}`,
            TAB + `equivalentAlphanumeric(streetLineOneValue, attentionValue) ? ${equivalentAlphanumeric(streetLineOneValue, attentionValue)}`,
            NL + `addresseeValue: '${addresseeValue}'`,
            TAB + `               streetLineOneValue.includes(addresseeValue) ? ${Boolean(addresseeValue) && streetLineOneValue.includes(addresseeValue)}`,
            TAB + `equivalentAlphanumeric(streetLineOneValue, addresseeValue) ? ${equivalentAlphanumeric(streetLineOneValue, addresseeValue)}`,
            NL + ` -> return streetLineTwoValue: '${streetLineTwoValue}'`
        );
        return streetLineTwoValue;
    } else if (streetLineNumber === 1) {
        return streetLineOneValue;
    } else if (streetLineNumber === 2 && lineOneIsRedundant) {
        return ''; // return empty string because already set value of addr1 to streetLineTwoValue
    } else if (streetLineNumber === 2) {
        return streetLineTwoValue;
    } else {
        mlog.error(`street() called with invalid streetLineNumber: ${streetLineNumber}`);
        return '';
    }
}


/**
 * return the name `{first, middle, last}` corresponding to the first column with a non-empty first and last name
 * @param row `Record<string, any>`
 * @param nameColumns the columns of the `row` to look for a name in.
 * @returns `{first: string, middle: string, last: string}` - the first, middle, and last name of the person, if found.
 * @see {@link extractName} for the regex used to validate the name.
 */
export const name = (
    row: Record<string, any>, 
    ...nameColumns: string[]
): {
    first: string;
    middle: string;
    last: string;
} => {
    for (const col of nameColumns) {
        let initialVal = cleanString(row[col], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
        if (!initialVal) {
            continue;
        }
        const {first, middle, last} = extractName(initialVal);
        if (first && last) { 
            plog.debug(`extractName('${initialVal}') from col='${col}'`,
                TAB+`-> return { first='${first}', middle='${middle}', last='${last}' }`
            );
            return { first: first, middle: middle || '', last: last }; 
        }
    }
    return {first: '', middle: '', last: ''};
}


/**
 * @param row `Record<string, any>`
 * @param firstNameColumn 
 * @param nameColumns 
 * @returns **`first`** - `{string}` 
 * - the value from `row[firstNameColumn]` if it is not empty, 
 * - `otherwise` returns the `name.first` from the first `nameColumn` with a non-empty `name.first` and `name.last` using {@link extractName}`(name=row[col])` for col in `nameColumns`
 * - `otherwise` empty string.
 */
export const firstName = (
    row: Record<string, any>,
    firstNameColumn?: string, 
    ...nameColumns: string[]
): string => {
    let first = (firstNameColumn 
        ? cleanString(row[firstNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
        : ''
    );
    SUPPRESS.push(NL + `cleanString(row[firstNameColumn]): '${first}'`);
    if (!first || first.split(' ').length > 1) {
        first = name(row, 
            ...(firstNameColumn ? [firstNameColumn] : []) //if data entry error when someone put whole name in firstNameColumn,
                .concat(nameColumns)
        ).first;
    }
    SUPPRESS.push(NL + `first after evaluate nameColumns: '${first}'`);
    return first.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
}

export const middleName = (
    row: Record<string, any>, 
    middleNameColumn?: string,
    ...nameColumns: string[]
): string => {
    let middle = (middleNameColumn 
        ? cleanString(row[middleNameColumn])
        : ''
    );
    if (!middle || middle.split(' ').length > 1) {
        middle = name(row, ...nameColumns).middle;
    }
    SUPPRESS.push(NL + `middle after evaluate nameColumns: '${middle}'`);
    return middle.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
}

export const lastName = (
    row: Record<string, any>, 
    lastNameColumn?: string,
    ...nameColumns: string[]
): string => {
    let last = (lastNameColumn 
        ? cleanString(row[lastNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
        : ''
    );
    // log.debug(`cleanString(row[lastNameColumn]): '${last}'`);
    if (!last) {
        last = name(row, ...nameColumns).last;
    }
    SUPPRESS.push(NL + `last after evaluate nameColumns: '${last}'`);
    return last.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');;
}


export const state = (
    row: Record<string, any>, 
    stateColumn: string
): FieldValue => {
    let state = cleanString(row[stateColumn], undefined, { toUpper: true});
    if (Object.keys(STATES).includes(state)) {
        return STATES[state as keyof typeof STATES];
    } else if (Object.values(STATES).includes(state as STATES)) {
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
    let country = cleanString(row[countryColumn], undefined, { toUpper: true});
    let state = cleanString(row[stateColumn], undefined, { toUpper: true});
    if (Object.keys(COUNTRIES).includes(country)) {
        return COUNTRIES[country as keyof typeof COUNTRIES];
    } else if (Object.values(COUNTRIES).includes(country as COUNTRIES)) {
        return country;
    } else if (Object.keys(STATES).includes(state) || Object.values(STATES).includes(state as STATES)) {
        return COUNTRIES.UNITED_STATES; 
        // Default to United States if state is valid but country is not
    } else {
        plog.warn(`Invalid country: '${country}' or state: '${state}'`);
        return '';
    }
}

export const terms = (
    row: Record<string, any>,
    termsColumn: string,
    termsDict: Record<string, Term> | undefined
): FieldValue => {
    if (!termsDict) {
        plog.error('evaluateVendorTerms: termDict is undefined. Cannot evaluate terms.');
        return null;
    }
    let termsRowValue = cleanString(row[termsColumn]);
    if (termsRowValue && Object.keys(termsDict).includes(termsRowValue)) {
        return termsDict[termsRowValue].internalid as number;
    } else if (termsRowValue && Object.keys(termsDict).some((key) => termsDict[key].name === termsRowValue)) {
        let key = Object.keys(termsDict)
            .find((key) => termsDict[key].name === termsRowValue);
        return key ? termsDict[key].internalid as number: null;
    } else if (!termsRowValue){
        return null;
    }
    plog.warn(`Invalid terms: '${termsRowValue}'`);
    return null;
}


const commonEmailDomains = [
    'benev.com', 'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'mail.com', 'live.com', 'msn.com', 'comcast.net',
    'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net',
    'cox.net', 'charter.net', 'earthlink.net', 'roadrunner.com', 
    '.edu', 'live.com'
]
export const website = (
    row: Record<string, any>, 
    websiteColumn: string,
    ...emailColumnOptions: Array<string | ColumnSliceOptions>
): FieldValue => {
    let websiteValue = cleanString(row[websiteColumn]);
    if (websiteValue) {
        websiteValue = websiteValue
            .replace(/^(http(s)?:\/\/)?(www\.)?/, '')
            .replace(/\/$/, '');
        return `https://${websiteValue}`;
    } else { // see if email address is for the entity's website
        for (const colOption of emailColumnOptions) {
            let emailValue = email(row, colOption);
            if (!emailValue 
                || stringEndsWithAnyOf(emailValue, commonEmailDomains, RegExpFlagsEnum.IGNORE_CASE)
            ) {
                continue; // skip common email domains
            }
            websiteValue = emailValue.split('@')[1] // get the domain part of the email
                .replace(/^(http(s)?:\/\/)?(www\.)?/, '')
                .replace(/\/$/, '');
            return `https://${websiteValue}`;
        }
    }
    return '';
}



