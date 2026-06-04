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
import { COMBAT_TUNABLES, HIT_REACTION_CONFIGS } from "./CombatConfig";

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
    const defaultHp = data?.maxHp || (isPlayer ? COMBAT_TUNABLES.playerDefaultMaxHp : 300);
    const defaultArmor = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxArmor : 50;
    const defaultEn = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxEn : 50;
    const defaultHeat = 0;
    const defaultPoise = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxPoise : 50;
    const defaultStaggerThreshold = isPlayer ? COMBAT_TUNABLES.playerDefaultMaxStaggerThreshold : 60;

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

    // Apply modifiers from status effects
    const isSlowed = state.activeEffects.some(e => e.type === StatusEffectType.SLOW);
    const isBlind = state.activeEffects.some(e => e.type === StatusEffectType.BLIND);
    const isSilenced = state.activeEffects.some(e => e.type === StatusEffectType.SILENCE);
    const isDisarmed = state.activeEffects.some(e => e.type === StatusEffectType.DISARM);

    // 3. Action Phase state machine ticking & recovery
    if (state.currentAction) {
      if (state.actionPhaseTimer > 0) {
        state.actionPhaseTimer -= deltaTimeSecs;
        if (state.actionPhaseTimer <= 0) {
          // Transition through action phases based on current configuration
          // Action is finished! Return to NEUTRAL.
          state.actionState = ActionState.NEUTRAL;
          state.currentAction = null;
        }
      }
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
        state.armor = state.maxArmor * 0.5; // Restores 50% on recovery
        console.log("[Combat Engine]: Armor Broken state ended. Restored 50% Shield Capacity.");
      }
    } else {
      // Armor regeneration if untouched for 5s and not broken
      if (state.timeSinceDamage >= COMBAT_TUNABLES.armorRegenDelaySecs && state.armor < state.maxArmor) {
        state.armor = Math.min(state.maxArmor, state.armor + COMBAT_TUNABLES.armorRegenRatePerSec * deltaTimeSecs);
      }
    }

    // 6. Guard break cooldown logic
    if (state.isGuardBroken) {
      state.guardBreakTimer -= deltaTimeSecs;
      if (state.guardBreakTimer <= 0) {
        state.isGuardBroken = false;
        state.guardIntegrity = state.maxGuardIntegrity * 0.3; // Restore 30% shield
        console.log("[Combat Engine]: Guard Integrity recovered from broken cooldown.");
      }
    } else {
      // Shield integrity out-of-combat regeneration
      if (state.timeSinceDamage >= 4.0 && state.guardIntegrity < state.maxGuardIntegrity) {
        state.guardIntegrity = Math.min(state.maxGuardIntegrity, state.guardIntegrity + 10 * deltaTimeSecs);
      }
    }

    // 7. Overheat cycle cooling
    if (state.isOverheated) {
      state.overheatCooldownTimer -= deltaTimeSecs;
      state.heat = Math.max(0, state.maxHeat * (state.overheatCooldownTimer / COMBAT_TUNABLES.heatOverheatRecoverySecs));
      // Heat DOT when overheating
      state.hp = Math.max(1, state.hp - COMBAT_TUNABLES.overheatDoTPerSec * deltaTimeSecs); // Overheat does standard damage
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
        // Regeneration penalty when overheated/slowed
        const regenMult = state.isOverheated ? 0.4 : 1.0;
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
   * Applies a custom Status Effect to an entity's dynamic registry
   */
  public static applyStatusEffect(state: CombatEntityState, type: StatusEffectType, duration: number, severity: number = 1.0): void {
    // See if effect already exists to override or augment it
    const exists = state.activeEffects.find(e => e.type === type);
    if (exists) {
      exists.duration = Math.max(exists.duration, duration); // Refresh duration
      exists.severity = Math.max(exists.severity, severity);
    } else {
      let name = type.toString();
      let description = `Affected by ${type}`;

      switch (type) {
        case StatusEffectType.BURN:
          description = "Thermal overload. Dealing periodic HP damage.";
          break;
        case StatusEffectType.SHOCK:
          description = "Electromagnetic disruption. Stunning system movement.";
          break;
        case StatusEffectType.CORRUPTION:
          description = "Nanite decay. Continuous Shield/Armor deterioration.";
          break;
        case StatusEffectType.BLEED:
          description = "Structural damage. Amplifies incoming impact and critical frequency.";
          break;
        case StatusEffectType.SLOW:
          description = "Thruster inhibitors. Redline speed reduction by 35%.";
          break;
        case StatusEffectType.BLIND:
          description = "Sensor calibration error. Cannot target lock targets.";
          break;
        case StatusEffectType.SILENCE:
          description = "Weapons control buffer. Cannot cast high resource skills.";
          break;
        case StatusEffectType.DISARM:
          description = "Armaments decoupled. Standard ammunition disabled.";
          break;
      }

      state.activeEffects.push({
        type,
        name,
        description,
        duration,
        elapsed: 0,
        tickTimer: 0,
        severity
      });
    }
  }

  /**
   * Status Effects tick logic loop
   */
  private static tickStatusEffects(state: CombatEntityState, deltaTime: number): void {
    state.activeEffects.forEach(effect => {
      effect.duration -= deltaTime;
      effect.elapsed += deltaTime;
      effect.tickTimer += deltaTime;

      // Pulse tick every 1.0s
      if (effect.tickTimer >= 1.0) {
        effect.tickTimer -= 1.0;

        switch (effect.type) {
          case StatusEffectType.BURN:
            // Continuous thermal bleed damage directly to HP
            const burnDmg = 15 * effect.severity;
            state.hp = Math.max(1, state.hp - burnDmg);
            console.log(`[Status Pulse]: Burn tick deals ${burnDmg} HP damage directly!`);
            break;
          case StatusEffectType.CORRUPTION:
            // Continuous armor erosion
            if (state.armor > 0) {
              const armorDecay = 12 * effect.severity;
              state.armor = Math.max(0, state.armor - armorDecay);
              console.log(`[Status Pulse]: Corruption decay drains ${armorDecay} armor capacity.`);
            }
            break;
          case StatusEffectType.SHOCK:
            // Electrocution minor interrupt
            state.en = Math.max(0, state.en - 5);
            break;
        }
      }
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
    const critChance = weaponStats?.critChance || 0.10;
    const isCrit = Math.random() < critChance;
    output.isCrit = isCrit;

    let finalDamage = baseDamage;
    if (isCrit) {
      finalDamage *= COMBAT_TUNABLES.defaultCritMultiplier;
    }

    // Process Status modifiers (Slow slows actions, Bleed increases crit damage, etc.)
    const hasBleed = targetState.activeEffects.some(e => e.type === StatusEffectType.BLEED);
    if (hasBleed) {
      finalDamage *= 1.25; // 25% damage boost if bleeding
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
        const dmgGuardReduction = weaponStats ? (finalDamage * (1.0 - weaponStats.penetration)) : finalDamage;
        const blockedDamage = finalDamage * targetState.guardDamageReduction;
        const remainderDamage = finalDamage - blockedDamage;

        output.damageDealtToGuard = blockedDamage;
        targetState.guardIntegrity -= blockedDamage;

        finalDamage = remainderDamage;
        finalImpact *= 0.2; // Guard shields shrug off 80% impact

        console.log(`[Combat Pipeline]: Defended by Active Guard! Blocked ${blockedDamage.toFixed(1)} damage. Guard integrity remaining: ${targetState.guardIntegrity}/${targetState.maxGuardIntegrity}`);

        // Evaluate Guard Break state
        if (targetState.guardIntegrity <= 0) {
          targetState.guardIntegrity = 0;
          targetState.isGuardBroken = true;
          targetState.guardBreakTimer = 5.0; // disabled for 5.0s
          
          output.guardBroken = true;
          output.resultReactionTier = HitReactionTier.TIER_3_HEAVY_STAGGER; 
          output.actionInterrupted = true;
          
          targetState.currentReactionTier = HitReactionTier.TIER_3_HEAVY_STAGGER;
          targetState.reactionRecoveryTimer = HIT_REACTION_CONFIGS[HitReactionTier.TIER_3_HEAVY_STAGGER].duration;
          
          // Guard break immediately resets action
          targetState.actionState = ActionState.INTERRUPTED;
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
      targetState.currentAction = null;
      output.actionInterrupted = true;
      
      console.log(`[Combat Pipeline]: Stagger Threshold ${targetState.staggerThreshold} exceeded! Stagger action interrupt applied.`);
    }

    // 6. Evaluate Interruption & Poise Mechanics
    // Only interrupt current actions if not guarded, and impact exceeds current poise
    if (targetState.currentAction && !targetState.currentAction.superArmor) {
      const activeAction = targetState.currentAction;
      let effectivePoise = targetState.poise;

      // If action defines poise values, use that
      if (activeAction.poiseValue !== undefined) {
        effectivePoise = activeAction.poiseValue;
      }

      if (finalImpact > effectivePoise) {
        // Attack interrupts action commitment check
        if (!activeAction.uninterruptible) {
          targetState.actionState = ActionState.INTERRUPTED;
          targetState.currentAction = null;
          output.actionInterrupted = true;
          
          if (prospectiveReaction < HitReactionTier.TIER_1_FLINCH) {
            prospectiveReaction = HitReactionTier.TIER_1_FLINCH;
          }
          console.log(`[Combat Pipeline]: Interruption success! Impact ${finalImpact.toFixed(0)} broke action poise target of ${effectivePoise}`);
        }
      }
    }

    // Overwrite weaker reaction state with stronger hit reaction tier
    if (prospectiveReaction > targetState.currentReactionTier) {
      targetState.currentReactionTier = prospectiveReaction;
      targetState.reactionRecoveryTimer = HIT_REACTION_CONFIGS[prospectiveReaction].duration;
    }

    output.resultReactionTier = targetState.currentReactionTier;
    return output;
  }
}
