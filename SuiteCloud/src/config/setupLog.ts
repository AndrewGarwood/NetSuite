/**
 * @file src/config/setupLog.ts
 * @reference https://tslog.js.org/#/?id=pretty-templates-and-styles-color-settings
 */
import { OUTPUT_DIR, CLOUD_LOG_DIR } from './env';
import { Logger, ISettingsParam, ISettings, ILogObj, ILogObjMeta, IPrettyLogStyles, IMeta } from 'tslog';
import path from 'node:path';
import { appendFileSync, WriteFileOptions } from 'node:fs';

/** LOCAL_LOG_DIR (in onedrive) or `OUTPUT_DIR/logs` */
export const LOCAL_LOG_DIR = path.join(OUTPUT_DIR, "logs");  
/**`OUTPUT_DIR/logs/DEBUG.txt` */
export const DEFAULT_LOG_FILEPATH = path.join(LOCAL_LOG_DIR, "DEBUG.txt");
/**`CLOUD_LOG_DIR/ERROR.txt` */
export const ERROR_LOG_FILEPATH = path.join(CLOUD_LOG_DIR, "ERROR.txt");
/**`CLOUD_LOG_DIR/PARSE_LOG.txt` */
export const PARSE_LOG_FILEPATH = path.join(CLOUD_LOG_DIR, 'PARSE_LOG.txt'); 
/** 
 * `INDENT_LOG_LINE =  '\n\t• '` = newLine + tab + bullet + space
 * - log.debug(s1, INDENT_LOG_LINE + s2, INDENT_LOG_LINE + s3,...) 
 * */
export const INDENT_LOG_LINE: string = '\n\t• ';
/** 
 * `NEW_LINE =  '\n > '` = newLine + space + > + space
 * */
export const NEW_LINE: string = '\n > ';

const dateTemplate = "{{yyyy}}-{{mm}}-{{dd}}";
const timeTemplate = "{{hh}}:{{MM}}:{{ss}}";//.{{ms}}";
const timestampTemplate = `(${dateTemplate} ${timeTemplate})`;

/**not included for now */
const logNameTemplate = "[{{name}}]"; //"[{{nameWithDelimiterPrefix}}{{name}}{{nameWithDelimiterSuffix}}]";
const logLevelTemplate = "[{{logLevelName}}]";
const fileInfoTemplate = 
    "{{filePathWithLine}}"; 
    // "{{fullFilePath}}\n{{fileNameWithLine}}";
    //:{{fileColumn}} {{method}}";
    // "{{fileName}}:{{fileLine}}";
/** 
 * use as value for {@link ISettingsParam.prettyLogTemplate} 
 * = {@link timestampTemplate} + {@link logNameTemplate} + {@link logLevelTemplate} + {@link fileInfoTemplate} + `\n\t{{logObjMeta}}`
 * - {@link timestampTemplate} = `({{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}})`
 * - {@link logNameTemplate} = `"[{{name}}]"`
 * - {@link logLevelTemplate} = `{{logLevelName}}:`
 * - {@link fileInfoTemplate} = `{{fileName}}:{{fileLine}}`
 * */
const LOG_TEMPLATE = [
    logLevelTemplate, 
    timestampTemplate, 
    // logNameTemplate, 
    fileInfoTemplate,
].join(' ') + NEW_LINE;

const errorInfoTemplate = "{{errorName}}: {{errorMessage}}\n\t{{errorStack}}";
/** 
 * use as value for {@link ISettingsParam.prettyErrorTemplate} 
 * @description template string for error message. 
 * */
const ERROR_TEMPLATE = `${errorInfoTemplate}`; //`${timestampTemplate} ${logNameTemplate} ${logLevelTemplate} ${fileInfoTemplate}\n${errorInfoTemplate}`;
/** 
 * use as value for {@link ISettingsParam.prettyErrorStackTemplate}.
 * @description template string for error stack trace lines. 
 * */
const ERROR_STACK_TEMPLATE = `${fileInfoTemplate}:{{method}} {{stack}}`;

const PRETTY_LOG_STYLES: IPrettyLogStyles = {
        yyyy: "green",
        mm: "green",
        dd: "green",
        hh: "greenBright",
        MM: "greenBright",
        ss: "greenBright",
        ms: "greenBright",
        dateIsoStr: ["redBright", "italic"], //dateIsoStr is = Shortcut for {{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}
        logLevelName:  {
            "*": ["bold", "black", "bgWhiteBright", "dim"],
            SILLY: ["bold", "white"],
            TRACE: ["bold", "whiteBright"],
            DEBUG: ["bold", "green"],
            INFO: ["bold", "cyan"],
            WARN: ["bold", "yellow"],
            ERROR: ["bold", "red"],
            FATAL: ["bold", "redBright"],
        },
        fileName: "cyan",
        filePath: "blue",
        fileLine: ["cyanBright", "bold"],
        filePathWithLine: ["blueBright", "italic"],
        name: "blue",
        nameWithDelimiterPrefix: ["whiteBright", "bold", "bgBlackBright"],
        nameWithDelimiterSuffix: ["whiteBright", "bold", "bgBlack"],
        errorName: ["red", "bold"],
        errorMessage: "redBright",
};   
/** `type: "pretty"` */
const MAIN_LOGGER_SETTINGS: ISettingsParam<ILogObj> = {
    type: "pretty", // "pretty" | "hidden" | "json"
    name: "NS_Main",
    minLevel: 0,
    prettyLogTemplate: LOG_TEMPLATE,
    prettyErrorTemplate: ERROR_TEMPLATE,
    prettyErrorStackTemplate: ERROR_STACK_TEMPLATE,
    stylePrettyLogs: true,
    prettyLogTimeZone: "local",
    prettyLogStyles: PRETTY_LOG_STYLES,
}
/** `type: "hidden"` -> suppress logs from being sent to console */
const PARSE_LOGGER_SETTINGS: ISettingsParam<ILogObj> = {
    type: "hidden", // "pretty" | "hidden" | "json"
    name: "NS_Parse",
    minLevel: 0,
    prettyLogTemplate: LOG_TEMPLATE,
    prettyErrorTemplate: ERROR_TEMPLATE,
    prettyErrorStackTemplate: ERROR_STACK_TEMPLATE,
    stylePrettyLogs: true,
    prettyLogTimeZone: "local",
    prettyLogStyles: PRETTY_LOG_STYLES,
}

/** `type: "pretty", name: "mainLogger"` */
export const mainLogger = new Logger<ILogObj>(MAIN_LOGGER_SETTINGS);
mainLogger.attachTransport((logObj: ILogObj) => {
    appendFileSync(
        DEFAULT_LOG_FILEPATH, formatLogObj(logObj), 
        { encoding: "utf-8" } as WriteFileOptions
    );
});


/** `type: "pretty", name: "errorLogger"` */ //logObj: ILogObj & ILogObjMeta
export const errorLogger = new Logger<ILogObj>(MAIN_LOGGER_SETTINGS);
errorLogger.attachTransport((logObj: ILogObj) => {
    appendFileSync(
        ERROR_LOG_FILEPATH, formatLogObj(logObj), 
        { encoding: "utf-8" } as WriteFileOptions
    );
});

/** `type: "hidden", name: "parseLogger"` */
export const parseLogger = new Logger<ILogObj>(PARSE_LOGGER_SETTINGS);
parseLogger.attachTransport((logObj: ILogObj) => {
    appendFileSync(
        PARSE_LOG_FILEPATH, formatLogObj(logObj), 
        { encoding: "utf-8" } as WriteFileOptions
    );
});


/** `type: "hidden", name: "pruneLogger"` */
export const pruneLogger = new Logger<ILogObj>(PARSE_LOGGER_SETTINGS);
/** `type: "hidden", name: "apiLogger"` */
export const apiLogger = new Logger<ILogObj>(PARSE_LOGGER_SETTINGS);

/**
 * compress metadata into `logObj['-1']` then return stringified `logObj`
 * @param logObj {@link ILogObj}
 * @returns `string`
 */
function formatLogObj(logObj: ILogObj | (ILogObj & ILogObjMeta)): string {
    const meta = logObj['_meta'] as IMeta;
    const { logLevelName, date, path } = meta;
    const timestamp = date ? date.toLocaleString() : '';
    const fileInfo = `${path?.filePathWithLine}:${path?.fileColumn}`;
    const methodInfo = `${path?.method ? path.method + '()' : ''}`;
    delete logObj['_meta'];
    logObj['meta0'] = `[${logLevelName}] (${timestamp})`;
    logObj['meta1'] = `${fileInfo} @ ${methodInfo}`;
    // logObj['-1'] = `[${logLevelName}] (${timestamp})`;
    // logObj['-2'] = `${fileInfo} @ ${methodInfo}`;
    return JSON.stringify(logObj, null, 4) + "\n" 
}

/**suppress logs by putting them here (do not print to console) */
export const SUPPRESSED_LOGS: any[] = []
export const INFO_LOGS: any[] = []
export const DEBUG_LOGS: any[] = [];