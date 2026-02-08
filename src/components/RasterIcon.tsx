interface RasterIconProps {
  name: string;
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  opacity?: number;
}

const icons = import.meta.glob<{ default: string }>(
  "/src/assets/icons/*.webp",
  {
    eager: true,
  },
);

export function RasterIcon({
  name,
  size = 20,
  width,
  height,
  className = "",
  alt,
  opacity,
}: RasterIconProps) {
  const iconPath = `/src/assets/icons/${name}.webp`;
  const iconModule = icons[iconPath];

  if (!iconModule) {
    console.warn(`Icon not found: ${name}`);
    return null;
  }

  const w = width ?? size;
  const h = height ?? size;

  return (
    <img
      src={iconModule.default}
      alt={alt || name}
      width={w}
      height={h}
      className={className}
      style={{ width: w, height: h, opacity }}
    />
  );
}
