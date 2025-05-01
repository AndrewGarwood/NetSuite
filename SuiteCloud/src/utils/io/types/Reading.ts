/**
 * @file src/types/io/Reading.ts
 * @description types for src/utils/io/reading.ts
 */

/**
 * 
 * @typedefn {Object} FileExtensionResult
 * @property {boolean} isValid - true if the filePath has the expected extension, false otherwise
 * @property {string} validatedFilePath - the filePath with the expected extension if it was missing, otherwise the original filePath
 */
export type FileExtensionResult = {
    isValid: boolean,
    validatedFilePath: string
}
