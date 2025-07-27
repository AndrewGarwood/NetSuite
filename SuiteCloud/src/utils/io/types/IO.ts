/**
 * @file src/utils/io/Io.ts
 */
import {
    StringCaseOptions, StringPadOptions, StringStripOptions
} from "../../regex/index"

export type WriteJsonOptions = {
    data: Record<string, any> | string;
    filePath: string;
    indent?: number;
    enableOverwrite?: boolean;
}

/**
 * @property **`fileName`** `string` - just the name with its extension
 * @property **`fileContent`** `string` - `base64` encoded string
 */
export type FileData = { 
    /** `string` - just the name with its extension */
    fileName: string, 
    /** `base64` encoded string */
    fileContent: string
}

/**
 * @deprecated use `CleanStringOptions` instead
 * @typedefn **`ParseOneToManyOptions`**
 * @property {StringStripOptions} [keyStripOptions] - options for stripping characters from the key
 * @property {StringStripOptions} [valueStripOptions] - options for stripping characters from the value
 * @property {StringCaseOptions} [keyCaseOptions] - options for changing the case of the key
 * @property {StringCaseOptions} [valueCaseOptions] - options for changing the case of the value
 * @property {StringPadOptions} [keyPadOptions] - options for padding values read from the `keyColumn`
 * @property {StringPadOptions} [valuePadOptions] - options for padding values read from the `valueColumn`
 * 
 * - {@link StringStripOptions} = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * - {@link StringCaseOptions}  = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * - {@link StringPadOptions} = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 */
export type ParseOneToManyOptions = {
    keyStripOptions?: StringStripOptions,
    valueStripOptions?: StringStripOptions,
    keyCaseOptions?: StringCaseOptions,
    valueCaseOptions?: StringCaseOptions,
    keyPadOptions?: StringPadOptions,
    valuePadOptions?: StringPadOptions
}
