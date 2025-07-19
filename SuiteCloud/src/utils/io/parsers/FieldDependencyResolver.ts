/**
 * @file src/utils/io/parsers/FieldDependencyResolver.ts
 */

import { 
    FieldDictionaryParseOptions,
    FieldParseOptions,
} from "../types";
import { 
    isFieldParseOptions,
} from "../../typeGuards";
import { 
    mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
} from "../../../config";

/**
 * Field Dependency Resolver
 */
export class FieldDependencyResolver {
    private fieldOptions: Record<string, FieldParseOptions>;
    private dependencyGraph: Map<string, Set<string>>;
    private evaluationOrder: string[];

    constructor(fieldOptions: FieldDictionaryParseOptions) {
        this.fieldOptions = {};
        for (const [fieldId, options] of Object.entries(fieldOptions)) {
            if (isFieldParseOptions(options)) {
                this.fieldOptions[fieldId] = options as FieldParseOptions;
            }
        }
        
        this.dependencyGraph = new Map();
        this.evaluationOrder = [];
        this.buildDependencyGraph();
        this.resolveEvaluationOrder();
    }

    private buildDependencyGraph(): void {
        for (const fieldId of Object.keys(this.fieldOptions)) {
            this.dependencyGraph.set(fieldId, new Set());
        }
        for (const [fieldId, options] of Object.entries(this.fieldOptions)) {
            if (options.dependencies) {
                for (const dependency of options.dependencies) {
                    if (this.dependencyGraph.has(dependency)) {
                        this.dependencyGraph.get(dependency)!.add(fieldId);
                    } else {
                        mlog.warn(`[FieldDependencyResolver.buildDependencyGraph()] Field '${fieldId}' depends on '${dependency}' which is not defined`);
                    }
                }
            }
        }
    }

    private resolveEvaluationOrder(): void {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const order: string[] = [];
        const DEFAULT_PRIORITY = 1000;
        
        const visit = (fieldId: string): void => {
            if (visiting.has(fieldId)) {
                throw new Error(`[FieldDependencyResolver.resolveEvaluationOrder()] Circular dependency detected involving field '${fieldId}'`);
            }
            if (visited.has(fieldId)) {
                return;
            }
            visiting.add(fieldId);
            const field = this.fieldOptions[fieldId];
            if (field.dependencies) {
                for (const dependency of field.dependencies) {
                    if (this.fieldOptions[dependency]) {
                        visit(dependency);
                    }
                }
            }
            visiting.delete(fieldId);
            visited.add(fieldId);
            order.push(fieldId);
        };

        const fieldsByPriority = Object.keys(this.fieldOptions).sort((a, b) => {
            const priorityA = this.fieldOptions[a].priority ?? DEFAULT_PRIORITY;
            const priorityB = this.fieldOptions[b].priority ?? DEFAULT_PRIORITY;
            return priorityA - priorityB;
        });
        
        for (const fieldId of fieldsByPriority) {
            visit(fieldId);
        }
        this.evaluationOrder = order;
    }

    getEvaluationOrder(): string[] {
        return [...this.evaluationOrder];
    }
}