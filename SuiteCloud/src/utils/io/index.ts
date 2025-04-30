import {
    getCurrentPacificTime,
    toPacificTime,
    getUnixTimestampFromISO,
    getDateFromUnixTimestamp,
    calculateDifferenceOfDateStrings,
    parseLocaleStringToDate,
    ISO_PATTERN,
    DEFAULT_LOCALE,
    DEFAULT_TIMEZONE,
    DateFormatEnum,
    TimeUnitEnum,
} from './dateTime'
import {
    parseDelimitedFileWithMapping,
    transformValue,
    getDelimiterFromFilePath,
    readFileLinesIntoArray,
    validateFileExtension,
    parseExcelForOneToMany,
    readJsonFileAsObject,
} from './reading'
import {
    writeListsToCsv,
    writeObjectToJson,
    printConsoleGroup,
    printJson
} from './writing'
import {
    stripChar,
    stringEndsWithAnyOf,
    stringContainsAnyOf,
    stringStartsWithAnyOf,
    EMAIL_REGEX,
    PHONE_REGEX,
    BOOLEAN_FIELD_ID_REGEX,
    RegExpFlagsEnum,
} from './regex'
export {
    // dateTime.ts
    getCurrentPacificTime,
    toPacificTime,
    getUnixTimestampFromISO,
    getDateFromUnixTimestamp,
    calculateDifferenceOfDateStrings,
    parseLocaleStringToDate,
    ISO_PATTERN,
    DEFAULT_LOCALE,
    DEFAULT_TIMEZONE,
    DateFormatEnum,
    TimeUnitEnum,

    // reading.ts
    parseDelimitedFileWithMapping,
    transformValue,
    getDelimiterFromFilePath,
    readFileLinesIntoArray,
    validateFileExtension,
    parseExcelForOneToMany,
    readJsonFileAsObject,

    // regex.ts
    stripChar,
    stringEndsWithAnyOf,
    stringContainsAnyOf,
    stringStartsWithAnyOf,
    EMAIL_REGEX,
    PHONE_REGEX,
    BOOLEAN_FIELD_ID_REGEX,
    RegExpFlagsEnum,

    // writing.ts
    writeListsToCsv,
    writeObjectToJson,
    printConsoleGroup,
    printJson
}