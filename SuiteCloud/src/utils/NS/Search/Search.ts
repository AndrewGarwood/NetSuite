/**
 * @file src/utils/ns/search/Search.ts
 * @reference ~\node_modules\@hitc\netsuite-types\N\search.d.ts
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4345764122.html#subsect_87180423808}
 */

/**
 * @enum {string} **`FilterOperatorEnum`**
 * @readonly
 * @property {string} AND = `'and'`
 * @property {string} OR = `'or'`
 */
export enum FilterOperatorEnum {
    AND = 'and',
    OR = 'or',
}
/**
 * @enum {string} **`ColumnSummaryEnum`**
 */
export enum ColumnSummaryEnum {
    GROUP = 'group',
    COUNT = 'count',
    SUM = 'sum',
    AVG = 'avg',
    MIN = 'min',
    MAX = 'max',
}
/**
 * @enum {string} **`SearchSortEnum`**
 */
export enum SearchSortEnum {
    ASC = 'asc',
    DESC = 'desc',
    NONE = 'none',
}

/**
 * @description operators for fields with the following input types: 
 * - `Multi Select`
 * @enum {string} **`MultiSelectOperatorEnum`**
 * @property {string} ALL_OF - `allof` - The field value is all of the specified values.
 * @property {string} NOT_ALL_OF - `notallof` - The field value is not all of the specified values.
 * @property {string} ANY_OF - `anyof` - The field value is any of the specified values.
 * @property {string} NONE_OF - `noneof` - The field value is none of the specified values.
 */
export enum MultiSelectOperatorEnum {
    ALL_OF = 'allof',
    NOT_ALL_OF = 'notallof',
    ANY_OF = 'anyof',
    NONE_OF = 'noneof',
}

/**
 * @description operators for fields with the following input types: 
 * - `Email Address`
 * - `Free-Form Text`
 * - `Long Text`
 * - `Password`
 * - `Percent`
 * - `Phone Number`
 * - `Rich Text`
 * - `Text Area`
 * @enum {string} **`TextOperatorEnum`**
 * @property {string} ANY - `any` - The field value is any of the specified values.
 * @property {string} CONTAINS - `contains` - The field value contains the specified value.
 * @property {string} DOES_NOT_CONTAIN - `doesnotcontain` - The field value does not contain the specified value.
 * @property {string} HAS_KEYWORDS - `haskeywords` - The field value has the specified keywords.
 * @property {string} IS - `is` - The field value is the specified value.
 * @property {string} IS_NOT - `isnot` - The field value is not the specified value.
 * @property {string} IS_EMPTY - `isempty` - The field value is empty.
 * @property {string} IS_NOT_EMPTY - `isnotempty` - The field value is not empty.
 * @property {string} STARTS_WITH - `startswith` - The field value starts with the specified value.
 * @property {string} DOES_NOT_START_WITH - `doesnotstartwith` - The field value does not start with the specified value.
 */
export enum TextOperatorEnum {
    ANY = 'any',
    CONTAINS = 'contains',
    DOES_NOT_CONTAIN = 'doesnotcontain',
    HAS_KEYWORDS = 'haskeywords',
    IS = 'is',
    IS_NOT = 'isnot',
    IS_EMPTY = 'isempty',
    IS_NOT_EMPTY = 'isnotempty',
    STARTS_WITH = 'startswith',
    DOES_NOT_START_WITH = 'doesnotstartwith',
}

/**
 * @description operators for fields with the following input types:  
 * - `Currency`
 * - `Decimal`
 * - `Time of Day`
 * @enum {string} **`NumericOperatorEnum`**
 * @property {string} ANY - `any` - The field value is any of the specified values.
 * @property {string} BETWEEN - `between` - The field value is between the specified values.
 * @property {string} NOT_BETWEEN - `notbetween` - The field value is not between the specified values.
 * @property {string} EQUAL_TO - `equalto` - The field value is equal to the specified value.
 * @property {string} NOT_EQUAL_TO - `notequalto` - The field value is not equal to the specified value.
 * @property {string} GREATER_THAN - `greaterthan` - The field value is greater than the specified value.
 * @property {string} NOT_GREATER_THAN - `notgreaterthan` - The field value is not greater than the specified value.
 * @property {string} GREATER_THAN_OR_EQUAL_TO - `greaterthanorequalto` - The field value is greater than or equal to the specified value.
 * @property {string} NOT_GREATER_THAN_OR_EQUAL_TO - `notgreaterthanorequalto` - The field value is not greater than or equal to the specified value.
 * @property {string} LESS_THAN - `lessthan` - The field value is less than the specified value.
 * @property {string} NOT_LESS_THAN - `notlessthan` - The field value is not less than the specified value.
 * @property {string} LESS_THAN_OR_EQUAL_TO - `lessthanorequalto` - The field value is less than or equal to the specified value.
 * @property {string} NOT_LESS_THAN_OR_EQUAL_TO - `notlessthanorequalto` - The field value is not less than or equal to the specified value.
 * @property {string} IS_EMPTY - `isempty` - The field value is empty.
 * @property {string} IS_NOT_EMPTY - `isnotempty` - The field value is not empty.
 */
export enum NumericOperatorEnum {
    ANY = 'any',
    BETWEEN = 'between',
    NOT_BETWEEN = 'notbetween',
    EQUAL_TO = 'equalto',
    NOT_EQUAL_TO = 'notequalto',
    GREATER_THAN = 'greaterthan',
    NOT_GREATER_THAN = 'notgreaterthan',
    GREATER_THAN_OR_EQUAL_TO = 'greaterthanorequalto',
    NOT_GREATER_THAN_OR_EQUAL_TO = 'notgreaterthanorequalto',
    LESS_THAN = 'lessthan',
    NOT_LESS_THAN = 'notlessthan',
    LESS_THAN_OR_EQUAL_TO = 'lessthanorequalto',
    NOT_LESS_THAN_OR_EQUAL_TO = 'notlessthanorequalto',
    IS_EMPTY = 'isempty',
    IS_NOT_EMPTY = 'isnotempty',
}

/**
 * @enum {string} **`RecordOperatorEnum`**
 * @description operators for fields with the following input types: 
 * - `List, Record`
 * @property {string} ANY_OF - `anyof` - The field value is one of the specified values.
 * @property {string} NONE_OF - `noneof` - The field value is not one of the specified values.
 * @reference https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0304061100.html#subsect_161114820748:~:text=id%3A%20%27customsearch_my_so_search%27%0A%20%20%20%20%20%20%20%20%7D)%3B%0A%20%20%20%20%7D%0A%0A%20%20%20%20deleteSearch()%3B%0A%7D)%3B-,Search%20Using%20a%20Specific%20Record%20Field,-The%20following%20sample
 */
export enum RecordOperatorEnum {
    ANY_OF = 'anyof',
    NONE_OF = 'noneof',
}
/**
 * @description operations for Date fields
 * @enum {string} **`DateOperatorEnum`**
 * @property {string} AFTER - `after` - The field value is after the specified date.
 * @property {string} NOT_AFTER - `notafter` - The field value is not after the specified date.
 * @property {string} BEFORE - `before` - The field value is before the specified date.
 * @property {string} NOT_BEFORE - `notbefore` - The field value is not before the specified date.
 * @property {string} IS_EMPTY - `isempty` - The field value is empty.
 * @property {string} IS_NOT_EMPTY - `isnotempty` - The field value is not empty.
 * @property {string} ON - `on` - The field value is on the specified date.
 * @property {string} NOT_ON - `noton` - The field value is not on the specified date.
 * @property {string} ON_OR_AFTER - `onorafter` - The field value is on or after the specified date.
 * @property {string} NOT_ON_OR_AFTER - `notonorafter` - The field value is not on or after the specified date.
 * @property {string} ON_OR_BEFORE - `onorbefore` - The field value is on or before the specified date.
 * @property {string} NOT_ON_OR_BEFORE - `notonorbefore` - The field value is not on or before the specified date.
 * @property {string} WITHIN - `within` - The field value is within the specified date range.
 * @property {string} NOT_WITHIN - `notwithin` - The field value is not within the specified date range.
 */ 
export enum DateOperatorEnum {
    AFTER = 'after',
    NOT_AFTER = 'notafter',
    BEFORE = 'before',
    NOT_BEFORE = 'notbefore',
    IS_EMPTY = 'isempty',
    IS_NOT_EMPTY = 'isnotempty',
    ON = 'on',
    NOT_ON = 'noton',
    ON_OR_AFTER = 'onorafter',
    NOT_ON_OR_AFTER = 'notonorafter',
    ON_OR_BEFORE = 'onorbefore',
    NOT_ON_OR_BEFORE = 'notonorbefore',
    WITHIN = 'within',
    NOT_WITHIN = 'notwithin',
}

/**
 * @typedefn **`SearchOperatorEnum`**
 * Composite of all operator enums.
 * @property {typeof RecordOperatorEnum} RECORD - **{@link RecordOperatorEnum}** Operators for record fields. use for 'internalid'
 * @property {typeof DateOperatorEnum} DATE - **{@link DateOperatorEnum}** for date fields.
 * @property {typeof NumericOperatorEnum} NUMERIC - **{@link NumericOperatorEnum}** for numeric fields.
 * @property {typeof TextOperatorEnum} TEXT - **{@link TextOperatorEnum}** for text fields.
 * @property {typeof MultiSelectOperatorEnum} MULTI_SELECT - **{@link MultiSelectOperatorEnum}** for multi-select fields.
 * @reference https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4094344956.html
 */
export type SearchOperatorEnum = {
    RECORD: typeof RecordOperatorEnum;
    DATE: typeof DateOperatorEnum;
    NUMERIC: typeof NumericOperatorEnum;
    TEXT: typeof TextOperatorEnum;
    MULTI_SELECT: typeof MultiSelectOperatorEnum;
}
export const SearchOperatorEnum: SearchOperatorEnum = {
    RECORD: RecordOperatorEnum,
    DATE: DateOperatorEnum,
    NUMERIC: NumericOperatorEnum,
    TEXT: TextOperatorEnum,
    MULTI_SELECT: MultiSelectOperatorEnum
};
