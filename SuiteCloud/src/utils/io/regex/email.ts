/**
 * @file src/utils/io/regex/email.ts
 */
import { stringContainsAnyOf } from "./stringOperations";
import { RegExpFlagsEnum } from "./configureParameters";

/** `re` = `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` */
export const EMAIL_REGEX = new RegExp(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, 
    RegExpFlagsEnum.GLOBAL
);

/**return true if matches {@link EMAIL_REGEX} and does not include substring `'@benev'`  */
export function isValidEmail(email: string): boolean {
    if (!email) return false;
    email = email.trim();
    return EMAIL_REGEX.test(email) 
        && !stringContainsAnyOf(
            email, /@benev/, 
            RegExpFlagsEnum.IGNORE_CASE, RegExpFlagsEnum.GLOBAL
        );
}

/** @returns **`email`**: `string` - the first email that matches {@link EMAIL_REGEX} or an empty string `''`*/
export function extractEmail(email: string): RegExpMatchArray | null {
    if (!email) return null;
    email = email.trim();
    const match = email.match(EMAIL_REGEX);
    // DEBUG.push(
    //     NL + `extractEmail() EMAIL_REGEX.test("${email}") = ${EMAIL_REGEX.test(email)}`, 
    //     TAB + `match=${JSON.stringify(match)}`
    // );
    if (match) {
        // DEBUG.push(NL+`-> match not null -> returning ${JSON.stringify(match)}`);
        return match;
    }
    // DEBUG.push(NL+`-> match is null -> returning null`);
    return null;
}
