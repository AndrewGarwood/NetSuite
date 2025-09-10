/**
 * @file src/api/server/types/TokenResponse.TypeGuards.ts
 */
import { isObject, isNonEmptyString, isInteger, isNumeric } from "@typeshi/typeValidation";
import { TokenResponse } from "./TokenResponse";


export function isTokenResponse(value: any): value is TokenResponse {
    const candidate = value as TokenResponse;     
    return (isObject(candidate)
        && isNonEmptyString(candidate.access_token)
        && (!candidate.refresh_token || isNonEmptyString(candidate.refresh_token))
        && (!candidate.expires_in || isNumeric(candidate.expires_in))
        && (!candidate.lastUpdated || isInteger(candidate.lastUpdated))
    );
}