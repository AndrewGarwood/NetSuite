/**
 * @file src/utils/parses/customer/customerParseEvaluatorFunctions.ts
 */
import { 
    FieldValue,
} from "../../api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { isNullLike, BOOLEAN_TRUE_VALUES, RADIO_FIELD_TRUE, RADIO_FIELD_FALSE } from "../../typeValidation";
import { 
    printConsoleGroup as print, stringEndsWithAnyOf, COMPANY_KEYWORDS_PATTERN, 
    applyPhoneRegex, stripCharFromString, 
    STRIP_DOT_IF_NOT_ABBREVIATION, cleanString, extractName, extractPhone,
    extractEmail, EMAIL_REGEX, ValueMapping, isValueMappingEntry, RegExpFlagsEnum, 
    stringStartsWithAnyOf
} from "../../io";

import { 
    RecordTypeEnum, 
    CountryAbbreviationEnum as COUNTRIES, 
    StateAbbreviationEnum as STATES, 
} from "../../api/types/NS";

/**
 * 
 * @param initialValue - the initial value to check if it should be overwritten
 * @param valueOverrides see {@link ValueMapping}
 * @returns 
 */
export function checkForOverride(initialValue: string, valueOverrides: ValueMapping): FieldValue {
    if (!initialValue) {
        return initialValue;
    }   
    // print({label: `checkForOverride: ${initialValue}`, details: [
    //     `is "${initialValue}" a value we want to override? = ${Object.keys(valueOverrides).includes(initialValue)}`
    //     ], printToConsole: false
    // });
    if (Object.keys(valueOverrides).includes(initialValue)) {
        let mappedValue = valueOverrides[initialValue as keyof typeof valueOverrides];
        if (isValueMappingEntry(mappedValue)) {
            return mappedValue.newValue as FieldValue;
        } else {
            return mappedValue as FieldValue;
        }
    }
    return initialValue;
}