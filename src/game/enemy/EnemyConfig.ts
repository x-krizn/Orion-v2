/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum EnemyAIState {
  IDLE = "idle",
  PATROL = "patrol",
  AGGRO = "aggro",
  CHASE = "chase",
  ATTACK = "attack",
  RECOVERY = "recovery",
  DEAD = "dead"
}

export interface EnemyBehaviorProfile {
  enemyId: string;
  aggroRange: number;       // Radius within which it notices player
  deaggroRange: number;     // Radius beyond which it loses aggro / returns to patrol
  attackRange: number;      // Distance required to perform attacks
  attackCooldown: number;   // Delay between actions in seconds
  recoveryDuration: number; // Time in seconds spent recovering post-strike
  patrolSpeedMult: number;  // Speed multiplier while patrolling
  chaseSpeedMult: number;   // Speed multiplier while chasing
  patrolRadius: number;     // Distance from initial spawn point to patrol around
  isRanged: boolean;        // Ranged vs Melee combat style
}

export const ENEMY_BEHAVIOR_PROFILES: Record<string, EnemyBehaviorProfile> = {
  orc_raider: {
    enemyId: "orc_raider",
    aggroRange: 15,
    deaggroRange: 24,
    attackRange: 3.2,
    attackCooldown: 1.6,
    recoveryDuration: 0.6,
    patrolSpeedMult: 0.4,
    chaseSpeedMult: 1.0,
    patrolRadius: 6.0,
    isRanged: false
  },
  bog_hound: {
    enemyId: "bog_hound",
    aggroRange: 18,
    deaggroRange: 26,
    attackRange: 2.5,
    attackCooldown: 1.1,
    recoveryDuration: 0.4,
    patrolSpeedMult: 0.5,
    chaseSpeedMult: 1.3,
    patrolRadius: 8.0,
    isRanged: false
  },
  wurmling: {
    enemyId: "wurmling",
    aggroRange: 16,
    deaggroRange: 25,
    attackRange: 12.0,
    attackCooldown: 2.2,
    recoveryDuration: 0.8,
    patrolSpeedMult: 0.3,
    chaseSpeedMult: 0.8,
    patrolRadius: 4.0,
    isRanged: true
  },
  wurm_boss: {
    enemyId: "wurm_boss",
    aggroRange: 30,
    deaggroRange: 45,
    attackRange: 15.0,
    attackCooldown: 2.0,
    recoveryDuration: 1.0,
    patrolSpeedMult: 0.3,
    chaseSpeedMult: 0.9,
    patrolRadius: 10.0,
    isRanged: true
  }
};

/**
 * Returns behavior profile for a given enemy ID or defaults to an orc_raider-like fallback
 */
export function getBehaviorProfileForId(enemyId: string): EnemyBehaviorProfile {
  return ENEMY_BEHAVIOR_PROFILES[enemyId] || {
    enemyId: enemyId,
    aggroRange: 15,
    deaggroRange: 24,
    attackRange: 3.2,
    attackCooldown: 1.8,
    recoveryDuration: 0.6,
    patrolSpeedMult: 0.4,
    chaseSpeedMult: 1.0,
    patrolRadius: 6.0,
    isRanged: false
  };
}
