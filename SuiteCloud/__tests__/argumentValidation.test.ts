/**
 * @deprecated
 */
jest.mock('../src/config', () => ({}));
jest.mock('../src/config/setupLog', () => ({}));
jest.mock('../src/utils/regex', () => ({}));
jest.mock('../src/utils/typeValidation', () => ({
    isNullLike: jest.fn((value: any) => value === null || value === undefined),
    isNonEmptyString: jest.fn((value: any) => typeof value === 'string' && value.length > 0),
    isNonEmptyArray: jest.fn((value: any) => value && Array.isArray(value) && value.length > 0),
    isObject: jest.fn((value: any) => typeof value === 'object' && value !== null),
    isFunction: jest.fn((value: any) => typeof value === 'function'),
}));
jest.mock('open', () => () => Promise.resolve());

import { objectArgument } from '../src/utils/argumentValidation';

// Mock type guard functions for testing
const isRecordOptions = (value: any): value is { id: string; fields: string[] } => {
    return typeof value === 'object' && 
        value !== null && 
        typeof value.id === 'string' && 
        Array.isArray(value.fields);
};
