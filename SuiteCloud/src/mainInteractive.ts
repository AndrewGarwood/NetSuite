/**
 * @file src/mainInteractive.ts
 * Interactive CLI version of main.ts with user prompts for pipeline configuration
 */
import * as fs from "node:fs";
import path from "node:path";
import inquirer from "inquirer";
import {
    trimFileSync, clearFile, getCurrentPacificTime,
    formatDebugLogFile, getDirectoryFiles,
    indentedStringify, isDirectory
} from "typeshi/dist/utils/io";
import { 
    STOP_RUNNING, DATA_DIR, DELAY, 
    mainLogger as mlog, simpleLogger as slog,
    INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH,
    ERROR_LOG_FILEPATH, DataDomainEnum,
    CLOUD_LOG_DIR,
} from "./config";
import { instantiateAuthManager } from "./api";
import { 
    runMainItemPipeline, 
    ItemPipelineOptions, 
    runMainTransactionPipeline, 
    TransactionMainPipelineOptions, LN_INVENTORY_ITEM_PIPELINE_CONFIG,
    NON_INVENTORY_ITEM_PIPELINE_CONFIG,
    SALES_ORDER_PIPELINE_CONFIG,
    MatchSourceEnum,
    TransactionEntityMatchOptions,
    DEFAULT_MATCH_OPTIONS,
    DEFAULT_TRANSACTION_STAGES_TO_WRITE,
    ALL_TRANSACTION_STAGES,
    DEFAULT_ITEM_STAGES_TO_WRITE,
    ALL_ITEM_STAGES
} from "./pipelines";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants"
import { getSkuDictionary, initializeData } from "./config/dataLoader";
import { EntityRecordTypeEnum, RecordTypeEnum } from "./utils/ns/Enums";
import { invokePipeline } from "./main";

const LOG_FILES = [
    DEFAULT_LOG_FILEPATH, 
    PARSE_LOG_FILEPATH, 
    ERROR_LOG_FILEPATH
];

// Pipeline selection options
enum PipelineTypeEnum {
    TRANSACTION = 'TRANSACTION',
    ITEM = 'ITEM'
}

type PipelineOptions = {
    type: PipelineTypeEnum;
    name: string;
    description: string;
    recordType: RecordTypeEnum;
    configFunction: any;
    confirmFunction: any;
    baseConfig?: any;
};

const AVAILABLE_PIPELINES: PipelineOptions[] = [
    {
        type: PipelineTypeEnum.TRANSACTION,
        name: 'Sales Order Pipeline',
        description: 'Process sales order transactions with entity matching',
        recordType: RecordTypeEnum.SALES_ORDER,
        configFunction: promptTransactionPipeline,
        confirmFunction: confirmTransactionConfiguration,
        baseConfig: SALES_ORDER_PIPELINE_CONFIG
    },
    {
        type: PipelineTypeEnum.ITEM,
        name: 'Inventory Item Pipeline',
        description: 'Process inventory items',
        recordType: RecordTypeEnum.INVENTORY_ITEM,
        configFunction: promptItemPipeline,
        confirmFunction: confirmItemConfiguration,
        baseConfig: LN_INVENTORY_ITEM_PIPELINE_CONFIG
    },
    {
        type: PipelineTypeEnum.ITEM,
        name: 'Non-Inventory Item Pipeline',
        description: 'Process non-inventory items',
        recordType: RecordTypeEnum.NON_INVENTORY_ITEM,
        configFunction: promptItemPipeline,
        confirmFunction: confirmItemConfiguration,
        baseConfig: NON_INVENTORY_ITEM_PIPELINE_CONFIG
    }
];

enum CLI_TruthyStringEnum {
    ENTER = '',
    YES = 'yes',
    YES_ABBREVIATED = 'y',
    BOOLEAN_TRUE = 'true',
    BINARY_TRUE = '1'
}

/**
 * Helper function to check if user input is truthy (yes/y/true or enter)
 */
function isTruthy(input: string): input is CLI_TruthyStringEnum {
    const normalized = input.trim().toLowerCase();
    return Object.values(CLI_TruthyStringEnum)
        .includes(normalized as CLI_TruthyStringEnum);
}

/**
 * Helper function to get stage enum from user input (number or string)
 */
function getStageFromInput(input: string, stageArray: string[]): string | null {
    const trimmed = input.trim();
    
    // Try parsing as number first
    const num = parseInt(trimmed);
    if (!isNaN(num) && num >= 1 && num <= stageArray.length) {
        return stageArray[num - 1];
    }
    
    // Try matching as string
    const matchedStage = stageArray.find(stage => 
        stage.toLowerCase() === trimmed.toLowerCase()
    );
    
    return matchedStage || null;
}

/**
 * Prompt user to select which pipeline to run
 */
async function selectPipeline(): Promise<PipelineOptions> {
    console.log('\n=== Pipeline Selection ===\n');
    
    const pipelineChoice = await inquirer.prompt([
        {
            type: 'list',
            name: 'pipeline',
            message: 'Select a pipeline to run:',
            choices: AVAILABLE_PIPELINES.map((pipeline, index) => ({
                name: `${pipeline.name} - ${pipeline.description}`,
                value: index,
                short: pipeline.name
            }))
        }
    ]);
    
    return AVAILABLE_PIPELINES[pipelineChoice.pipeline];
}

/**
 * Prompt user for pipeline configuration options
 */
async function promptTransactionPipeline(): Promise<TransactionMainPipelineOptions> {
    console.log('\n=== Interactive Pipeline Configuration ===\n');
    
    // Start with the base config
    const config = { ...SALES_ORDER_PIPELINE_CONFIG };
    
    // 1. Confirm parseOptions record types
    const parseOptionKeys = Object.keys(config.parseOptions);
    const confirmParseOptions = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: `Confirm parse options record type(s): ${parseOptionKeys.join(', ')}?`,
            default: true
        }
    ]);
    
    if (!confirmParseOptions.confirmed) {
        console.log('Pipeline cancelled by user.');
        process.exit(0);
    }
    
    // 2. Confirm postProcessingOptions record types (if exists)
    if (config.postProcessingOptions) {
        const postProcessingKeys = Object.keys(config.postProcessingOptions);
        const confirmPostProcessing = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: `Confirm post-processing options record type(s): ${postProcessingKeys.join(', ')}?`,
                default: true
            }
        ]);
        
        if (!confirmPostProcessing.confirmed) {
            console.log('Pipeline cancelled by user.');
            process.exit(0);
        }
    }
    
    // 3. Configure matchOptions
    console.log('\n--- Transaction Entity Match Options ---');
    const matchMethod = await inquirer.prompt([
        {
            type: 'list',
            name: 'method',
            message: 'Select match method:',
            choices: [
                { name: 'API (recommended)', value: MatchSourceEnum.API },
                { name: 'Local File', value: MatchSourceEnum.LOCAL }
            ],
            default: MatchSourceEnum.API
        }
    ]);
    
    const matchOptions: TransactionEntityMatchOptions = {
        ...DEFAULT_MATCH_OPTIONS,
        matchMethod: matchMethod.method
    };
    
    // If using local file, prompt for file options
    if (matchMethod.method === MatchSourceEnum.LOCAL) {
        console.log('\n--- Local File Options ---');
        const fileOptions = await inquirer.prompt([
            {
                type: 'input',
                name: 'filePath',
                message: 'Enter file path:',
                default: DEFAULT_MATCH_OPTIONS.localFileOptions?.filePath,
                validate: (input) => {
                    if (!input.trim()) return 'File path is required';
                    if (!fs.existsSync(input.trim())) return 'File does not exist';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'entityIdColumn',
                message: 'Enter entity ID column name:',
                default: DEFAULT_MATCH_OPTIONS.localFileOptions?.targetValueColumn 
                    || 'Name'
            },
            {
                type: 'input',
                name: 'internalIdColumn',
                message: 'Enter internal ID column name:',
                default: DEFAULT_MATCH_OPTIONS.localFileOptions?.internalIdColumn 
                    || 'Internal ID'
            }
        ]);
        
        matchOptions.localFileOptions = {
            filePath: fileOptions.filePath.trim(),
            targetValueColumn: fileOptions.entityIdColumn.trim(),
            internalIdColumn: fileOptions.internalIdColumn.trim()
        };
    }
    
    config.matchOptions = matchOptions;
    
    // 4. Generate missing entities
    console.log('\n--- Generate Missing Entities ---');
    const generateMissingAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'generate',
            message: 'Generate missing entities? (press Enter for yes, or type no)',
            default: CLI_TruthyStringEnum.ENTER
        }
    ]);
    
    config.generateMissingEntities = isTruthy(generateMissingAnswer.generate);
    
    // 5. Output directory
    console.log('\n--- Output Directory ---');
    const outputDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'directory',
            message: `Correct output directory?\n    Current value: '${config.outputDir}'\n    (press Enter to confirm, or enter new path):`,
            default: CLI_TruthyStringEnum.ENTER,
            validate: (input) => {
                if (!input.trim()) return true; // Using default
                if (!isDirectory(input.trim())) return 'Directory does not exist';
                return true;
            }
        }
    ]);
    
    if (outputDirAnswer.directory.trim()) {
        config.outputDir = outputDirAnswer.directory.trim();
    }
    
    // 6. Stages to write
    console.log('\n--- Stages to Write ---');
    const defaultStagesStr = DEFAULT_TRANSACTION_STAGES_TO_WRITE.join(', ');
    const confirmStages = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useDefault',
            message: `Use default stages to write: ${defaultStagesStr}?`,
            default: true
        }
    ]);
    
    if (confirmStages.useDefault) {
        config.stagesToWrite = [...DEFAULT_TRANSACTION_STAGES_TO_WRITE];
    } else {
        console.log('\nSelect stages to write (you can select multiple):');
        const stageChoices = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'stages',
                message: 'Select stages to write:',
                choices: ALL_TRANSACTION_STAGES.map(stage => ({
                    name: stage,
                    value: stage,
                    checked: DEFAULT_TRANSACTION_STAGES_TO_WRITE.includes(stage as any)
                }))
            }
        ]);
        
        config.stagesToWrite = stageChoices.stages;
    }
    
    // 7. Stop after stage
    console.log('\n--- Stop After Stage ---');
    const lastStage = ALL_TRANSACTION_STAGES[ALL_TRANSACTION_STAGES.length - 1];
    const confirmStopAfter = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useDefault',
            message: `Stop after last stage (${lastStage})?`,
            default: true
        }
    ]);
    
    if (confirmStopAfter.useDefault) {
        config.stopAfter = lastStage as any;
    } else {
        console.log('\nAvailable stages:');
        ALL_TRANSACTION_STAGES.forEach((stage, index) => {
            console.log(`  ${index + 1}. ${stage}`);
        });
        
        const stopAfterAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'stage',
                message: 'Enter stage number or name:',
                validate: (input) => {
                    const stage = getStageFromInput(input, ALL_TRANSACTION_STAGES);
                    if (!stage) {
                        return 'Invalid stage. Please enter a valid stage number (1-' + 
                            ALL_TRANSACTION_STAGES.length + ') or stage name.';
                    }
                    return true;
                }
            }
        ]);
        
        const selectedStage = getStageFromInput(stopAfterAnswer.stage, ALL_TRANSACTION_STAGES);
        config.stopAfter = selectedStage as any;
    }
    
    return config;
}

/**
 * Prompt user for item pipeline configuration options
 */
async function promptItemPipeline(baseConfig: ItemPipelineOptions): Promise<ItemPipelineOptions> {
    console.log('\n=== Interactive Item Pipeline Configuration ===\n');
    
    // Start with the base config
    const config = { ...baseConfig };
    
    // 1. Confirm parseOptions record types
    const parseOptionKeys = Object.keys(config.parseOptions);
    const confirmParseOptions = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: `Confirm parse options record type(s): ${parseOptionKeys.join(', ')}?`,
            default: true
        }
    ]);
    
    if (!confirmParseOptions.confirmed) {
        console.log('Pipeline cancelled by user.');
        process.exit(0);
    }
    
    // 2. Confirm postProcessingOptions record types (if exists)
    if (config.postProcessingOptions) {
        const postProcessingKeys = Object.keys(config.postProcessingOptions);
        const confirmPostProcessing = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: `Confirm post-processing options record type(s): ${postProcessingKeys.join(', ')}?`,
                default: true
            }
        ]);
        
        if (!confirmPostProcessing.confirmed) {
            console.log('Pipeline cancelled by user.');
            process.exit(0);
        }
    }
    
    // 3. Output directory
    console.log('\n--- Output Directory ---');
    const outputDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'directory',
            message: `Correct output directory?\n    Current value: '${config.outputDir}'\n    (press Enter to confirm, or enter new path):`,
            default: '',
            validate: (input) => {
                if (!input.trim()) return true; // Using default
                if (!isDirectory(input.trim())) return 'Directory does not exist';
                return true;
            }
        }
    ]);
    
    if (outputDirAnswer.directory.trim()) {
        config.outputDir = outputDirAnswer.directory.trim();
    }
    
    // 4. Stages to write
    console.log('\n--- Stages to Write ---');
    const defaultStagesStr = DEFAULT_ITEM_STAGES_TO_WRITE.join(', ');
    const confirmStages = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useDefault',
            message: `Use default stages to write: ${defaultStagesStr}?`,
            default: true
        }
    ]);
    
    if (confirmStages.useDefault) {
        config.stagesToWrite = [...DEFAULT_ITEM_STAGES_TO_WRITE];
    } else {
        console.log('\nSelect stages to write (you can select multiple):');
        const stageChoices = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'stages',
                message: 'Select stages to write:',
                choices: ALL_ITEM_STAGES.map(stage => ({
                    name: stage,
                    value: stage,
                    checked: DEFAULT_ITEM_STAGES_TO_WRITE.includes(stage as any)
                }))
            }
        ]);
        
        config.stagesToWrite = stageChoices.stages;
    }
    
    // 5. Stop after stage
    console.log('\n--- Stop After Stage ---');
    const lastStage = ALL_ITEM_STAGES[ALL_ITEM_STAGES.length - 1];
    const confirmStopAfter = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useDefault',
            message: `Stop after last stage (${lastStage})?`,
            default: true
        }
    ]);
    
    if (confirmStopAfter.useDefault) {
        config.stopAfter = lastStage as any;
    } else {
        console.log('\nAvailable stages:');
        ALL_ITEM_STAGES.forEach((stage, index) => {
            console.log(`  ${index + 1}. ${stage}`);
        });
        
        const stopAfterAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'stage',
                message: 'Enter stage number or name:',
                validate: (input) => {
                    const stage = getStageFromInput(input, ALL_ITEM_STAGES);
                    if (!stage) {
                        return 'Invalid stage. Please enter a valid stage number (1-' + 
                            ALL_ITEM_STAGES.length + ') or stage name.';
                    }
                    return true;
                }
            }
        ]);
        
        const selectedStage = getStageFromInput(stopAfterAnswer.stage, ALL_ITEM_STAGES);
        config.stopAfter = selectedStage as any;
    }
    
    return config;
}

/**
 * Display configuration summary and get final confirmation for Transaction Pipeline
 */
async function confirmTransactionConfiguration(
    config: TransactionMainPipelineOptions
): Promise<boolean> {
    console.log('\n=== Transaction Pipeline Configuration Summary ===');
    console.log(`  Parse Options: ${Object.keys(config.parseOptions).join(', ')}`);
    console.log(`Post-Processing: ${config.postProcessingOptions ? Object.keys(config.postProcessingOptions).join(', ') : 'None'}`);
    console.log(`   Match Method: ${config.matchOptions?.matchMethod}`);
    if (config.matchOptions?.matchMethod === MatchSourceEnum.LOCAL) {
        console.log(`      Match File Path: ${config.matchOptions.localFileOptions?.filePath}`);
        console.log(`  Target Value Column: ${config.matchOptions.localFileOptions?.targetValueColumn}`);
        console.log(`   Internal ID Column: ${config.matchOptions.localFileOptions?.internalIdColumn}`);
    }
    console.log(`Generate Missing Entities: ${config.generateMissingEntities}`);
    console.log(`Output Directory: ${config.outputDir}`);
    console.log(`Stages to Write: ${config.stagesToWrite?.join(', ') || 'None'}`);
    console.log(`Stop After: ${config.stopAfter}`);
    
    const confirmation = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'proceed',
            message: '\nProceed with this configuration?',
            default: true
        }
    ]);
    
    return confirmation.proceed;
}

/**
 * Display configuration summary and get final confirmation for Item Pipeline
 */
async function confirmItemConfiguration(
    config: ItemPipelineOptions
): Promise<boolean> {
    console.log('\n=== Item Pipeline Configuration Summary ===');
    console.log(`Parse Options: ${Object.keys(config.parseOptions).join(', ')}`);
    console.log(`Post-Processing: ${config.postProcessingOptions ? Object.keys(config.postProcessingOptions).join(', ') : 'None'}`);
    console.log(`Output Directory: ${config.outputDir}`);
    console.log(`Stages to Write: ${config.stagesToWrite?.join(', ') || 'None'}`);
    console.log(`Stop After: ${config.stopAfter}`);
    
    const confirmation = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'proceed',
            message: '\nProceed with this configuration?',
            default: true
        }
    ]);
    
    return confirmation.proceed;
}

/**
 * Display configuration summary and get final confirmation (legacy function)
 */
async function confirmConfiguration(config: TransactionMainPipelineOptions): Promise<boolean> {
    return confirmTransactionConfiguration(config);
}

/**
 * Main interactive function
 */
async function main() {
    await clearFile(...LOG_FILES);
    await DELAY(1000, null);
    mlog.info(`[START mainInteractive.main()] at ${getCurrentPacificTime()}`);
    
    await instantiateAuthManager();
    await initializeData();
    
    // Step 1: Select pipeline type
    const selectedPipeline = await selectPipeline();
    console.log(`\n✅ Selected: ${selectedPipeline.name}`);
    
    // Step 2: Configure the selected pipeline
    let config: TransactionMainPipelineOptions | ItemPipelineOptions;
    let confirmed: boolean;
    
    if (selectedPipeline.type === PipelineTypeEnum.TRANSACTION) {
        config = await selectedPipeline.configFunction();
        confirmed = await selectedPipeline.confirmFunction(config);
    } else {
        config = await selectedPipeline.configFunction(selectedPipeline.baseConfig);
        confirmed = await selectedPipeline.confirmFunction(config);
    }
    
    if (!confirmed) {
        console.log('Pipeline cancelled by user.');
        STOP_RUNNING(0);
    }
    
    // TODO: refactor this later
    // Step 3: Determine files to process
    let filesToProcess: string[] = [];
    
    if (selectedPipeline.type === PipelineTypeEnum.TRANSACTION) {
        // For transaction pipelines, get sales order files
        const csvFiles = getDirectoryFiles(
            soConstants.UNVIABLE_SO_DIR, '.csv', '.tsv'
        );
        filesToProcess = csvFiles.slice(7, 10); // handle subset for now
        console.log(`\nFound ${csvFiles.length} transaction files, operating on ${filesToProcess.length} file(s)`);
    } else {
        // For item pipelines, prompt for file selection or use default
        const filePrompt = await inquirer.prompt([
            {
                type: 'input',
                name: 'filePath',
                message: 'Enter item file path (or press Enter for default):',
                default: '',
                validate: (input) => {
                    if (!input.trim()) return true; // Will use default
                    if (!fs.existsSync(input.trim())) return 'File does not exist';
                    return true;
                }
            }
        ]);
        
        if (filePrompt.filePath.trim()) {
            filesToProcess = [filePrompt.filePath.trim()];
        } else {
            // Use a default item file path based on the selected pipeline
            const defaultItemFile = path.join(DATA_DIR, 'items', 'remaining_inventory.tsv');
            if (fs.existsSync(defaultItemFile)) {
                filesToProcess = [defaultItemFile];
                console.log(`\nUsing default item file: ${defaultItemFile}`);
            } else {
                console.log(`\nDefault item file not found: ${defaultItemFile}`);
                console.log('Please provide a valid item file path.');
                process.exit(1);
            }
        }
    }
    
    // Step 4: Run the pipeline
    console.log('\n=== Starting Pipeline ===\n');
    await DELAY(1000, null);
    
    if (selectedPipeline.type === PipelineTypeEnum.TRANSACTION) {
        await invokePipeline(
            selectedPipeline.recordType, 
            filesToProcess, 
            runMainTransactionPipeline, 
            config as TransactionMainPipelineOptions
        );
    } else if (selectedPipeline.type === PipelineTypeEnum.ITEM) {
        await invokePipeline(
            selectedPipeline.recordType, 
            filesToProcess, 
            runMainItemPipeline, 
            config as ItemPipelineOptions
        );
    }
    
    mlog.info([`[END mainInteractive()] at ${getCurrentPacificTime()}`,
        `handling logs...`
    ].join(TAB));
    
    trimFileSync(5, ...LOG_FILES);
    for (const filePath of LOG_FILES) { 
        formatDebugLogFile(filePath);
    }
    console.log('\n=== Pipeline Complete ===');
}

// Run the interactive main function
if (require.main === module) {
    main()
    .then(() => {
        STOP_RUNNING(0, `Finished execution of mainInteractive()`);
    })
    .catch(error => {
        mlog.error('Error executing main() function', JSON.stringify(error as any));
        STOP_RUNNING(1);
    });
}

export { 
    main as mainInteractive, 
    promptTransactionPipeline, 
    promptItemPipeline,
    confirmTransactionConfiguration,
    confirmItemConfiguration,
    confirmConfiguration,
};
