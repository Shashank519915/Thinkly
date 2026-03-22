"use client";
import { memo } from 'react';

export const LiquidGlassFilter = memo(function LiquidGlassFilter() {
    return (
        <svg style={{ width: 0, height: 0, position: 'absolute' }} aria-hidden="true" focusable="false">
            <defs>
                <filter id="liquid-glass-lens" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                    {/* 1. Heavy frosted blur */}
                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                    
                    {/* 2. Procedural liquid wave distortion (Lens curvature effect) */}
                    <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves="1" result="noise" />
                    <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" in="noise" result="lensMap" />
                    <feDisplacementMap in="blur" in2="lensMap" scale="50" xChannelSelector="R" yChannelSelector="G" result="distorted" />

                    {/* 3. Severe Chromatic Aberration at the edges (RGB shift) */}
                    <feOffset dx="-5" dy="2" in="distorted" result="red-shift" />
                    <feOffset dx="5" dy="-2" in="distorted" result="blue-shift" />
                    <feOffset dx="0" dy="0" in="distorted" result="green-shift" />

                    <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" in="red-shift" result="red-only" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" in="green-shift" result="green-only" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" in="blue-shift" result="blue-only" />

                    <feBlend mode="screen" in="red-only" in2="green-only" result="rg" />
                    <feBlend mode="screen" in="rg" in2="blue-only" result="aberration" />

                    {/* 4. Deep Saturation Boost to make colors pop through the thick glass */}
                    <feColorMatrix type="saturate" values="1.8" in="aberration" result="glassy" />
                </filter>
            </defs>
        </svg>
    )
});
