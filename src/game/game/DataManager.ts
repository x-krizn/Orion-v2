/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface WeaponData {
  id: string;
  name: string;
  description: string;
  mesh: string;
  icon: string;
  damage: number;
  heatCost: number;
  cooldown: number;
  projectile: string;
  sound: string;
  rarity: "standard" | "rare" | "epic" | "legendary";
}

export interface AbilityData {
  id: string;
  name: string;
  description: string;
  damage?: number;
  cooldown: number;
  range?: number;
  color?: ColorRGB;
  key: string;
  icon: string;
  particleCount?: number;
  strikeCount?: number;
  spread?: number;
  speedMultiplier?: number;
  intensity?: number;
}

export interface EnemyData {
  id: string;
  name: string;
  description: string;
  health: number;
  speed: number;
  damage: number;
  attackRange: number;
  color: ColorRGB;
  scale: number;
  mesh: string;
}

export interface StatusEffectData {
  id: string;
  name: string;
  description: string;
  duration: number;
  modifiers: {
    speedMult?: number;
    cooldownMult?: number;
    damageMult?: number;
    damageReduction?: number;
    damageOverTime?: number;
  };
  particleColor: ColorRGB;
}

export interface MapData {
  id: string;
  name: string;
  theme: "cyber" | "magma" | "wasteland" | "matrix";
  arenaSize: number;
  gridSpacing: number;
  hasFloorReflection: boolean;
  skyboxBrightness: number;
  initialDecoCount: number;
  fogColor: ColorRGB;
  groundColor: ColorRGB;
}

export class DataManager {
  private static instance: DataManager | null = null;

  public weapons: WeaponData[] = [];
  public abilities: AbilityData[] = [];
  public enemies: EnemyData[] = [];
  public statusEffects: StatusEffectData[] = [];
  public maps: MapData[] = [];

  public loaded: boolean = false;
  private onLoadedCallbacks: (() => void)[] = [];

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  private constructor() {}

  /**
   * Performs parallel fetches to load all content JSON files from public/data
   */
  public async loadAllData(): Promise<void> {
    try {
      console.log("[DataManager]: Loading game configurations asynchronously...");
      const [weaponsRes, abilitiesRes, enemiesRes, statusEffectsRes, mapsRes] = await Promise.all([
        fetch("/data/weapons.json").then((r) => r.json()),
        fetch("/data/abilities.json").then((r) => r.json()),
        fetch("/data/enemies.json").then((r) => r.json()),
        fetch("/data/statusEffects.json").then((r) => r.json()),
        fetch("/data/maps.json").then((r) => r.json()),
      ]);

      this.weapons = weaponsRes;
      this.abilities = abilitiesRes;
      this.enemies = enemiesRes;
      this.statusEffects = statusEffectsRes;
      this.maps = mapsRes;

      this.loaded = true;
      console.log(`[DataManager]: Finished loading configurations details:
        - Weapons: ${this.weapons.length}
        - Abilities: ${this.abilities.length}
        - Enemies: ${this.enemies.length}
        - Status Effects: ${this.statusEffects.length}
        - Maps Preset: ${this.maps.length}`);

      this.onLoadedCallbacks.forEach((cb) => cb());
    } catch (error) {
      console.error("[DataManager]: Failed to fetch static JSON dataset. Using runtime fallbacks.", error);
      this.populateFallbackDefaults();
      this.loaded = true;
      this.onLoadedCallbacks.forEach((cb) => cb());
    }
  }

  public onLoaded(callback: () => void): void {
    if (this.loaded) {
      callback();
    } else {
      this.onLoadedCallbacks.push(callback);
    }
  }

  /**
   * Generates robust memory-based fallbacks in case network/development routes fail
   */
  private populateFallbackDefaults(): void {
    this.weapons = [
      {
        id: "pulse_cannon",
        name: "Pulse Cannon",
        description: "Rapid-fire energy weapon.",
        mesh: "models/weapons/pulse_cannon.glb",
        icon: "textures/icons/pulse_cannon.png",
        damage: 25,
        heatCost: 10,
        cooldown: 0.25,
        projectile: "pulse_projectile",
        sound: "pulse_fire",
        rarity: "standard",
      }
    ];

    this.abilities = [
      {
        id: "plasma_emitter",
        name: "Plasma Emitter",
        description: "Discharges localized high-voltage plasma shockwaves.",
        damage: 50,
        cooldown: 1.0,
        range: 6,
        color: { r: 0.0, g: 0.94, b: 1.0 },
        key: "L-CLICK",
        icon: "Crosshair",
        particleCount: 6,
        intensity: 0.8
      },
      {
        id: "heavy_railbeam",
        name: "Fusion Railbeam",
        description: "Pierces the target area with high intensity energy sweep.",
        damage: 150,
        cooldown: 4.0,
        range: 25,
        color: { r: 1.0, g: 0.2, b: 0.4 },
        key: "Q / 1",
        icon: "Zap",
        particleCount: 15,
        intensity: 1.2
      },
      {
        id: "tactical_bombardment",
        name: "Orbital Bombardment",
        description: "Calls down surgical plasma-mortar strikes.",
        damage: 200,
        cooldown: 8.0,
        strikeCount: 4,
        spread: 5,
        color: { r: 1.0, g: 0.7, b: 0.1 },
        key: "E / 2",
        icon: "Sparkles",
        particleCount: 10,
        intensity: 1.5
      }
    ];

    this.enemies = [
      {
        id: "enemy_scout",
        name: "Recon Drone Unit-S1",
        description: "Highly mobile scout hover drone.",
        health: 80,
        speed: 6.5,
        damage: 10,
        attackRange: 12,
        color: { r: 0.1, g: 0.8, b: 1.0 },
        scale: 0.8,
        mesh: "models/enemies/scout.glb"
      }
    ];

    this.statusEffects = [
      {
        id: "overdrive",
        name: "Overdrive",
        description: "Weapon fire rates accelerated.",
        duration: 5.0,
        modifiers: { speedMult: 1.5, cooldownMult: 0.5 },
        particleColor: { r: 1.0, g: 0.4, b: 0.0 }
      }
    ];

    this.maps = [
      {
        id: "cyber_sector",
        name: "Cyber Grid Sector 4",
        theme: "cyber",
        arenaSize: 40,
        gridSpacing: 3,
        hasFloorReflection: true,
        skyboxBrightness: 0.5,
        initialDecoCount: 6,
        fogColor: { r: 0.02, g: 0.02, b: 0.05 },
        groundColor: { r: 0.05, g: 0.07, b: 0.12 }
      },
      {
        id: "magma_rift",
        name: "Ashen Magma Rift",
        theme: "magma",
        arenaSize: 50,
        gridSpacing: 4,
        hasFloorReflection: false,
        skyboxBrightness: 0.8,
        initialDecoCount: 10,
        fogColor: { r: 0.12, g: 0.03, b: 0.01 },
        groundColor: { r: 0.18, g: 0.08, b: 0.04 }
      }
    ];
  }

  public getWeaponById(id: string): WeaponData | undefined {
    return this.weapons.find((w) => w.id === id);
  }

  public getAbilityById(id: string): AbilityData | undefined {
    return this.abilities.find((a) => a.id === id);
  }

  public getEnemyById(id: string): EnemyData | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  public getStatusEffectById(id: string): StatusEffectData | undefined {
    return this.statusEffects.find((s) => s.id === id);
  }

  public getMapById(id: string): MapData | undefined {
    return this.maps.find((m) => m.id === id);
  }
}
