import React from 'react';
import logo from '@/assets/logo_v2.png';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export function BrandLogo({ size = 'md', className = '', showText = false }: BrandLogoProps) {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-48 h-48',
  };

  const textSizeMap = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative flex items-center justify-center rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95 ${sizeMap[size]}`} style={{ background: 'transparent', border: 'none', outline: 'none' }}>
        <img 
          src={logo} 
          alt="Civic Setu"
          className="w-full h-full object-cover"
          style={{ border: 'none', outline: 'none', display: 'block' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://ui-avatars.com/api/?name=Civic+Setu&background=E8821C&color=fff';
          }}
        />
      </div>
      {showText && (
        <span 
          className={`font-black tracking-tight text-white ${textSizeMap[size]}`}
          style={{ 
            fontFamily: "'Poppins', sans-serif",
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Civic <span style={{ color: '#E8821C' }}>Setu</span>
        </span>
      )}
    </div>
  );
}
