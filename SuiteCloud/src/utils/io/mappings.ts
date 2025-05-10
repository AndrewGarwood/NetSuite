/**
 * @deprecated
 * @file src/utils/io/mappings.ts
 * @description Column and Value mappings to map CSV column headers to NetSuite record fieldIds 
 * or override row values to a standardized form or valid NetSuite {@link RecordRef}s.
 * - used in {@link parseDelimitedFileWithMapping}`()` function to parse CSV files with mappings
 * @module mappings
 */
import { parseDelimitedFileWithMapping } from "src/utils/io/reading"
import { RecordRef, TermBase as Term } from "src/utils/api/types/NS"
import { FieldValue } from "src/utils/api/types/Api";
import {ValueMapping, ColumnMapping, MappedRow } from "src/utils/io/types/Csv";

export const TERM_COLUMN_MAPPING: ColumnMapping = {
    'Inactive': 'isinactive',
    'Description': 'name',
    'Preferred': 'preferred',
};

export const TERM_VALUE_MAPPING: ValueMapping = {
    "ORIGINAL_TERM_VALUE": "TERM_VALUE_WITH_STANDARDIZED_SYNTAX",
}

export const SB_TERM_DICTIONARY: Record<string, Term> = {
    "Net 15": {
        name: "Net 15",
        internalid: 1,
    },
    "Net 30": {
        name: "Net 30",
        internalid: 2,
    },
    "Net 60": {
        name: "Net 60",
        internalid: 3,
    },
    "Upon Receipt": {
        name: "Upon Receipt",
        internalid: 4,
    },
    "1% 10 Net 30": {
        name: "1% 10 Net 30",
        internalid: 5,
    },
    "2% 10 Net 30": {
        name: "Upon Receipt",
        internalid: 6,
    },
}