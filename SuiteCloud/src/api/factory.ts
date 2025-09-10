/**
 * @file src/api/requestFactory.ts
 * @consideration maybe i should just make classes for the types....
 */

import { 
    RecordResponseOptions, isRecordResponseOptions,
    SingleRecordRequest, RelatedRecordRequest, 
    idPropertyEnum, idSearchOptions, ChildSearchOptions, 
    FieldDictionary,
    SublistDictionary, RecordOptions,
    isIdSearchOptions,
} from "./types";
import { getSourceString } from "@typeshi/io";
import { RecordTypeEnum, SearchOperatorEnum } from "@utils/ns/Enums";
import * as validate from "@typeshi/argumentValidation";
import { isNonEmptyString } from "@typeshi/typeValidation";

export const Factory = {
    RelatedRecordRequest,
    SingleRecordRequest,
    ChildSearchOptions,
    idSearchOptions,
    RecordOptions
}

function RelatedRecordRequest(
    parentRecordType: RecordTypeEnum,
    idProp: idPropertyEnum,
    idValue: string | number,
    childOptions: ChildSearchOptions[]
): RelatedRecordRequest {
    const source = getSourceString(__filename, RelatedRecordRequest.name);
    validate.enumArgument(source, {parentRecordType, RecordTypeEnum});
    validate.enumArgument(source, {idProp, idPropertyEnum});
    let idOptions: idSearchOptions[] = [{
        idProp,
        idValue,
        searchOperator: (idProp === idPropertyEnum.INTERNAL_ID 
            ? SearchOperatorEnum.RECORD.ANY_OF 
            : SearchOperatorEnum.TEXT.IS
        )
    }];
    return { parentRecordType, idOptions, childOptions } as RelatedRecordRequest;
}


function SingleRecordRequest(
    recordType: string | RecordTypeEnum,
    idProp: idPropertyEnum,
    idValue: string | number,
    responseOptions?: RecordResponseOptions
): SingleRecordRequest {
    const source = getSourceString(__filename, SingleRecordRequest.name);
    validate.enumArgument(source, {recordType, RecordTypeEnum});
    if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    const idOptions = [idSearchOptions(idProp, idValue)]

    const request: SingleRecordRequest = { recordType, idOptions, responseOptions };
    return request;

}

function ChildSearchOptions(
    childRecordType: RecordTypeEnum,
    fieldId: string,
    sublistId?: string,
    responseOptions?: RecordResponseOptions
): ChildSearchOptions {
    const source = getSourceString(__filename, ChildSearchOptions.name);
    validate.enumArgument(source, {childRecordType, RecordTypeEnum});
    validate.stringArgument(source, {fieldId});
    if (sublistId) validate.stringArgument(source, {sublistId});
    if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    return {
        childRecordType, 
        fieldId,
        sublistId,
        responseOptions
    } as ChildSearchOptions
}


/**
 * @param idProp 
 * @param idValue 
 * @param searchOperator `string` - `Default` = {@link SearchOperatorEnum.TEXT.IS} = `'is'`
 * @returns **`idSearchOptions`** {@link idSearchOptions}
 */
function idSearchOptions(
    idProp: string, 
    idValue: string | number, 
    searchOperator?: string
): idSearchOptions {
    return { 
        idProp, 
        idValue: (idProp === idPropertyEnum.INTERNAL_ID
            ? Number(idValue)
            : String(idValue)
        ), 
        searchOperator: (isNonEmptyString(searchOperator) 
            ? searchOperator 
            : (idProp === idPropertyEnum.INTERNAL_ID 
                ? SearchOperatorEnum.RECORD.ANY_OF 
                : SearchOperatorEnum.TEXT.IS
            )
        )
    } as idSearchOptions
}

function RecordOptions(
    recordType: RecordTypeEnum,
    idOptions?: idSearchOptions | idSearchOptions[],
    fields?: FieldDictionary,
    sublists?: SublistDictionary,
    meta?: Record<string, any>
): Required<RecordOptions> {
    const source = getSourceString(__filename, RecordOptions.name);
    validate.enumArgument(source, {recordType, RecordTypeEnum});
    return {
        recordType,
        isDynamic: false,
        idOptions: isIdSearchOptions(idOptions) ? [idOptions] : idOptions,
        fields: fields ?? {},
        sublists: sublists ?? {},
        meta: meta ?? {}
    } as Required<RecordOptions>
}