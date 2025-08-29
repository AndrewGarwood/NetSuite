/**
 * @file src/api/server/types/TokenResponse.TypeGuards.ts
 */
import { isObject, isNonEmptyString, isInteger } from "@typeshi/typeValidation";
import { TokenResponse } from "./TokenResponse";
/**
 *
 */
export function isTokenResponse(value: any): value is TokenResponse {
    // alias with explicit type to get autocomplete + auto-update if change property name
    const candidate = value as TokenResponse; 
    return (isObject(candidate)
        && isNonEmptyString(candidate.access_token)
        && isNonEmptyString(candidate.refresh_token)
        && isInteger(candidate.expires_in)
        && (!candidate.lastUpdated || isInteger(candidate.lastUpdated))
        && (!candidate.lastUpdatedLocaleString || isNonEmptyString(candidate.lastUpdatedLocaleString))
    )
}