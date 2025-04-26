/**
 * @deprecated
 * @file src/utils/io/mappings.ts
 * @description Column and Value mappings to map CSV column headers to NetSuite record fieldIds 
 * or override row values to a standardized form or valid NetSuite {@link RecordRef}s.
 * - used in {@link parseDelimitedFileWithMapping}`()` function to parse CSV files with mappings
 * @module mappings
 */
import { parseDelimitedFileWithMapping } from "src/utils/io/reading"
import { RecordRef } from "src/types/NS/Record"
import { FieldValue } from "src/types/api/Api";
import {ValueMapping, ColumnMapping, MappedRow } from '../../types/io/CsvMapping';

export const TERM_COLUMN_MAPPING: ColumnMapping = {
    'Inactive': 'isinactive',
    'Description': 'name',
    'Preferred': 'preferred',
};
