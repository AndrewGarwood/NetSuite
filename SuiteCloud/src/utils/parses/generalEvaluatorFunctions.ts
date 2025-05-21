/**
 * @file src/utils/parses/generalEvaluatorFunctions.ts
 */

import { mainLogger as log } from 'src/config/setupLog';
import { HUMAN_VENDORS_TRIMMED } from './vendor/vendorParseEvaluatorFunctions';
import { 
    FieldValue, 
    StateAbbreviationEnum as STATES, 
    CountryAbbreviationEnum as COUNTRIES, 
    TermBase as Term,
} from "../api/types";
import { 
    applyPhoneRegex, cleanString, extractEmail, extractName, stringEndsWithAnyOf, RegExpFlagsEnum,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, COMPANY_KEYWORDS_PATTERN, COMPANY_ABBREVIATION_PATTERN,
    checkForOverride,
    SALUTATION_REGEX,
    ValueMapping, 
} from "../io";

export const ENTITY_VALUE_OVERRIDES: ValueMapping = {
} 

export const entityId = (row: Record<string, any>, entityIdColumn: string): string => {
    let entity = cleanString(row[entityIdColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION) || '';
    return checkForOverride(entity, entityIdColumn, ENTITY_VALUE_OVERRIDES) as string;
}

export const isPerson = (
    row: Record<string, any>, 
    entityIdColumn: string, 
    companyColumn: string='Company'
): boolean => {
    let entity = entityId(row, entityIdColumn);
    let company = cleanString(row[companyColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    const logArr: any[] = [
        `isPerson("${entity}") entityIdColumn = "${entityIdColumn}", companyColumn = "${companyColumn}"`, 
        `\n\t HUMAN_VENDORS_TRIMMED.includes("${entity}") = ${HUMAN_VENDORS_TRIMMED.includes(entity)}`,
        `\n\t  COMPANY_KEYWORDS_PATTERN.test("${entity}") = ${COMPANY_KEYWORDS_PATTERN.test(entity)}`,
        `\n\t          "${entity}" ends with abbreviation = ${stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)}`,
        `\n\t                 /[0-9@]+/.test("${entity}") = ${/[0-9@]+/.test(entity)}`,
        `\n\t                       Boolean("${company}") = ${Boolean(company)}`,
    ];
    if (HUMAN_VENDORS_TRIMMED.includes(entity)) {
        // log.debug(...[...logArr, `\n\t -> return true`]);
        return true;
    }
    if (COMPANY_KEYWORDS_PATTERN.test(entity) 
        || stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
        || /[0-9@]+/.test(entity)
        || company// && (company !== entity || COMPANY_KEYWORDS_PATTERN.test(company))
    ) {
        // log.debug(...[...logArr, `\n\t -> return false`]);
        return false;
    }
    log.debug(...[...logArr, `\n\t Reached End of isPerson() -> return true`]);
    return true;
}

/**
 * 
 * @param row - `Record<string, any>` the `row` of data to look for a phone number in
 * @param phoneColumns the columns of the `row` to look for a phone number in
 * @returns `phone` - `{string}` - the formatted version of the first valid phone number found in the `row`, or an empty string if none is found.
 * @see {@link applyPhoneRegex} for the regex used to validate the phone number.
 */
export const phone = (
    row: Record<string, any>, 
    ...phoneColumns: string[]
): string =>{
    let phone: string = '';
    for (const col of phoneColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        phone = applyPhoneRegex(initialVal);
        if (phone) { return phone; }// return the first valid phone number found
    }
    return ''
}

export const email = (
    row: Record<string, any>, 
    ...emailColumns: string[]
): string => {
    let email: string = '';
    for (const col of emailColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        // log.debug(`evaluateEmail: extractEmail("${initialVal}") = "${extractEmail(initialVal)}"`);
        email = extractEmail(initialVal);
        if (email) { return email; }// return the first valid email address found
    }
    return ''
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
    ...nameColumns: string[]
): string => {
    let entity = entityId(row, entityIdColumn);
    let { first, middle, last } = name(row, ...nameColumns);
    let fullName = `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
    return fullName === entity ? '' : fullName;
}


/**
 * return the name `{first, middle, last}` corresponding to the first column with a non-empty first and last name
 * @param row `Record<string, any>`
 * @param nameColumns 
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
        // log.debug(`extractName("${initialVal}") from col="${col}"`,
        //     `\n\t-> {first="${first}", middle="${middle}", last="${last}"}`);
            return {first: first, middle: middle || '', last: last}; 
        }
    }
    return {first: '', middle: '', last: ''};
}


/**
 * 
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
        // log.warn(`Invalid state: "${state}"`);
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
        // log.warn(`Invalid country: "${country}" or state: "${state}"`);
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


