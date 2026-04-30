export function AvanceBar({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const v = Math.max(0, Math.min(100, value));
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  const color = v >= 80 ? "bg-blue-500" : v >= 50 ? "bg-emerald-500" : v >= 20 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className={`w-full overflow-hidden rounded-full bg-gray-100 ${h}`}>
      <div className={`${h} ${color} transition-[width]`} style={{ width: `${v}%` }} />
    </div>
  );
}
