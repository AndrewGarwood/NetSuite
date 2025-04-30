/**
 * @file src/config/logging.ts
 */

import fs from 'fs';
import pino, {StreamEntry, Level} from 'pino';
import { SRC_DIR as SRC } from './env';

const streams: StreamEntry<Level>[] = [  
    {
        level: "info", // log INFO and above
        stream: fs.createWriteStream(`${SRC}/logs/debug.log`, { flags: "a" }),
    },
    {
        level: "error", // log INFO and above
        stream: fs.createWriteStream(`${SRC}/logs/error.log`, { flags: "a" }),
    },
];

/**
 * @description Logger for the SuiteCloud project.
 * @example
 * import log from 'src/config/logging';
 * log.info('Logging initialized');
 */
export const logger = pino(
    {
        level: "info",
    },
    pino.multistream(streams)
);
