/**
 * @file src/parse_configurations/evaluators/entity.ts
 */
import { 
    parseLogger as plog, mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
} from "../../config";
import { getHumanVendorList } from "../../config";
import { 
    FieldDictionary,
    FieldValue,
} from "../../api/types";
import { 
    extractPhone, clean, extractEmail, extractName, stringEndsWithAnyOf, RegExpFlagsEnum,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, COMPANY_KEYWORDS_PATTERN, COMPANY_ABBREVIATION_PATTERN,
    isValidEmail,
    SALUTATION_REGEX, ATTN_SALUTATION_PREFIX_PATTERN, LAST_NAME_COMMA_FIRST_NAME_PATTERN,
    REMOVE_ATTN_SALUTATION_PREFIX, ENSURE_SPACE_AROUND_HYPHEN, REPLACE_EM_HYPHEN,
    stringContainsAnyOf, JOB_TITLE_SUFFIX_PATTERN, extractJobTitleSuffix,
    REMOVE_JOB_TITLE_SUFFIX, KOREA_ADDRESS_LATIN_TEXT_PATTERN
} from "typeshi:utils/regex";
import { field } from "./common";
import { RecordTypeEnum } from "../../utils/ns/Enums";
import { checkForOverride } from "../../utils/ns";
import { ColumnSliceOptions } from "src/services/parse/types/index";
import { getEntityValueOverrides } from "../../config";
import { isNonEmptyString } from "@typeshi/typeValidation";

/** 
 * @param row `Record<string, any>` - the `row` of data
 * @param entityIdColumn `string`
 * @returns **`entity`** = {@link checkForOverride}`(`{@link clean}`(row[entityIdColumn],...),...)`
 * */
export const entityId = (
    fields: FieldDictionary, 
    row: Record<string, any>, 
    entityIdColumn: string
): string => {
    let entity = (isNonEmptyString(fields.entityid) 
        ? fields.entityid
        : clean(row[entityIdColumn], {
            strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
            replace: [
                { searchValue: /(\^|\*)$/g, replaceValue: '' },
                { searchValue: /Scienc$/g, replaceValue: 'Science' },
                { searchValue: /(?<= )Ctr(\.)?$/g, replaceValue: 'Center' },
                { searchValue: /(?<= )Ctr(\.)(?= )/g, replaceValue: 'Center' },
                { searchValue: /(?<= )Ctr(?=-.+)/g, replaceValue: 'Center ' },
                REPLACE_EM_HYPHEN, 
                ENSURE_SPACE_AROUND_HYPHEN,
            ]
        })
    );
    return checkForOverride(
        entity, entityIdColumn, getEntityValueOverrides()
    ) as string;
}


/**
 * @param row `Record<string, any>` - the `row` of data
 * @param recordType {@link RecordTypeEnum} - the type of record being parsed from the `row`
 * @param entityIdColumn `string` - the column of the `row` to look for the `'entityid'` in
 * @returns **`externalId`** `string` = `'${`{@link entity}`(entityIdColumn)}<${recordType}>'`
 */
export const entityExternalId = (
    fields: FieldDictionary, 
    row: Record<string, any>, 
    recordType: RecordTypeEnum, 
    entityIdColumn: string
): string => {
    if (isNonEmptyString(fields.externalid)) {
        return fields.externalid;
    }
    let entity = isNonEmptyString(fields.entityid) ? String(fields.entityid) : entityId(fields, row, entityIdColumn);
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
    fields: FieldDictionary, 
    row: Record<string, any>, 
    entityIdColumn: string, 
    companyColumn: string='Company'
): boolean => {
    let entity = isNonEmptyString(fields.entityid) ? String(fields.entityid) : entityId(fields, row, entityIdColumn);
    let company = (companyColumn 
        ? clean(row[companyColumn], {
            strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
            replace: [REPLACE_EM_HYPHEN, ENSURE_SPACE_AROUND_HYPHEN]
        })
        : ''
    );
    plog.debug(NL + [`[START isPerson()]`,
        `entityIdColumn = '${entityIdColumn}' -> entity = '${entity}'`,
        ` companyColumn = '${companyColumn}' -> company = '${company}'`,
    ].join(TAB));
    if (getHumanVendorList().includes(entity)) {
        plog.debug(NL + `-> return true because entity '${entity}' is in HUMAN_VENDORS_TRIMMED`);
        return true;
    }
    if (COMPANY_KEYWORDS_PATTERN.test(entity) 
        || stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
        || stringContainsAnyOf(entity, /[0-9@]+/, RegExpFlagsEnum.GLOBAL)
        || entity.split(' ').length === 1
        // || (company && COMPANY_KEYWORDS_PATTERN.test(company)
        //     && !LAST_NAME_COMMA_FIRST_NAME_PATTERN.test(company)
        //     && equivalentAlphanumeric(entity, company)
        // )
        || (company && COMPANY_KEYWORDS_PATTERN.test(company))
    ) {
        plog.debug(
            NL + `-> return false`);
        return false;
    }
    plog.debug([
        `[END isPerson()]:`,
        `entityIdColumn = '${entityIdColumn}' -> entity = '${entity}'`,`companyColumn = '${companyColumn}'`, 
        `humanVendorList.includes('${entity}') = ${getHumanVendorList().includes(entity)}`,
        `COMPANY_KEYWORDS_PATTERN.test('${entity}')  = ${COMPANY_KEYWORDS_PATTERN.test(entity)}`,
        `'${entity}' ends with company abbreviation  = ${stringEndsWithAnyOf(entity, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE)}`,
        `/[0-9@]+/.test('${entity}')                 = ${/[0-9@&]+/.test(entity)}`,
        `companyColumn = '${companyColumn}' -> company = '${company}'`,
        `Boolean('${company}')                       = ${Boolean(company)}`,
        // TAB +`company is not of format lastName, firstName = ${!LAST_NAME_COMMA_FIRST_NAME_PATTERN.test(company)}`,
        `COMPANY_KEYWORDS_PATTERN.test('${company}') = ${company && COMPANY_KEYWORDS_PATTERN.test(company)}`, 
    ].join(TAB));
    plog.debug(NL + `[END isPerson()] -> return true`);
    return true;
}

/**
 * @param row - `Record<string, any>` the `row` of data to look for an phone number in
 * @param phoneColumnOptions `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for an phone number in
 * @returns **`phone`** - `string` - the first valid phone number found, or an empty string if none found.
 */
export const phone = (
    fields: FieldDictionary, 
    row: Record<string, any>, 
    ...phoneColumnOptions: Array<string | ColumnSliceOptions>
): string => {
    return field(fields, row, extractPhone, ...phoneColumnOptions);
    // mlog.info(`evaluatorFunctions.phone() -> return phoneValue: '${phoneValue}'`,);
    // return phoneValue;
}

/**
 * @param row - `Record<string, any>` the `row` of data to look for an email address in
 * @param emailColumnOptions - `Array<string |` {@link ColumnSliceOptions}`>` the columns of the `row` to look for an email address in
 * @returns **`email`** - `string` - the first valid email address found, or an empty string if none found.
 */
export const email = (
    fields: FieldDictionary, 
    row: Record<string, any>,
    ...emailColumnOptions: Array<string | ColumnSliceOptions>
): string => {
    const emailValue: string = field(fields, row, extractEmail, ...emailColumnOptions);
    plog.debug(NL+[`evaluatorFunctions.email()`,
        `emailValue: '${emailValue}'`,
        `isValidEmail('${emailValue}') = ${isValidEmail(emailValue)}`,
        `-> return '${emailValue}'`
    ].join(TAB));
    return isValidEmail(emailValue) ? emailValue : '';
}

export const salutation = (
    fields: FieldDictionary, 
    row: Record<string, any>,
    salutationColumn: string,
    ...nameColumns: string[]
): string => {
    if (isNonEmptyString(fields.salutation)) {
        return fields.salutation;
    }
    let salutationValue = clean(row[salutationColumn]);
    if (salutationValue) return salutationValue;
    if (!nameColumns) return '';
    plog.debug(
        NL+`evaluate.salutation() clean(row['${salutationColumn}']) = '${salutationValue}'`,
    );
    for (const col of nameColumns) {
        let initialVal = clean(
            row[col], {
            strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
            replace: [{searchValue: /^((attention|attn|atn):)?\s*/i, replaceValue: '' }]
        });
        plog.debug(
            `col: '${col}', initialVal: '${initialVal}'`,
        );
        if (!initialVal) { continue; } 
        if (SALUTATION_REGEX.test(initialVal)) {
            salutationValue = initialVal.match(SALUTATION_REGEX)?.[0] || '';
            plog.debug([
                `SALUTATION_REGEX.test('${initialVal}') = true`,
                `initialVal.match(SALUTATION_REGEX)?.[0] = '${initialVal.match(SALUTATION_REGEX)?.[0]}'`,
                `-> RETURN salutationValue: '${salutationValue}'`
            ].join(TAB));
            return salutationValue;
        }
    }
    return '';
    
}


/**
 * return the name `{first, middle, last}` corresponding to the first column with a non-empty first and last name
 * @param row `Record<string, any>`
 * @param nameColumns the columns of the `row` to look for a name in.
 * @returns `{first: string, middle: string, last: string}` - the first, middle, and last name of the person, if found.
 * @see {@link extractName} for the regex used to validate the name.
 */
export const name = (
    fields: FieldDictionary, 
    row: Record<string, any>, 
    ...nameColumns: string[]
): { first: string; middle: string; last: string; } => {
    for (const col of nameColumns) {
        let initialVal = clean(row[col], {
            strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
            replace: [
                REMOVE_ATTN_SALUTATION_PREFIX, 
                { searchValue: /,$/g, replaceValue: '' },
            ]
        });
        if (!initialVal || KOREA_ADDRESS_LATIN_TEXT_PATTERN.test(initialVal)) {
            continue;
        }
        const {first, middle, last} = extractName(initialVal);
        if (first && last) { 
            // mlog.debug(`extractName('${row[col]}') from col='${col}'`,
            //     `-> return { first='${first}', middle='${middle}', last='${last}' }`
            // );
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
    fields: FieldDictionary, row: Record<string, any>,
    firstNameColumn?: string, 
    ...nameColumns: string[]
): string => {
    let first = (firstNameColumn 
        ? clean(row[firstNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
        : ''
    );
    plog.debug(NL + `clean(row[firstNameColumn]): '${first}'`);
    if (!first || first.split(' ').length > 1) {
        first = name(fields, row, 
            ...(firstNameColumn ? [firstNameColumn] : []) //if data entry error when someone put whole name in firstNameColumn,
                .concat(nameColumns)
        ).first;
    }
    plog.debug(NL + `first after evaluate nameColumns: '${first}'`);
    return first.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
}

export const middleName = (
    fields: FieldDictionary, row: Record<string, any>, 
    middleNameColumn?: string,
    ...nameColumns: string[]
): string => {
    let middle = (middleNameColumn 
        ? clean(row[middleNameColumn])
        : ''
    );
    if (!middle || middle.split(' ').length > 1) {
        middle = name(fields, row, ...nameColumns).middle;
    }
    plog.debug(NL + `[evaluators.entity.middleName()] after evaluate nameColumns: '${middle}'`);
    return middle.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
}

export const lastName = (
    fields: FieldDictionary, row: Record<string, any>, 
    lastNameColumn?: string,
    ...nameColumns: string[]
): string => {
    let last = (lastNameColumn 
        ? clean(row[lastNameColumn], {
            // replace: REMOVE_JOB_TITLE_SUFFIX, 
            strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION
        })
        : ''
    );
    if (!last) {
        last = name(fields, row, ...nameColumns).last;
    }
    plog.debug(NL + `last after evaluate nameColumns: '${last}'`);
    return last.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
}

/**
 * - {@link JOB_TITLE_SUFFIX_PATTERN}
 * @param row `Record<string, any>`
 * @param jobTitleColumn `string`
 * @param nameColumns `string[]`
 * @returns **`jobTitle`** `string` - the job title, if it exists
 */
export const jobTitleSuffix = (
    fields: FieldDictionary, row: Record<string, any>, 
    jobTitleColumn?: string,
    ...nameColumns: string[]
): string => {
    let jobTitle = (jobTitleColumn 
        ? clean(row[jobTitleColumn])
        : ''
    );
    if (jobTitle) return jobTitle;
    for (const col of nameColumns) {
        let nameValue = clean(row[col]);
        if (!nameValue) continue;
        jobTitle = extractJobTitleSuffix(nameValue);
        if (jobTitle) {
            return jobTitle.replace(/^[-,;:]*/, '').replace(/[-,;:]*$/, '');
        }
    }
    return '';
}


const commonEmailDomains = [
    'benev.com', 'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'mail.com', 'live.com', 'msn.com', 'comcast.net',
    'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net',
    'cox.net', 'charter.net', 'earthlink.net', 'roadrunner.com', 
    '.edu', 'live.com'
]
export const website = (
    fields: FieldDictionary, row: Record<string, any>, 
    websiteColumn: string,
    ...emailColumnOptions: Array<string | ColumnSliceOptions>
): FieldValue => {
    let websiteValue = clean(row[websiteColumn]);
    if (websiteValue) {
        websiteValue = websiteValue
            .replace(/^(http(s)?:\/\/)?(www\.)?/, '')
            .replace(/\/$/, '');
        return `https://${websiteValue}`;
    } else { // see if email address is for the entity's website
        for (const colOption of emailColumnOptions) {
            let emailValue = email(fields, row, colOption);
            if (!emailValue 
                || stringEndsWithAnyOf(emailValue, commonEmailDomains, 
                    RegExpFlagsEnum.IGNORE_CASE)) {
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