/*
Name	Type
internalId	string
scriptId	string

*/

import { RecordTypeEnum } from './Record';

/**
 * @typedefinitinon CustomFieldRef
 * @property {string} [internalId] - The internal ID of the custom field.
 * @property {string} [scriptId] - The script ID of the custom field.
 */
export type CustomFieldRef = {
    internalId?: string;
    scriptId?: string;
};

export type CustomField = CustomFieldRef;
export type CustomFieldList = CustomFieldRef[];