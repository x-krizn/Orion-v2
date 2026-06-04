/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3 } from "@babylonjs/core";

// Hit Reaction Tiers
export enum HitReactionTier {
  TIER_0_NONE = 0,
  TIER_1_FLINCH = 1,
  TIER_2_STAGGER = 2,
  TIER_3_HEAVY_STAGGER = 3,
  TIER_4_KNOCKDOWN = 4,
  TIER_5_LAUNCH = 5,
}

// Lock States
export enum LockState {
  NO_LOCK = "No Lock",
  ACQUIRING = "Acquiring",
  LOCKED = "Locked",
  BROKEN = "Broken",
}

// Action States
export enum ActionState {
  NEUTRAL = "Neutral",
  ACQUISITION = "Acquisition",
  COMMITMENT = "Commitment",
  ACTIVE = "Active",
  RECOVERY = "Recovery",
  INTERRUPTED = "Interrupted",
}

// Status Effect Types
export enum StatusEffectType {
  BURN = "Burn",
  SHOCK = "Shock",
  CORRUPTION = "Corruption",
  BLEED = "Bleed",
  SLOW = "Slow",
  BLIND = "Blind",
  SILENCE = "Silence",
  DISARM = "Disarm",
}

// Action Frame Data / Combat Action definition
export interface CombatActionConfig {
  id: string;
  name: string;
  startup: number;          // duration of startup phase (seconds)
  active: number;           // duration of active phase (seconds)
  recovery: number;         // duration of recovery phase (seconds)
  cancelWindowStart?: number; // seconds after start of action when it can be canceled by input or another action
  cancelable: boolean;      // support universal cancel 'X'
  poiseValue: number;       // poise rating during this action's commitment
  superArmor?: boolean;     // if true, ignores interruption (impact won't break action)
  uninterruptible?: boolean; // if true, cannot be interrupted by any hit reaction except knockdown/launch
  hpCost?: number;
  enCost?: number;          // Energy consumption
  heatCost?: number;        // Heat generation
  damage?: number;
  impact?: number;          // Stagger impact
  reactionTierOverride?: HitReactionTier;
}

// Complete Dynamic Combat State for Entities
export interface CombatEntityState {
  // Primary Resources
  hp: number;
  maxHp: number;
  
  armor: number;
  maxArmor: number;
  isArmorBroken: boolean;
  armorBreakTimer: number; // remaining broken recovery duration
  timeSinceDamage: number; // to track regeneration
  
  en: number;
  maxEn: number;
  enRechargeDelayTimer: number;
  
  heat: number;
  maxHeat: number;
  isOverheated: boolean;
  overheatCooldownTimer: number; // coolant phase timer

  // Poise of commitment
  poise: number;
  maxPoise: number;
  poiseRecoveryDelayTimer: number;

  // Stagger accumulation
  staggerAccumulation: number;
  staggerThreshold: number;
  staggerDecayDelayTimer: number;
  currentStaggerDuration: number; // if staggered (positive means staggered)
  
  // Guard system active defensive resources
  guardActive: boolean;
  guardAngle: number;         // defense sweep angle (e.g., 120 deg)
  guardIntegrity: number;     // shield HP
  maxGuardIntegrity: number;  // max shield HP
  guardDamageReduction: number; // e.g. 0.8 (80%)
  isGuardBroken: boolean;
  guardBreakTimer: number;    // guard disable timer after break

  // Action State
  actionState: ActionState;
  currentAction: CombatActionConfig | null;
  actionPhaseTimer: number;    // countdown of current active action state
  isActionCharged?: boolean;   // for charged attacks

  // Lock status details
  lockState: LockState;
  lockTargetId: string | null; // ID of target node or entity
  lockProgress: number;        // 0 to 1 for Acquiring

  // Hit reaction state
  currentReactionTier: HitReactionTier;
  reactionRecoveryTimer: number; // time left stuck in reaction

  // List of active status effects
  activeEffects: ActiveStatusEffectInstance[];
}

// Active Status Effect instance details
export interface ActiveStatusEffectInstance {
  type: StatusEffectType;
  name: string;
  description: string;
  duration: number;        // in seconds
  elapsed: number;
  tickTimer: number;       // ticks for DoT
  severity: number;        // strength metric (multiplier or value)
}

// Weapon Data-driven Balance parameters
export interface WeaponCombatStats {
  id: string;
  name: string;
  damage: number;
  impact: number;
  heatCost: number;
  enCost: number;
  reactionTier: HitReactionTier;
  critChance: number;      // e.g. 0.15 for 15%
  penetration: number;     // percentage of armor/guard ignored
}

// Guard Style specifications
export interface GuardPreset {
  id: string;
  name: string;
  guardAngle: number;
  maxGuardIntegrity: number;
  guardDamageReduction: number;
  guardBreakRecovery: number;
}
