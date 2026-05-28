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
      className={`px-3 py-1.5 bg-trench-black hover:bg-trench-sandbag text-trench-gasmask hover:text-white border border-trench-sandbag rounded font-staatliches text-xs sm:text-sm tracking-wider uppercase transition-colors font-bold ${className}`}
    >
      {children}
    </button>
  </Link>
);
