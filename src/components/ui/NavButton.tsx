import Link from 'next/link';
import React from 'react';

interface NavButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const NavButton: React.FC<NavButtonProps> = ({ href, children, className }) => (
  <Link href={href}>
    <button
      className={`px-3 py-1.5 retro-btn bg-black text-white hover:text-neon-moon border-2 border-transparent hover:border-neon-moon font-staatliches text-xs sm:text-sm tracking-wider uppercase transition-colors font-bold ${className || ''}`}
    >
      {children}
    </button>
  </Link>
);
