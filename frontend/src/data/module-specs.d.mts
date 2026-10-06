import type { ModuleSpec } from './types'

export const MODULE_SPECS: ModuleSpec[]
export const MODULE_SPEC_BY_KEY: Map<string, ModuleSpec>
export function getModuleSpec(key: string): ModuleSpec
