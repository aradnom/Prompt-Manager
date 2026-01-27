interface RasterIconProps {
  name: string;
  size?: number;
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

  return (
    <img
      src={iconModule.default}
      alt={alt || name}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, opacity }}
    />
  );
}
