/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GuardPreset, WeaponCombatStats, StatusEffectType, HitReactionTier, CombatActionConfig, StatusEffectConfig } from "./CombatTypes";

export const COMBAT_TUNABLES = {
  // HP settings
  playerDefaultMaxHp: 1000,
  
  // Armor settings
  playerDefaultMaxArmor: 200,
  armorRegenDelaySecs: 5.0,     // begins after 5.0s of not taking damage
  armorRegenRatePerSec: 15.0,    // regenerates 15 armor/sec
  armorBrokenDamageMultiplier: 1.5, // 1.5x damage when broken
  armorBrokenStaggerMultiplier: 1.5, // 1.5x impact received
  armorBrokenRecoveryDelaySecs: 8.0, // recovers and resets armor to 50% max state after 8 seconds
  armorRestoreFactor: 0.5,        // restores 50% on recovery from break (new!)

  // Guard settings
  guardRestoreFactor: 0.3,        // restores 30% shield (new!)
  guardRegenDelaySecs: 4.0,       // delay before guard out-of-combat regen starts (new!)
  guardRegenRatePerSec: 10.0,     // regeneration per sec (new!)
  defaultGuardBreakDuration: 5.0, // default break duration (new!)
  guardImpactReductionFactor: 0.2, // guard blocks 80% impact (new!)

  // Energy stats
  playerDefaultMaxEn: 120,
  enRegenRatePerSec: 30.0,
  enRechargeDelaySecs: 0.8,     // delay after high EN spending action before regen starts

  // Heat stats
  playerDefaultMaxHeat: 100,
  heatDissipationRatePerSec: 15.0, // recovers heat/sec
  heatOverheatThreshold: 100,
  heatOverheatRecoverySecs: 5.0,  // cool cycle takes 5.0s
  overheatSpeedDebuffMult: 0.65,  // 35% speed penalty when overheated
  overheatDoTPerSec: 5.0,         // takes minor damage per second during overheat

  // Poise stats
  playerDefaultMaxPoise: 100,
  poiseRecoveryDelaySecs: 2.5,
  poiseRecoveryRatePerSec: 40.0,

  // Stagger stats
  playerDefaultMaxStaggerThreshold: 100,
  staggerDecayDelaySecs: 3.0,
  staggerDecayRatePerSec: 25.0,

  // Lock stats
  defaultLockRange: 35.0,
  defaultLockSpeed: 2.0, // speed to lock = 0.5s (1 / 2.0)
  defaultLockCount: 1,
  defaultLockRetentionSecs: 1.5, // lock stays for 1.5s after LOS loss (new!)

  // Enemy AI metrics (new!)
  enemyTurnSpeed: 3.5,
  enemyChaseSpeed: 3.0,
  enemyAttackCooldownMs: 1800,
  enemyAttackDamage: 45,

  // Status effect settings (new!)
  burnDamagePerTick: 15,
  corruptionDamagePerTick: 12,
  shockEnergyDrainPerTick: 5,
  bleedDamageMultiplier: 1.25,

  // Critical Damage multiplier
  defaultCritMultiplier: 1.5,

  // Enemy Default combat stats (new!)
  enemyDefaultMaxHp: 300,
  enemyDefaultMaxArmor: 50,
  enemyDefaultMaxEn: 50,
  enemyDefaultMaxPoise: 50,
  enemyDefaultMaxStaggerThreshold: 60,

  // Additional Config driven balance metrics (new!)
  overheatEnRegenPenaltyMult: 0.4,
  defaultInterruptLockoutSecs: 0.35,
  defaultCritChance: 0.10,
};

// Data-driven Status Effects Configurations (new!)
export const STATUS_EFFECT_CONFIGS: Record<string, StatusEffectConfig> = {
  [StatusEffectType.BURN]: {
    type: StatusEffectType.BURN,
    name: "Burn",
    description: "Thermal overload. Dealing periodic HP damage.",
    duration: 5.0,
    tickRate: 1.0,
    periodicDamage: { type: "hp", amount: 15 },
    regenPenalty: { type: "en", penaltyMultiplier: 0.4 }
  },
  [StatusEffectType.SHOCK]: {
    type: StatusEffectType.SHOCK,
    name: "Shock",
    description: "Electromagnetic disruption. Stunning system movement and draining EN.",
    duration: 3.5,
    tickRate: 1.0,
    periodicDrain: { type: "en", amount: 5 },
    speedMultiplier: 0.5,
    actionRestriction: "no_skills"
  },
  [StatusEffectType.CORRUPTION]: {
    type: StatusEffectType.CORRUPTION,
    name: "Corruption",
    description: "Nanite decay. Continuous Shield/Armor deterioration.",
    duration: 8.0,
    tickRate: 1.0,
    periodicDamage: { type: "armor", amount: 12 }
  },
  [StatusEffectType.BLEED]: {
    type: StatusEffectType.BLEED,
    name: "Bleed",
    description: "Structural damage. Amplifies incoming impact and critical susceptibility.",
    duration: 6.0,
    stackingRule: "refresh"
  },
  [StatusEffectType.SLOW]: {
    type: StatusEffectType.SLOW,
    name: "Slow",
    description: "Thruster inhibitors. Redline speed reduction by 35%.",
    duration: 4.5,
    speedMultiplier: 0.65
  },
  [StatusEffectType.BLIND]: {
    type: StatusEffectType.BLIND,
    name: "Blind",
    description: "Sensor calibration error. Cannot target lock targets.",
    duration: 5.0,
    lockModifier: "prevent_lock"
  },
  [StatusEffectType.SILENCE]: {
    type: StatusEffectType.SILENCE,
    name: "Silence",
    description: "Weapons control buffer. Cannot cast high resource skills.",
    duration: 5.0,
    actionRestriction: "no_skills"
  },
  [StatusEffectType.DISARM]: {
    type: StatusEffectType.DISARM,
    name: "Disarm",
    description: "Armaments decoupled. Standard ammunition disabled.",
    duration: 5.0,
    actionRestriction: "no_attacks"
  }
};

// Hit reaction duration metrics
export const HIT_REACTION_CONFIGS = {
  [HitReactionTier.TIER_0_NONE]: { duration: 0.0, interruptsMovement: false },
  [HitReactionTier.TIER_1_FLINCH]: { duration: 0.25, interruptsMovement: true },
  [HitReactionTier.TIER_2_STAGGER]: { duration: 0.65, interruptsMovement: true },
  [HitReactionTier.TIER_3_HEAVY_STAGGER]: { duration: 1.2, interruptsMovement: true },
  [HitReactionTier.TIER_4_KNOCKDOWN]: { duration: 2.0, interruptsMovement: true },
  [HitReactionTier.TIER_5_LAUNCH]: { duration: 1.8, interruptsMovement: true }
} as Record<HitReactionTier, { duration: number; interruptsMovement: boolean }>;

// Guard Presets list
export const GUARD_PRESETS: Record<string, GuardPreset> = {
  aegis_barrier: {
    id: "aegis_barrier",
    name: "Aegis Barrier",
    guardAngle: 120.0,            // defends within 120 degrees forward
    maxGuardIntegrity: 300,
    guardDamageReduction: 0.85,   // blocks 85% of damage
    guardBreakRecovery: 5.0        // cannot guard for 5 seconds after break
  },
  light_nano_shield: {
    id: "light_nano_shield",
    name: "Nano Deflector",
    guardAngle: 90.0,
    maxGuardIntegrity: 150,
    guardDamageReduction: 0.60,
    guardBreakRecovery: 3.0
  },
  heavy_chassis: {
    id: "heavy_chassis",
    name: "Heavy Bastion Shell",
    guardAngle: 180.0,
    maxGuardIntegrity: 500,
    guardDamageReduction: 0.95,
    guardBreakRecovery: 6.5
  }
};

// Combat attributes mapped to Weapon instances
export const WEAPON_COMBAT_STATS: Record<string, WeaponCombatStats> = {
  pulse_cannon: {
    id: "pulse_cannon",
    name: "Pulse Cannon",
    damage: 25,
    impact: 18,
    heatCost: 8,
    enCost: 0,
    reactionTier: HitReactionTier.TIER_1_FLINCH,
    critChance: 0.10,
    penetration: 0.0
  },
  vortex_rifle: {
    id: "vortex_rifle",
    name: "Gravity Vortex Rifle",
    damage: 65,
    impact: 45,
    heatCost: 28,
    enCost: 10,
    reactionTier: HitReactionTier.TIER_2_STAGGER,
    critChance: 0.15,
    penetration: 0.25
  },
  hyperion_gatling: {
    id: "hyperion_gatling",
    name: "Hyperion Laser-Gatling",
    damage: 8,
    impact: 5,
    heatCost: 4,
    enCost: 0,
    reactionTier: HitReactionTier.TIER_0_NONE,
    critChance: 0.05,
    penetration: 0.10
  },
  singular_lance: {
    id: "singular_lance",
    name: "Void Singularity Lance",
    damage: 450,
    impact: 120,
    heatCost: 90,
    enCost: 35,
    reactionTier: HitReactionTier.TIER_4_KNOCKDOWN,
    critChance: 0.25,
    penetration: 0.75
  }
};

// Actions Map - Startup, Active, Recovery configuration database
export const COMBAT_ACTIONS: Record<string, CombatActionConfig> = {
  pulse_multi_fire: {
    id: "pulse_multi_fire",
    name: "PULSE MULTI-FIRE",
    startup: 0.05,
    active: 0.05,
    recovery: 0.05,
    cancelable: true,
    poiseValue: 10,
    damage: 25,
    impact: 18,
    heatCost: 8,
    enCost: 0,
    reduceMovement: 0.8,
    allowDash: true,
    allowCancel: true,
    allowWeaponSwap: true,
  },
  dual_blade_slash: {
    id: "dual_blade_slash",
    name: "DUAL BLADE SLASH",
    startup: 0.12,
    active: 0.10,
    recovery: 0.10,
    cancelable: true,
    poiseValue: 35,
    damage: 120,
    impact: 45,
    heatCost: 12,
    enCost: 15,
    reactionTierOverride: HitReactionTier.TIER_1_FLINCH,
    reduceMovement: 0.4,
    lockFacing: true,
    allowDash: false,
    allowWeaponSwap: false,
  },
  fusion_gatling_charge: {
    id: "fusion_gatling_charge",
    name: "FUSION GATLING SPINUP",
    startup: 0.35,
    active: 0.45,
    recovery: 0.20,
    cancelable: true,
    poiseValue: 15,
    superArmor: false,
    damage: 13,
    impact: 6,
    heatCost: 5,
    enCost: 0,
    reduceMovement: 0.35,
    allowDash: true,
  },
  orbital_mortar_launch: {
    id: "orbital_mortar_launch",
    name: "ORBITAL CALIBRATION",
    startup: 0.50,
    active: 0.10,
    recovery: 0.40,
    cancelable: false,
    poiseValue: 80,
    superArmor: true,
    uninterruptible: false,
    damage: 250,
    impact: 95,
    heatCost: 40,
    enCost: 30,
    reactionTierOverride: HitReactionTier.TIER_3_HEAVY_STAGGER,
    lockMovement: true,
    lockFacing: true,
    allowDash: false,
    allowGuard: false,
    allowWeaponSwap: false,
  },
  aegis_shield_raise: {
    id: "aegis_shield_raise",
    name: "AEGIS SHIELD DEPLOY",
    startup: 0.08,
    active: 1.5,
    recovery: 0.15,
    cancelable: true,
    poiseValue: 95,
    superArmor: true,
    uninterruptible: true,
    enCost: 5,
    reduceMovement: 0.5,
    allowDash: true,
    allowGuard: true,
  },
  tactical_dash: {
    id: "tactical_dash",
    name: "THRUSTER DASH",
    startup: 0.0,
    active: 0.25,
    recovery: 0.10,
    cancelable: true,
    poiseValue: 200,
    superArmor: true,
    uninterruptible: true,
    enCost: 35,
    lockFacing: true,
    allowDash: false,
    allowGuard: false,
    allowWeaponSwap: false,
  }
};
