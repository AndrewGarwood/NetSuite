/**
 * @file src/utils/io/types/PostProcessing.ts
 */

import { 
    FieldDictionary, idSearchOptions, SublistDictionary, SublistLine 
} from "../../../api";
import { RecordOptions, SublistUpdateDictionary } from "../../../api/types/RecordEndpoint";

/**
 * Defines the order of operations for post-processing
 * @enum {string} **`PostProcessingOperationEnum`**
 * @property {string} CLONE - Represents the clone operation. (see {@link CloneOptions})
 * @property {string} COMPOSE - Represents the compose operation. (see {@link ComposeOptions})
 * @property {string} PRUNE - Represents the prune operation, which is a user-defined function 
 * that modifies or removes records from the results.
 */
export enum PostProcessingOperationEnum {
    CLONE = 'clone',
    COMPOSE = 'compose',
    PRUNE = 'prune'
}

/**
 * - {@link ParseResults}
 * @typedefn **`RecordPostProcessingOptions`**
 * @property {CloneOptions} [cloneOptions] - {@link CloneOptions} - Options for cloning records.
 * @property {PostProcessingOperationEnum[]} [operationOrder] - Array defining the order of operations to perform. Defaults to `[CLONE, COMPOSE, PRUNE]`.
 * @property {ComposeOptions} [composeOptions] - {@link ComposeOptions} - Options for composing additional fields or sublists for the record based on the ParseResults.
 * @property {function} [pruneFunc] - A function that takes a {@link RecordOptions} object and returns a modified version of it or `null` to remove the record from the results.
 */
export type RecordPostProcessingOptions = {
    operationOrder?: PostProcessingOperationEnum[];
    cloneOptions?: CloneOptions;
    composeOptions?: ComposeOptions;
    pruneFunc?: (options: RecordOptions, ...args: any[]) => RecordOptions | null | Promise<RecordOptions | null>;
    pruneArgs?: any[];
}



export type PostProcessDictionary = {
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
    donorType: string;
    recipientType: string;
    idProp: string;
    fieldIds?: string[];
    sublistIds?: string[];
}


/**
 * Used in post processing.
 * @typedefn **`ComposeOptions`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum | string} recordType - {@link RecordTypeEnum}
 */
export type ComposeOptions = {
    recordType: string,
    idOptions?: { 
        composer: (record: RecordOptions, idOptions: idSearchOptions[]) => idSearchOptions[] | Promise<idSearchOptions[]> 
    },
    fields?: {
        composer: (record: RecordOptions, fields: FieldDictionary) => FieldDictionary | Promise<FieldDictionary>
    },
    sublists?: ({ 
            composer: (record: RecordOptions, sublists: SublistDictionary) => SublistDictionary | Promise<SublistDictionary>
        } | {
            [sublistId: string]: {
                composer: (
                    record: RecordOptions, 
                    sublistContent: SublistLine[] | SublistUpdateDictionary
                ) => SublistLine[] 
                    | SublistUpdateDictionary 
                    | Promise<SublistLine[] | SublistUpdateDictionary>
            };
        }
    )
};


export type CompositeSublistComposer = {
    composer: (record: RecordOptions, sublists: SublistDictionary) => SublistDictionary | Promise<SublistDictionary>
}