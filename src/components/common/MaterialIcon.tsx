import React from 'react';

export interface MaterialIconProps {
  name: string;
  size?: number | string;
  className?: string;
  fill?: boolean;
  weight?: number;
  grade?: number;
  opticalSize?: number;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  title?: string;
}

export const MaterialIcon: React.FC<MaterialIconProps> = ({
  name,
  size = 18,
  className = '',
  fill = false,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  style,
  onClick,
  title,
}) => {
  const fontVariationSettings = `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`;
  const fontSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center leading-none ${className}`}
      style={{
        fontSize,
        fontVariationSettings,
        width: fontSize,
        height: fontSize,
        ...style,
      }}
      onClick={onClick}
      title={title}
    >
      {name}
    </span>
  );
};
