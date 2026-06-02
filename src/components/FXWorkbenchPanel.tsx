import React, { useState, useEffect } from "react";
import { CustomEffectData } from "../game/fx/FXSystem";

interface FXWorkbenchPanelProps {
  gameManagerRef: React.MutableRefObject<any>;
  onClose: () => void;
}

export function FXWorkbenchPanel({ gameManagerRef, onClose }: FXWorkbenchPanelProps) {
  const [effectsList, setEffectsList] = useState<CustomEffectData[]>([]);
  const [selectedEffectId, setSelectedEffectId] = useState<string>("");
  const [discoveredSockets, setDiscoveredSockets] = useState<string[]>([]);
  const [selectedSocket, setSelectedSocket] = useState<string>("socket_muzzle");

  // Editable effect state variables
  const [id, setId] = useState("custom_effect");
  const [name, setName] = useState("Custom Level Flash");
  const [color, setColor] = useState("#7dfcff");
  const [emissive, setEmissive] = useState(true);
  const [particleCount, setParticleCount] = useState(60);
  const [lifetime, setLifetime] = useState(0.25);
  const [speed, setSpeed] = useState(8.0);
  const [size, setSize] = useState(0.18);
  const [spread, setSpread] = useState(0.4);
  const [gravity, setGravity] = useState(0.0);
  const [duration, setDuration] = useState(0.3);
  const [blendMode, setBlendMode] = useState("additive");

  const [copied, setCopied] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

  // Load effects and discovered sockets on mount
  useEffect(() => {
    const handle = setInterval(() => {
      const gm = gameManagerRef.current;
      if (gm && gm.fx) {
        const list = gm.fx.getEffectDefinitionsList();
        if (list.length > 0 && effectsList.length === 0) {
          setEffectsList(list);
          // Auto select first
          if (list[0]) {
            loadEffectIntoWorkbench(list[0]);
          }
        }
      }

      // Sync sockets list from active character controller
      const player = gm?.player;
      if (player && player.socketManager) {
        const sockets = player.socketManager.getDiscoveredSocketNames();
        if (sockets.join(",") !== discoveredSockets.join(",")) {
          setDiscoveredSockets(sockets);
        }
      }
    }, 1000);

    return () => clearInterval(handle);
  }, [gameManagerRef, effectsList, discoveredSockets]);

  // Load a selected effect metadata into editable states
  const loadEffectIntoWorkbench = (eff: CustomEffectData) => {
    setSelectedEffectId(eff.id);
    setId(eff.id);
    setName(eff.name || eff.id);
    setColor(eff.color);
    setEmissive(eff.emissive !== false);
    setParticleCount(eff.particleCount);
    setLifetime(eff.lifetime);
    setSpeed(eff.speed);
    setSize(eff.size);
    setSpread(eff.spread);
    setGravity(eff.gravity || 0);
    setDuration(eff.duration);
    setBlendMode(eff.blendMode || "additive");

    if (eff.emitterSocket) {
      setSelectedSocket(eff.emitterSocket);
    }
  };

  // Compile active properties into a CustomEffectData object
  const getActiveDefinition = (): CustomEffectData => {
    return {
      id,
      name,
      type: "particle",
      duration,
      emitterSocket: selectedSocket || undefined,
      color,
      emissive,
      particleCount,
      lifetime,
      speed,
      size,
      spread,
      gravity,
      blendMode,
    };
  };

  // Re-run visualizer preview on Babylon scene
  const triggerPreview = (currentDef?: CustomEffectData) => {
    const gm = gameManagerRef.current;
    if (!gm || !gm.fx) return;

    const def = currentDef || getActiveDefinition();
    
    // Find target socket transform node
    let socketNode = null;
    const player = gm.player;
    if (player && player.socketManager && selectedSocket) {
      socketNode = player.socketManager.getSocket(selectedSocket);
    }

    if (isLooping) {
      gm.fx.previewEffect(def, socketNode);
    } else {
      gm.fx.stopPreview();
      // Single trigger burst
      gm.fx.spawnCustomEffect(def, socketNode || player?.getRootNode() || null);
    }
  };

  // Sync state changes with active preview
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm && gm.fx && isLooping) {
      gm.fx.updatePreviewParams(getActiveDefinition());
    }
  }, [id, name, color, emissive, particleCount, lifetime, speed, size, spread, gravity, duration, blendMode, selectedSocket, isLooping]);

  // Handle preview toggles or initial play trigger
  useEffect(() => {
    triggerPreview();
    return () => {
      const gm = gameManagerRef.current;
      if (gm && gm.fx) {
        gm.fx.stopPreview();
      }
    };
  }, [selectedEffectId, selectedSocket, isLooping]);

  const selectPreconfiguredEffect = (id: string) => {
    const eff = effectsList.find(e => e.id === id);
    if (eff) {
      loadEffectIntoWorkbench(eff);
    }
  };

  const copyToClipboard = () => {
    const def = getActiveDefinition();
    const jsonStr = JSON.stringify(def, null, 2);
    navigator.clipboard.writeText(jsonStr)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback handled by textarea instruction
      });
  };

  const activeJsonString = JSON.stringify(getActiveDefinition(), null, 2);

  return (
    <div id="fxWorkbenchRoot" className="fixed inset-y-0 right-0 w-80 md:w-96 bg-black/90 border-l border-orange-500/30 text-white z-50 flex flex-col shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-orange-950/20">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          <h2 className="text-xs font-bold tracking-widest uppercase text-orange-400 font-mono">FX WORKBENCH v2</h2>
        </div>
        <button 
          onClick={() => {
            const gm = gameManagerRef.current;
            if (gm && gm.fx) gm.fx.stopPreview();
            onClose();
          }}
          className="text-[#d1d1d6] hover:text-white font-bold text-sm bg-white/5 hover:bg-white/15 px-2.5 py-1 rounded transition-all cursor-pointer font-mono"
        >
          ✕
        </button>
      </div>

      {/* Editor Content scroll area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono select-none">
        {/* Preset Selector */}
        <div className="space-y-1.5 p-2 bg-white/5 rounded border border-white/5">
          <label className="text-[10px] font-bold text-white/50 tracking-wider block uppercase">Select Base Preset</label>
          <select
            value={selectedEffectId}
            onChange={(e) => selectPreconfiguredEffect(e.target.value)}
            className="w-full bg-[#1c1c1e] text-white py-1.5 px-2 rounded border border-white/10 focus:outline-none focus:border-orange-500 text-[11px]"
          >
            <option value="">-- Start Custom Definition --</option>
            {effectsList.map((eff) => (
              <option key={eff.id} value={eff.id}>
                {eff.name || eff.id}
              </option>
            ))}
          </select>
        </div>

        {/* Emitter Sockets Discovery */}
        <div className="space-y-1.5 p-2 bg-white/5 rounded border border-white/5">
          <label className="text-[10px] font-bold text-white/50 tracking-wider block uppercase">Emitter Anchor Socket</label>
          <select
            value={selectedSocket}
            onChange={(e) => setSelectedSocket(e.target.value)}
            className="w-full bg-[#1c1c1e] text-white py-1.5 px-2 rounded border border-white/10 focus:outline-none focus:border-orange-500 text-[11px]"
          >
            <option value="">No Socket (World Center 0,1,0)</option>
            {discoveredSockets.map((sock) => (
              <option key={sock} value={sock}>
                {sock}
              </option>
            ))}
          </select>
          <div className="text-[9px] text-[#d1d1d6]/40 leading-tight">
            {discoveredSockets.length === 0 
              ? "⚠ No custom GLB sockets detected. Sockets default to world position."
              : `✓ Discovered ${discoveredSockets.length} valid sockets on mech skeleton.`}
          </div>
        </div>

        {/* Sliders Grid Section */}
        <div className="space-y-3.5 bg-white/5 p-3 rounded border border-white/5">
          <div className="text-[10px] font-bold text-white/50 tracking-wider block uppercase pb-1 border-b border-white/5 flex justify-between">
            <span>PARAMETER CALIBRATOR</span>
            <span className="text-orange-400 capitalize">{blendMode}</span>
          </div>

          {/* Color & Blend Mode */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-white/70 block uppercase mb-1">Hex Color</label>
              <div className="flex gap-1.5">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-6 h-6 rounded bg-transparent cursor-pointer border border-white/10"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 bg-[#1c1c1e] text-white px-1.5 py-0.5 rounded border border-white/10 text-[10px] uppercase font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-white/70 block uppercase mb-1">Blend Mode</label>
              <select
                value={blendMode}
                onChange={(e) => setBlendMode(e.target.value)}
                className="w-full bg-[#1c1c1e] text-white py-1 px-1.5 rounded border border-white/10 text-[10px] focus:outline-none"
              >
                <option value="additive">Additive</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          </div>

          {/* Particle Count */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-white/70 uppercase">Particles Burst</span>
              <span className="font-bold text-orange-400">{particleCount} count</span>
            </div>
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={particleCount}
              onChange={(e) => setParticleCount(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Lifetime */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-white/70 uppercase">Particle Lifetime</span>
              <span className="font-bold text-orange-400">{lifetime.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.50"
              step="0.05"
              value={lifetime}
              onChange={(e) => setLifetime(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Speed */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-white/70 uppercase">Launch Velocity</span>
              <span className="font-bold text-orange-400">{speed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="25.0"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Size */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-white/70 uppercase">Particle Volume</span>
              <span className="font-bold text-orange-400">{size.toFixed(2)}m</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.80"
              step="0.02"
              value={size}
              onChange={(e) => setSize(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Spread */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-white/70 uppercase">Scattering (Spread)</span>
              <span className="font-bold text-orange-400">{(spread * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={spread}
              onChange={(e) => setSpread(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Gravity */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-white/70 uppercase">Mock Gravity</span>
              <span className="font-bold text-orange-400">{gravity.toFixed(1)} y-drift</span>
            </div>
            <input
              type="range"
              min="-12.0"
              max="12.0"
              step="0.5"
              value={gravity}
              onChange={(e) => setGravity(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Emissive Check */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="emissiveCheck"
              checked={emissive}
              onChange={(e) => setEmissive(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer rounded border-white/20"
            />
            <label htmlFor="emissiveCheck" className="text-[10px] text-white/85 cursor-pointer uppercase">
              Emissive Glow (High-Energy)
            </label>
          </div>
        </div>

        {/* Trigger Controls */}
        <div className="grid grid-cols-2 gap-2 bg-white/5 p-2 rounded border border-white/5">
          <button
            onClick={() => {
              setIsLooping(!isLooping);
            }}
            className={`w-full py-2.5 rounded border text-[10px] font-bold uppercase transition-all tracking-wider text-center cursor-pointer ${
              isLooping 
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/35"
                : "bg-white/5 border-white/10 text-[#d1d1d6] hover:bg-white/15"
            }`}
          >
            {isLooping ? "🔁 Looping [ON]" : "🔁 Looping [OFF]"}
          </button>
          <button
            onClick={() => triggerPreview(getActiveDefinition())}
            className="w-full py-2.5 rounded bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-[10px] uppercase transition-all tracking-wider text-center cursor-pointer border border-orange-500/35"
          >
            ⚡ Test Burst
          </button>
        </div>

        {/* Live Export Declarative Code Area */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold text-white/50 tracking-wider uppercase">
            <span>DECLARATIVE JSON BLUEPRINT</span>
            <span className="text-[8px] text-orange-400">Read-Only</span>
          </div>

          <textarea
            readOnly
            value={activeJsonString}
            className="w-full h-36 bg-black/80 text-[10px] text-[#7dfcff] font-mono p-2 border border-white/10 rounded focus:outline-none"
          />

          <button
            onClick={copyToClipboard}
            className="w-full flex items-center justify-center py-2 rounded bg-orange-500/10 hover:bg-orange-500/25 border border-orange-500/30 hover:border-orange-500/60 text-orange-400 transition-all font-bold text-[10px] cursor-pointer tracking-wider uppercase font-mono gap-1.5"
          >
            {copied ? "✓ Copied to Clipboard" : "⎘ Copy JSON Blueprint"}
          </button>
        </div>
      </div>

      {/* Footer System Indicator */}
      <div className="p-2 border-t border-white/5 text-[8px] text-white/30 text-center font-mono">
        Orion Modular Weaponry Workbench v2.1 • Native Frame-rate
      </div>
    </div>
  );
}
