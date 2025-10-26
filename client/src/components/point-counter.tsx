import { Star } from "lucide-react";
import { useEffect, useState } from "react";

interface PointCounterProps {
  points: number;
  size?: "compact" | "standard" | "hero";
  showAnimation?: boolean;
}

export function PointCounter({
  points,
  size = "standard",
  showAnimation = false,
}: PointCounterProps) {
  const [displayPoints, setDisplayPoints] = useState(points);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (showAnimation && points !== displayPoints) {
      setIsAnimating(true);
      const duration = 500;
      const steps = 20;
      const increment = (points - displayPoints) / steps;
      let current = displayPoints;
      
      const timer = setInterval(() => {
        current += increment;
        if (
          (increment > 0 && current >= points) ||
          (increment < 0 && current <= points)
        ) {
          setDisplayPoints(points);
          setIsAnimating(false);
          clearInterval(timer);
        } else {
          setDisplayPoints(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    } else {
      setDisplayPoints(points);
    }
  }, [points, displayPoints, showAnimation]);

  const sizeClasses = {
    compact: "h-12",
    standard: "h-16",
    hero: "h-24",
  };

  const textSizeClasses = {
    compact: "text-xl",
    standard: "text-3xl",
    hero: "text-5xl",
  };

  const iconSizeClasses = {
    compact: "h-5 w-5",
    standard: "h-7 w-7",
    hero: "h-10 w-10",
  };

  return (
    <div
      className={`${sizeClasses[size]} inline-flex items-center gap-2 px-6 rounded-full gradient-celebration ${
        isAnimating ? "animate-pulse" : ""
      }`}
      data-testid="point-counter"
    >
      <Star className={`${iconSizeClasses[size]} text-white fill-white`} />
      <span
        className={`${textSizeClasses[size]} font-black font-accent text-white`}
        data-testid="text-points-value"
      >
        {displayPoints.toLocaleString()}
      </span>
    </div>
  );
}
