export function DotDivider() {
  return (
    <div className="flex justify-center gap-1 py-4">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="rounded-full bg-cyan-medium"
          style={{ width: 3, height: 3 }}
        />
      ))}
    </div>
  );
}
