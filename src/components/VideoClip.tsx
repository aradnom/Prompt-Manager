import { cn } from "@/lib/utils";

interface VideoClipProps {
  name: string;
  aspectRatio?: string;
  className?: string;
}

export function VideoClip({ name, aspectRatio, className }: VideoClipProps) {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      className={cn("w-full", className)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      <source src={`/video/${name}.mp4`} type="video/mp4" />
    </video>
  );
}
