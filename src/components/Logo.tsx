import React from 'react';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';

interface LogoProps {
  width?: number;
  height?: number;
  color?: string;
  showText?: boolean;
}

export function Logo({
  width = 200,
  height = 60,
  color = '#5B50E8',
  showText = true
}: LogoProps) {
  const iconSize = height;
  const textHeight = height * 0.6;

  return (
    <Svg width={width} height={height} viewBox="0 0 400 120">
      {/* Icono de círculo con flecha circular */}
      <G transform="translate(20, 20)">
        {/* Círculo base */}
        <Circle
          cx="40"
          cy="40"
          r="35"
          stroke={color}
          strokeWidth="6"
          fill="none"
        />

        {/* Flecha circular (símbolo de recurrencia) */}
        <Path
          d="M 50 15 A 25 25 0 1 1 30 15"
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Punta de flecha */}
        <Path
          d="M 45 10 L 50 15 L 55 10"
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Check mark */}
        <Path
          d="M 25 40 L 35 50 L 55 30"
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>

      {/* Monedas apiladas */}
      <G transform="translate(95, 35)">
        {/* Moneda 1 (atrás) */}
        <Circle
          cx="0"
          cy="5"
          r="12"
          fill={color}
          opacity="0.4"
        />
        <Path
          d="M -8 5 Q 0 8 8 5"
          stroke={color}
          strokeWidth="2"
          fill="none"
        />

        {/* Moneda 2 (medio) */}
        <Circle
          cx="8"
          cy="15"
          r="12"
          fill={color}
          opacity="0.6"
        />
        <Path
          d="M 0 15 Q 8 18 16 15"
          stroke={color}
          strokeWidth="2"
          fill="none"
        />

        {/* Moneda 3 (adelante) */}
        <Circle
          cx="16"
          cy="25"
          r="12"
          fill={color}
          opacity="0.8"
        />
        <Path
          d="M 8 25 Q 16 28 24 25"
          stroke={color}
          strokeWidth="2"
          fill="none"
        />
      </G>

      {/* Texto "Cuotify" */}
      {showText && (
        <G>
          <SvgText
            x="140"
            y="75"
            fontSize="60"
            fontWeight="600"
            fill={color}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Cuotify
          </SvgText>
        </G>
      )}
    </Svg>
  );
}

// Versión compacta solo con el ícono
export function LogoIcon({
  size = 60,
  color = '#5B50E8'
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      {/* Círculo base */}
      <Circle
        cx="40"
        cy="40"
        r="35"
        stroke={color}
        strokeWidth="6"
        fill="none"
      />

      {/* Flecha circular (símbolo de recurrencia) */}
      <Path
        d="M 50 15 A 25 25 0 1 1 30 15"
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Punta de flecha */}
      <Path
        d="M 45 10 L 50 15 L 55 10"
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Check mark */}
      <Path
        d="M 25 40 L 35 50 L 55 30"
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
