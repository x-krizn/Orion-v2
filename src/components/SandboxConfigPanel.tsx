import React, { useState, useEffect } from "react";
import { Download, Check, Copy, Upload, Sparkles } from "lucide-react";
import { Vector3 } from "@babylonjs/core";

interface SandboxConfigPanelProps {
  theme: string;
  glowIntensity: number;
  bloomWeight: number;
  exposure: number;
  fov: number;
  cameraDist: number;
  pitch: number;
  customChassisScale: number;
  customChassisRotation: number;
  customPropsScale: number;
  customPropsRotation: number;
  chassisOffsetX: number;
  chassisOffsetY: number;
  chassisOffsetZ: number;
  muzzleOffsetX: number;
  muzzleOffsetY: number;
  muzzleOffsetZ: number;
  bobbingHeight: number;
  bobbingSpeed: number;
  tiltPitch: number;
  swayRoll: number;
  collisionRadius: number;
  gameManagerRef: React.MutableRefObject<any>;
  handleThemeChange: (theme: any) => void;
  handleGlowIntensityChange: (val: number) => void;
  handleBloomWeightChange: (val: number) => void;
  handleExposureChange: (val: number) => void;
  handleFovChange: (val: number) => void;
  handleCameraDistChange: (val: number) => void;
  handlePitchChange: (val: number) => void;
  handleCustomChassisScaleChange: (val: number) => void;
  handleCustomChassisRotationChange: (val: number) => void;
  handleCustomPropsScaleChange: (val: number) => void;
  handleCustomPropsRotationChange: (val: number) => void;
  handleChassisOffsetXChange: (val: number) => void;
  handleChassisOffsetYChange: (val: number) => void;
  handleChassisOffsetZChange: (val: number) => void;
  handleMuzzleOffsetXChange: (val: number) => void;
  handleMuzzleOffsetYChange: (val: number) => void;
  handleMuzzleOffsetZChange: (val: number) => void;
  handleBobbingHeightChange: (val: number) => void;
  handleBobbingSpeedChange: (val: number) => void;
  handleTiltPitchChange: (val: number) => void;
  handleSwayRollChange: (val: number) => void;
  handleCollisionRadiusChange: (val: number) => void;
}

export function SandboxConfigPanel({
  theme,
  glowIntensity,
  bloomWeight,
  exposure,
  fov,
  cameraDist,
  pitch,
  customChassisScale,
  customChassisRotation,
  customPropsScale,
  customPropsRotation,
  chassisOffsetX,
  chassisOffsetY,
  chassisOffsetZ,
  muzzleOffsetX,
  muzzleOffsetY,
  muzzleOffsetZ,
  bobbingHeight,
  bobbingSpeed,
  tiltPitch,
  swayRoll,
  collisionRadius,
  gameManagerRef,
  handleThemeChange,
  handleGlowIntensityChange,
  handleBloomWeightChange,
  handleExposureChange,
  handleFovChange,
  handleCameraDistChange,
  handlePitchChange,
  handleCustomChassisScaleChange,
  handleCustomChassisRotationChange,
  handleCustomPropsScaleChange,
  handleCustomPropsRotationChange,
  handleChassisOffsetXChange,
  handleChassisOffsetYChange,
  handleChassisOffsetZChange,
  handleMuzzleOffsetXChange,
  handleMuzzleOffsetYChange,
  handleMuzzleOffsetZChange,
  handleBobbingHeightChange,
  handleBobbingSpeedChange,
  handleTiltPitchChange,
  handleSwayRollChange,
  handleCollisionRadiusChange,
}: SandboxConfigPanelProps) {
  const [jsonString, setJsonString] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  // Generate dynamic JSON string reflecting active environment settings and custom placed layout
  const generateConfigJson = () => {
    const placedPropsRecords = gameManagerRef.current?.environment?.customPropsRecords || [];
    const placedPropsList = placedPropsRecords.map((r: any, idx: number) => {
      // Isolate clean mesh/prop origin name
      let propName = r.node.name || "prop";
      if (propName.startsWith("PLACED_")) {
        propName = propName.replace("PLACED_", "");
      }
      // Strip timestamp suffixes
      const indexSuffix = propName.lastIndexOf("_");
      if (indexSuffix > 0) {
        propName = propName.substring(0, indexSuffix);
      }

      return {
        name: propName,
        position: {
          x: Number(r.node.position.x.toFixed(3)),
          y: Number(r.node.position.y.toFixed(3)),
          z: Number(r.node.position.z.toFixed(3)),
        },
        rotationY: r.randomFloorRotation ? Number(r.randomFloorRotation.toFixed(3)) : undefined,
      };
    });

    const config = {
      $schema: "https://ai.studio/build/mech-combat-sandbox",
      version: "1.0.0",
      description: "2.5D Mech Vertical Slice Arena & Mech Rig Layout Settings",
      timestamp: new Date().toISOString(),
      theme: theme,
      rendering: {
        glowIntensity: Number(glowIntensity.toFixed(2)),
        bloomWeight: Number(bloomWeight.toFixed(2)),
        exposure: Number(exposure.toFixed(2)),
      },
      camera: {
        fov: Number(fov.toFixed(3)),
        distance: cameraDist,
        pitch: pitch,
      },
      chassisOverrides: {
        scale: Number(customChassisScale.toFixed(2)),
        rotation: customChassisRotation,
        offset: {
          x: Number(chassisOffsetX.toFixed(3)),
          y: Number(chassisOffsetY.toFixed(3)),
          z: Number(chassisOffsetZ.toFixed(3)),
        },
        muzzle: {
          widthOffset: Number(muzzleOffsetX.toFixed(3)),
          heightOffset: Number(muzzleOffsetY.toFixed(3)),
          extensionOffset: Number(muzzleOffsetZ.toFixed(3)),
        },
        bobbing: {
          height: Number(bobbingHeight.toFixed(3)),
          speed: Number(bobbingSpeed.toFixed(2)),
        },
        physics: {
          tiltPitch: Number(tiltPitch.toFixed(3)),
          swayRoll: Number(swayRoll.toFixed(3)),
          collisionRadius: Number(collisionRadius.toFixed(2)),
        },
        effectBoneMappings: {
          Helm: ["EffectEyeGlow"],
          CoreRear: ["EffectLeftBooster", "EffectRightBooster", "EffectDashThruster"],
          LeftCalf: ["EffectLeftLegBooster"],
          RightCalf: ["EffectRightCalfBooster"],
        },
      },
      environment: {
        propsScale: Number(customPropsScale.toFixed(2)),
        propsRotation: customPropsRotation,
        placedProps: placedPropsList,
      },
    };

    return JSON.stringify(config, null, 2);
  };

  // Re-generate json when layout state / variables update
  useEffect(() => {
    setJsonString(generateConfigJson());
    setImportSuccess(false);
    setImportError("");
  }, [
    theme,
    glowIntensity,
    bloomWeight,
    exposure,
    fov,
    cameraDist,
    pitch,
    customChassisScale,
    customChassisRotation,
    customPropsScale,
    customPropsRotation,
    chassisOffsetX,
    chassisOffsetY,
    chassisOffsetZ,
    muzzleOffsetX,
    muzzleOffsetY,
    muzzleOffsetZ,
    bobbingHeight,
    bobbingSpeed,
    tiltPitch,
    swayRoll,
    collisionRadius,
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mech_sandbox_config_${theme}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApplyJsonImport = (inputStr: string) => {
    try {
      setImportError("");
      setImportSuccess(false);
      const config = JSON.parse(inputStr);

      if (!config) {
        throw new Error("Pasted config is null or empty.");
      }

      // 1. Process theme
      if (config.theme) {
        handleThemeChange(config.theme);
      }

      // 2. Process rendering levels
      if (config.rendering) {
        if (typeof config.rendering.glowIntensity === "number") {
          handleGlowIntensityChange(config.rendering.glowIntensity);
        }
        if (typeof config.rendering.bloomWeight === "number") {
          handleBloomWeightChange(config.rendering.bloomWeight);
        }
        if (typeof config.rendering.exposure === "number") {
          handleExposureChange(config.rendering.exposure);
        }
      }

      // 3. Process camera vectors
      if (config.camera) {
        if (typeof config.camera.fov === "number") handleFovChange(config.camera.fov);
        if (typeof config.camera.distance === "number") handleCameraDistChange(config.camera.distance);
        if (typeof config.camera.pitch === "number") handlePitchChange(config.camera.pitch);
      }

      // 4. Process chassis settings
      if (config.chassisOverrides) {
        if (typeof config.chassisOverrides.scale === "number") {
          handleCustomChassisScaleChange(config.chassisOverrides.scale);
        }
        if (typeof config.chassisOverrides.rotation === "number") {
          handleCustomChassisRotationChange(config.chassisOverrides.rotation);
        }
        if (config.chassisOverrides.offset) {
          if (typeof config.chassisOverrides.offset.x === "number") handleChassisOffsetXChange(config.chassisOverrides.offset.x);
          if (typeof config.chassisOverrides.offset.y === "number") handleChassisOffsetYChange(config.chassisOverrides.offset.y);
          if (typeof config.chassisOverrides.offset.z === "number") handleChassisOffsetZChange(config.chassisOverrides.offset.z);
        }
        if (config.chassisOverrides.muzzle) {
          if (typeof config.chassisOverrides.muzzle.widthOffset === "number") handleMuzzleOffsetXChange(config.chassisOverrides.muzzle.widthOffset);
          if (typeof config.chassisOverrides.muzzle.heightOffset === "number") handleMuzzleOffsetYChange(config.chassisOverrides.muzzle.heightOffset);
          if (typeof config.chassisOverrides.muzzle.extensionOffset === "number") handleMuzzleOffsetZChange(config.chassisOverrides.muzzle.extensionOffset);
        }
        if (config.chassisOverrides.bobbing) {
          if (typeof config.chassisOverrides.bobbing.height === "number") handleBobbingHeightChange(config.chassisOverrides.bobbing.height);
          if (typeof config.chassisOverrides.bobbing.speed === "number") handleBobbingSpeedChange(config.chassisOverrides.bobbing.speed);
        }
        if (config.chassisOverrides.physics) {
          if (typeof config.chassisOverrides.physics.tiltPitch === "number") handleTiltPitchChange(config.chassisOverrides.physics.tiltPitch);
          if (typeof config.chassisOverrides.physics.swayRoll === "number") handleSwayRollChange(config.chassisOverrides.physics.swayRoll);
          if (typeof config.chassisOverrides.physics.collisionRadius === "number") handleCollisionRadiusChange(config.chassisOverrides.physics.collisionRadius);
        }
      }

      // 5. Process physical items list
      if (config.environment) {
        if (typeof config.environment.propsScale === "number") {
          handleCustomPropsScaleChange(config.environment.propsScale);
        }
        if (typeof config.environment.propsRotation === "number") {
          handleCustomPropsRotationChange(config.environment.propsRotation);
        }

        if (Array.isArray(config.environment.placedProps) && gameManagerRef.current) {
          // Flush existing obstacles
          gameManagerRef.current.environment.clearCustomAssets();

          const libItems = gameManagerRef.current.environment.libraryItems || [];
          if (libItems.length > 0) {
            config.environment.placedProps.forEach((prop: any) => {
              const cleanedPropName = prop.name.toLowerCase();

              // Fallback match: if exact match fails, check if the library item name is contained within the prop name or vice versa
              const targetLibItem = libItems.find(
                (item: any) =>
                  item.name.toLowerCase() === cleanedPropName ||
                  cleanedPropName.includes(item.name.toLowerCase()) ||
                  item.name.toLowerCase().includes(cleanedPropName)
              );

              if (targetLibItem && prop.position) {
                const heightY = prop.position.y ?? 0.0;
                const pos = new Vector3(prop.position.x, heightY, prop.position.z);
                const spawned = gameManagerRef.current.environment.instantiateLibraryItem(targetLibItem.id, pos);
                
                // Set custom rotation parameter if matched and exists
                if (spawned && typeof prop.rotationY === "number") {
                  const records = gameManagerRef.current.environment.customPropsRecords;
                  if (records.length > 0) {
                    const lastRecord = records[records.length - 1];
                    lastRecord.randomFloorRotation = prop.rotationY;
                  }
                }
              }
            });

            // Reinforce all visual transform parameters overrides
            gameManagerRef.current.environment.setCustomPropsTransforms(
              config.environment.propsScale ?? customPropsScale,
              config.environment.propsRotation ?? customPropsRotation
            );
          }
        }
      }

      setJsonString(JSON.stringify(config, null, 2));
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err: any) {
      setImportError(err?.message || "Parsing error. Check JSON syntax compliance.");
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target?.result;
      if (typeof contents === "string") {
        handleApplyJsonImport(contents);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4 text-xs font-mono" id="configPanelRoot">
      {/* Description header */}
      <div className="border border-white/5 bg-black/30 rounded p-2 text-[10px] text-[#d1d1d6]/70 leading-relaxed">
        <div className="flex items-center space-x-1 mb-1 font-bold text-orange-400">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span>REAL-TIME SANDBOX EXPORTER</span>
        </div>
        Save, export, or import level assets layout maps and combat RIG effect mappings in standard JSON.
      </div>

      {/* Primary Actions Grid */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center justify-center p-2 rounded border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/15 text-orange-400 transition-all cursor-pointer font-bold gap-1 text-[10px]"
          id="copyJsonButton"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "COPIED JSON" : "COPY TO CLIPBOARD"}</span>
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center justify-center p-2 rounded border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 transition-all cursor-pointer font-bold gap-1 text-[10px]"
          id="downloadJsonButton"
        >
          <Download className="w-3.5 h-3.5" />
          <span>DOWNLOAD FILE</span>
        </button>
      </div>

      {/* JSON raw text box display / editor */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-bold text-white/50 tracking-widest block uppercase">Live State Descriptor</span>
          <span className="text-[8px] text-[#d1d1d6]/40 font-mono">Editable sandbox markup</span>
        </div>
        <textarea
          id="rawConfigJsonTextarea"
          value={jsonString}
          onChange={(e) => setJsonString(e.target.value)}
          className="w-full h-44 bg-black/60 border border-white/10 rounded p-2 text-[9px] leading-tight font-mono text-[#d1d1d6] focus:outline-none focus:border-orange-500 transition-all resize-none"
          spellCheck={false}
        />
      </div>

      {/* Interactive buttons to apply or read from file */}
      <div className="space-y-2">
        <button
          onClick={() => handleApplyJsonImport(jsonString)}
          className="w-full flex items-center justify-center p-2 rounded border border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 text-white font-bold transition-all text-[10px] cursor-pointer tracking-wider uppercase"
          id="applyJsonChangesButton"
        >
          <span>Apply Edited Configuration</span>
        </button>

        {/* File importer */}
        <div className="relative">
          <input
            id="importJsonFileInput"
            type="file"
            accept=".json"
            onChange={handleJsonFileUpload}
            className="hidden"
          />
          <button
            onClick={() => document.getElementById("importJsonFileInput")?.click()}
            className="w-full flex items-center justify-center gap-1.5 p-2 rounded border border-white/5 hover:border-orange-500/30 bg-black/40 hover:bg-black/60 text-[#d1d1d6] transition-all text-[10px] font-bold cursor-pointer uppercase font-mono"
            id="triggerUploadJsonButton"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load JSON from file</span>
          </button>
        </div>
      </div>

      {/* Alerts feedback alerts banner */}
      {importError && (
        <div className="border border-rose-500/20 bg-rose-500/5 text-rose-400 p-2 rounded text-[10px] uppercase font-bold text-center leading-normal animate-pulse">
          ⚠️ {importError}
        </div>
      )}

      {importSuccess && (
        <div className="border border-green-500/20 bg-green-500/5 text-green-400 p-2 rounded text-[10px] uppercase font-bold text-center leading-normal">
          ✅ Import Loaded Successfully!
        </div>
      )}
    </div>
  );
}
