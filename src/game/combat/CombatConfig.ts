/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GuardPreset, WeaponCombatStats, StatusEffectType, HitReactionTier, CombatActionConfig } from "./CombatTypes";

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

  // Critical Damage multiplier
  defaultCritMultiplier: 1.5
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
    enCost: 0
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
    reactionTierOverride: HitReactionTier.TIER_1_FLINCH
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
    enCost: 0
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
    reactionTierOverride: HitReactionTier.TIER_3_HEAVY_STAGGER
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
    enCost: 5 // per tick or start
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
    enCost: 35
  }
};
