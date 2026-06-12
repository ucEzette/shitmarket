'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAppState } from '@/store/useAppState';
import { motion, AnimatePresence } from 'framer-motion';
import { Radiation, Sparkles, ShieldAlert, Info, X } from 'lucide-react';

export const CustomAlertModal: React.FC = () => {
  const customAlert = useAppState((state) => state.customAlert);
  const hideAlert = useAppState((state) => state.hideAlert);

  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number>(240); // Safe default height before measurement

  // Play a sound when the alert opens
  useEffect(() => {
    if (customAlert) {
      const triggerSound = (soundType: 'defeat' | 'victory' | 'bet') => {
        if (typeof window !== 'undefined' && (window as any).playDAppSound) {
          (window as any).playDAppSound(soundType);
        }
      };

      if (customAlert.type === 'error') {
        triggerSound('defeat');
      } else if (customAlert.type === 'success') {
        triggerSound('victory');
      } else {
        triggerSound('bet');
      }
    }
  }, [customAlert]);

  // Dynamically measure the modal container height after mount and whenever message changes
  useEffect(() => {
    if (customAlert && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const height = rect.height || containerRef.current.offsetHeight;
      if (height > 0 && height !== measuredHeight) {
        setMeasuredHeight(height);
      }
    }
  }, [customAlert, customAlert?.message, measuredHeight]);

  // Calculate anchored layout positioning dynamically relative to the viewport
  useEffect(() => {
    if (customAlert?.anchorRect) {
      const rect = customAlert.anchorRect;
      const alertWidth = 320; 
      
      // Calculate horizontal center relative to the originating element
      let left = rect.left + rect.width / 2 - alertWidth / 2;
      // Keep alert card within viewport horizontal boundaries (16px padding)
      left = Math.max(16, Math.min(left, window.innerWidth - alertWidth - 16));
      
      // Attempt to place alert below the button first
      let top = rect.top + rect.height + 8;
      // If it would overflow the bottom of the viewport, place it above instead
      if (top + measuredHeight > window.innerHeight) {
        top = rect.top - measuredHeight - 8;
      }
      // Keep top coordinate within viewport boundaries
      top = Math.max(16, Math.min(top, window.innerHeight - measuredHeight - 16));
      
      setCoords({ top, left });
    } else {
      setCoords(null);
    }
  }, [customAlert, measuredHeight]);

  if (!customAlert) return null;

  const { message, type = 'error', title, anchorRect } = customAlert;

  let borderColor = 'border-trench-sandbag';
  let textColor = 'text-white';
  let bgColor = 'bg-[#090b0e]';
  let glowShadow = 'shadow-[0_0_20px_rgba(148,163,184,0.15)]';
  let btnColorClass = 'border-trench-gasmask text-trench-gasmask hover:text-white hover:border-white';
  let arrowBorderClass = '';
  let Icon = <Info size={20} className="shrink-0" />;
  let defaultTitle = 'SYSTEM ADVISORY';

  if (type === 'error') {
    borderColor = 'border-jeet-red';
    textColor = 'text-jeet-red';
    bgColor = 'bg-[#0e0406]/95';
    glowShadow = 'shadow-[0_0_25px_rgba(255,42,77,0.35)]';
    btnColorClass = 'border-jeet-red text-jeet-red hover:bg-jeet-red hover:text-black';
    Icon = <Radiation size={20} className="text-jeet-red shrink-0 animate-pulse" />;
    defaultTitle = 'CRITICAL ERROR';
  } else if (type === 'success') {
    borderColor = 'border-neon-moon';
    textColor = 'text-neon-moon';
    bgColor = 'bg-[#040d05]/95';
    glowShadow = 'shadow-[0_0_25px_rgba(22,163,74,0.35)]';
    btnColorClass = 'border-neon-moon text-neon-moon hover:bg-neon-moon hover:text-black';
    Icon = <Sparkles size={20} className="text-neon-moon shrink-0" />;
    defaultTitle = 'MISSION ACCOMPLISHED';
  } else if (type === 'warning') {
    borderColor = 'border-moon-gold';
    textColor = 'text-moon-gold';
    bgColor = 'bg-[#0e0a03]/95';
    glowShadow = 'shadow-[0_0_25px_rgba(251,191,36,0.35)]';
    btnColorClass = 'border-moon-gold text-moon-gold hover:bg-moon-gold hover:text-black';
    Icon = <ShieldAlert size={20} className="text-moon-gold shrink-0" />;
    defaultTitle = 'SECURITY WARNING';
  }

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && (window as any).playDAppSound) {
      (window as any).playDAppSound('bet');
    }
    hideAlert();
  };

  const isAnchored = !!anchorRect && !!coords;
  const isBelow = coords && anchorRect ? coords.top > anchorRect.top : true;

  // Calculate relative arrow X coordinate inside the card
  let arrowLeft = '50%';
  if (anchorRect && coords) {
    const buttonCenter = anchorRect.left + anchorRect.width / 2;
    const relativeX = buttonCenter - coords.left;
    // Keep the arrow at least 20px away from the left/right card borders
    arrowLeft = `${Math.max(20, Math.min(relativeX, 320 - 20))}px`;
  }

  return (
    <div 
      className={`fixed inset-0 z-[10000] p-4 select-none scanlines transition-colors duration-200 ${
        isAnchored ? 'bg-black/10 pointer-events-auto' : 'bg-black/90 backdrop-blur-md flex items-center justify-center'
      }`}
      onClick={handleDismiss}
    >
      <motion.div
        ref={containerRef}
        initial={isAnchored ? { opacity: 0, scale: 0.85 } : { opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={isAnchored ? { opacity: 0, scale: 0.85 } : { opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the card
        className={`w-[320px] max-w-full border-2 rounded-lg p-5 flex flex-col relative overflow-visible ${borderColor} ${bgColor} ${glowShadow}`}
        style={isAnchored ? {
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          transformOrigin: isBelow ? 'top center' : 'bottom center'
        } : undefined}
      >
        {/* Pointer Arrow pointing to originating button */}
        {isAnchored && (
          <div
            className={`absolute w-0 h-0 border-l-[8px] border-r-[8px] border-l-transparent border-r-transparent -translate-x-1/2 ${
              isBelow 
                ? `-top-[8px] border-b-[8px] ${
                    type === 'error' ? 'border-b-[#0e0406]' :
                    type === 'success' ? 'border-b-[#040d05]' :
                    type === 'warning' ? 'border-b-[#0e0a03]' : 'border-b-[#090b0e]'
                  }` 
                : `-bottom-[8px] border-t-[8px] ${
                    type === 'error' ? 'border-t-[#0e0406]' :
                    type === 'success' ? 'border-t-[#040d05]' :
                    type === 'warning' ? 'border-t-[#0e0a03]' : 'border-t-[#090b0e]'
                  }`
            }`}
            style={{ 
              left: arrowLeft,
              filter: `drop-shadow(0 ${isBelow ? '-2px' : '2px'} 0px var(--tw-border-opacity, 1) ${
                type === 'error' ? '#FF2A4D' :
                type === 'success' ? '#16A34A' :
                type === 'warning' ? '#FBBF24' : '#1E222D'
              })`
            }}
          />
        )}

        {/* Glow scanline lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,1)_50%,rgba(0,0,0,1))] bg-[size:100%_4px] rounded-lg overflow-hidden"></div>

        {/* Top Header */}
        <div className={`flex items-center justify-between gap-3 border-b border-trench-sandbag/40 pb-3 mb-4`}>
          <div className="flex items-center gap-2">
            {Icon}
            <span className={`font-staatliches text-lg tracking-widest uppercase ${textColor}`}>
              {title || defaultTitle}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-trench-gasmask hover:text-white transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Message Content */}
        <div className="font-mono text-[10px] uppercase text-gray-300 leading-relaxed font-bold tracking-wide break-words max-h-48 overflow-y-auto mb-5 pr-1">
          {message}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-3 border-t border-trench-sandbag/20">
          <button
            onClick={handleDismiss}
            className={`px-4 py-1.5 border-2 rounded font-staatliches text-base tracking-wider uppercase transition-all duration-150 cursor-pointer active:scale-95 ${btnColorClass}`}
          >
            [ACKNOWLEDGE]
          </button>
        </div>
      </motion.div>
    </div>
  );
};
