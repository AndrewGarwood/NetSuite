/**
 * @file src/utils/api/url.ts
 */

export type SearchParamValue = string | number | boolean;
/**
 * Creates a URL object with search parameters from a dictionary.
 * @param {string} baseUrl - The base URL as a string.
 * @param {Object.<string, SearchParamValue | Array<SearchParamValue>>} searchParamsDict - An object containing key-value pairs for search parameters ({@link SearchParamValue}).
 * @returns {URL} A new {@link URL} object with the search parameters added.
 * @example createUrlWithParams(baseUrl: "https://example.com/api", searchParamsDict: { record: "true", hydrate: "FAVORITE" }) => url 
 * url.toString() = "https://example.com/api?record=true&hydrate=FAVORITE"
 */
export function createUrlWithParams(
    baseUrl: string, 
    searchParamsDict: { [s: string]: SearchParamValue | Array<SearchParamValue>; }
): URL {
    if (!baseUrl || typeof baseUrl !== "string") {
        throw new Error("baseUrlString must be a valid string.");
    }
    if (!searchParamsDict || typeof searchParamsDict !== "object") {
        throw new Error("searchParamsDict must be a valid object.");
    }

    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(searchParamsDict)) {
        if (typeof value === "string") {
            url.searchParams.append(key, value);
        } else if (Array.isArray(value)) {
            value.forEach(val => url.searchParams.append(key, String(val)));
        } else {
            throw new Error(`Value for key ${key} must be a primitives or an array of primitives.`);
        }
    }
    return url;
}