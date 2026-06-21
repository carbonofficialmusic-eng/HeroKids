export function isImageIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http");
}

export function RewardIconDisplay({
  icon,
  textClassName = "text-4xl leading-none",
  imgClassName = "w-full h-full object-contain drop-shadow-sm",
}: {
  icon: string | null | undefined;
  textClassName?: string;
  imgClassName?: string;
}) {
  const value = icon || "🎁";
  if (isImageIcon(value)) {
    return <img src={value} alt="" className={imgClassName} />;
  }
  return <span className={textClassName}>{value}</span>;
}
