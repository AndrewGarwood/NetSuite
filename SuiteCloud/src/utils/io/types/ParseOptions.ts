/**
 * @file src/utils/io/types/ParseOptions.ts
 */
import { 
    RecordOperatorEnum, SearchOperatorEnum, TextOperatorEnum, NumericOperatorEnum, 
    RecordTypeEnum 
} from "../../ns";
import { FieldDictionary, FieldValue, RecordOptions, SublistDictionary, 
    SublistLine, idPropertyEnum 
} from '../../api/types';

export type ParseOptions = {
    [recordType: RecordTypeEnum | string]: RecordParseOptions;
}

export type RecordParseOptions = {
    keyColumn: string;
    fieldOptions?: FieldDictionaryParseOptions;
    sublistOptions?: SublistDictionaryParseOptions;
}

export type IntermediateParseResults = {
    [recordType: RecordTypeEnum | string]: {
        [recordId: string]: RecordOptions
    }
};
export type ParseResults = {
    [recordType: RecordTypeEnum | string]: RecordOptions[]
};
export type ValidatedParseResults = {
    [recordType: RecordTypeEnum | string]: {
        valid: RecordOptions[], 
        invalid: RecordOptions[]
    }
};

/**
 * @typedefn **`FieldDictionaryParseOptions`**
 * @keys `fieldId` `string`
 * @values 
 * - {@link FieldParseOptions} = `{ defaultValue?: FieldValue, colName?: string, evaluator?: function, args?: any[] }`
 * - {@link SubrecordParseOptions} 
 * = `{ subrecordType: string, fieldOptions: FieldDictionaryParseOptions, sublistOptions`: {@link SublistDictionaryParseOptions}` }`
 */
export type FieldDictionaryParseOptions = {
    [fieldId: string]: FieldParseOptions | SubrecordParseOptions;
}

/**
 * @typedefn **`SublistDictionaryParseOptions`**
 * - dictionary mapping sublistIds to `Array<`{@link SublistLineParseOptions}`>`
 * - {@link SublistLineParseOptions} = 
 * - `{ [sublistFieldId: string]: `{@link FieldParseOptions} | {@link SubrecordParseOptions}` } & { lineIdProp?: string }`
 */
export type SublistDictionaryParseOptions = {
    [sublistId: string] : Array<SublistLineParseOptions>;
};


/**
 * @typedefn **`SublistLineParseOptions`**
 * @property {string} [lineIdOptions.lineIdProp] `string` - `optional` the `'internalid'` of the sublist field used to identify existing sublist lines for editing.
 * - e.g. for the addressbook sublist, can define values for the sublistFieldId 'label', then set 'label' as the `lineIdProp`. 
 */
export type SublistLineParseOptions = { 
    [sublistFieldId: string]: FieldParseOptions | SubrecordParseOptions | SublistLineIdOptions
} & {
    lineIdOptions?: SublistLineIdOptions | {
        /**`string` - the `'internalid'` of the sublist field used to identify existing sublist lines for editing. */
        lineIdProp?: string;
        lineIdEvaluator?: (sublistLine: SublistLine, ...args: any[]) => string;
        args?: any[]; 
    }
}

export type SublistLineIdOptions = {
    /**`string` - the `'internalid'` of the sublist field used to identify existing sublist lines for editing. */
    lineIdProp?: string;
    /** function to calculate an id value used to compare if a sublist line is identical to another. */
    lineIdEvaluator?: (sublistLine: SublistLine, ...args: any[]) => string;
    /**arguments for `lineIdEvaluator` */
    args?: any[]; 
}

/**
 * `evaluator` and `colName` are mutually exclusive.
 * @typedefn **`FieldParseOptions`**
 * @property {FieldValue} defaultValue - The default value to use if `row[colName]` or `evaluator(row)` is `undefined`.
 * @property {string} colName - The column name in the CSV file containing the value for the body field.
 * @property {function} evaluator - A function that takes a `row` object and returns the value for the `fieldId`. 
 * - This is used when the value is not in the CSV file or is determined by the contents/context of the `row`.
 * @property {Array<any>} args - An optional array of arguments to pass to the `evaluator` function.
 */
export type FieldParseOptions = {
    defaultValue?: FieldValue;
    /** Fields that must be evaluated before this field */
    dependencies?: string[];
    /** Priority for evaluation order (lower numbers evaluated first) */
    priority?: number;
    /** Whether this field should be cached to avoid re-computation */
    cache?: boolean;
} & ({
    colName?: string; 
    evaluator?: never; 
    /** {@link ValueMapping} - define if there are specific row[colName] values you want to override */
    args?: ValueMapping[]; 
} | { 
    colName?: never; 
    /**`function` that takes a `row` object (and arbitrary `args`) and returns the value for the `field`. */
    evaluator?: ((row: Record<string, any>, ...args: any[]) => FieldValue | Promise<FieldValue>); 
    /**`optional` `array` of arguments to pass to the `evaluator` function. */
    args?: any[]; 
});

export type FieldEvaluator = (
    row: Record<string, any>,
    context: EvaluationContext,
    ...args: any[]
) => any;

/**
 * @interface **`RowContext`**
 * @property **`rowIndex`** `number` - The index of the current row (0-based)
 * @property **`recordType`** `string` - The type of record being processed (e.g., 'salesorder', 'customer')
 * @property **`recordId`** `string` - The ID of the current record being processed (optional)
 * @property **`filePath`** `string` - The path to the source CSV file being processed
 * @property **`cache`** {@link FieldDictionary} - Cache for expensive computations to avoid re-evaluation
 */
export type RowContext = {
    /** Current row index (0-based) */
    rowIndex: number;
    /** Current record type being processed */
    recordType: string;
    /** id of current record being processed */
    recordId: string;
    /** Source file path */
    filePath: string;
    /** 
     * Cache for expensive computations; e.g. store and get values 
     * for a record spanning more than 1 row. 
     * - is populated with entries from `globalCache` and the current `record.fields` 
     * when passed into an `evaluator` function
     * */
    cache: FieldDictionary;

}

/**
 * @typedefn **`EvaluationContext`**
 * @extends RowContext {@link RowContext} = `{ rowIndex: number, recordType: string, recordId?: string, filePath: string, cache: Record<string, any> }`
 * @property **`currentFieldId`** `string` - The ID of the field currently being evaluated
 * @property **`fields`** {@link FieldDictionary} - Dictionary of field values for the current record
 * @property **`sublistId`** `string` - The ID of the sublist currently being evaluated (optional)
 * @property **`sublists`** {@link SublistDictionary} - Dictionary mapping `sublistId` to {@link SublistLine}`[]`.
 */
export type EvaluationContext = RowContext & {
    /** Field ID currently being evaluated */
    currentFieldId: string;
} & ({
    /** `{ [fieldId: string]: `{@link FieldValue} | {@link SubrecordValue}`; }` */
    fields?: FieldDictionary;
    sublistId?: never;
    sublists?: never;
} | {
    fields?: FieldDictionary;
    sublistId?: string;
    /** `{ [sublistId: string]: `{@link SublistLine}`[] }` */
    sublists?: SublistDictionary;
});
/**
 * @typedefn **`SubrecordParseOptions`**
 * @property {string} subrecordType - The type of the subrecord.
 * @property {FieldDictionaryParseOptions} fieldOptions - {@link FieldDictionaryParseOptions} - The field dictionary parse options for the subrecord.
 * @property {SublistDictionaryParseOptions} sublistOptions - {@link SublistDictionaryParseOptions} - The sublist dictionary parse options for the subrecord.
 */
export type SubrecordParseOptions = {
    subrecordType: string;
    fieldOptions?: FieldDictionaryParseOptions;
    sublistOptions?: SublistDictionaryParseOptions;
}


/** 
 * options for parsing a csv to extract an {@link idSearchOptions} object 
 * */
export type idSearchParseOptions = {
    idProp: idPropertyEnum;
    searchOperator: RecordOperatorEnum | SearchOperatorEnum | TextOperatorEnum | NumericOperatorEnum;
    idValueMapping: FieldParseOptions 
}


/**
 * only set oldValue to newValue if the column name is in validColumns
 * @property {FieldValue} newValue - The new value to set for the column.
 * @property {string | string[]} validColumns - The column names that this mapping applies to. Can be a single string or an array of strings.
 */
export type ValueMappingEntry = {
    newValue: FieldValue;
    validColumns: string | string[];
};

/**
 * @description use when row[columnName] might contain multiple values e.g. `row[columnName] = "email1; email2; email3"`
 * @property {string} col - The column name to extract a value from.
 * @property {number} [minIndex] - Accept values from col starting at this index of `matchResults RegExpArray` returned from `extractor(row[col])`
 */
export type ColumnSliceOptions = {
    /**The column name to extract a value from. */
    colName: string;
    /** *`(zero-based)`* Accept values from col starting at this index of `matchResults RegExpArray` returned from `extractor(row[col])` */
    minIndex?: number
};


/**
 * @description
 * - `keys` - an explicit value that you want to override
 * - `value` can be: 
 * - - a {@link FieldValue} -> override occurrences of `key` in any column it's found in with the `FieldValue`
 * - - a {@link ValueMappingEntry} -> override occurences of `key` only in specified columns (see {@link ValueMappingEntry.validColumns}) with {@link ValueMappingEntry.newValue}.
 */
export type ValueMapping = Record<string, FieldValue | ValueMappingEntry>;
