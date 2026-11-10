/**
 * DemoIsolationService enforces strict isolation between sample/demo data and real production records:
 * - Guarantees sample records are explicitly flagged with `isDemo: true`
 * - Filters queries and reports to prevent demo records from leaking into production
 * - Purges ONLY demo records during "Clear Sample Data", leaving production records 100% untouched
 */
export class DemoIsolationService {
  /**
   * Filters out all demo/sample records, returning strictly production records.
   */
  public static filterProductionOnly<T extends { isDemo?: boolean }>(items: T[]): T[] {
    return items.filter((item) => item.isDemo !== true);
  }

  /**
   * Selectively purges ONLY records where isDemo === true.
   * Production records are guaranteed never to be deleted.
   */
  public static purgeDemoData<T extends { isDemo?: boolean }>(
    items: T[]
  ): { remaining: T[]; purgedCount: number } {
    const remaining = items.filter((item) => item.isDemo !== true);
    const purgedCount = items.length - remaining.length;

    return {
      remaining,
      purgedCount,
    };
  }

  /**
   * Tags an entity with the immutable demo flag.
   */
  public static tagAsDemo<T extends object>(item: T): T & { isDemo: true } {
    return {
      ...item,
      isDemo: true,
    };
  }
}
