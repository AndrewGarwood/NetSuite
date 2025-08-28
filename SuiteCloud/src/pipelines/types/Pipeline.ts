/**
 * @file src/pipelines/types/Pipeline.ts
 */

import { RecordOptions } from "../../api/types/RecordEndpoint";



export enum MatchSourceEnum {
    API = 'API',
    LOCAL = 'LOCAL',
}

export type LocalFileMatchOptions = {
    filePath: string;
    targetValueColumn: string;
    internalIdColumn: string;
}
export type MatchErrorDetails = {
    timestamp: string;
    sourceFile: string;
    numMatchErrors: number; 
    errors: RecordOptions[];
}