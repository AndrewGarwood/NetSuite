/**
 * Converts a date string to Pacific Time
 * @param {string} initialDateString The date string to convert
 * @returns {string} The date string in Pacific Time
 */
export function toPacificTime(initialDateString: string): string {
    const initialDate = new Date(initialDateString);
    const pacificTime = initialDate.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
    return pacificTime
}


/**
 * Gets the current date and time in Pacific Time
 * @returns {string} The current date and time in Pacific Time
 */
export function getCurrentPacificTime(): string {
    const currentDate = new Date();
    const pacificTime = currentDate.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
    return pacificTime;
}