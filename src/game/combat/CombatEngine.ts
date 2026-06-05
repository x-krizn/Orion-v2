/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3, Tools } from "@babylonjs/core";
import { 
  CombatEntityState, 
  ActionState, 
  HitReactionTier, 
  LockState, 
  StatusEffectType, 
  ActiveStatusEffectInstance, 
  WeaponCombatStats,
  CombatActionConfig
} from "./CombatTypes";
import { COMBAT_TUNABLES, HIT_REACTION_CONFIGS, STATUS_EFFECT_CONFIGS } from "./CombatConfig";

export interface DamageResolutionResult {
  hitConfirmed: boolean;
  isCrit: boolean;
  damageBeforeGuard: number;
  damageDealtToGuard: number;
  damageDealtToArmor: number;
  damageDealtToHp: number;
  impactApplied: boolean;
  staggerPressureAdded: number;
  staggerResetOccurred: boolean;
  actionInterrupted: boolean;
  resultReactionTier: HitReactionTier;
  guardBroken: boolean;
  armorBroken: boolean;
  hpRemaining: number;
}

export class CombatEngine {
  /**
   * Initializes a default combat state for the player or an enemy combatant
   */
  public static createDefaultCombatState(isPlayer: boolean, data?: { maxHp?: number, scale?: number }): CombatEntityState {
    const defaultHp = data?.maxHp || (isPlayer ? COMBAT_TUNABLES.playerDefaultMaxHp : COMBAT_TUNABLES.enemyDefaultMaxHp);
    const defaultArmor = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxArmor : COMBAT_TUNABLES.enemyDefaultMaxArmor;
    const defaultEn = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxEn : COMBAT_TUNABLES.enemyDefaultMaxEn;
    const defaultHeat = 0;
    const defaultPoise = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxPoise : COMBAT_TUNABLES.enemyDefaultMaxPoise;
    const defaultStaggerThreshold = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxStaggerThreshold : COMBAT_TUNABLES.enemyDefaultMaxStaggerThreshold;

    return {
      hp: defaultHp,
      maxHp: defaultHp,
      
      armor: defaultArmor,
      maxArmor: defaultArmor,
      isArmorBroken: false,
      armorBreakTimer: 0,
      timeSinceDamage: 99.0, // Initial safe state
      
      en: defaultEn,
      maxEn: defaultEn,
      enRechargeDelayTimer: 0,
      
      heat: defaultHeat,
      maxHeat: COMBAT_TUNABLES.playerDefaultMaxHeat,
      isOverheated: false,
      overheatCooldownTimer: 0,

      poise: defaultPoise,
      maxPoise: defaultPoise,
      poiseRecoveryDelayTimer: 0,

      staggerAccumulation: 0,
      staggerThreshold: defaultStaggerThreshold,
      staggerDecayDelayTimer: 0,
      currentStaggerDuration: 0,

      guardActive: false,
      guardAngle: 120.0,
      guardIntegrity: 200,
      maxGuardIntegrity: 200,
      guardDamageReduction: 0.80, // 80% default reduction
      isGuardBroken: false,
      guardBreakTimer: 0,

      actionState: ActionState.NEUTRAL,
      currentAction: null,
      actionPhaseTimer: 0,

      lockState: LockState.NO_LOCK,
      lockTargetId: null,
      lockProgress: 0,

      currentReactionTier: HitReactionTier.TIER_0_NONE,
      reactionRecoveryTimer: 0,

      activeEffects: []
    };
  }

  /**
   * Performs the modular update tick on a combatant's resources and timer decay
   */
  public static updateCombatState(
    state: CombatEntityState, 
    deltaTimeSecs: number, 
    isOverheatedChanged?: (overheated: boolean) => void
  ): void {
    // 1. Time since damage accumulator
    state.timeSinceDamage += deltaTimeSecs;

    // 2. Active Status Effects ticking
    CombatEngine.tickStatusEffects(state, deltaTimeSecs);

    // Filter out decayed status effects
    state.activeEffects = state.activeEffects.filter(e => e.duration > 0);

    // 3. Action Phase state machine ticking & recovery (Startup -> Active -> Recovery)
    if (state.currentAction) {
      if (state.actionPhaseTimer > 0) {
        state.actionPhaseTimer -= deltaTimeSecs;
        if (state.actionPhaseTimer <= 0) {
          const action = state.currentAction;
          if (state.actionState === ActionState.STARTUP) {
            // Transition from Startup to Active!
            state.actionState = ActionState.ACTIVE;
            state.actionPhaseTimer = action.active;
            
            // Pay action costs at Active phase if specified in metadata
            if ((action as any).payCostAtActive) {
              if (action.enCost) {
                state.en = Math.max(0, state.en - action.enCost);
              }
              if (action.heatCost) {
                state.heat = Math.min(state.maxHeat, state.heat + action.heatCost);
              }
            }

            console.log(`[Combat Phase Transition]: Action "${action.name}" -> ACTIVE (${state.actionPhaseTimer}s)`);
          } else if (state.actionState === ActionState.ACTIVE) {
            // Transition from Active to Recovery!
            state.actionState = ActionState.RECOVERY;
            state.actionPhaseTimer = action.recovery;
            console.log(`[Combat Phase Transition]: Action "${action.name}" -> RECOVERY (${state.actionPhaseTimer}s)`);
          } else {
            // Transition from Recovery -> Neutral
            state.actionState = ActionState.NEUTRAL;
            state.currentAction = null;
            console.log(`[Combat Phase Transition]: Action "${action.name}" completed. Return to NEUTRAL.`);
          }
        }
      }
    } else if (state.actionState === ActionState.INTERRUPTED) {
      if (state.actionPhaseTimer > 0) {
        state.actionPhaseTimer -= deltaTimeSecs;
        if (state.actionPhaseTimer <= 0) {
          state.actionState = ActionState.NEUTRAL;
          console.log(`[Combat Phase Transition]: Interruption lockout ended. Return to NEUTRAL.`);
        }
      }
    }

    // Dynamic Guard Active mapping based on action and phase
    if (state.currentAction && state.actionState === ActionState.ACTIVE && state.currentAction.allowGuard) {
      state.guardActive = true;
    } else {
      state.guardActive = false;
    }

    // 4. Hit reaction recovery
    if (state.reactionRecoveryTimer > 0) {
      state.reactionRecoveryTimer -= deltaTimeSecs;
      if (state.reactionRecoveryTimer <= 0) {
        state.currentReactionTier = HitReactionTier.TIER_0_NONE;
      }
    }

    // 5. Armor Break state tick
    if (state.isArmorBroken) {
      state.armorBreakTimer -= deltaTimeSecs;
      if (state.armorBreakTimer <= 0) {
        state.isArmorBroken = false;
        state.armor = state.maxArmor * COMBAT_TUNABLES.armorRestoreFactor;
        console.log(`[Combat Engine]: Armor Broken state ended. Restored ${(COMBAT_TUNABLES.armorRestoreFactor * 100).toFixed(0)}% Shield Capacity.`);
      }
    } else {
      // Armor regeneration if untouched and not broken (taking status effect dampener into account!)
      if (state.timeSinceDamage >= COMBAT_TUNABLES.armorRegenDelaySecs && state.armor < state.maxArmor) {
        const regenMult = CombatEngine.getRegenMultiplier(state, "armor");
        state.armor = Math.min(state.maxArmor, state.armor + COMBAT_TUNABLES.armorRegenRatePerSec * deltaTimeSecs * regenMult);
      }
    }

    // 6. Guard break cooldown logic
    if (state.isGuardBroken) {
      state.guardBreakTimer -= deltaTimeSecs;
      if (state.guardBreakTimer <= 0) {
        state.isGuardBroken = false;
        state.guardIntegrity = state.maxGuardIntegrity * COMBAT_TUNABLES.guardRestoreFactor;
        console.log(`[Combat Engine]: Guard Integrity recovered from broken cooldown.`);
      }
    } else {
      // Shield integrity out-of-combat regeneration
      if (state.timeSinceDamage >= COMBAT_TUNABLES.guardRegenDelaySecs && state.guardIntegrity < state.maxGuardIntegrity) {
        const regenMult = CombatEngine.getRegenMultiplier(state, "guard");
        state.guardIntegrity = Math.min(state.maxGuardIntegrity, state.guardIntegrity + COMBAT_TUNABLES.guardRegenRatePerSec * deltaTimeSecs * regenMult);
      }
    }

    // 7. Overheat cycle cooling
    if (state.isOverheated) {
      state.overheatCooldownTimer -= deltaTimeSecs;
      state.heat = Math.max(0, state.maxHeat * (state.overheatCooldownTimer / COMBAT_TUNABLES.heatOverheatRecoverySecs));
      // Heat DOT when overheating
      state.hp = Math.max(1, state.hp - COMBAT_TUNABLES.overheatDoTPerSec * deltaTimeSecs);
      if (state.overheatCooldownTimer <= 0) {
        state.isOverheated = false;
        state.heat = 0;
        console.log("[Combat Engine]: Coolant process complete. Weapons systems restored.");
        if (isOverheatedChanged) isOverheatedChanged(false);
      }
    } else {
      // Standard heat dissipation
      if (state.heat > 0) {
        state.heat = Math.max(0, state.heat - COMBAT_TUNABLES.heatDissipationRatePerSec * deltaTimeSecs);
      }
    }

    // 8. Energy regeneration
    if (state.enRechargeDelayTimer > 0) {
      state.enRechargeDelayTimer -= deltaTimeSecs;
    } else {
      if (state.en < state.maxEn) {
        const regenMult = CombatEngine.getRegenMultiplier(state, "en");
        state.en = Math.min(state.maxEn, state.en + COMBAT_TUNABLES.enRegenRatePerSec * deltaTimeSecs * regenMult);
      }
    }

    // 9. Poise recovery
    if (state.poiseRecoveryDelayTimer > 0) {
      state.poiseRecoveryDelayTimer -= deltaTimeSecs;
    } else {
      if (state.poise < state.maxPoise) {
        state.poise = Math.min(state.maxPoise, state.poise + COMBAT_TUNABLES.poiseRecoveryRatePerSec * deltaTimeSecs);
      }
    }

    // 10. Stagger pressure decay
    if (state.staggerDecayDelayTimer > 0) {
      state.staggerDecayDelayTimer -= deltaTimeSecs;
    } else {
      if (state.staggerAccumulation > 0) {
        state.staggerAccumulation = Math.max(0, state.staggerAccumulation - COMBAT_TUNABLES.staggerDecayRatePerSec * deltaTimeSecs);
      }
    }
  }

  /**
   * Applies a custom Status Effect to an entity's dynamic registry (Fully Data-driven!)
   */
  public static applyStatusEffect(state: CombatEntityState, type: StatusEffectType, duration: number, severity: number = 1.0): void {
    const config = STATUS_EFFECT_CONFIGS[type];
    if (!config) return;

    const exists = state.activeEffects.find(e => e.type === type);
    if (exists) {
      const stacking = config.stackingRule || "refresh";
      if (stacking === "refresh") {
        exists.duration = Math.max(exists.duration, duration);
        exists.severity = Math.max(exists.severity, severity);
      } else if (stacking === "add") {
        exists.duration += duration;
        exists.severity = Math.max(exists.severity, severity);
      }
    } else {
      state.activeEffects.push({
        type,
        name: config.name,
        description: config.description,
        duration,
        elapsed: 0,
        tickTimer: 0,
        severity
      });
    }
  }

  /**
   * Status Effects tick logic loop (Data-Driven generic runner!)
   */
  private static tickStatusEffects(state: CombatEntityState, deltaTime: number): void {
    state.activeEffects.forEach(effect => {
      effect.duration -= deltaTime;
      effect.elapsed += deltaTime;
      effect.tickTimer += deltaTime;

      const config = STATUS_EFFECT_CONFIGS[effect.type];
      if (!config) return;

      const rate = config.tickRate || 1.0;
      if (effect.tickTimer >= rate) {
        effect.tickTimer -= rate;

        // Apply periodic damage
        if (config.periodicDamage) {
          const amount = config.periodicDamage.amount * effect.severity;
          if (config.periodicDamage.type === "hp") {
            state.hp = Math.max(1, state.hp - amount);
            console.log(`[Status Pulse]: ${config.name} tick deals ${amount.toFixed(0)} HP damage.`);
          } else if (config.periodicDamage.type === "armor") {
            if (state.armor > 0) {
              state.armor = Math.max(0, state.armor - amount);
              console.log(`[Status Pulse]: ${config.name} tick decays ${amount.toFixed(0)} Armor.`);
            }
          } else if (config.periodicDamage.type === "en") {
            state.en = Math.max(0, state.en - amount);
          }
        }

        // Apply periodic drain
        if (config.periodicDrain) {
          const amount = config.periodicDrain.amount * effect.severity;
          if (config.periodicDrain.type === "en") {
            state.en = Math.max(0, state.en - amount);
            console.log(`[Status Pulse]: ${config.name} tick drains ${amount.toFixed(0)} EN.`);
          }
        }
      }
    });
  }

  /**
   * Static Getters for Modifiers (Data-driven)
   */
  public static getSpeedMultiplier(state: CombatEntityState): number {
    let multiplier = 1.0;
    if (state.isOverheated) {
      multiplier *= COMBAT_TUNABLES.overheatSpeedDebuffMult;
    }
    state.activeEffects.forEach(effect => {
      const config = STATUS_EFFECT_CONFIGS[effect.type];
      if (config && config.speedMultiplier !== undefined) {
        multiplier *= config.speedMultiplier;
      }
    });
    return multiplier;
  }

  public static getRegenMultiplier(state: CombatEntityState, type: "en" | "armor" | "guard"): number {
    let multiplier = 1.0;
    if (type === "en" && state.isOverheated) {
      multiplier *= COMBAT_TUNABLES.overheatEnRegenPenaltyMult;
    }
    state.activeEffects.forEach(effect => {
      const config = STATUS_EFFECT_CONFIGS[effect.type];
      if (config && config.regenPenalty && config.regenPenalty.type === type) {
        multiplier *= config.regenPenalty.penaltyMultiplier;
      }
    });
    return multiplier;
  }

  public static isActionRestricted(state: CombatEntityState, restriction: "no_skills" | "no_attacks" | "no_movement" | "all"): boolean {
    return state.activeEffects.some(effect => {
      const config = STATUS_EFFECT_CONFIGS[effect.type];
      return config && (config.actionRestriction === restriction || config.actionRestriction === "all");
    });
  }

  public static isTargetLockPrevented(state: CombatEntityState): boolean {
    return state.activeEffects.some(effect => {
      const config = STATUS_EFFECT_CONFIGS[effect.type];
      return config && config.lockModifier === "prevent_lock";
    });
  }

  /**
   * The core Damage Resolution Pipeline.
   * Processes attacks, locks, shields, armor absorption, and poise stagger thresholds modularly.
   */
  public static resolveDamagePipeline(
    attackerState: CombatEntityState,
    attackerPos: Vector3,
    targetState: CombatEntityState,
    targetPos: Vector3,
    targetRotationY: number,
    baseDamage: number,
    baseImpact: number,
    weaponStats?: WeaponCombatStats
  ): DamageResolutionResult {
    let output: DamageResolutionResult = {
      hitConfirmed: true,
      isCrit: false,
      damageBeforeGuard: baseDamage,
      damageDealtToGuard: 0,
      damageDealtToArmor: 0,
      damageDealtToHp: 0,
      impactApplied: true,
      staggerPressureAdded: baseImpact,
      staggerResetOccurred: false,
      actionInterrupted: false,
      resultReactionTier: HitReactionTier.TIER_0_NONE,
      guardBroken: false,
      armorBroken: false,
      hpRemaining: targetState.hp
    };

    // 1. Evaluate Critical Hit chance
    const critChance = weaponStats?.critChance || COMBAT_TUNABLES.defaultCritChance;
    const isCrit = Math.random() < critChance;
    output.isCrit = isCrit;

    let finalDamage = baseDamage;
    if (isCrit) {
      finalDamage *= COMBAT_TUNABLES.defaultCritMultiplier;
    }

    // Process Status modifiers (Slow slows actions, Bleed increases crit damage, etc.)
    const hasBleed = targetState.activeEffects.some(e => e.type === StatusEffectType.BLEED);
    if (hasBleed) {
      finalDamage *= COMBAT_TUNABLES.bleedDamageMultiplier; // 25% damage boost if bleeding (fully config driven!)
    }

    output.damageBeforeGuard = finalDamage;

    // 2. Resolve Active Guard Shielding
    let finalImpact = baseImpact;
    let guardBlocked = false;

    if (targetState.guardActive && !targetState.isGuardBroken) {
      // Check guard angle
      const toAttacker = attackerPos.subtract(targetPos);
      toAttacker.y = 0;
      toAttacker.normalize();

      // Guarding rotation face forward
      const targetForward = new Vector3(Math.sin(targetRotationY), 0, Math.cos(targetRotationY));
      targetForward.normalize();

      const dot = Vector3.Dot(toAttacker, targetForward);
      const angle = Math.acos(dot) * (180 / Math.PI); // degrees

      if (angle <= targetState.guardAngle / 2) {
        guardBlocked = true;

        // Apply reduction factor
        const blockedDamage = finalDamage * targetState.guardDamageReduction;
        const remainderDamage = finalDamage - blockedDamage;

        output.damageDealtToGuard = blockedDamage;
        targetState.guardIntegrity -= blockedDamage;

        finalDamage = remainderDamage;
        finalImpact *= COMBAT_TUNABLES.guardImpactReductionFactor; // Guard shields block default 80% impact (from config!)

        console.log(`[Combat Pipeline]: Defended by Active Guard! Blocked ${blockedDamage.toFixed(1)} damage. Guard integrity remaining: ${targetState.guardIntegrity}/${targetState.maxGuardIntegrity}`);

        // Evaluate Guard Break state
        if (targetState.guardIntegrity <= 0) {
          targetState.guardIntegrity = 0;
          targetState.isGuardBroken = true;
          targetState.guardBreakTimer = COMBAT_TUNABLES.defaultGuardBreakDuration;
          
          output.guardBroken = true;
          output.resultReactionTier = HitReactionTier.TIER_3_HEAVY_STAGGER; 
          output.actionInterrupted = true;
          
          targetState.currentReactionTier = HitReactionTier.TIER_3_HEAVY_STAGGER;
          targetState.reactionRecoveryTimer = HIT_REACTION_CONFIGS[HitReactionTier.TIER_3_HEAVY_STAGGER].duration;
          
          // Guard break immediately resets action and locks out
          targetState.actionState = ActionState.INTERRUPTED;
          targetState.actionPhaseTimer = COMBAT_TUNABLES.defaultGuardBreakDuration;
          targetState.currentAction = null;
          
          console.log("[Combat Pipeline]: GUARD BROKEN! Target is heavily staggered.");
        }
      }
    }

    // 3. Resolve Armor Shielding absorption if NOT guarded fully
    targetState.timeSinceDamage = 0.0; // Reset regen delay timer on any hit

    if (finalDamage > 0) {
      // Armor broken modifiers
      if (targetState.isArmorBroken) {
        finalDamage *= COMBAT_TUNABLES.armorBrokenDamageMultiplier;
        finalImpact *= COMBAT_TUNABLES.armorBrokenStaggerMultiplier;
      }

      if (targetState.armor > 0 && !targetState.isArmorBroken) {
        const absorbed = Math.min(targetState.armor, finalDamage);
        targetState.armor -= absorbed;
        finalDamage -= absorbed;
        output.damageDealtToArmor = absorbed;

        if (targetState.armor <= 0) {
          targetState.armor = 0;
          targetState.isArmorBroken = true;
          targetState.armorBreakTimer = COMBAT_TUNABLES.armorBrokenRecoveryDelaySecs;
          
          output.armorBroken = true;
          console.log("[Combat Pipeline]: ARMOR CAPACITY CRUSHED! Defense debuff active.");
        }
      }

      // 4. Resolve remaining HP damage
      if (finalDamage > 0) {
        targetState.hp = Math.max(0, targetState.hp - finalDamage);
        output.damageDealtToHp = finalDamage;
      }
    }

    output.hpRemaining = targetState.hp;

    // 5. Apply Stagger Impact
    output.staggerPressureAdded = finalImpact;
    targetState.staggerAccumulation += finalImpact;
    targetState.staggerDecayDelayTimer = COMBAT_TUNABLES.staggerDecayDelaySecs;

    // Determine default reaction unless guard break overtook it
    let prospectiveReaction = weaponStats ? weaponStats.reactionTier : HitReactionTier.TIER_1_FLINCH;
    
    // If stagger threshold exceeded, trigger a major Stagger reaction
    if (targetState.staggerAccumulation >= targetState.staggerThreshold) {
      targetState.staggerAccumulation = 0; // reset
      output.staggerResetOccurred = true;

      // Force high stagger tier
      prospectiveReaction = HitReactionTier.TIER_2_STAGGER;
      targetState.actionState = ActionState.INTERRUPTED;
      targetState.actionPhaseTimer = COMBAT_TUNABLES.defaultInterruptLockoutSecs;
      targetState.currentAction = null;
      output.actionInterrupted = true;
      
      console.log(`[Combat Pipeline]: Stagger Threshold ${targetState.staggerThreshold} exceeded! Stagger action interrupt applied.`);
    }

    // 6. Evaluate Interruption & Poise Mechanics
    if (targetState.currentAction) {
      const activeAction = targetState.currentAction;
      
      if (activeAction.uninterruptible) {
        console.log(`[Combat Pipeline]: Action "${activeAction.name}" is uninterruptible (ignores standard hit interrupts).`);
      } else if (activeAction.superArmor) {
        console.log(`[Combat Pipeline]: Action "${activeAction.name}" has Super Armor (ignores standard action interrupt).`);
      } else {
        let effectivePoise = targetState.poise;
        if (activeAction.poiseValue !== undefined) {
          effectivePoise = activeAction.poiseValue;
        }

        if (finalImpact > effectivePoise) {
          targetState.actionState = ActionState.INTERRUPTED;
          targetState.actionPhaseTimer = COMBAT_TUNABLES.defaultInterruptLockoutSecs; // Lockout in Interrupted state!
          targetState.currentAction = null;
          output.actionInterrupted = true;
          
          if (prospectiveReaction < HitReactionTier.TIER_1_FLINCH) {
            prospectiveReaction = HitReactionTier.TIER_1_FLINCH;
          }
          console.log(`[Combat Pipeline]: Interruption success! Impact ${finalImpact.toFixed(0)} broke action poise target of ${effectivePoise}`);
        } else {
          console.log(`[Combat Pipeline]: Interruption resisted. Impact ${finalImpact.toFixed(0)} did not break poise target of ${effectivePoise}`);
        }
      }
    }

    // Process "trigger on hit" status effect hooks generically
    attackerState.activeEffects.forEach(effect => {
      const config = STATUS_EFFECT_CONFIGS[effect.type];
      if (config && config.triggerOnHit) {
        const h = config.triggerOnHit;
        if (Math.random() < h.probability) {
          CombatEngine.applyStatusEffect(targetState, h.effectId, h.duration);
          console.log(`[Status Effect Hook]: ${effect.name} triggered on hit! Applied ${h.effectId} to target.`);
        }
      }
    });

    // Process "trigger on damage taken" status effect hooks generically
    targetState.activeEffects.forEach(effect => {
      const config = STATUS_EFFECT_CONFIGS[effect.type];
      if (config && config.triggerOnDamageTaken) {
        const d = config.triggerOnDamageTaken;
        if (Math.random() < d.probability) {
          if (d.retaliateDamage) {
            attackerState.hp = Math.max(1, attackerState.hp - d.retaliateDamage);
            console.log(`[Status Effect Hook]: ${effect.name} triggered on damage taken! Dealt ${d.retaliateDamage} retaliate damage to attacker.`);
          }
        }
      }
    });

    // Overwrite weaker reaction state with stronger hit reaction tier
    if (prospectiveReaction > targetState.currentReactionTier) {
      targetState.currentReactionTier = prospectiveReaction;
      targetState.reactionRecoveryTimer = HIT_REACTION_CONFIGS[prospectiveReaction].duration;
    }

    output.resultReactionTier = targetState.currentReactionTier;
    return output;
  }
}
