import { EntityRecordTypeEnum, idPropertyEnum, RecordOptions, RecordTypeEnum } from "src/utils/api";

/**
 * @TODO maybe add something like a "RecordReferenceOptions" so that if the 
 * `ParseRecordOptions` object has a field that requires a record reference, 
 * call the api to get it from NetSuite with a corresponding `idSearchOptions` object
 * - {@link ParseResults}
 * @typedefn **`RecordPostProcessingOptions`**
 * @property {CloneOptions} [cloneOptions] - {@link CloneOptions} - Options for cloning records.
 * @property {function} [pruneFunc] - A function that takes a {@link RecordOptions} object and returns a modified version of it or `null` to remove the record from the results.
 */
export type RecordPostProcessingOptions = {
    cloneOptions?: CloneOptions;
    pruneFunc?: (options: RecordOptions) => RecordOptions | null;
}
export type ProcessParseResultsOptions = {
    [recordType: string]: RecordPostProcessingOptions;
}

/**
 * @typedefn **`CloneOptions`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum | string} donorType - {@link RecordTypeEnum} - The type of record to clone from.
 * @property {RecordTypeEnum | EntityRecordTypeEnum | string} recipientType - {@link RecordTypeEnum} - The type of record to clone to.
 * @property {idPropertyEnum} idProp - {@link idPropertyEnum} - The property from the donor's {@link FieldDictionary.valueFields} used to join the donor and recipient records.
 * @property {Array<string>} fieldIds - `Array<string>` - `fieldIds` to clone from the donor's {@link FieldDictionary}'s ({@link RecordOptions}`.fields` 
 * @property {Array<string>} sublistIds - `Array<string>` - `sublistIds` to clone from the donor's {@link SublistDictionary}
 */
export type CloneOptions = {
    donorType: RecordTypeEnum | EntityRecordTypeEnum | string;
    recipientType: RecordTypeEnum | EntityRecordTypeEnum | string;
    idProp: idPropertyEnum;
    fieldIds?: string[];
    sublistIds?: string[];
}
