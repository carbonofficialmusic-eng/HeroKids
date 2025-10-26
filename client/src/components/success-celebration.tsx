import { useEffect, useState } from "react";

interface SuccessCelebrationProps {
  points: number;
  message: string;
  onComplete: () => void;
}

export function SuccessCelebration({
  points,
  message,
  onComplete,
}: SuccessCelebrationProps) {
  const [confettiPieces] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random(),
      color: ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EC4899"][
        Math.floor(Math.random() * 5)
      ],
    }))
  );

  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      data-testid="celebration-overlay"
    >
      <div className="relative">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className="absolute w-2 h-2 animate-confetti"
            style={{
              left: `${piece.left}%`,
              top: "-10px",
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
            }}
          />
        ))}
        <div className="animate-bounce-in text-center">
          <div
            className="text-8xl font-black font-accent gradient-text-celebration mb-4"
            data-testid="text-points-earned"
          >
            +{points} pts
          </div>
          <div className="text-3xl font-bold text-white" data-testid="text-celebration-message">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}
