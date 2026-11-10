import type { CannedReply } from '../../types/crm';

/**
 * CannedReplyService handles workspace-level quick response macros,
 * slash-command trigger searching, and template placeholder interpolation.
 */
export class CannedReplyService {
  /**
   * Search canned replies by slash command or query string.
   * Strips leading slash if present (e.g., "/ref" -> "ref").
   */
  public static search(cannedReplies: CannedReply[], query: string): CannedReply[] {
    if (!query) return cannedReplies;

    const normalized = query.trim().startsWith('/')
      ? query.trim().substring(1).toLowerCase()
      : query.trim().toLowerCase();

    if (!normalized) return cannedReplies;

    return cannedReplies.filter((reply) => {
      const shortcutMatch = reply.shortcut.toLowerCase().includes(normalized);
      const titleMatch = reply.title.toLowerCase().includes(normalized);
      return shortcutMatch || titleMatch;
    }).sort((a, b) => {
      const aStarts = a.shortcut.toLowerCase().startsWith(normalized);
      const bStarts = b.shortcut.toLowerCase().startsWith(normalized);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * Interpolate variable placeholders like {{contact_name}}, {{agent_name}}
   */
  public static interpolate(content: string, vars: Record<string, string>): string {
    return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
      if (key in vars && vars[key] !== undefined) {
        return vars[key];
      }
      return match;
    });
  }
}
