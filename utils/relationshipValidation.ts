/**
 * Relationship State Validation
 * 
 * Lightweight validation function to check relationship state invariants.
 * Used for debugging and state repair.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from './logger';

const log = logger.scope('RelationshipValidation');

export interface RelationshipValidationResult {
  isValid: boolean;
  issues: string[];
  repaired: boolean;
}

/**
 * Validate relationship state invariants
 */
export function validateRelationshipState(state: GameState): RelationshipValidationResult {
  const issues: string[] = [];
  
  // Check spouse consistency
  if (state.family?.spouse) {
    const spouseInRelationships = state.relationships?.find(
      r => r.id === state.family.spouse!.id && r.type === 'spouse'
    );
    if (!spouseInRelationships) {
      issues.push(`Spouse ${state.family.spouse.id} not found in relationships array`);
    } else if (spouseInRelationships.type !== 'spouse') {
      issues.push(`Spouse ${state.family.spouse.id} has incorrect type: ${spouseInRelationships.type}`);
    }
  }
  
  // Check for multiple spouses in relationships
  const spousesInRelationships = (state.relationships || []).filter(r => r.type === 'spouse');
  if (spousesInRelationships.length > 1) {
    issues.push(`Multiple spouses found in relationships array: ${spousesInRelationships.map(s => s.id).join(', ')}`);
  }
  
  // Check children consistency
  (state.family?.children || []).forEach(child => {
    const childInRelationships = state.relationships?.find(
      r => r.id === child.id && r.type === 'child'
    );
    if (!childInRelationships) {
      issues.push(`Child ${child.id} not found in relationships array`);
    } else if (childInRelationships.type !== 'child') {
      issues.push(`Child ${child.id} has incorrect type: ${childInRelationships.type}`);
    }
  });
  
  // Check for orphaned child relationships (in relationships but not in family.children)
  const childRelationships = (state.relationships || []).filter(r => r.type === 'child');
  childRelationships.forEach(childRel => {
    const inFamily = state.family?.children?.some(c => c.id === childRel.id);
    if (!inFamily) {
      issues.push(`Orphaned child relationship: ${childRel.id} in relationships but not in family.children`);
    }
  });
  
  // Check engagement/marriage properties
  (state.relationships || []).forEach(rel => {
    if (rel.type === 'spouse') {
      if (rel.engagementWeek !== undefined) {
        issues.push(`Spouse ${rel.id} has engagementWeek set (should be undefined)`);
      }
      if (rel.engagementRing !== undefined) {
        issues.push(`Spouse ${rel.id} has engagementRing set (should be undefined)`);
      }
      if (rel.weddingPlanned !== undefined) {
        issues.push(`Spouse ${rel.id} has weddingPlanned set (should be undefined)`);
      }
      if (rel.marriageWeek === undefined && rel.anniversaryWeek === undefined) {
        // This is a warning, not an error - spouse might have been added directly
        // issues.push(`Spouse ${rel.id} has no marriageWeek or anniversaryWeek`);
      }
    }
    if (rel.type !== 'spouse') {
      if (rel.marriageWeek !== undefined) {
        issues.push(`Non-spouse ${rel.id} has marriageWeek set (type: ${rel.type})`);
      }
      if (rel.anniversaryWeek !== undefined) {
        issues.push(`Non-spouse ${rel.id} has anniversaryWeek set (type: ${rel.type})`);
      }
    }
    if (rel.type !== 'partner' && rel.type !== 'spouse') {
      if (rel.engagementWeek !== undefined) {
        issues.push(`Non-partner/spouse ${rel.id} has engagementWeek set (type: ${rel.type})`);
      }
      if (rel.engagementRing !== undefined) {
        issues.push(`Non-partner/spouse ${rel.id} has engagementRing set (type: ${rel.type})`);
      }
      if (rel.weddingPlanned !== undefined) {
        issues.push(`Non-partner/spouse ${rel.id} has weddingPlanned set (type: ${rel.type})`);
      }
    }
  });
  
  // Check relationship score bounds
  (state.relationships || []).forEach(rel => {
    if (typeof rel.relationshipScore !== 'number' || isNaN(rel.relationshipScore)) {
      issues.push(`Relationship ${rel.id} has invalid relationshipScore: ${rel.relationshipScore}`);
    } else if (rel.relationshipScore < 0 || rel.relationshipScore > 100) {
      issues.push(`Relationship ${rel.id} has out-of-bounds relationshipScore: ${rel.relationshipScore}`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues,
    repaired: false,
  };
}

/**
 * Repair relationship state inconsistencies
 * 
 * This function attempts to repair common inconsistencies:
 * - Clear invalid engagement/marriage properties
 * - Remove orphaned relationships
 * - Fix type mismatches
 */
export function repairRelationshipState(state: GameState): GameState {
  let repaired = false;
  let relationships = [...(state.relationships || [])];
  let family = { ...state.family };
  
  // Repair engagement/marriage properties
  relationships = relationships.map(rel => {
    const repairedRel = { ...rel };
    
    // Clear engagement properties on spouses
    if (rel.type === 'spouse') {
      if (rel.engagementWeek !== undefined || rel.engagementRing !== undefined || rel.weddingPlanned !== undefined) {
        repairedRel.engagementWeek = undefined;
        repairedRel.engagementRing = undefined;
        repairedRel.weddingPlanned = undefined;
        repaired = true;
        log.warn('Cleared engagement properties on spouse', { relationshipId: rel.id });
      }
    }
    
    // Clear marriage properties on non-spouses
    if (rel.type !== 'spouse') {
      if (rel.marriageWeek !== undefined || rel.anniversaryWeek !== undefined) {
        repairedRel.marriageWeek = undefined;
        repairedRel.anniversaryWeek = undefined;
        repaired = true;
        log.warn('Cleared marriage properties on non-spouse', { relationshipId: rel.id, type: rel.type });
      }
    }
    
    // Clear engagement properties on non-partners/spouses
    if (rel.type !== 'partner' && rel.type !== 'spouse') {
      if (rel.engagementWeek !== undefined || rel.engagementRing !== undefined || rel.weddingPlanned !== undefined) {
        repairedRel.engagementWeek = undefined;
        repairedRel.engagementRing = undefined;
        repairedRel.weddingPlanned = undefined;
        repaired = true;
        log.warn('Cleared engagement properties on non-partner/spouse', { relationshipId: rel.id, type: rel.type });
      }
    }
    
    // Fix relationship score bounds
    if (typeof rel.relationshipScore !== 'number' || isNaN(rel.relationshipScore)) {
      repairedRel.relationshipScore = 50;
      repaired = true;
      log.warn('Fixed invalid relationshipScore', { relationshipId: rel.id });
    } else if (rel.relationshipScore < 0) {
      repairedRel.relationshipScore = 0;
      repaired = true;
      log.warn('Clamped relationshipScore to 0', { relationshipId: rel.id });
    } else if (rel.relationshipScore > 100) {
      repairedRel.relationshipScore = 100;
      repaired = true;
      log.warn('Clamped relationshipScore to 100', { relationshipId: rel.id });
    }
    
    return repairedRel;
  });
  
  // Remove orphaned child relationships (in relationships but not in family.children)
  const childIdsInFamily = new Set((family.children || []).map(c => c.id));
  const orphanedChildren = relationships.filter(r => r.type === 'child' && !childIdsInFamily.has(r.id));
  if (orphanedChildren.length > 0) {
    relationships = relationships.filter(r => !(r.type === 'child' && !childIdsInFamily.has(r.id)));
    repaired = true;
    log.warn('Removed orphaned child relationships', { count: orphanedChildren.length });
  }
  
  // Remove children from family.children that aren't in relationships
  if (family.children) {
    const relationshipIds = new Set(relationships.map(r => r.id));
    const originalCount = family.children.length;
    family.children = family.children.filter(c => {
      const inRelationships = relationshipIds.has(c.id);
      if (!inRelationships) {
        log.warn('Removed child from family.children (not in relationships)', { childId: c.id });
      }
      return inRelationships;
    });
    if (family.children.length !== originalCount) {
      repaired = true;
    }
  }
  
  // Fix spouse consistency
  if (family.spouse) {
    const spouseInRelationships = relationships.find(r => r.id === family.spouse!.id && r.type === 'spouse');
    if (!spouseInRelationships) {
      family.spouse = undefined;
      repaired = true;
      log.warn('Cleared family.spouse (not found in relationships)', { spouseId: family.spouse.id });
    } else if (spouseInRelationships.type !== 'spouse') {
      family.spouse = undefined;
      repaired = true;
      log.warn('Cleared family.spouse (incorrect type)', { spouseId: family.spouse.id, actualType: spouseInRelationships.type });
    }
  }
  
  // Remove duplicate spouses (keep first one)
  const spouses = relationships.filter(r => r.type === 'spouse');
  if (spouses.length > 1) {
    const firstSpouse = spouses[0];
    relationships = relationships.filter(r => !(r.type === 'spouse' && r.id !== firstSpouse.id));
    if (family.spouse && family.spouse.id !== firstSpouse.id) {
      family.spouse = firstSpouse;
    }
    repaired = true;
    log.warn('Removed duplicate spouses', { keptSpouseId: firstSpouse.id, removedCount: spouses.length - 1 });
  }
  
  return {
    ...state,
    relationships,
    family,
  };
}

