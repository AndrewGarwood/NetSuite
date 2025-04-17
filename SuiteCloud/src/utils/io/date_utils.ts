/**
 * @file date_utils.ts
 */


/**
 * @enum {string} DateFormatEnum
 * @property {string} ISO - ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @property {string} UTC - UTC format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @property {string} LOCALE - Local format (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export enum DateFormatEnum {
    ISO = 'ISO',
    UTC = 'UTC',
    LOCALE = 'LOCALE'
};

/**
 * - defaultValue: string = "en-US"
 * @description set as first param, locales, in {@link Date}.toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions)
 * @reference ~\node_modules\typescript\lib\lib.es2020.date.d.ts @see {@link Date}
 */
export const DEFAULT_LOCALE: string = 'en-US';
/**
 * - defaultValue: string = "America/Los_Angeles"
 * @description set as second param, options, in {@link Date}.toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions)
 * @reference ~\node_modules\typescript\lib\lib.es2020.date.d.ts @see {@link Date}
 */
export const DEFAULT_TIMEZONE: string = 'America/Los_Angeles';

/**
 * @description Converts a date string to Pacific Time
 * @param {string} initialDateString The date string to convert
 * @returns {string} The date string in Pacific Time
 */
export function toPacificTime(initialDateString: string): string {
    const initialDate = new Date(initialDateString);
    const pacificTime = initialDate.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
    return pacificTime
}


/**
 * @description Gets the current date and time in Pacific Time
 * @returns {string} The current date and time in Pacific Time
 * @example "4/16/2025, 9:00:15 AM"
 */
export function getCurrentPacificTime(): string {
    const currentDate = new Date();
    const pacificTime = currentDate.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
    return pacificTime;
}

/**
 * @description Converts a date string in ISO format (YYYY-MM-DD) to a Unix timestamp in milliseconds
 * @param {string} dateString The date string to convert
 * @returns {number | null} The Unix timestamp in milliseconds
 */
export function getUnixTimestampFromISO(dateString: string): number | null {
    if (!dateString) {
        console.error('No date string provided');
        return null;
    }
    if (typeof dateString !== 'string') {
        console.error('Date string must be a string');
        return null;
    }
    if (dateString.length > 10) {
        dateString = dateString.substring(0, 10);
    }
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoPattern.test(dateString)) {
        console.error('Date string must be in ISO format (YYYY-MM-DD)');
        return null;
    }
    const date = new Date(dateString);
    return date.getTime();
}

/**
 * @description Converts a Unix timestamp to a date string in the specified format
 * @param {number} unixTimestamp - number - The unix timestamp in milliseconds or seconds to convert
 * @param {DateFormatEnum} dateFormat {@link DateFormatEnum} - The format to return the date in
 * @returns {string|null} The date string in the specified format
 * @example "2025-04-16T00:00:00.000Z"
 * @note dateFormat === DateFormatEnum.LOCALE -> use {@link DEFAULT_LOCALE} and {@link DEFAULT_TIMEZONE}
 */
export function getDateFromUnixTimestamp(unixTimestamp: number, dateFormat: DateFormatEnum): string | null {
    if (!unixTimestamp) {
        console.error('No unixTimestamp provided');
        return null;
    }
    if (typeof unixTimestamp !== 'number') {
        console.error('unixTimestamp must be a number');
        return null;
    }
    if (String(unixTimestamp).length === 10) {
        unixTimestamp = unixTimestamp * 1000; // Convert to milliseconds if in seconds
    }
    if (String(unixTimestamp).length > 13) {
        console.error('unixTimestamp must be in milliseconds or seconds');
        return null;
    }
    const date = new Date(unixTimestamp);
    if (dateFormat === DateFormatEnum.ISO) {
        return date.toISOString();
    } else if (dateFormat === DateFormatEnum.UTC) {
        return date.toUTCString();
    } else if (dateFormat === DateFormatEnum.LOCALE) {
        return date.toLocaleString(DEFAULT_LOCALE, {timeZone: DEFAULT_TIMEZONE});
    }
    console.error('Invalid date format specified. Use DateFormatEnum.ISO, DateFormatEnum.UTC, or DateFormatEnum.LOCALE');
    return null;
}
