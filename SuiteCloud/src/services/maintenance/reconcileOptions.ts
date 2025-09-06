/**
 * @file src/services/maintenance/config.ts
 * declare constants... mostly for reconicliation.ts
 */

import { RecordResponseOptions } from "@api/types";
import { RecordTypeEnum } from "@utils/ns";
import { CacheOptions, SublistRecordReferenceOptions } from "./types/Reconcile";

export const revCacheOptions: CacheOptions = {
    fields: ['name'],
    sublists: {
        component: [
            'quantity', 'bomquantity', 'componentyield', 'description', 
            //'itemsource', 'itemsourcelist'
        ] 
    }
}
export const revResponseOptions: Required<RecordResponseOptions> = {
    fields: ['externalid', 'billofmaterial', 'name'],
    sublists: { 
        component: [
            'internalid','item', 'quantity', 'bomquantity', 'unit', 'componentyield',
            'description', // 'itemsource', 'itemsourcelist'
        ]
    }

}
export const soCacheOptions: CacheOptions = {
    fields: ['total'],
    sublists: {
        item: ['quantity',  'rate'] //'quantitybilled',
    }
}
export const soResponseOptions: Required<RecordResponseOptions> = {
    fields: ['externalid', 'tranid', 'amount', 'memo', 'total'],
    sublists: {
        item: ['id', 'item', 'quantity', 'rate', ]//'quantitybilled']
    }
}

/** for records that have sublist reference dependency on item record */
export const sublistReferenceDictionary: {
    [recordType: string]: SublistRecordReferenceOptions
} = {
    [RecordTypeEnum.BOM_REVISION]: {
        referenceFieldId: 'item',
        sublistId: 'component',
        cacheOptions: revCacheOptions,
        responseOptions: revResponseOptions
    },
    [RecordTypeEnum.SALES_ORDER]: {
        referenceFieldId: 'item',
        sublistId: 'item',
        cacheOptions: soCacheOptions,
        responseOptions: soResponseOptions
    }
}