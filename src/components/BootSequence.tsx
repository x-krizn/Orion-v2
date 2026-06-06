/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Project ORION - Neural Boot Sequence Gatekeeper
 */

import React, { useState, useEffect } from "react";

interface BootSequenceProps {
  onConfirm: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onConfirm }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [identityInput, setIdentityInput] = useState("PE-ORION-009_BOG");
  const [bootCompleted, setBootCompleted] = useState(false);
  const [synced, setSynced] = useState(false);

  const diagnosticSteps = [
    { text: "CORE::INITIALIZING REACTOR CRUCIBLE...", delay: 400 },
    { text: "CORE::REACTOR ACTIVE. OUTPUT STATE: COLD FUSION / 1.21 GW", delay: 350 },
    { text: "MEM::MOUNTING SYNC LAYER (ZUSTAND STATE INTERFACE)... CONNECTED", delay: 300 },
    { text: "SYS::DETECTION FOR HIGH-DPI ENGINE ACCELERATION [MOBI-OOM-S24+]... INITIATED", delay: 500 },
    { text: "SYS::CHROMIUM WEBGL/WEBGL2 PIPELINES ACQUIRED. 60FPS TARGET SET.", delay: 400 },
    { text: "NET::PELORUS PILOT ENCRYPTION PROTOCOLS... LOADED", delay: 300 },
    { text: "ELO::CALCULATING TARGET PROGRESSION GATING... ZERO STAT-BLOAT CONFIRMED", delay: 450 },
    { text: "WAR::ESTABLISHING SECURE THE BOG SECTOR VECTOR CHANNELS... COMPLETE", delay: 350 },
    { text: "SYS::IDENTITY ENVELOPE ENCRYPTION DECRYPTED. WAITING FOR NEURAL LINK...", delay: 200 }
  ];

  useEffect(() => {
    if (currentStep < diagnosticSteps.length) {
      const step = diagnosticSteps[currentStep];
      const timer = setTimeout(() => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${step.text}`]);
        setCurrentStep((prev) => prev + 1);
      }, step.delay);
      return () => clearTimeout(timer);
    } else {
      setBootCompleted(true);
    }
  }, [currentStep]);

  const handleIdentityConfirm = () => {
    setSynced(true);
    // Dramatic neural coupling delay
    setTimeout(() => {
      onConfirm();
    }, 1200);
  };

  return (
    <div id="orionBootGate" className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050508] text-[#00ffcc] font-mono p-4 overflow-hidden select-none">
      {/* Scanline & CRT Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_40%,rgba(0,0,0,0.85)_100%)] z-10" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,255,200,0.03)_50%,rgba(0,0,0,0.18)_50%)] bg-[size:100%_4px] opacity-40 z-10" />
      
      {/* Glow background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg border border-cyan-500/20 bg-slate-950/75 p-6 rounded-lg backdrop-blur-md relative shadow-[0_0_35px_rgba(0,255,200,0.05)]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">ORION NEURAL KERNEL</span>
          </div>
          <span className="text-[9px] text-cyan-500/60 uppercase">SECURE_TERM_A22</span>
        </div>

        {/* Scrollable logs */}
        <div className="h-56 overflow-y-auto pr-2 space-y-1 text-[11px] leading-relaxed text-cyan-500/80 scrollbar-thin select-text">
          {logs.map((log, idx) => (
            <div key={idx} className="border-l-2 border-cyan-500/20 pl-2 animate-fade-in">
              {log}
            </div>
          ))}
          {!bootCompleted && (
            <div className="flex items-center space-x-1 pl-2 text-cyan-400">
              <span className="inline-block w-1.5 h-3.5 bg-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider animate-pulse">Running systems check...</span>
            </div>
          )}
        </div>

        {/* Action Panel Gated by Completion */}
        {bootCompleted && (
          <div className="mt-5 pt-4 border-t border-cyan-500/20 animate-fade-in flex flex-col space-y-4">
            {!synced ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-cyan-400/60 uppercase tracking-widest block">PILOT CLEARED ID</label>
                  <input
                    id="bootIdInput"
                    type="text"
                    value={identityInput}
                    onChange={(e) => setIdentityInput(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-cyan-500/30 px-3 py-2 text-xs text-white tracking-widest rounded outline-none focus:border-cyan-400 shadow-[inset_0_0_8px_rgba(0,255,200,0.05)] transition-all"
                  />
                </div>

                <button
                  id="btnNeuralLink"
                  onClick={handleIdentityConfirm}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-slate-950 hover:text-black font-black uppercase text-xs tracking-widest rounded cursor-pointer shadow-[0_0_15px_rgba(0,255,200,0.2)] hover:shadow-[0_0_25px_rgba(0,255,200,0.45)] transition-all duration-300 transform active:scale-95 text-center"
                >
                  [ ESTABLISH NEURAL DIRECT LINK ]
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 space-y-2 text-cyan-300">
                <span className="text-[10px] animate-pulse tracking-[0.25em] uppercase font-bold text-teal-400">NEURAL LINK STABLISHED. SYNCHRONIZING MIND...</span>
                <div className="w-full bg-slate-900 h-1 rounded overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-400 to-cyan-400 h-full w-full animate-[loading_1s_ease-out-in]" style={{ animationDuration: "1s" }} />
                </div>
                <span className="text-[11px] font-black tracking-widest text-[#00ffcc] animate-pulse uppercase">IDENTITY CONFIRMED. WELCOME, PILOT.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
