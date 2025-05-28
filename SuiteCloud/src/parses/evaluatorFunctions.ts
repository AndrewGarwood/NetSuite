/**
 * @file src/parses/evaluatorFunctions.ts
 */

import { parseLogger as log, INDENT_LOG_LINE as TAB } from 'src/config/setupLog';
import { HUMAN_VENDORS_TRIMMED } from './vendor/vendorParseEvaluatorFunctions';
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
    checkForOverride,
    SALUTATION_REGEX,
    ValueMapping,
    ColumnSliceOptions, 
} from "../utils/io";

export const ENTITY_VALUE_OVERRIDES: ValueMapping = {
} 

/** 
 * @returns `entity` = {@link checkForOverride}`(`{@link cleanString}`(row[entityIdColumn],...),...)`
 * */
export const entityId = (row: Record<string, any>, entityIdColumn: string): string => {
    let entity = cleanString(row[entityIdColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION) || '';
    return checkForOverride(entity, entityIdColumn, ENTITY_VALUE_OVERRIDES) as string;
}


export const externalId = (row: Record<string, any>, recordType: RecordTypeEnum, entityIdColumn: string): string => {
    let entity = entityId(row, entityIdColumn);
    const externalId = `${entity}<${recordType}>`;
    return externalId;
}

/**
 * @description
 * Check if the entity is a person or a company based on the `row` context data using the following assumptions/rules:
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
 * @returns `boolean` - `true` if the entity is a person, `false` otherwise
 */
export const isPerson = (
    row: Record<string, any>, 
    entityIdColumn: string, 
    companyColumn: string='Company'
): boolean => {
    let entity = entityId(row, entityIdColumn);
    let company = cleanString(row[companyColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    const entityNameIsSameAsCompanyName = company && (company.toLowerCase().replace(/\W*/g, '') === entity.toLowerCase().replace(/\W*/g, ''));
    const logArr: any[] = [
        `isPerson("${entity}") entityIdColumn = "${entityIdColumn}", companyColumn = "${companyColumn}"`, 
        TAB + `HUMAN_VENDORS_TRIMMED.includes("${entity}") = ${HUMAN_VENDORS_TRIMMED.includes(entity)}`,
        TAB + ` COMPANY_KEYWORDS_PATTERN.test("${entity}") = ${COMPANY_KEYWORDS_PATTERN.test(entity)}`,
        TAB + ` "${entity}" ends with company abbreviation = ${stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)}`,
        TAB + `                /[0-9@]+/.test("${entity}") = ${/[0-9@&]+/.test(entity)}`,
        TAB + `                      Boolean("${company}") = ${Boolean(company)}`,
        TAB + `              entityNameIsSameAsCompanyName = ${entityNameIsSameAsCompanyName}`,
    ];
    if (HUMAN_VENDORS_TRIMMED.includes(entity)) {
        log.debug(...[...logArr, TAB + `-> return true`]);
        return true;
    }
    if (COMPANY_KEYWORDS_PATTERN.test(entity) 
        || stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
        || /[0-9@]+/.test(entity) || entity.split(' ').length === 1
        || (company// && (company !== entity || COMPANY_KEYWORDS_PATTERN.test(company))
            && company.toLowerCase().replace(/\W*/g, '') !== entity.toLowerCase().replace(/\W*/g, ''))
    ) {
        log.debug(...[...logArr, TAB + `-> return false`]);
        return false;
    }
    log.debug(...[...logArr, TAB + `Reached End of isPerson() -> return true`]);
    return true;
}


/**
 * @param row - `Record<string, any>` the `row` of data
 * @param columnOptions `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for the fieldValue in
 * @returns `matchResults[minIndex]` - `string` - or an empty string if none is found.
 */
export const field = (
    row: Record<string, any>,
    extractor: (fieldValue: string) => RegExpMatchArray | null | string[],
    ...columnOptions: ColumnSliceOptions[] | string[] | Array<string | ColumnSliceOptions>
): string => {
    if (!row) {
        return '';
    }
    for (const colOption of columnOptions) {
        const col = typeof colOption === 'string' ? colOption : colOption.colName;
        const minIndex = typeof colOption === 'object' && colOption.minIndex ? colOption.minIndex : 0;
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        const matchResults = extractor(initialVal);
        if (!matchResults || matchResults.length <= minIndex || !matchResults[minIndex]) {
            continue;
        }
        return matchResults[minIndex];
    }
    return ''
}

/**
 * @param row - `Record<string, any>` the `row` of data to look for an phone number in
 * @param phoneColumnOptions `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for an phone number in
 * @returns `email` - `string` - the first valid phone number found, or an empty string if none found.
 */
export const phone = (
    row: Record<string, any>, 
    ...phoneColumnOptions: Array<string | ColumnSliceOptions>
): string => {
    return field(row, extractPhone,...phoneColumnOptions);
}

/**
 * @param row - `Record<string, any>` the `row` of data to look for an email address in
 * @param emailColumnOptions - `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for an email address in
 * @returns `email` - `string` - the first valid email address found, or an empty string if none found.
 */
export const email = (
    row: Record<string, any>,
    ...emailColumnOptions: Array<string | ColumnSliceOptions>
): string => {
    return field(row, extractEmail, ...emailColumnOptions);
}

export const salutation = (
    row: Record<string, any>,
    salutationColumn: string,
    ...nameColumns: string[]
): string => {
    let salutation = cleanString(row[salutationColumn]);
    if (salutation) return salutation;
    if (!nameColumns) {
        return '';
    } else { // salutation not found in salutationColumn, let's check nameColumns
        for (const col of nameColumns) {
            let initialVal = cleanString(row[col], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
            if (!initialVal) {
                continue;
            } else if (SALUTATION_REGEX.test(initialVal)) {
                salutation = initialVal.match(SALUTATION_REGEX)?.[0] || '';
                return salutation;
            }
        }
        return '';
    }
}

export const attention = (
    row: Record<string, any>,
    entityIdColumn: string,
    salutationColumn: string,
    ...nameColumns: string[]
): string => {
    let entity = entityId(row, entityIdColumn);
    let { first, middle, last } = name(row, ...nameColumns);
    let fullName = `${salutation(row, salutationColumn).replace(/\.\s*/, '')}. ${first} ${middle} ${last}`
        .trim().replace(/\s+/g, ' ');
    return fullName === entity ? '' : fullName;
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
        log.debug(`extractName("${initialVal}") from col="${col}"`,
            `\n\t-> {first="${first}", middle="${middle}", last="${last}"}`);
            return {first: first, middle: middle || '', last: last}; 
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
 * - otherwise returns the `name.first` from the first `nameColumn` with a non-empty `name.first` and `name.last` using {@link extractName}`(name=row[col])` for col in `nameColumns`
 * - otherwise empty string.
 */
export const firstName = (
    row: Record<string, any>,
    firstNameColumn: string, 
    ...nameColumns: string[]
): string => {
    let first = cleanString(row[firstNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    // log.debug(`cleanString(row[firstNameColumn]): "${first}"`);
    if (!first || first.split(' ').length > 1) {
        first = name(row, ...([firstNameColumn].concat(nameColumns))).first;
    }
    // log.debug(`first after evaluate nameColumns: "${first}"`);
    return first.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');;
}


export const middleName = (
    row: Record<string, any>, 
    middleNameColumn: string,
    ...nameColumns: string[]
): string => {
    let middle = cleanString(row[middleNameColumn]);
    if (!middle || middle.split(' ').length > 1) {
        middle = name(row, ...nameColumns).middle;
    }
    // log.debug(`middle after evaluate nameColumns: "${middle}"`);
    return middle.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
}

export const lastName = (
    row: Record<string, any>, 
    lastNameColumn: string,
    ...nameColumns: string[]
): string => {
    let last = cleanString(row[lastNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    // log.debug(`cleanString(row[lastNameColumn]): "${last}"`);
    if (!last) {
        last = name(row, ...nameColumns).last;
    }
    // log.debug(`last after evaluate nameColumns: "${last}"`);
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
        log.warn(`Invalid state: "${state}"`);
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
        log.warn(`Invalid country: "${country}" or state: "${state}"`);
        return '';
    }
}

export const terms = (
    row: Record<string, any>,
    termsColumn: string,
    termsDict: Record<string, Term> | undefined
): FieldValue => {
    if (!termsDict) {
        log.error('evaluateVendorTerms: termDict is undefined. Cannot evaluate terms.');
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
    log.warn(`Invalid terms: "${termsRowValue}"`);
    return null;
}


const commonEmailDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
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
    let website = cleanString(row[websiteColumn]);
    if (website) {
        website = website
            .replace(/^(http(s)?:\/\/)?(www\.)?/, '')
            .replace(/\/$/, '');
        return `https://${website}`;
    } else { // see if email address is for the entity's website
        for (const colOption of emailColumnOptions) {
            let emailValue = email(row, colOption);
            if (!emailValue 
                || stringEndsWithAnyOf(emailValue, commonEmailDomains, RegExpFlagsEnum.IGNORE_CASE)
            ) {
                continue; // skip common email domains
            }
            website = emailValue.split('@')[1] // get the domain part of the email
                .replace(/^(http(s)?:\/\/)?(www\.)?/, '')
                .replace(/\/$/, '');
            return `https://${website}`;
        }
    }
    return '';
}



