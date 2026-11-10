import type { WorkspaceMember } from '../../types/crm';

export interface RoundRobinState {
  lastIndex: number;
}

export interface MinimalConversation {
  id?: string;
  assignedTo?: string;
}

/**
 * AssignmentService manages conversational workload balancing,
 * supporting round-robin and least-loaded routing across online agents.
 */
export class AssignmentService {
  /**
   * Assign via Round-Robin cycling through online agents only.
   */
  public static assignRoundRobin<T extends Pick<WorkspaceMember, 'id'> & { isOnline?: boolean }>(
    agents: T[],
    state: RoundRobinState
  ): T | null {
    const onlineAgents = agents.filter((a) => a.isOnline === true);
    if (onlineAgents.length === 0) {
      return null;
    }

    const nextIndex = (state.lastIndex + 1) % onlineAgents.length;
    state.lastIndex = nextIndex;
    return onlineAgents[nextIndex];
  }

  /**
   * Assign to the online agent with the fewest active assigned conversations.
   */
  public static assignLeastLoaded<T extends Pick<WorkspaceMember, 'id'> & { isOnline?: boolean }>(
    agents: T[],
    conversations: MinimalConversation[]
  ): T | null {
    const onlineAgents = agents.filter((a) => a.isOnline === true);
    if (onlineAgents.length === 0) {
      return null;
    }

    // Count open conversations per agent
    const loadMap = new Map<string, number>();
    for (const agent of onlineAgents) {
      loadMap.set(agent.id, 0);
    }

    for (const conv of conversations) {
      if (conv.assignedTo && loadMap.has(conv.assignedTo)) {
        loadMap.set(conv.assignedTo, (loadMap.get(conv.assignedTo) ?? 0) + 1);
      }
    }

    // Find agent with minimum load
    let selectedAgent = onlineAgents[0];
    let minLoad = loadMap.get(selectedAgent.id) ?? 0;

    for (let i = 1; i < onlineAgents.length; i++) {
      const agent = onlineAgents[i];
      const load = loadMap.get(agent.id) ?? 0;
      if (load < minLoad) {
        minLoad = load;
        selectedAgent = agent;
      }
    }

    return selectedAgent;
  }
}
