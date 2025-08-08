// Mock the problematic modules before importing argumentValidation
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

const isUserConfig = (value: any): value is { name: string; email: string } => {
    return typeof value === 'object' && 
        value !== null && 
        typeof value.name === 'string' && 
        typeof value.email === 'string';
};

const isApiSettings = (value: any): value is { url: string; timeout: number } => {
    return typeof value === 'object' && 
        value !== null && 
        typeof value.url === 'string' && 
        typeof value.timeout === 'number';
};

describe('argumentValidation.objectArgument', () => {
    describe('New overload: automatic type name derivation', () => {
        test('should derive type name from type guard function name with "is" prefix', () => {
            const validRecord = { id: 'test', fields: ['field1', 'field2'] };
            
            // This should not throw - function name "isRecordOptions" should derive "RecordOptions"
            expect(() => {
                objectArgument('testFunction', { options: validRecord }, { isRecordOptions });
            }).not.toThrow();
        });

        test('should work with different type guard function names', () => {
            const validUser = { name: 'John', email: 'john@example.com' };
            
            // Function name "isUserConfig" should derive "UserConfig"
            expect(() => {
                objectArgument('testFunction', { userConfig: validUser }, { isUserConfig });
            }).not.toThrow();
        });

        test('should work with API settings type guard', () => {
            const validApi = { url: 'https://api.example.com', timeout: 5000 };
            
            // Function name "isApiSettings" should derive "ApiSettings"
            expect(() => {
                objectArgument('testFunction', { apiSettings: validApi }, { isApiSettings });
            }).not.toThrow();
        });

        test('should throw error when value fails type guard validation', () => {
            const invalidRecord = { id: 'test' }; // missing 'fields' property
            
            expect(() => {
                objectArgument('testFunction', { options: invalidRecord }, { isRecordOptions });
            }).toThrow(/Invalid argument: 'options'/);
        });

        test('should respect allowEmpty parameter when true', () => {
            const emptyObject = {};
            
            expect(() => {
                objectArgument('testFunction', { options: emptyObject }, { isRecordOptions }, true);
            }).not.toThrow();
        });

        test('should throw error for empty object when allowEmpty is false (default)', () => {
            const emptyObject = {};
            
            expect(() => {
                objectArgument('testFunction', { options: emptyObject }, { isRecordOptions });
            }).toThrow();
        });

        test('should handle undefined value when allowEmpty is true', () => {
            expect(() => {
                objectArgument('testFunction', { options: undefined }, { isRecordOptions }, true);
            }).not.toThrow();
        });

        test('should throw error for undefined value when allowEmpty is false', () => {
            expect(() => {
                objectArgument('testFunction', { options: undefined }, { isRecordOptions });
            }).toThrow();
        });

        test('should throw error for non-object values', () => {
            expect(() => {
                objectArgument('testFunction', { options: 'not an object' }, { isRecordOptions });
            }).toThrow(/Invalid argument: 'options'/);
            
            expect(() => {
                objectArgument('testFunction', { options: 123 }, { isRecordOptions });
            }).toThrow(/Invalid argument: 'options'/);
            
            expect(() => {
                objectArgument('testFunction', { options: [] }, { isRecordOptions });
            }).toThrow(/Invalid argument: 'options'/);
        });

        test('should include derived type name in error message', () => {
            const invalidRecord = { id: 123, fields: 'not an array' }; // invalid types
            
            try {
                objectArgument('testFunction', { options: invalidRecord }, { isRecordOptions });
                fail('Expected function to throw');
            } catch (error) {
                expect((error as Error).message).toContain('RecordOptions');
                expect((error as Error).message).toContain('isRecordOptions');
            }
        });
    });

    describe('Regex type name extraction', () => {
        test('should extract type name from various function naming patterns', () => {
            // Test the regex pattern directly by checking error messages
            const testCases = [
                { functionName: 'isRecordOptions', expectedType: 'RecordOptions' },
                { functionName: 'isUserConfig', expectedType: 'UserConfig' },
                { functionName: 'isApiSettings', expectedType: 'ApiSettings' },
                { functionName: 'isValidation', expectedType: 'Validation' },
                { functionName: 'isSimple', expectedType: 'Simple' }
            ];

            testCases.forEach(({ functionName, expectedType }) => {
                // Create a dynamic type guard function with the specific name
                const typeGuard = Object.defineProperty(
                    () => false, // Always returns false to trigger error
                    'name', 
                    { value: functionName, configurable: true }
                );

                try {
                    objectArgument('testFunction', { test: { invalidProp: 'invalid' } }, { [functionName]: typeGuard });
                    fail(`Expected function to throw for ${functionName}`);
                } catch (error) {
                    expect((error as Error).message).toContain(expectedType);
                }
            });
        });

        test('should fallback to function name when regex does not match "is" prefix', () => {
            const customTypeGuard = Object.defineProperty(
                () => false,
                'name',
                { value: 'validateCustomObject', configurable: true }
            );

            try {
                objectArgument('testFunction', { test: { invalidProp: 'invalid' } }, { validateCustomObject: customTypeGuard });
                fail('Expected function to throw');
            } catch (error) {
                // Should use the full function name as fallback
                expect((error as Error).message).toContain('validateCustomObject');
            }
        });
    });

    describe('Integration with existing overloads', () => {
        test('should not interfere with original string-based overloads', () => {
            const validObject = { prop: 'value' };
            
            // Original overload: objectArgument(source, label, value, typeName?, typeGuard?, allowEmpty?)
            expect(() => {
                objectArgument('testFunction', 'myObject', validObject);
            }).not.toThrow();
            
            // Original overload with type name
            expect(() => {
                objectArgument('testFunction', 'myObject', validObject, 'CustomType');
            }).not.toThrow();
        });

        test('should not interfere with labeled object overloads', () => {
            const validObject = { prop: 'value' };
            
            // Original overload: objectArgument(source, {label: value}, typeName?, typeGuard?, allowEmpty?)
            expect(() => {
                objectArgument('testFunction', { myObject: validObject });
            }).not.toThrow();
            
            // Original overload with type name
            expect(() => {
                objectArgument('testFunction', { myObject: validObject }, 'CustomType');
            }).not.toThrow();
        });
    });

    describe('Error handling for new overload', () => {
        test('should throw error for multiple keys in labeledValue', () => {
            const validRecord = { id: 'test', fields: ['field1'] };
            
            expect(() => {
                objectArgument('testFunction', { options: validRecord, extra: 'value' }, { isRecordOptions });
            }).toThrow(/expected a single key/);
        });

        test('should throw error for multiple type guards in labeledTypeGuard', () => {
            const validRecord = { id: 'test', fields: ['field1'] };
            
            expect(() => {
                objectArgument('testFunction', { options: validRecord }, { 
                    isRecordOptions, 
                    isUserConfig 
                });
            }).toThrow(); // Should not match the new overload pattern
        });

        test('should throw error for non-function in labeledTypeGuard', () => {
            const validRecord = { id: 'test', fields: ['field1'] };
            
            expect(() => {
                objectArgument('testFunction', { options: validRecord }, { 
                    notAFunction: 'string value' as any  // Force type to test runtime behavior
                });
            }).toThrow(); // Should not match the new overload pattern
        });
    });
});
