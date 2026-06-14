/**
 * Registry Contract Pattern
 *
 * Defines the standard contract that all registries must implement.
 * This is the v86 long-term contract pattern for registry consistency.
 * Copied verbatim from LumaWeave src/themes/registryContract.types.ts.
 */

export interface RegistryContract<TEntry, TQuery = Partial<TEntry>> {
  /** List all entries in the registry */
  list(): TEntry[];

  /** Get a single entry by ID */
  getById(id: string): TEntry | undefined;

  /** Filter entries by query criteria */
  filterByCategory(query: TQuery): TEntry[];

  /** Validate that an entry matches the expected shape */
  validateShape(entry: unknown): { valid: boolean; errors?: string[] };

  /** Register a new entry */
  register(entry: TEntry): void;

  /** Optional change subscription */
  subscribe?(listener: (entries: TEntry[]) => void): () => void;
}
