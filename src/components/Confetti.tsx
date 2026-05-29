import { useEffect, useRef } from "react";

interface ConfettiProps {
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = [
  "#FF6B6B", // Red coral
  "#4D96FF", // Blue
  "#6BCB77", // Green
  "#FFD93D", // Gold/Yellow
  "#F473B9", // Pink
  "#A084CF", // Purple
  "#FF9F29", // Orange
];

export default function Confetti({ active }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      particlesRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Initial particles popping from center/bottom
    const createParticle = (isInitial = false): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      
      return {
        x: isInitial ? canvas.width * 0.5 : Math.random() * canvas.width,
        y: isInitial ? canvas.height * 0.45 : -20,
        size: 5 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        speedX: isInitial ? Math.cos(angle) * speed : -2 + Math.random() * 4,
        speedY: isInitial ? Math.sin(angle) * speed - 5 : 2 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotationSpeed: -5 + Math.random() * 10,
      };
    };

    // Burst initial confetti!
    for (let i = 0; i < 150; i++) {
      particlesRef.current.push(createParticle(true));
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // We maintain about 150-200 particles
      if (particlesRef.current.length < 180 && Math.random() < 0.4) {
        particlesRef.current.push(createParticle(false));
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.speedX;
        p.y += p.speedY;

        // Apply a bit of gravity and air resistance
        p.speedY += 0.12; 
        p.speedX *= 0.98;
        p.rotation += p.rotationSpeed;

        // Draw particle (rotated rectangle)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();

        // Remove if off bounds
        if (p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) {
          particlesRef.current.splice(i, 1);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      id="confetti-canvas"
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
}
