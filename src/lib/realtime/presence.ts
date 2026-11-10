import type { WorkspaceMember } from '../../types/crm';

export interface ViewerPresence {
  memberId: string;
  fullName: string;
  avatarUrl?: string;
  isTyping?: boolean;
}

export interface CollisionDetectionResult {
  isCollision: boolean;
  collidingMembers: string[];
  isAnyoneTyping: boolean;
}

/**
 * PresenceService manages agent collision avoidance and claim-on-reply routing:
 * - Detects when multiple agents are viewing or typing in the same conversation
 * - Automatically claims an unassigned or rival chat upon reply dispatch
 */
export class PresenceService {
  /**
   * Detects whether other agents are currently viewing or actively drafting a reply in the chat.
   */
  public static detectCollision(
    viewers: ViewerPresence[],
    currentMemberId: string
  ): CollisionDetectionResult {
    const otherViewers = viewers.filter((v) => v.memberId !== currentMemberId);

    const isCollision = otherViewers.length > 0;
    const collidingMembers = otherViewers.map((v) => v.fullName || v.memberId);
    const isAnyoneTyping = otherViewers.some((v) => v.isTyping === true);

    return {
      isCollision,
      collidingMembers,
      isAnyoneTyping,
    };
  }

  /**
   * Claim-on-reply: Automatically claims the conversation for the responding agent
   * to ensure clarity of ownership and prevent double responses.
   */
  public static claimOnReply<
    T extends { assignedTo?: string; assignedAgent?: Pick<WorkspaceMember, 'id' | 'fullName'> }
  >(
    conversation: T,
    agent: Pick<WorkspaceMember, 'id' | 'fullName'>
  ): T & { assignedTo: string; assignedAgent: Pick<WorkspaceMember, 'id' | 'fullName'> } {
    return {
      ...conversation,
      assignedTo: agent.id,
      assignedAgent: agent,
    };
  }
}
