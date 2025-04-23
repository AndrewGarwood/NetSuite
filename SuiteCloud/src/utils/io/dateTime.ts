/**
 * @file src/utils/io/dateTime.ts
 */


/**
 * @enum {string} DateFormatEnum
 * @property {string} ISO - ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @property {string} UTC - UTC format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @property {string} LOCALE - Local format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @property {string} UNIX - Unix format (milliseconds since epoch)
 */
export enum DateFormatEnum {
    /**ISO format (YYYY-MM-DDTHH:mm:ss.sssZ) */
    ISO = 'ISO',
    /**UTC format (YYYY-MM-DDTHH:mm:ss.sssZ) */
    UTC = 'UTC',
    /**Local format (YYYY-MM-DDTHH:mm:ss.sssZ) */
    LOCALE = 'LOCALE',
    /** ```/\d{13}/``` if milliseconds, ```/\d{10}/``` if seconds */
    UNIX = 'UNIX'
};

/**
 * @enum {string} TimeUnitEnum
 * @property {string} MILLISECONDS - milliseconds
 * @property {string} SECONDS - seconds
 * @property {string} MINUTES - minutes
 * @property {string} HOURS - hours
 * @property {string} DAYS - days
 */
export enum TimeUnitEnum {
    MILLISECONDS = 'milliseconds',
    SECONDS = 'seconds',
    MINUTES = 'minutes',
    HOURS = 'hours',
    DAYS = 'days'
}

/** 
 * /^\d{4}-\d{2}-\d{2}$/ 
 * @description Regular expression pattern for ISO date format (YYYY-MM-DD)
 * @example "2025-04-16"
 * */
export const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * - defaultValue: string = "en-US"
 * @description set as first param, locales, in {@link Date}.toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions)
 * @reference ~\node_modules\typescript\lib\lib.es2020.date.d.ts @see {@link Date}
 */
export const DEFAULT_LOCALE = 'en-US';
/**
 * - defaultValue: string = "America/Los_Angeles"
 * @description set as second param, options, in {@link Date}.toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions)
 * @reference ~\node_modules\typescript\lib\lib.es2020.date.d.ts @see {@link Date}
 */
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * @description Gets the current date and time in Pacific Time in Locale format
 * @returns {string} The current date and time in Pacific Time in Locale format
 * @example "4/16/2025, 9:00:15 AM"
 */
export function getCurrentPacificTime(): string {
    const currentDate = new Date();
    const pacificTime = currentDate.toLocaleString(DEFAULT_LOCALE, {timeZone: DEFAULT_TIMEZONE});
    return pacificTime;
}

/**
 * @description Converts a date string to Pacific Time
 * @param {string} initialDateString The date string to convert
 * @returns {string} The date string in Pacific Time
 */
export function toPacificTime(initialDateString: string): string {
    const initialDate = new Date(initialDateString);
    const pacificTime = initialDate.toLocaleString(DEFAULT_LOCALE, {timeZone: DEFAULT_TIMEZONE});
    return pacificTime
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
    if (!ISO_PATTERN.test(dateString)) {
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

/**
 * 
 * @param ds1 first date string (required) - must be in {@link DateFormatEnum.ISO} format or {@link DateFormatEnum.LOCALE} format. @TODO test other formats
 * @param ds2 second date string (optional) - defaults to current date and time in Pacific Time
 * @param unit {@link TimeUnitEnum} - The unit of time to return the difference in
 * @param absoluteDifference boolean - Whether to return the absolute difference (true) or the signed difference (false)
 * @description Calculates the difference between two date strings in the specified unit of time. Subtracts ds1 from ds2.
 * @returns {number|null} The difference between the two date strings in the specified {@link TimeUnitEnum} unit, or null if an error occurs
 */
export function calculateDifferenceOfDateStrings(
    ds1: string, 
    ds2: string = getCurrentPacificTime(),
    unit: TimeUnitEnum = TimeUnitEnum.MILLISECONDS,
    absoluteDifference: boolean = true
): number | null {
    const date1 = new Date(ds1);
    const date2 = new Date(ds2);
    const diffInMs = absoluteDifference 
        ? Math.abs(date2.getTime() - date1.getTime()) 
        : date2.getTime() - date1.getTime();
    switch (unit) {
        case TimeUnitEnum.MILLISECONDS:
            return diffInMs;
        case TimeUnitEnum.SECONDS:
            return Math.floor(diffInMs / 1000);
        case TimeUnitEnum.MINUTES:
            return Math.floor(diffInMs / (1000 * 60));
        case TimeUnitEnum.HOURS:
            return Math.floor(diffInMs / (1000 * 60 * 60));
        case TimeUnitEnum.DAYS:
            return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        default:
            console.error('Invalid time unit specified. Use TimeUnitEnum.MILLISECONDS, TimeUnitEnum.SECONDS, TimeUnitEnum.MINUTES, TimeUnitEnum.HOURS, or TimeUnitEnum.DAYS');
            return null;
    }
}

/**
 * Parses a locale string into a Date object
 * @param dateStr Date string in locale format (e.g., '4/21/2025, 4:22:45 PM')
 * @returns {Date} Date object
 */
export function parseLocaleStringToDate(dateStr: string): Date {
    try {
        const [datePart, timeWithPeriod] = dateStr.split(', ');
        const [month, day, year] = datePart.split('/').map(Number);
        
        const [timePart, period] = timeWithPeriod.split(' ');
        let [hours, minutes, seconds] = timePart.split(':').map(Number);
        
        // Convert to 24-hour format if needed
        if (period.toUpperCase() === 'PM' && hours < 12) {
            hours += 12;
        } else if (period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
        }
        
        // Create the Date object (month is 0-based in JavaScript)
        return new Date(year, month - 1, day, hours, minutes, seconds);
    } catch (error) {
        throw new Error(`Failed to parse date string: ${dateStr}. Expected format: 'M/D/YYYY, h:mm:ss AM/PM'`);
    }
}