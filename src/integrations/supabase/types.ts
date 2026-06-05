// Public evaluation placeholder.
// Production database table types are intentionally not included in this package.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = Record<string, never>;
