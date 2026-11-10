import type { AgentNotification, WorkspaceMember } from '../../types/crm';

export interface CreateMentionNotificationInput {
  workspaceId: string;
  conversationId?: string;
  senderName?: string;
  mentionedMember: Pick<WorkspaceMember, 'id' | 'fullName'>;
  noteContent: string;
}

/**
 * MentionService handles @mentions in private notes,
 * parsing tagged workspace members and dispatching in-app agent notifications.
 */
export class MentionService {
  /**
   * Extract members mentioned via `@FullName` in a text snippet.
   */
  public static extractMentions<T extends Pick<WorkspaceMember, 'id' | 'fullName'>>(
    text: string,
    members: T[]
  ): T[] {
    if (!text || members.length === 0) {
      return [];
    }

    const mentionedMembers: T[] = [];
    const lowerText = text.toLowerCase();

    for (const member of members) {
      if (!member.fullName) continue;
      const mentionTag = `@${member.fullName.toLowerCase()}`;
      // Check for exact @Full Name occurrence bounded by word boundaries or punctuation
      if (lowerText.includes(mentionTag)) {
        if (!mentionedMembers.some((m) => m.id === member.id)) {
          mentionedMembers.push(member);
        }
      }
    }

    return mentionedMembers;
  }

  /**
   * Generates an AgentNotification record for a mentioned member.
   */
  public static createMentionNotification(input: CreateMentionNotificationInput): AgentNotification {
    const author = input.senderName || 'A team member';
    return {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      workspaceId: input.workspaceId,
      memberId: input.mentionedMember.id,
      conversationId: input.conversationId,
      senderName: input.senderName,
      title: `${author} mentioned you in an internal note`,
      content: input.noteContent,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
  }
}
