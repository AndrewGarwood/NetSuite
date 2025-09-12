/**
 * @file src/api/response.ts
 */

import { RecordResponse } from "@api/types";

export { standardizeResponse }

/**
 * ensure `response.results.every(r=>isObject(r.fields) && isObject(r.sublists))`
 * @param response {@link RecordResponse}
 * @returns **`response`**
 */
function standardizeResponse(response: RecordResponse): RecordResponse {
    if (!Array.isArray(response.results)) {
        response.results = [];
    }
    if (!Array.isArray(response.rejects)) {
        response.rejects = [];
    }
    for (let result of response.results) {
        if (!result.fields) {
            result.fields = {};
        }
        if (!result.sublists) {
            result.sublists = {};
        }
    }
    return response
}