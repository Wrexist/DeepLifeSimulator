import { GameStats } from '@/contexts/game/types';

export interface FamilyMemberNode {
  id: string;
  firstName: string;
  lastName: string;
  generation: number;
  birthYear: number;
  deathYear?: number;
  
  // Relationships (IDs)
  parents: string[]; 
  children: string[]; 
  spouse?: string; 
  
  // Legacy Data
  traits: string[]; // IDs of GeneticTraits
  finalStats?: Partial<GameStats>; // Snapshot of stats at death/transition
  occupation?: string;
  netWorth: number;
  causeOfDeath?: string;
  achievements?: string[]; // IDs or names
  
  // Visuals
  gender: 'male' | 'female';
  avatarSeed?: string; // For consistent character generation
}

export class FamilyTree {
  members: Record<string, FamilyMemberNode>;
  lineageId: string;

  constructor(lineageId: string) {
    this.members = {};
    this.lineageId = lineageId;
  }
  
  addMember(member: FamilyMemberNode) {
    this.members[member.id] = member;
  }
  
  getMember(id: string): FamilyMemberNode | undefined {
    return this.members[id];
  }
  
  getChildren(id: string): FamilyMemberNode[] {
    const member = this.members[id];
    if (!member) return [];
    return member.children
      .map(childId => this.members[childId])
      .filter((m): m is FamilyMemberNode => !!m)
      .sort((a, b) => a.birthYear - b.birthYear);
  }
  
  getParents(id: string): FamilyMemberNode[] {
    const member = this.members[id];
    if (!member) return [];
    return member.parents
      .map(parentId => this.members[parentId])
      .filter((m): m is FamilyMemberNode => !!m);
  }
  
  getSpouse(id: string): FamilyMemberNode | undefined {
    const member = this.members[id];
    if (!member || !member.spouse) return undefined;
    return this.members[member.spouse];
  }

  // Get all ancestors for a specific member (recursive)
  getAncestors(id: string, maxGenerations: number = 10): FamilyMemberNode[] {
    const ancestors: FamilyMemberNode[] = [];
    const queue: { id: string; depth: number }[] = [{ id, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift()!;
      
      if (depth >= maxGenerations) continue;
      
      const parents = this.getParents(currentId);
      for (const parent of parents) {
        if (!visited.has(parent.id)) {
          visited.add(parent.id);
          ancestors.push(parent);
          queue.push({ id: parent.id, depth: depth + 1 });
        }
      }
    }
    
    return ancestors.sort((a, b) => b.generation - a.generation);
  }

  toJSON() {
    return {
      members: this.members,
      lineageId: this.lineageId,
    };
  }

  static fromJSON(json: any): FamilyTree {
    const tree = new FamilyTree(json.lineageId);
    tree.members = json.members || {};
    return tree;
  }
}

