import React from 'react';

// Custom pixel art SVGs to match the high-fidelity degen military look and feel.
export const PixelPepe: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 80 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Rusty Helmet */}
    <rect x="8" y="1" width="16" height="6" fill="#5C5244" />
    <rect x="7" y="3" width="18" height="3" fill="#3D362C" />
    <rect x="6" y="5" width="20" height="2" fill="#2A241A" />
    <rect x="5" y="7" width="22" height="1" fill="#FFD700" /> {/* Gold helmet trim */}
    {/* Helmet strap */}
    <rect x="11" y="8" width="1" height="4" fill="#3A2512" />
    <rect x="20" y="8" width="1" height="4" fill="#3A2512" />

    {/* Pepe Green Face */}
    <rect x="9" y="8" width="14" height="10" fill="#16A34A" />
    <rect x="7" y="10" width="18" height="6" fill="#2EBE10" />
    
    {/* Smug Eyes */}
    <rect x="9" y="9" width="5" height="3" fill="#FFFFFF" />
    <rect x="18" y="9" width="5" height="3" fill="#FFFFFF" />
    <rect x="11" y="10" width="2" height="2" fill="#000000" /> {/* Pupils looking smugly to the right */}
    <rect x="20" y="10" width="2" height="2" fill="#000000" />
    <rect x="9" y="8" width="5" height="1" fill="#2B0008" /> {/* Eyebrows */}
    <rect x="18" y="8" width="5" height="1" fill="#2B0008" />

    {/* Big Green Cheeks */}
    <rect x="6" y="13" width="3" height="3" fill="#153E04" />
    <rect x="23" y="13" width="3" height="3" fill="#153E04" />

    {/* Smug Red Lips */}
    <rect x="10" y="15" width="12" height="1" fill="#FF073A" />
    <rect x="9" y="16" width="14" height="2" fill="#900C27" />
    <rect x="11" y="18" width="10" height="1" fill="#2B0008" />

    {/* Shadow neck */}
    <rect x="12" y="18" width="8" height="4" fill="#153E04" />
    <rect x="9" y="22" width="14" height="6" fill="#2A241A" /> {/* Dark combat uniform */}
    <rect x="14" y="24" width="4" height="4" fill="#5C5244" /> {/* Tactical chest harness */}
  </svg>
);

export const PixelChadBull: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Horns */}
    <rect x="4" y="4" width="2" height="6" fill="#F3F4F6" />
    <rect x="5" y="6" width="2" height="4" fill="#D1D5DB" />
    <rect x="26" y="4" width="2" height="6" fill="#F3F4F6" />
    <rect x="25" y="6" width="2" height="4" fill="#D1D5DB" />
    
    {/* Bull Head */}
    <rect x="7" y="10" width="18" height="14" fill="#3A2512" />
    <rect x="9" y="11" width="14" height="12" fill="#5C3A21" />
    <rect x="6" y="14" width="20" height="6" fill="#3A2512" />
    
    {/* Chad Chin / Jawline */}
    <rect x="11" y="22" width="10" height="5" fill="#3A2512" />
    <rect x="12" y="24" width="8" height="2" fill="#FFD700" /> {/* Glowing gold Chad highlight */}
    
    {/* Glowing Neon Green Eyes */}
    <rect x="9" y="14" width="4" height="2" fill="#16A34A" />
    <rect x="19" y="14" width="4" height="2" fill="#16A34A" />
    <rect x="10" y="15" width="2" height="1" fill="#FFFFFF" />

    {/* Nostrils blowing steam */}
    <rect x="12" y="21" width="2" height="2" fill="#1E120A" />
    <rect x="18" y="21" width="2" height="2" fill="#1E120A" />
    <rect x="10" y="23" width="2" height="1" fill="#E5E7EB" opacity="0.6" />
    <rect x="20" y="23" width="2" height="1" fill="#E5E7EB" opacity="0.6" />
  </svg>
);

export const PixelSkeletonBear: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Round ears with skeletal decay */}
    <rect x="7" y="6" width="5" height="5" fill="#1F2937" />
    <rect x="8" y="7" width="3" height="3" fill="#111827" />
    <rect x="20" y="6" width="5" height="5" fill="#1F2937" />
    <rect x="21" y="7" width="2" height="2" fill="#FF073A" opacity="0.5" /> {/* blood stain */}

    {/* Bear Skull Face */}
    <rect x="6" y="10" width="20" height="16" fill="#E5E7EB" />
    <rect x="8" y="11" width="16" height="14" fill="#F9FAFB" />
    <rect x="7" y="13" width="18" height="10" fill="#9CA3AF" />

    {/* Sunken eye sockets with electric red pupils */}
    <rect x="9" y="13" width="4" height="4" fill="#000000" />
    <rect x="19" y="13" width="4" height="4" fill="#000000" />
    <rect x="10" y="14" width="2" height="2" fill="#FF073A" className="animate-pulse" />
    <rect x="20" y="14" width="2" height="2" fill="#FF073A" className="animate-pulse" />

    {/* Nose socket */}
    <rect x="14" y="18" width="4" height="3" fill="#000000" />

    {/* Skeletal teeth */}
    <rect x="10" y="22" width="12" height="1" fill="#000000" />
    <rect x="11" y="23" width="1" height="2" fill="#000000" />
    <rect x="13" y="23" width="1" height="2" fill="#000000" />
    <rect x="15" y="23" width="1" height="2" fill="#000000" />
    <rect x="17" y="23" width="1" height="2" fill="#000000" />
    <rect x="19" y="23" width="1" height="2" fill="#000000" />
    <rect x="21" y="23" width="1" height="2" fill="#000000" />
    
    {/* Cracks in skull */}
    <rect x="15" y="8" width="2" height="3" fill="#9CA3AF" />
    <rect x="16" y="11" width="1" height="2" fill="#4B5563" />
  </svg>
);

export const MedalFirstBlood: React.FC<{ className?: string; size?: number; locked?: boolean }> = ({
  className = '',
  size = 64,
  locked = false
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Ribbon */}
    <rect x="12" y="2" width="8" height="10" fill={locked ? '#4B5563' : '#FF073A'} />
    <rect x="14" y="2" width="4" height="10" fill={locked ? '#374151' : '#B91C1C'} />
    
    {/* Medal Border (Bronze/Iron feel or Silver if locked) */}
    <circle cx="16" cy="20" r="8" fill={locked ? '#374151' : '#C0C0C0'} />
    <circle cx="16" cy="20" r="7" fill={locked ? '#4B5563' : '#8C7853'} />
    <circle cx="16" cy="20" r="5" fill={locked ? '#1F2937' : '#B08D57'} />

    {/* Center Blood Drop (Red) or greyed out skull */}
    {locked ? (
      <rect x="14" y="18" width="4" height="4" fill="#374151" />
    ) : (
      <>
        <path d="M16 15 L19 20 A3 3 0 0 1 13 20 Z" fill="#FF073A" />
        <rect x="15" y="19" width="1" height="2" fill="#FFFFFF" />
      </>
    )}
  </svg>
);

export const MedalMoonMillionaire: React.FC<{ className?: string; size?: number; locked?: boolean }> = ({
  className = '',
  size = 64,
  locked = false
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Ribbon - Gold and Green stripe */}
    <rect x="10" y="2" width="12" height="10" fill={locked ? '#4B5563' : '#16A34A'} />
    <rect x="13" y="2" width="6" height="10" fill={locked ? '#374151' : '#FFD700'} />

    {/* Large Shiny Gold Medal (Sleek gold coin) */}
    <circle cx="16" cy="20" r="8" fill={locked ? '#374151' : '#FFD700'} />
    <circle cx="16" cy="20" r="6" fill={locked ? '#1F2937' : '#FFDF00'} />
    <circle cx="16" cy="20" r="5" fill={locked ? '#4B5563' : '#D4AF37'} />

    {/* Floating Rocket inside */}
    {locked ? (
      <rect x="14" y="17" width="4" height="6" fill="#374151" />
    ) : (
      <>
        <rect x="15" y="16" width="2" height="6" fill="#FFFFFF" />
        <rect x="14" y="18" width="4" height="3" fill="#FF073A" />
        <rect x="15" y="22" width="2" height="2" fill="#FFD700" /> {/* Thrust flame */}
      </>
    )}
  </svg>
);

export const MedalSerialJeeter: React.FC<{ className?: string; size?: number; locked?: boolean }> = ({
  className = '',
  size = 64,
  locked = false
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Ribbon - Red/Purple camo stripe */}
    <rect x="11" y="2" width="10" height="10" fill={locked ? '#4B5563' : '#FF073A'} />
    <rect x="14" y="2" width="4" height="10" fill={locked ? '#1F2937' : '#900C27'} />

    {/* Skull shaped Medal (Dull lead/metal feel) */}
    <rect x="11" y="14" width="10" height="10" fill={locked ? '#374151' : '#8B8B7A'} />
    <rect x="12" y="15" width="8" height="11" fill={locked ? '#4B5563' : '#A9A9A9'} />
    
    {/* Skull eyes */}
    <rect x="13" y="17" width="2" height="2" fill="#000000" />
    <rect x="17" y="17" width="2" height="2" fill="#000000" />
    
    {/* Skeletal red glow */}
    {!locked && (
      <>
        <rect x="13" y="17" width="1" height="1" fill="#FF073A" />
        <rect x="17" y="17" width="1" height="1" fill="#FF073A" />
      </>
    )}
    
    {/* Skull teeth */}
    <rect x="14" y="22" width="4" height="3" fill={locked ? '#374151' : '#E5E7EB'} />
    <rect x="15" y="23" width="1" height="2" fill="#000000" />
    <rect x="17" y="23" width="1" height="2" fill="#000000" />
  </svg>
);

export const MedalTrenchVet: React.FC<{ className?: string; size?: number; locked?: boolean }> = ({
  className = '',
  size = 64,
  locked = false
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Ribbon - Muddy brown ribbon with yellow borders */}
    <rect x="10" y="2" width="12" height="10" fill={locked ? '#374151' : '#FFD700'} />
    <rect x="12" y="2" width="8" height="10" fill={locked ? '#4B5563' : '#2A241A'} />

    {/* Iron Cross Star Shield */}
    <rect x="14" y="12" width="4" height="16" fill={locked ? '#1F2937' : '#5C5244'} />
    <rect x="8" y="18" width="16" height="4" fill={locked ? '#1F2937' : '#5C5244'} />
    <rect x="11" y="15" width="10" height="10" fill={locked ? '#374151' : '#8B8B7A'} />
    <circle cx="16" cy="20" r="3" fill={locked ? '#4B5563' : '#FFD700'} />
  </svg>
);

export const PixelGasMask: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Mask Hood */}
    <rect x="6" y="4" width="12" height="14" fill="#2A241A" />
    <rect x="5" y="7" width="14" height="9" fill="#1E120A" />

    {/* Large Glass Eyepieces */}
    <rect x="7" y="7" width="4" height="4" fill="#5C5244" />
    <rect x="13" y="7" width="4" height="4" fill="#5C5244" />
    <rect x="8" y="8" width="2" height="2" fill="#16A34A" opacity="0.8" /> {/* Green reflection */}
    <rect x="14" y="8" width="2" height="2" fill="#16A34A" opacity="0.8" />

    {/* Snout / Filter connection */}
    <rect x="10" y="11" width="4" height="4" fill="#5C5244" />
    <rect x="9" y="14" width="6" height="6" fill="#8B8B7A" /> {/* Iron canister filter */}
    <rect x="10" y="16" width="4" height="3" fill="#2A241A" />
    <rect x="11" y="15" width="2" height="1" fill="#FFD700" />
  </svg>
);

export const PixelShovel: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Handle / Stem (Wood) */}
    <rect x="4" y="18" width="2" height="2" fill="#5C3A21" />
    <rect x="6" y="16" width="2" height="2" fill="#5C3A21" />
    <rect x="8" y="14" width="2" height="2" fill="#5C3A21" />
    <rect x="10" y="12" width="2" height="2" fill="#5C3A21" />
    <rect x="12" y="10" width="2" height="2" fill="#5C3A21" />
    <rect x="14" y="8" width="2" height="2" fill="#5C3A21" />

    {/* D-Ring Grip */}
    <rect x="2" y="20" width="4" height="1" fill="#3A2512" />
    <rect x="1" y="21" width="1" height="2" fill="#3A2512" />
    <rect x="4" y="21" width="1" height="2" fill="#3A2512" />
    <rect x="2" y="23" width="3" height="1" fill="#3A2512" />

    {/* Iron Spade Head */}
    <rect x="14" y="8" width="3" height="3" fill="#8B8B7A" />
    <rect x="16" y="6" width="4" height="4" fill="#8B8B7A" />
    <rect x="18" y="4" width="4" height="4" fill="#D1D5DB" /> {/* Shiny spade edge */}
    <rect x="21" y="3" width="2" height="2" fill="#FFFFFF" />
    <rect x="15" y="9" width="1" height="1" fill="#5C5244" />
  </svg>
);

export const PixelCrackedHelmet: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Helmet dome (gritty green-brown) */}
    <rect x="6" y="4" width="12" height="12" fill="#5C5244" />
    <rect x="4" y="7" width="16" height="8" fill="#3D362C" />
    <rect x="3" y="10" width="18" height="4" fill="#2A241A" />
    <rect x="2" y="13" width="20" height="2" fill="#1E120A" /> {/* Brim */}

    {/* Bullet hole & cracks */}
    <rect x="10" y="8" width="2" height="2" fill="#000000" /> {/* Impact bullet hole */}
    <rect x="9" y="7" width="1" height="1" fill="#8B8B7A" /> {/* Crack line */}
    <rect x="8" y="6" width="1" height="1" fill="#8B8B7A" />
    <rect x="12" y="10" width="1" height="1" fill="#8B8B7A" />
    <rect x="13" y="11" width="1" height="1" fill="#8B8B7A" />

    {/* Rust spots */}
    <rect x="15" y="6" width="2" height="1" fill="#B08D57" />
    <rect x="6" y="11" width="1" height="2" fill="#B08D57" />
  </svg>
);

export const PixelBarbedWire: React.FC<{ className?: string; height?: number }> = ({ className = '', height = 16 }) => (
  <svg
    width="100%"
    height={height}
    viewBox="0 0 200 16"
    preserveAspectRatio="none"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} image-render-pixel`}
  >
    {/* Wire core */}
    <path d="M0 8 Q 25 12, 50 8 T 100 8 T 150 8 T 200 8" stroke="#8B8B7A" strokeWidth="2" strokeDasharray="1 1" />
    <path d="M0 6 Q 25 2, 50 6 T 100 6 T 150 6 T 200 6" stroke="#5C5244" strokeWidth="1" />

    {/* Sharp barbs */}
    <path d="M22 4 L26 12 M26 4 L22 12" stroke="#D1D5DB" strokeWidth="2" />
    <path d="M72 4 L76 12 M76 4 L72 12" stroke="#D1D5DB" strokeWidth="2" />
    <path d="M122 4 L126 12 M126 4 L122 12" stroke="#D1D5DB" strokeWidth="2" />
    <path d="M172 4 L176 12 M176 4 L172 12" stroke="#D1D5DB" strokeWidth="2" />
  </svg>
);
