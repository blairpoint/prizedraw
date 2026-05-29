import React, { useState, useEffect, useRef } from "react";
import { Prize, Participant, TicketEntry, DrawResult, Sponsor } from "../types";
import { Trophy, HelpCircle, AlertTriangle, Play, Sparkles, Volume2, VolumeX, Shuffle, RefreshCw, Layers, CheckCircle2, Award, Sparkle } from "lucide-react";
import { playTick, playRumbleTick, playCelebration, playChime } from "../utils/audio";
import SponsorSlideshow, { getSponsorKey } from "./SponsorSlideshow";
import { SpizzicoLogo, SuperfinaLogo, WakaGoldLogo, PallyLogo } from "./SponsorsShowcase";
import PrizeWinnersWall from "./PrizeWinnersWall";
import { fetchTransitionsCfg, DEFAULT_TRANSITIONS, TransitionTimers } from "../utils/transitionsParser";
import { matchSponsorFiles } from "../utils/sponsorFiles";
import sponsorFilesManifest from "../data/sponsorFilesManifest.json";

const getImageUrl = (src: string | undefined, defaultPath: string, sponsorName?: string) => {
  if (!src) {
    if (sponsorName) {
      const { logo } = matchSponsorFiles(sponsorName, sponsorFilesManifest);
      if (logo) return logo;
    }
    return defaultPath;
  }
  if (src.startsWith("data:") || src.startsWith("/") || src.startsWith("http")) return src;
  
  // Fuzzy search in manifest
  const match = sponsorFilesManifest.find(f => f.toLowerCase() === src.toLowerCase());
  if (match) return `/sponsorfiles/${match}`;
  
  const baseName = src.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const fuzzyMatch = sponsorFilesManifest.find(f => {
    const fileClean = f.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/g, "");
    return fileClean.includes(baseName) || baseName.includes(fileClean);
  });
  if (fuzzyMatch) return `/sponsorfiles/${fuzzyMatch}`;

  return `/sponsorfiles/${src}`;
};

interface RaffleSpinnerProps {
  prizes: Prize[];
  setPrizes: React.Dispatch<React.SetStateAction<Prize[]>>;
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  onDrawComplete: (result: DrawResult) => void;
  drawHistory: DrawResult[];
  isSimpleMode?: boolean;
  isTotallyFullScreen?: boolean;
  sponsors?: Sponsor[];
  onToggleClaim?: (id: string, currentClaimed: boolean) => void;
  onAdditionalPrizeWon?: (id: string, prize: string) => void;
  isDebugMode?: boolean;
}

export default function RaffleSpinner({
  prizes,
  setPrizes,
  participants,
  setParticipants,
  onDrawComplete,
  drawHistory,
  isSimpleMode = false,
  isTotallyFullScreen = false,
  sponsors = [],
  onToggleClaim,
  onAdditionalPrizeWon,
  isDebugMode = false,
}: RaffleSpinnerProps) {
  // Simple Mode presentation progression: "ready" | "video" | "spinner" | "winners"
  const [simpleState, setSimpleState] = useState<"ready" | "video" | "spinner" | "winners">("video");
  const [videoTarget, setVideoTarget] = useState<"spinner" | "winners" | "spin">("spinner");

  useEffect(() => {
    if (isSimpleMode) {
      setSimpleState("video");
      setVideoTarget("spinner");
    }
  }, [isSimpleMode]);

  // YouTube Iframe Player API Setup for automatic advancement
  useEffect(() => {
    if (!isSimpleMode || simpleState !== "video") return;

    let player: any = null;
    const checkYT = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        player = new (window as any).YT.Player("youtube-player-iframe", {
          events: {
            onReady: (event: any) => {
              try {
                event.target.playVideo();
              } catch (e) {
                console.warn("Autoplay was blocked or failed:", e);
              }
            },
            onStateChange: (event: any) => {
              // 0 matches YT.PlayerState.ENDED
              if (event.data === 0) {
                if (videoTarget === "winners") {
                  setSimpleState("winners");
                } else if (videoTarget === "spin") {
                  setSimpleState("spinner");
                  if (nextDrawType === "wheel") {
                    setCountdownVal(timers.id4_pause || 20);
                    setDrawPhase("idle");
                  } else {
                    handleStartDraw();
                  }
                } else {
                  setSimpleState("spinner");
                }
              }
            },
            onError: () => {
              console.warn("YouTube player loaded with warning or error status");
            }
          }
        });
      }
    };

    // Auto load base script if not available
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Poller to initialize player when API is ready
    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        checkYT();
        clearInterval(interval);
      }
    }, 300);

    return () => {
      clearInterval(interval);
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
    };
  }, [isSimpleMode, simpleState]);

  // Config state
  const [selectedPrizeId, setSelectedPrizeId] = useState<string>("");
  const [useTicketsWeighted, setUseTicketsWeighted] = useState(true); // Weighted by ticket count
  const [paidOnly, setPaidOnly] = useState(true); // Filter by status === "Paid"
  const [excludePastWinners, setExcludePastWinners] = useState(true); // Deduplicate winners
  const [duration, setDuration] = useState(4.5); // Spin duration in seconds
  const [turboMode, setTurboMode] = useState(false); // Turbo Mode toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Core spinning states
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeRollName, setActiveRollName] = useState<string>("Ready to Spin");
  const [activeRollTicket, setActiveRollTicket] = useState<string>("#00000000");
  const [tickerFlash, setTickerFlash] = useState(false);
  
  // Confetti reveal states
  const [winnerReveal, setWinnerReveal] = useState<{
    id: string;
    participant: Participant;
    prize: Prize;
    ticketNum: number;
    timestamp?: string;
    drawnTimeMs?: number;
  } | null>(null);

  // Countdown timer for 11 minutes when winner is revealed in Simple Mode
  const [countdownSeconds, setCountdownSeconds] = useState<number>(11 * 60);

  // Autopilot states
  const [isAutopilot, setIsAutopilot] = useState<boolean>(true);
  const [activeWedgeIndex, setActiveWedgeIndex] = useState<number>(0);
  const lastWedgeRef = useRef<number>(-1);

  // Gameshow drawing pipeline state
  const [drawPhase, setDrawPhase] = useState<"idle" | "round_intro" | "spinning_winner" | "congrats_countdown" | "wheel_intro" | "wheel_spinning" | "ball_intro" | "ball_spinning" | "ball_reveal" | "victory_screen" | "victory_promo_flip" | "autopilot_countdown">("idle");
  const [drawnWinner, setDrawnWinner] = useState<Participant | null>(null);
  const [drawnTicketIndex, setDrawnTicketIndex] = useState<number>(1);
  const [countdownVal, setCountdownVal] = useState<number>(30);
  
  // Dynamic transition step timer config values
  const [timers, setTimers] = useState<TransitionTimers>(DEFAULT_TRANSITIONS);

  useEffect(() => {
    fetchTransitionsCfg().then(parsed => {
      setTimers(parsed);
      // Initialize countdownVal dynamically based on general or autopilot countdown
      setCountdownVal(parsed.autopilot_countdown);
    });
  }, []);
  const [wheelSponsors, setWheelSponsors] = useState<string[]>([]);
  const [wonSponsor, setWonSponsor] = useState<string>("");
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [wheelAngle, setWheelAngle] = useState<number>(0);
  const [isWheelZoomed, setIsWheelZoomed] = useState<boolean>(false);

  // Magic Ball Cage state
  const [nextDrawType, setNextDrawType] = useState<"wheel" | "ball">("wheel");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cageAngle, setCageAngle] = useState<number>(0);
  const [isSpatActive, setIsSpatActive] = useState<boolean>(false);
  const [spatBallY, setSpatBallY] = useState<number>(180);
  const [spatBallColor, setSpatBallColor] = useState<string>("#EC4899");
  const [spatBallLabel, setSpatBallLabel] = useState<string>("7");
  const [ballFlipState, setBallFlipState] = useState<"hidden" | "flipping" | "revealed">("hidden");

  interface LottoBall {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    label: string;
  }

  const ballsRef = useRef<LottoBall[]>([]);

  // Simulation effect for lotto balls inside the lottery drum
  useEffect(() => {
    if (drawPhase !== "ball_intro" && drawPhase !== "ball_spinning") {
      ballsRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI Canvas Scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Initialize list of balls
    if (ballsRef.current.length === 0) {
      const arr: LottoBall[] = [];
      const count = 30;
      const CX = width / 2;
      const CY = height / 2;
      const R = width / 2 - 12;

      const colors = [
        "#EC4899", // Pink
        "#FBBF24", // Yellow
        "#10B981", // Green
        "#F59E0B", // Orange
        "#3B82F6", // Blue
        "#EF4444", // Red
        "#8B5CF6", // Purple
        "#06B6D4", // Cyan
      ];

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (R * 0.75);
        const x = CX + Math.cos(angle) * dist;
        const y = CY + Math.sin(angle) * dist;

        const speed = 4 + Math.random() * 5;
        const moveAngle = Math.random() * Math.PI * 2;

        arr.push({
          x,
          y,
          vx: Math.cos(moveAngle) * speed,
          vy: Math.sin(moveAngle) * speed,
          radius: width / 30, // appropriate size inside circle
          color: colors[i % colors.length],
          label: String(((i + 7) % 49) + 1), // Numbers from 1 to 49
        });
      }
      ballsRef.current = arr;
    }

    let animId: number;
    let localCageAngle = cageAngle;

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, width, height);

      const CX = width / 2;
      const CY = height / 2;
      const R = width / 2 - 10;

      const balls = ballsRef.current;
      const agitation = drawPhase === "ball_spinning" ? 0.45 : 0.15;
      const gravity = 0.08;

      // Update position, velocity, and bounce walls
      for (const b of balls) {
        b.vy += gravity;

        // Apply energetic blowing upward forces
        if (Math.random() < 0.15) {
          b.vy -= Math.random() * agitation * 3.5;
          b.vx += (Math.random() * 2 - 1) * agitation * 2;
        }

        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const maxSpeed = drawPhase === "ball_spinning" ? 11 : 4.5;
        const minSpeed = drawPhase === "ball_spinning" ? 2.5 : 1.0;

        if (speed > maxSpeed) {
          b.vx = (b.vx / speed) * maxSpeed;
          b.vy = (b.vy / speed) * maxSpeed;
        } else if (speed < minSpeed) {
          const angle = Math.random() * Math.PI * 2;
          b.vx += Math.cos(angle) * 0.5;
          b.vy += Math.sin(angle) * 0.5;
        }

        b.x += b.vx;
        b.y += b.vy;

        // Circle bounds collision
        const dx = b.x - CX;
        const dy = b.y - CY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist + b.radius > R) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push back in
          b.x = CX + (R - b.radius) * nx;
          b.y = CY + (R - b.radius) * ny;

          // Reflect
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) {
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
          }

          b.vx *= 1.015;
          b.vy *= 1.015;
        }
      }

      // Ball to ball collision
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minD = b1.radius + b2.radius;

          if (dist < minD && dist > 0) {
            const overlap = minD - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            b1.x -= nx * overlap * 0.5;
            b1.y -= ny * overlap * 0.5;
            b2.x += nx * overlap * 0.5;
            b2.y += ny * overlap * 0.5;

            const rvx = b2.vx - b1.vx;
            const rvy = b2.vy - b1.vy;
            const velNormal = rvx * nx + rvy * ny;

            if (velNormal < 0) {
              const impulse = -(1.85) * velNormal / 2;
              b1.vx -= impulse * nx;
              b1.vy -= impulse * ny;
              b2.vx += impulse * nx;
              b2.vy += impulse * ny;
            }
          }
        }
      }

      // Draw all balls
      for (const b of balls) {
        ctx.beginPath();
        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.35,
          b.y - b.radius * 0.35,
          b.radius * 0.1,
          b.x,
          b.y,
          b.radius
        );
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.35, b.color);
        grad.addColorStop(1, "#0a0a0f");

        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.52, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fill();

        ctx.fillStyle = "#030202";
        ctx.font = `bold ${Math.round(b.radius * 0.58)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.label, b.x, b.y);
      }

      // Rotate the cageAngle under ball_spinning
      if (drawPhase === "ball_spinning") {
        localCageAngle = (localCageAngle + 2) % 360;
        setCageAngle(localCageAngle);
      } else if (drawPhase === "ball_intro") {
        localCageAngle = (localCageAngle + 0.3) % 360;
        setCageAngle(localCageAngle);
      }

      animId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [drawPhase]);

  const renderWheelSvg = () => {
    const numSlices = wheelSponsors.length || 1;
    const radius = 180;
    const center = 200;
    
    return (
      <svg className="w-full h-full select-none" viewBox="0 0 400 400">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.9" floodColor="#000000"/>
          </filter>
          <radialGradient id="hubGold" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF2A3" />
            <stop offset="70%" stopColor="#D9A406" />
            <stop offset="100%" stopColor="#8F6300" />
          </radialGradient>
          <radialGradient id="neonGlowRing" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="#000000" stopOpacity="0" />
            <stop offset="97%" stopColor="#EC4899" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Outer glowing border rim like the image */}
        <circle cx={center} cy={center} r={radius + 14} fill="#000000" stroke="#E0338F" strokeWidth="8" />
        <circle cx={center} cy={center} r={radius + 6} fill="#FABE00" stroke="#000000" strokeWidth="4" />
        <circle cx={center} cy={center} r={radius} fill="#111111" />

        {/* Wedges */}
        {wheelSponsors.map((sponsor, idx) => {
          const startAngle = (idx * 360) / numSlices;
          const endAngle = ((idx + 1) * 360) / numSlices;
          
          const startRad = ((startAngle - 90) * Math.PI) / 180;
          const endRad = ((endAngle - 90) * Math.PI) / 180;
          
          const x1 = center + radius * Math.cos(startRad);
          const y1 = center + radius * Math.sin(startRad);
          const x2 = center + radius * Math.cos(endRad);
          const y2 = center + radius * Math.sin(endRad);
          
          const pathData = `
            M ${center} ${center}
            L ${x1} ${y1}
            A ${radius} ${radius} 0 0 1 ${x2} ${y2}
            Z
          `;
          
          // Wheel start sequence logic
          let sliceColor = "#111111"; // Default black
          const finalColor = idx % 2 === 0 ? "#FFFFFF" : "#EC4899";
          let isBlack = true;

          if (drawPhase === "wheel_intro") {
            const unveiledCount = numSlices - countdownVal;
            if (idx < unveiledCount) {
              sliceColor = finalColor;
              isBlack = false;
            }
          } else if (
            drawPhase === "wheel_spinning" ||
            drawPhase === "victory_screen" ||
            drawPhase === "victory_promo_flip" ||
            drawPhase === "congrats_countdown" ||
            drawPhase === "spinning_winner" ||
            drawPhase === "round_intro" ||
            drawPhase === "autopilot_countdown" || 
            drawPhase === "idle"
          ) {
            // Keep the final white/pink pattern around the wheel after it's been unveiled
            sliceColor = finalColor;
            isBlack = false;
          }
          
          const textAngle = startAngle + 180 / numSlices - 90;
          const textAngleRad = (textAngle * Math.PI) / 180;
          const textDist = radius * 0.58;
          const textX = center + textDist * Math.cos(textAngleRad);
          const textY = center + textDist * Math.sin(textAngleRad);
          
          // Determine if this is the currently selected active wedge pointing at the top pointer (index 0 is active)
          const isActive = idx === activeWedgeIndex;
          
          // Pegs coordinates at division boundaries
          const pegRad = (startAngle - 90) * Math.PI / 180;
          const pegX = center + (radius - 8) * Math.cos(pegRad);
          const pegY = center + (radius - 8) * Math.sin(pegRad);

          return (
            <g key={`slice-${idx}`} className="transition-all duration-300">
              {/* Sector slice path with dimmed opacity if not active */}
              <path
                d={pathData}
                fill={sliceColor}
                stroke="#000000"
                strokeWidth="4"
                opacity={isBlack ? "1.0" : (isActive ? "1.0" : "0.32")}
                style={{ filter: isActive ? "drop-shadow(0 0 8px rgba(250,204,21,0.5))" : "none" }}
              />

              {/* Bold Outlined Radial Text showing ONLY for the currently active wedge under pointer for safety & maximum readability */}
              {isActive && !isBlack && (
                <g transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}>
                  {/* Thick custom black backdrop stroke for extreme high contrast readability */}
                  <text
                    x={textX}
                    y={textY}
                    fill="#000"
                    stroke="#000"
                    strokeWidth="8"
                    strokeLinejoin="round"
                    fontWeight="1000"
                    fontSize="17"
                    fontFamily="'Space Grotesk', 'Impact', 'Inter', sans-serif"
                    textAnchor="middle"
                    className="uppercase tracking-widest select-none pointer-events-none"
                  >
                    {sponsor.substring(0, 15)}
                  </text>
                  <text
                    x={textX}
                    y={textY}
                    fill="#FFF"
                    stroke={sliceColor === "#E2E8F0" ? "#000" : "#FBBF24"}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fontWeight="1000"
                    fontSize="17"
                    fontFamily="'Space Grotesk', 'Impact', 'Inter', sans-serif"
                    textAnchor="middle"
                    className="uppercase tracking-widest select-none pointer-events-none text-glow-gold animate-pulse"
                  >
                    {sponsor.substring(0, 15)}
                  </text>
                </g>
              )}

              {/* Physical Peg Points (little glowing circular nodes) around the outer perimeter ring */}
              <circle 
                cx={pegX} 
                cy={pegY} 
                r="5" 
                fill="#FFFFFF" 
                stroke="#000000" 
                strokeWidth="2" 
                className="shadow-[0_0_8px_#FFF]"
              />
              <circle 
                cx={pegX} 
                cy={pegY} 
                r="2" 
                fill="#FABE00" 
              />
            </g>
          );
        })}
        
        {/* Hub Circle center decorations with gold gradients */}
        <circle cx={center} cy={center} r="35" fill="url(#hubGold)" stroke="#000" strokeWidth="4" />
        <circle cx={center} cy={center} r="20" fill="#111111" stroke="#FABE00" strokeWidth="2" />
        <circle cx={center} cy={center} r="8" fill="#E0338F" />
      </svg>
    );
  };

  const renderPromoProduct = (sponsorName: string, prize?: Prize) => {
    const normSponsor = sponsorName.toLowerCase().trim();
    
    // Check if there are any specific custom prize images upload
    let prizeImgSrc = "";
    if (prize?.prizeImages) {
      const imgs = prize.prizeImages.split(",").map(i => i.trim()).filter(Boolean);
      if (imgs.length > 0) {
        prizeImgSrc = getImageUrl(imgs[0], `/GAMEFILES/${imgs[0]}`, sponsorName);
      }
    } else {
      // Check if custom sponsor has ad images
      const customSponsor = sponsors.find(s => s.name.toLowerCase().trim() === sponsorName.toLowerCase().trim());
      if (customSponsor?.adImages && customSponsor.adImages.length > 0) {
        prizeImgSrc = getImageUrl(customSponsor.adImages[0], `/GAMEFILES/${customSponsor.adImages[0]}`, sponsorName);
      }
    }

    if (prizeImgSrc) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl border-4 border-pink-500 overflow-hidden flex flex-col items-center justify-center p-4 text-center shadow-[0_0_50px_rgba(236,72,153,0.25)] animate-scale-in max-h-[340px]">
          <div className="absolute top-2 right-2 bg-pink-500 text-white font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">LUCKY WIN</div>
          <div className="w-full h-44 rounded-xl overflow-hidden bg-black/40 border border-white/10 mb-3 flex items-center justify-center">
            <img src={prizeImgSrc} alt={prize?.label || "Prize Product"} className="w-full h-full object-contain filter drop-shadow-md" referrerPolicy="no-referrer" />
          </div>
          <h3 className="font-display font-black text-lg text-white uppercase truncate max-w-xs">{prize?.label}</h3>
          <p className="text-[10px] font-sans text-zinc-400 uppercase tracking-widest font-semibold truncate mt-1">Provided by {sponsorName}</p>
        </div>
      );
    }

    if (normSponsor.includes("spizzicco") || normSponsor.includes("spizzico")) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-amber-950/80 to-amber-900/95 rounded-3xl border-4 border-yellow-500 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(234,179,8,0.2)] animate-scale-in">
          <div className="absolute top-2 right-2 bg-yellow-500 text-black font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">HOT & FRESH</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(249,115,22,0.6)] select-none animate-bounce" style={{ animationDuration: "5s" }}>🍕</div>
          <h3 className="font-display font-black text-2xl text-yellow-405 uppercase mt-4 tracking-tight text-glow-gold">Sourdough Slices</h3>
          <p className="text-[11px] font-sans text-amber-200 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; SOURDOUGH PIZZA &#47;&#47;<br/>Authentic Roman Pizzas Crafted with 48h Fermented Organic Flour & Premium Fiordilatte</p>
        </div>
      );
    } else if (normSponsor.includes("pally")) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-indigo-950/85 to-zinc-900/95 rounded-3xl border-4 border-emerald-500 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-scale-in">
          <div className="absolute top-2 right-2 bg-emerald-500 text-black font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">DEV EXCLUSIVE</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(16,185,129,0.5)] select-none animate-pulse">🧥</div>
          <h3 className="font-display font-black text-2xl text-emerald-400 uppercase mt-4 tracking-tight">Premium Green Hoodie</h3>
          <p className="text-[11px] font-sans text-emerald-250 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; DEVELOPER GEAR &#47;&#47;<br/>Heavyweight organic cotton, brushed interior, embroidered branding & custom stickers</p>
        </div>
      );
    } else if (normSponsor.includes("waka") || normSponsor.includes("gold")) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-amber-900/90 to-amber-950/95 rounded-3xl border-4 border-yellow-405 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(251,191,36,0.3)] animate-scale-in">
          <div className="absolute top-2 right-2 bg-yellow-405 text-black font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">100% PURE NZ</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(245,158,11,0.5)] select-none animate-bounce" style={{ animationDuration: "4.5s" }}>🍯</div>
          <h3 className="font-display font-black text-2xl text-yellow-300 uppercase mt-4 tracking-tight text-glow-gold">NZ Native Raw Honey</h3>
          <p className="text-[11px] font-sans text-amber-200 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; ORGANIC MANUKA &#47;&#47;<br/>Unpasteurized premium multifloral Manuka harvested from native pristine wild forest valleys</p>
        </div>
      );
    } else if (normSponsor.includes("superfina")) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-zinc-900/90 to-zinc-950/95 rounded-3xl border-4 border-pink-500/80 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(236,72,153,0.25)] animate-scale-in">
          <div className="absolute top-2 right-2 bg-pink-500 text-white font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">BOUTIQUE ART</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(236,72,153,0.5)] select-none animate-pulse">🛋️</div>
          <h3 className="font-display font-black text-2xl text-pink-400 uppercase mt-4 tracking-tight">Luxury Interior Deco</h3>
          <p className="text-[11px] font-sans text-pink-200 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; APARTMENT DESIGN &#47;&#47;<br/>Elegant premium catalog voucher supporting architectural modern furniture & aesthetic decor</p>
        </div>
      );
    } else if (normSponsor.includes("equilibrium")) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-teal-950/85 to-zinc-900/95 rounded-3xl border-4 border-teal-400 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(45,212,191,0.2)] animate-scale-in">
          <div className="absolute top-2 right-2 bg-teal-400 text-black font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">LUXE WELLNESS</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(45,212,191,0.5)] select-none animate-bounce" style={{ animationDuration: "6s" }}>🪨</div>
          <h3 className="font-display font-black text-2xl text-teal-300 uppercase mt-4 tracking-tight">Stone Therapy Spa</h3>
          <p className="text-[11px] font-sans text-teal-150 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; DEEP THERAPEUTIC &#47;&#47;<br/>Therapeutic deep-tissue massage aligning basalt power points for body balance</p>
        </div>
      );
    } else if (normSponsor.includes("vonuts")) {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-pink-900/40 to-amber-950/70 rounded-3xl border-4 border-[#E0338F] overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(224,51,143,0.3)] animate-scale-in">
          <div className="absolute top-2 right-2 bg-[#E0338F] text-white font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">100% VEGAN</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(224,51,143,0.5)] select-none animate-bounce" style={{ animationDuration: "3.8s" }}>🍩</div>
          <h3 className="font-display font-black text-2xl text-pink-300 uppercase mt-4 tracking-tight">Glazed Ring Basket</h3>
          <p className="text-[11px] font-sans text-pink-150 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; VEGAN DONUTS &#47;&#47;<br/>Handcrafted sourdough ring bakeries with organic pink strawberry glaze toppings</p>
        </div>
      );
    } else {
      return (
        <div className="relative w-full h-full min-h-[220px] bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl border-4 border-yellow-450 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-md animate-scale-in">
          <div className="absolute top-2 right-2 bg-yellow-450 text-black font-mono text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">PARTNER BRAND</div>
          <div className="text-8xl filter drop-shadow-[0_16px_24px_rgba(250,204,21,0.5)] select-none animate-pulse">🎁</div>
          <h3 className="font-display font-black text-2xl text-white uppercase mt-4 tracking-tight">{sponsorName}</h3>
          <p className="text-[11px] font-sans text-zinc-400 uppercase tracking-wider font-semibold max-w-sm leading-snug mt-1.5">&#47;&#47; SPONSOR ITEM &#47;&#47;<br/>Premium quality curated product contributed graciously in support of our fundraising mission</p>
        </div>
      );
    }
  };

  const renderUnifiedDrawingOverlay = () => {
    if (drawPhase === "idle") return null;

    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
        <div className="relative w-full h-full flex flex-col items-center justify-center text-center text-white select-none overflow-hidden">
          
          {/* 0) round_intro */}
          {drawPhase === "round_intro" && (
            <div className="space-y-6 flex flex-col items-center justify-center max-w-4xl w-full px-4 animate-fade-in">
              <span className="bg-yellow-405/20 text-yellow-405 text-sm font-black px-6 py-2 rounded-full border-2 border-yellow-405 tracking-widest uppercase animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                🎰 UP NEXT 🎰
              </span>

              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none filter drop-shadow-[0_8px_32px_rgba(255,255,255,0.15)] animate-flip-in-3d text-glow-gold mt-4">
                ROUND {drawHistory.length + 1}
              </h1>

              <div className="text-xl sm:text-3xl font-mono uppercase tracking-widest text-zinc-300 mt-8 font-bold animate-fade-in animation-delay-300">
                BEGINS IN... <span className="text-pink-500 text-4xl sm:text-5xl border-b-4 border-pink-500 ml-2">{countdownVal}</span>
              </div>
            </div>
          )}

          {/* 1) spinning_winner */}
          {drawPhase === "spinning_winner" && (
            <div className="space-y-6 flex flex-col items-center justify-center max-w-4xl w-full px-4 animate-fade-in">
              <span className="bg-[#E0338F]/20 text-[#E0338F] text-[10px] sm:text-xs font-black px-5 py-2 rounded-full border-2 border-[#E0338F] tracking-widest uppercase animate-pulse">
                🔮 CONNECTING TO THE RAFFLE CYLINDER... 🔮
              </span>
              
              <h2 className="text-3xl sm:text-5xl font-display font-black text-center uppercase tracking-tight text-white leading-none">
                TUMBLING ALL RAFFLE TICKETS
              </h2>

              <div className="relative w-full transition-all duration-150 py-4 scale-105">
                <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-pink-500 to-indigo-500 opacity-40 blur-sm"></div>
                <div className="relative bg-[#000] border-4 border-pink-500 rounded-[32px] p-8 flex flex-col items-center justify-center min-h-[160px] text-white">
                  <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl px-2 w-full tracking-tighter text-white uppercase text-center text-glow-pink break-words">
                    {activeRollName}
                  </h1>
                  <p className="font-mono text-xs mt-4 tracking-widest px-4 py-1.5 border-2 border-zinc-800 rounded-full font-bold uppercase bg-neutral-900 text-zinc-400">
                    {activeRollTicket}
                  </p>
                </div>
              </div>

              <div className="bg-black/95 border border-zinc-800 rounded-2xl px-5 py-2 z-10 text-center flex items-center justify-center gap-3">
                <span className="text-pink-500 font-mono text-xs font-bold animate-ping">⏳</span>
                <p className="text-white font-mono text-[10px] sm:text-xs uppercase tracking-wider font-bold leading-none">
                  Locking onto target ticket: {countdownVal}s REMAINING
                </p>
              </div>

              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
                <span>Generating cryptographic random draw chance...</span>
              </div>
            </div>
          )}

          {/* 2) congrats_countdown */}
          {drawPhase === "congrats_countdown" && (
            <div className="space-y-10 flex flex-col items-center justify-center max-w-3xl w-full animate-fade-in">
              <div className="flex w-full justify-center pb-2 mb-4">
                <img src="/sponsorfiles/bcnz-logo.png" alt="Breast Cancer NZ Logo" className="h-16 md:h-24 w-auto object-contain filter drop-shadow-md" />
              </div>

              <div className="space-y-2">
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] sm:text-xs font-black px-6 py-2.5 rounded-full border-2 border-emerald-500 tracking-widest uppercase text-glow-green animate-bounce">
                  🎉 TICKET DRAW COMPLETE 🎉
                </span>
              </div>

              <div className="space-y-4 w-full px-4 max-w-[95vw]">
                <span className="text-zinc-500 text-xs sm:text-sm font-mono tracking-widest uppercase block animate-fade-in animation-delay-150">Selected Winner</span>
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl w-full break-words font-black text-white uppercase tracking-tighter leading-none filter drop-shadow-[0_8px_32px_rgba(255,255,255,0.15)] select-all selection:bg-[#E0338F] animate-flip-in-3d">
                  {drawnWinner?.fullName}
                </h1>
                <p className="text-[#E0338F] font-extrabold text-sm sm:text-base mt-2 tracking-widest font-mono animate-fade-in animation-delay-300">
                  TICKET ID: #{drawnWinner?.orderId} • CHANCE #{drawnTicketIndex} OF {drawnWinner?.ticketsCount}
                </p>
              </div>

              {/* Sub-card countdown timer bar */}
              <div className="w-full max-w-sm sm:max-w-md bg-zinc-900/75 rounded-[32px] p-6 border-2 border-zinc-800 shadow-2xl text-center flex flex-col items-center space-y-4">
                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                  <div 
                    className="h-full bg-gradient-to-r from-[#E0338F] to-yellow-405 transition-all duration-1000"
                    style={{ width: `${(countdownVal / (timers.congrats_countdown || 30)) * 100}%` }}
                  ></div>
                </div>
                
                <div>
                  <h3 className="font-display font-black text-lg sm:text-2xl text-yellow-405 text-glow-gold uppercase tracking-tight">
                    {nextDrawType === "wheel" 
                      ? `REVEALING SPONSOR WHEEL IN ${countdownVal}s` 
                      : `REVEALING LUCKY BALL DRUM IN ${countdownVal}s`}
                  </h3>
                </div>

                <button
                  onClick={handleSkipToWheel}
                  className="mt-2 bg-yellow-405 hover:bg-yellow-350 text-black font-black text-xs uppercase px-6 py-3.5 rounded-2xl cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:scale-105 active:scale-95 transition-all"
                >
                  {nextDrawType === "wheel" 
                    ? "Skip & Spin Logo Wheel ⏭️" 
                    : "Skip & Tumble Magic Ball ⏭️"}
                </button>
              </div>
            </div>
          )}

          {/* 3) wheel_intro */}
          {drawPhase === "wheel_intro" && (
            <div className="space-y-8 flex flex-col items-center justify-center max-w-3xl w-full animate-fade-in">
              <div className="flex w-full justify-center -mb-4">
                <img src="/sponsorfiles/spotlight-logo.png" alt="Spotlight Logo" className="h-20 md:h-28 w-auto object-contain filter drop-shadow-md brightness-110" />
              </div>
              <span className="bg-[#E0338F] text-white text-[10px] sm:text-xs font-black px-5 py-2 rounded-full border-2 border-black tracking-widest uppercase">
                🎰 SPONSOR WHEEL ACTIVATED 🎰
              </span>

              <div className="space-y-2">
                <h2 className="text-3xl sm:text-5xl font-display font-black text-center uppercase tracking-tight text-white leading-none">
                  {drawnWinner?.fullName.toUpperCase()} IS GEARED TO SPIN!
                </h2>
                <p className="text-zinc-500 font-mono text-xs uppercase tracking-wider font-bold">EVERY SEGMENT STANDS FOR A BRAND CONTRIBUTING PRIZES VALUE</p>
              </div>

              {/* Live wheel layout preview */}
              <div className="w-64 h-64 md:w-80 md:h-80 relative flex items-center justify-center my-4 opacity-75 transform scale-95">
                <div className="absolute -top-3 z-30 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow-400 drop-shadow-md"></div>
                <div className="w-56 h-56 md:w-72 md:h-72" style={{ transform: `rotate(-${wheelAngle}deg)` }}>
                  {renderWheelSvg()}
                </div>
              </div>

              <div className="w-full max-w-md bg-zinc-900/80 rounded-2xl p-4 border border-zinc-800 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-yellow-450 font-display font-black text-xs uppercase">INITIATING AUTOMATIC SPIN</p>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mt-0.5 font-bold">LAUNCHING IN {countdownVal} SECONDS...</p>
                </div>
                <button
                  onClick={handleSkipToSpin}
                  className="bg-white hover:bg-zinc-200 text-black font-black uppercase text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Spin Now! ⚡
                </button>
              </div>
            </div>
          )}

          {/* 3a) ball_intro */}
          {drawPhase === "ball_intro" && (
            <div className="space-y-8 flex flex-col items-center justify-center max-w-3xl w-full animate-fade-in">
              <span className="bg-amber-500 text-black text-[10px] sm:text-xs font-black px-5 py-2 rounded-full border-2 border-black tracking-widest uppercase animate-pulse">
                🔮 LUCKY DRUM ACTIVATED 🔮
              </span>

              <div className="space-y-2">
                <h2 className="text-3xl sm:text-5xl font-display font-black text-center uppercase tracking-tight text-white leading-none">
                  {drawnWinner?.fullName.toUpperCase()}'S LUCKY BALL IS LOADING!
                </h2>
                <p className="text-zinc-500 font-mono text-xs uppercase tracking-wider font-bold">THE LUCKY DRUM INCORPORATES SPONSORS CONTRIBUTION CHANCE</p>
              </div>

              {/* Live lotterydrum frame layout preview */}
              <div className="relative w-80 h-80 flex items-center justify-center my-4 opacity-75 transform scale-95">
                <canvas 
                  ref={canvasRef} 
                  style={{ width: "240px", height: "240px" }}
                  className="block bg-transparent"
                />
              </div>

              <div className="w-full max-w-md bg-zinc-900/80 rounded-2xl p-4 border border-zinc-800 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-amber-450 font-display font-black text-xs uppercase">INITIATING TUMBLE INSTEAD OF WHEEL</p>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mt-0.5 font-bold">TUMBLES IN {countdownVal} SECONDS...</p>
                </div>
                <button
                  onClick={handleSkipToSpin}
                  className="bg-amber-400 hover:bg-amber-500 text-black font-black uppercase text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Tumble Now! ⚡
                </button>
              </div>
            </div>
          )}

          {/* 3b) ball_spinning */}
          {drawPhase === "ball_spinning" && (
            <div className="space-y-6 flex flex-col items-center justify-center h-full max-h-screen relative w-full overflow-hidden animate-fade-in">
              <span className="bg-amber-500 text-black text-[10px] sm:text-xs font-black px-6 py-2 rounded-full border border-black tracking-widest uppercase z-10 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse">
                ⚡ TUMBLING THE MAGIC BALL CAGE ⚡
              </span>

              <h2 className="text-2xl sm:text-4xl font-display font-black text-center uppercase tracking-tight text-white leading-none z-10 max-w-xl">
                DETERMINING {drawnWinner?.fullName.toUpperCase()}'S PRIZE OUTCOME...
              </h2>

              {/* Ticker scrolling header inside the viewport */}
              <div className="w-full bg-zinc-950 border-y-2 border-amber-500/60 py-2.5 overflow-hidden shadow-inner flex items-center justify-center z-10">
                <div className="whitespace-nowrap flex items-center gap-12 font-mono text-base md:text-lg font-black text-amber-450 uppercase tracking-widest animate-marquee-smooth">
                  <span>★ CHURNING SPONSORS CHAMBER ★</span>
                  <span>★ CHURNING SPONSORS CHAMBER ★</span>
                  <span>★ CHURNING SPONSORS CHAMBER ★</span>
                  <span>★ CHURNING SPONSORS CHAMBER ★</span>
                </div>
              </div>

              {/* THE CAGE ROTATOR CONTAINER */}
              <div className="relative flex flex-col items-center justify-center py-4 z-10 select-none">
                <div className="absolute inset-x-0 top-0 h-96 bg-radial-gradient from-yellow-500/10 to-transparent blur-3xl z-0 pointer-events-none"></div>

                <div className="relative w-80 h-[380px] flex items-center justify-center select-none scale-105 sm:scale-120 md:scale-125 transition-all">
                  
                  <div className="absolute top-[30px] left-[10px] w-[300px] h-[300px] rounded-full overflow-hidden flex items-center justify-center">
                    <canvas 
                      ref={canvasRef} 
                      style={{ width: "300px", height: "300px" }}
                      className="block bg-transparent"
                    />
                  </div>

                  <svg className="absolute inset-0 w-80 h-[380px] overflow-visible pointer-events-none" viewBox="0 0 320 380">
                    <defs>
                      <linearGradient id="frameSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#E2E8F0" />
                        <stop offset="45%" stopColor="#CBD5E1" />
                        <stop offset="50%" stopColor="#FFFFFF" />
                        <stop offset="55%" stopColor="#94A3B8" />
                        <stop offset="100%" stopColor="#475569" />
                      </linearGradient>

                      <radialGradient id="hubSilver" cx="40%" cy="40%" r="60%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="70%" stopColor="#64748B" />
                        <stop offset="100%" stopColor="#1E293B" />
                      </radialGradient>

                      <linearGradient id="chuteGold" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="30%" stopColor="#FEF3C7" />
                        <stop offset="70%" stopColor="#D97706" />
                        <stop offset="100%" stopColor="#78350F" />
                      </linearGradient>
                    </defs>

                    <circle cx="160" cy="180" r="130" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />

                    <g style={{ transform: `rotate(${cageAngle}deg)`, transformOrigin: "160px 180px" }}>
                      <line x1="160" y1="50" x2="160" y2="310" stroke="url(#frameSilver)" strokeWidth="4" strokeDasharray="3,3" />
                      <line x1="30" y1="180" x2="290" y2="180" stroke="url(#frameSilver)" strokeWidth="4" strokeDasharray="3,3" />
                      <circle cx="160" cy="180" r="128" fill="none" stroke="url(#frameSilver)" strokeWidth="3" opacity="0.6" />
                      <circle cx="160" cy="180" r="120" fill="none" stroke="url(#frameSilver)" strokeWidth="1" opacity="0.4" />
                    </g>

                    <line x1="30" y1="180" x2="290" y2="180" stroke="url(#frameSilver)" strokeWidth="8" strokeLinecap="round" />

                    <line x1="160" y1="180" x2="60" y2="340" stroke="url(#frameSilver)" strokeWidth="12" strokeLinecap="round" />
                    <line x1="160" y1="180" x2="260" y2="340" stroke="url(#frameSilver)" strokeWidth="12" strokeLinecap="round" />

                    <circle cx="160" cy="180" r="16" fill="url(#hubSilver)" stroke="#0F172A" strokeWidth="2" />

                    <path d="M 144 305 Q 144 350 144 355 L 144 375" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <path d="M 176 305 Q 176 350 176 355 L 176 375" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    
                    <rect x="138" y="358" width="44" height="18" rx="8" fill="url(#chuteGold)" stroke="#000" strokeWidth="2" />

                    <rect x="40" y="335" width="240" height="15" rx="7.5" fill="url(#frameSilver)" stroke="#030712" strokeWidth="2.5" />

                    <circle cx="160" cy="180" r="130" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="6" />
                    <path d="M 60 110 A 130 130 0 0 1 260 110" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="8" strokeLinecap="round" />
                  </svg>

                  {isSpatActive && (
                    <div className="absolute top-[30px] left-[10px] w-[300px] h-[300px] pointer-events-none z-20">
                      <div 
                        className="absolute w-7 h-7 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                        style={{
                          left: "136px",
                          top: `${spatBallY - 14}px`,
                          backgroundColor: spatBallColor,
                          backgroundImage: "radial-gradient(circle at 8px 8px, #ffffff, transparent 75%)",
                          transition: "none",
                        }}
                      >
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-mono font-black text-white">
                          {spatBallLabel}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="bg-black/90 backdrop-blur-md px-6 py-2.5 border-2 border-amber-500/40 rounded-full z-10 shadow-lg text-center flex items-center gap-4">
                <span className="text-amber-500 font-mono text-xs font-bold uppercase animate-ping">⏳</span>
                <p className="text-white font-mono text-[9px] sm:text-xs uppercase tracking-wider font-bold leading-none">
                  TUMBLING CHURNING PROGRESSIVE: {countdownVal}s REMAINING
                </p>
                <button
                  onClick={handleSpatBallReveal}
                  className="bg-white/10 hover:bg-white/20 text-white font-black text-[9px] uppercase px-3 py-1 rounded border border-white/20 transition-all cursor-pointer"
                >
                  Skip Tumble ⏭️
                </button>
              </div>
            </div>
          )}

          {/* 3c) ball_reveal */}
          {drawPhase === "ball_reveal" && wonPrize && drawnWinner && (
            <div 
              onClick={() => {
                playChime();
                setCountdownVal(timers.victory_promo_flip);
                setDrawPhase("victory_promo_flip");
                setNextDrawType("wheel");
              }}
              className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 md:p-16 z-50 text-white cursor-pointer select-none transition-all duration-700 animate-fade-in"
              title="Click or tap anywhere to manually flip the sponsor detail card"
            >
              <div 
                className="absolute inset-0 bg-radial-gradient blur-3xl h-full -z-10 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, ${getSponsorColor(wonSponsor)}25 0%, transparent 70%)`
                }}
              ></div>

              <div className="max-w-5xl w-full text-center space-y-10 md:space-y-12 flex flex-col items-center animate-scale-in">
                
                <div className="w-72 h-72 sm:w-80 sm:h-80 relative select-none" style={{ perspective: "1000px" }}>
                  <div 
                    className="w-full h-full relative transition-transform duration-[1500ms]"
                    style={{
                      transform: ballFlipState === "revealed" ? "rotateY(180deg)" : "rotateY(0deg)",
                      transformStyle: "preserve-3d"
                    }}
                  >
                    <div 
                      className="absolute inset-0 rounded-full flex flex-col items-center justify-center p-8 border-4 border-white/20 shadow-[0_0_80px_rgba(255,255,255,0.15)]"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        position: "absolute",
                        inset: 0,
                        backgroundColor: spatBallColor,
                        backgroundImage: "radial-gradient(circle at 25% 25%, #ffffff 0%, rgba(255,255,255,0.1) 40%, rgba(0,0,0,0.55) 100%)",
                      }}
                    >
                      <div className="w-40 h-40 rounded-full bg-white flex flex-col items-center justify-center text-black border-4 border-black/30 shadow-inner p-4 text-center">
                        <span className="text-[10px] font-mono tracking-widest text-zinc-500 font-black uppercase">LUCKY CHANCE</span>
                        <h1 className="text-3xl font-display font-black tracking-tight leading-none mt-1 text-zinc-900">
                          #{drawnWinner?.orderId}
                        </h1>
                        <div className="h-0.5 bg-zinc-200 w-16 my-2"></div>
                        <span className="text-xs font-mono font-bold uppercase text-[#E0338F]">
                          BALL #{drawnTicketIndex}
                        </span>
                      </div>
                    </div>

                    <div 
                      className="absolute inset-0 rounded-full flex flex-col items-center justify-center p-6 border-4 border-yellow-405 shadow-[0_0_120px_rgba(234,179,8,0.35)]"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        position: "absolute",
                        inset: 0,
                        transform: "rotateY(180deg)",
                        backgroundColor: "#0d0d0f",
                        backgroundImage: "radial-gradient(circle at 50% 5%, rgba(251,191,36,0.3) 0%, transparent 80%)",
                      }}
                    >
                      <div className="absolute inset-0 rounded-full border-4 border-yellow-405/40 animate-pulse blur-[2px]"></div>

                      <div className="relative text-center flex flex-col items-center max-w-xs space-y-4 px-2">
                        <span className="text-[9px] font-mono font-bold tracking-widest text-yellow-405 uppercase">
                          PRESENTED BY
                        </span>

                        <div className="min-h-[50px] flex items-center justify-center filter brightness-110">
                          {(() => {
                            const key = wonSponsor.toLowerCase().trim();
                            if (key.includes("spizzicco") || key.includes("spizzico")) {
                              return <SpizzicoLogo className="scale-[1.5]" />;
                            } else if (key.includes("pally")) {
                              return <PallyLogo className="scale-[1.5]" />;
                            } else if (key.includes("waka")) {
                              return <WakaGoldLogo className="h-12" />;
                            } else if (key.includes("superfina")) {
                              return <SuperfinaLogo className="scale-[1.5]" />;
                            } else {
                              return <h2 className="font-display font-black text-2xl tracking-tighter text-glow-gold uppercase text-yellow-405">{wonSponsor}</h2>;
                            }
                          })()}
                        </div>

                        <div className="w-16 h-0.5 bg-yellow-405/45"></div>

                        <div className="space-y-1">
                          <span className="text-[8px] font-sans text-zinc-400 tracking-wider font-extrabold uppercase">&#47;&#47; OUTCOME PRIZE</span>
                          <h3 className="font-display font-black text-base md:text-lg text-white uppercase leading-tight tracking-tight text-glow-primary">
                            {wonPrize?.label}
                          </h3>
                        </div>

                        {wonPrize && wonPrize.value > 0 && (
                          <span className="text-[10px] font-mono text-zinc-500 font-bold tracking-tight font-extrabold">
                            VALUE: NZD ${wonPrize.value}
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                </div>

                <div 
                  className="w-48 h-1.5 rounded-full shadow-lg"
                  style={{
                    backgroundColor: getSponsorColor(wonSponsor),
                    boxShadow: `0 0 16px ${getSponsorColor(wonSponsor)}`
                  }}
                ></div>

                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-zinc-500 uppercase block">OUTCOME DRAW WINNER</span>
                  <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter uppercase font-display leading-none filter drop-shadow-[0_16px_40px_rgba(255,255,255,0.15)] block animate-flip-in-3d animation-delay-150">
                    {drawnWinner.fullName}
                  </h1>
                </div>

                <div className="w-full max-w-sm space-y-2 pt-4">
                  <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div className="h-full bg-yellow-405 transition-all duration-1000" style={{ width: `${(countdownVal / (timers.ball_reveal || 30)) * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    Flipping to brand promotion in <strong className="text-yellow-400 font-bold">{countdownVal}s</strong>... (Tap anywhere to skip)
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* 4) wheel_spinning */}
          {drawPhase === "wheel_spinning" && (
            <div className="space-y-6 flex flex-col items-center justify-center h-full max-h-screen relative w-full overflow-hidden animate-fade-in">
              <span className="bg-[#E0338F] text-white text-[10px] sm:text-xs font-black px-6 py-2 rounded-full border border-black tracking-widest uppercase z-10 shadow-[0_0_15px_rgba(224,51,143,0.5)]">
                ⚡ SPINNING THE WHEEL OF SPONSORS ⚡
              </span>

              <h2 className="text-2xl sm:text-4xl font-display font-black text-center uppercase tracking-tight text-white leading-none z-10 max-w-xl">
                WHAT IS {drawnWinner?.fullName.toUpperCase()}'S PRIZE?
              </h2>

              {/* Real-time Ticker scrolling header inside the spinning viewport */}
              <div className="w-full bg-zinc-950 border-y-2 border-yellow-405/60 py-2.5 overflow-hidden shadow-inner flex items-center justify-center z-10">
                <div className="whitespace-nowrap flex items-center gap-12 font-mono text-base md:text-lg font-black text-yellow-450 uppercase tracking-widest animate-marquee-smooth">
                  <span>★ NOW PASSING: {wheelSponsors[activeWedgeIndex]?.toUpperCase() || "SPONSOR"} ★</span>
                  <span>★ NOW PASSING: {wheelSponsors[activeWedgeIndex]?.toUpperCase() || "SPONSOR"} ★</span>
                  <span>★ NOW PASSING: {wheelSponsors[activeWedgeIndex]?.toUpperCase() || "SPONSOR"} ★</span>
                  <span>★ NOW PASSING: {wheelSponsors[activeWedgeIndex]?.toUpperCase() || "SPONSOR"} ★</span>
                </div>
              </div>

              {/* Animated Rotary Sector Plate container with dynamic scale zoom */}
              <div className="relative w-[340px] h-[345px] sm:w-[450px] sm:h-[455px] md:w-[500px] md:h-[505px] flex items-center justify-center my-2 select-all select-none">
                {/* Pointer needle indicator */}
                <div className="absolute -top-3 z-30 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-yellow-405 drop-shadow-xl animate-pulse"></div>
                
                {/* Rotary plate */}
                <div
                  className="w-80 h-80 sm:w-96 sm:h-96 md:w-[400px] md:h-[400px] overflow-visible rounded-full relative flex items-center justify-center"
                  style={{
                    transform: isWheelZoomed ? "scale(2.2) translateY(55px)" : "scale(1.0)",
                    transition: "transform 7s cubic-bezier(0.1, 0.8, 0.2, 1)",
                  }}
                >
                  <div
                    className="w-full h-full relative"
                    style={{
                      transform: `rotate(-${wheelAngle}deg)`,
                    }}
                  >
                    {renderWheelSvg()}
                  </div>
                </div>
              </div>

              <div className="bg-black/90 backdrop-blur-md px-6 py-2 border-2 border-yellow-405/40 rounded-full z-10 shadow-lg text-center flex items-center gap-4">
                <span className="text-yellow-450 font-mono text-xs font-bold uppercase animate-ping">⏳</span>
                <p className="text-yellow-405 font-mono text-[9px] sm:text-xs uppercase tracking-wider animate-pulse leading-none font-bold">
                  {isWheelZoomed 
                    ? `🔍 LOCKING ON SPONSOR SECTOR: ${countdownVal}s LEFT` 
                    : `⏳ DE-ACCELERATING STEADY TENSION: ${countdownVal}s REMAINING`}
                </p>
              </div>
            </div>
          )}

          {/* 5) victory_screen */}
          {drawPhase === "victory_screen" && wonPrize && drawnWinner && (
            <div 
              onClick={() => {
                playChime();
                setNextDrawType("ball");
                setCountdownVal(timers.victory_promo_flip);
                setDrawPhase("victory_promo_flip");
              }}
              className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 md:p-16 z-50 text-white cursor-pointer select-none transition-all duration-700 animate-fade-in"
              title="Click or tap anywhere to manually flip the wheel card"
            >
              <div className="max-w-5xl w-full text-center space-y-10 md:space-y-12 flex flex-col items-center animate-scale-in">
                
                {/* 1. Winner name */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-zinc-500 uppercase block">GAMESHOW WINNER</span>
                  <h1 className="text-6xl sm:text-7xl md:text-9xl font-black text-white tracking-tighter uppercase font-display leading-none filter drop-shadow-[0_16px_40px_rgba(224,51,143,0.35)] block">
                    {drawnWinner.fullName}
                  </h1>
                </div>

                {/* Minimal separator with accent glow */}
                <div className="w-48 h-1.5 bg-[#E0338F] rounded-full shadow-[0_0_16px_#E0338F]"></div>

                {/* 2. Prize label inside vibrant neon badge */}
                <div className="bg-[#E0338F]/15 border-4 border-[#E0338F] px-12 py-5 sm:px-20 sm:py-6 rounded-[48px] shadow-[0_0_80px_rgba(224,51,143,0.25)]">
                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-black uppercase text-glow-pink tracking-tight text-white leading-tight">
                    {wonPrize.label}
                  </h2>
                </div>

                {/* 3. Sponsor Logo */}
                <div className="flex items-center justify-center min-h-[140px] transform hover:scale-105 transition-transform duration-300">
                  {(() => {
                    const key = wonSponsor.toLowerCase().trim();
                    const activeKey = getSponsorKey(wonSponsor);
                    const customSponsor = sponsors.find(s => s.name.toLowerCase().trim() === key);
                    const resolvedLogo = customSponsor?.logo || wonPrize?.sponsorLogo;
                    
                    const computedLogo = getImageUrl(resolvedLogo, "", wonSponsor);
                    
                    if (computedLogo) {
                      return (
                        <img
                          src={computedLogo}
                          alt={`${wonSponsor} logo`}
                          className="max-h-24 md:max-h-32 w-auto object-contain filter drop-shadow-md brightness-110"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      );
                    }
                    
                    if (key.includes("spizzicco") || key.includes("spizzico")) {
                      return <SpizzicoLogo className="scale-[2.4] md:scale-[3.2]" />;
                    } else if (key.includes("pally")) {
                      return <PallyLogo className="scale-[2.4] md:scale-[3.2]" />;
                    } else if (key.includes("waka")) {
                      return <WakaGoldLogo className="h-28 md:h-40" />;
                    } else if (key.includes("superfina")) {
                      return <SuperfinaLogo className="scale-[2.4] md:scale-[3.2]" />;
                    } else if (key.includes("equilibrium")) {
                      return <span className="font-serif italic font-bold text-4xl md:text-6xl text-white tracking-wide text-glow-primary">Equilibrium Massage</span>;
                    } else if (key.includes("vonuts")) {
                      return <span className="font-sans font-black text-5xl md:text-7xl tracking-widest text-[#E0338F]">VONUTS</span>;
                    } else {
                      return <span className="font-display font-black tracking-tight text-[#E0338F] text-5xl md:text-7xl uppercase text-glow-pink">{wonSponsor}</span>;
                    }
                  })()}
                </div>



              </div>
            </div>
          )}

          {/* 6) victory_promo_flip */}
          {drawPhase === "victory_promo_flip" && wonPrize && (
            <div 
              onClick={handleCloseVictory}
              className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 md:p-12 z-50 text-white cursor-pointer select-none transition-all duration-700 animate-fade-in"
              title="Click anywhere to return to broads"
            >
              <div className="max-w-5xl w-full flex flex-col h-full justify-between py-6">
                
                {/* Header branding */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                  <div className="text-left">
                    <span className="text-[8px] font-mono font-black text-[#E0338F] tracking-widest uppercase">CONGRATULATING CHAMPION</span>
                    <h4 className="font-display font-black text-lg text-white uppercase">{drawnWinner?.fullName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-mono font-black text-zinc-500 tracking-widest uppercase">PROMOTED BY</span>
                    <h4 className="font-mono text-xs text-yellow-300 font-black">{wonSponsor.toUpperCase()}</h4>
                  </div>
                </div>

                {/* Flipped Card using Perspective container */}
                <div className="my-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center justify-center w-full py-4">
                  {/* Left Column: Simple readble text of what the prize is */}
                  <div className="md:col-span-12 text-center space-y-6 flex flex-col items-center justify-center h-full animate-fade-in">
                    
                    {/* Sponsor Logo mini */}
                    <div className="flex items-center justify-center filter brightness-110 min-h-[160px] pb-4">
                      {(() => {
                        const key = wonSponsor.toLowerCase().trim();
                        const activeKey = getSponsorKey(wonSponsor);
                        const customSponsor = sponsors.find(s => s.name.toLowerCase().trim() === key);
                        const resolvedLogo = customSponsor?.logo || wonPrize?.sponsorLogo;
                        
                        if (resolvedLogo) {
                          return (
                            <img
                              src={getImageUrl(resolvedLogo, `/GAMEFILES/${resolvedLogo}`, wonSponsor)}
                              alt={`${wonSponsor} logo`}
                              className="max-h-40 md:max-h-56 w-auto object-contain filter drop-shadow-md"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          );
                        }
                        
                        if (key.includes("spizzicco") || key.includes("spizzico")) {
                          return <SpizzicoLogo className="scale-[3.5]" />;
                        } else if (key.includes("pally")) {
                          return <PallyLogo className="scale-[3.5]" />;
                        } else if (key.includes("waka")) {
                          return <WakaGoldLogo className="h-40 md:h-48" />;
                        } else if (key.includes("superfina")) {
                          return <SuperfinaLogo className="scale-[3.5]" />;
                        } else {
                          return <span className="font-display font-black text-5xl md:text-7xl text-yellow-450 uppercase">{wonSponsor}</span>;
                        }
                      })()}
                    </div>

                    <div className="h-0.5 bg-zinc-900 w-24"></div>

                    <div className="space-y-3">
                      <span className="bg-yellow-450/10 text-yellow-405 border border-yellow-500 text-[9px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest inline-block select-none">
                        🎫 SECURED OFFICIAL PRIZE 🎫
                      </span>
                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-tight text-white leading-tight uppercase select-all">
                        {wonPrize.label}
                      </h2>
                    </div>

                    <div className="space-y-2 bg-zinc-900/60 rounded-2xl p-5 border border-zinc-850">
                      <p className="text-[11px] font-mono text-zinc-400 font-black uppercase tracking-wider">REDEEM INSTRUCTIONS:</p>
                      <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                        {wonPrize.details || `Congratulations! Contact the event administration counter with Ticket Orders ID #${drawnWinner?.orderId} to claim your exclusive ${wonPrize.label} voucher kindly provided by ${wonSponsor}.`}
                      </p>
                      {wonPrize.value > 0 && (
                        <p className="text-[10px] font-mono text-yellow-405 mt-2 font-bold uppercase tracking-wider">
                          CONTRIBUTION VALUE: NZD ${wonPrize.value}.00
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer and Skip button */}
                <div className="border-t border-zinc-900 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-left font-mono">
                    <p className="text-[9px] text-zinc-500 uppercase">AUTOPILOT VIDEO PRESENTATION CAROUSEL</p>
                    <p className="text-[11px] text-[#E0338F] font-bold">PLAYING COMMERCIAL SCREENCAST IN {countdownVal}s...</p>
                  </div>
                  <button
                    onClick={handleCloseVictory}
                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white rounded-xl px-5 py-2 uppercase font-mono text-xs font-bold font-black"
                  >
                    Skip & Play video ⏭️
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* 7) autopilot_countdown */}
          {drawPhase === "autopilot_countdown" && (
            <div className="space-y-10 flex flex-col items-center justify-center max-w-3xl w-full animate-fade-in py-16 dark:bg-black">
              <div className="space-y-3">
                <span className="bg-indigo-600 border border-zinc-800 text-white text-[10px] sm:text-xs font-black px-6 py-2 rounded-full tracking-widest uppercase animate-pulse">
                  🤖 AUTOPILOT MACHINE SENSOR ENGAGED 🤖
                </span>
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white px-2 tracking-tight uppercase leading-none">
                  NEXT PRIZE DRAW COMING UP
                </h1>
              </div>

              {/* Glowing countdown circle */}
              <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
                {/* SVG circular track spinner */}
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle cx="50%" cy="50%" r="42%" stroke="#1f2937" strokeWidth="8" fill="transparent" />
                  <circle 
                    cx="50%" cy="50%" r="42%" 
                    stroke="#FBBF24" strokeWidth="10" fill="transparent"
                    strokeDasharray="263"
                    strokeDashoffset={263 - (263 * (countdownVal / (timers.autopilot_countdown || 30)))}
                    className="transition-all duration-1000 ease-linear shadow-[0_0_15px_#FBBF24]"
                  />
                </svg>
                <div className="relative flex flex-col items-center justify-center">
                  <span className="text-5xl sm:text-7xl md:text-8xl font-black font-display text-glow-gold text-yellow-400">
                    {countdownVal}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">Seconds Left</span>
                </div>
              </div>

              <div className="w-full max-w-md bg-zinc-900/60 rounded-[28px] p-6 border border-zinc-800 space-y-4">
                <div className="text-center font-mono text-xs text-zinc-400 uppercase tracking-wider">
                  {prizes.filter(p => prizes.length === 0 || p.quantity > drawHistory.filter(h => h.prize.label === p.label).length).length > 0 ? (
                    <>STILL <strong className="text-yellow-405 font-bold">{prizes.filter(p => p.quantity > drawHistory.filter(h => h.prize.label === p.label).length).reduce((ac,p)=>ac+(p.quantity-drawHistory.filter(h => h.prize.label === p.label).length),0)} PRIZES</strong> AVAILABLE IN THE TOTAL POOL</>
                  ) : (
                    <span className="text-rose-500 font-bold">ALL PRIZES DRAWN! AUTOPILOT IDLE</span>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setDrawPhase("idle");
                      setIsAutopilot(false);
                    }}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-xs uppercase py-3.5 rounded-2xl cursor-pointer"
                  >
                    Pause Loop ⏸️
                  </button>
                  <button
                    onClick={() => {
                      handleStartDraw();
                    }}
                    className="flex-1 bg-yellow-405 hover:bg-yellow-350 text-black font-black text-xs uppercase py-3.5 rounded-2xl cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:scale-105 active:scale-95 transition-all animate-bounce"
                  >
                    DRAW NOW! ⚡
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  // Wheel of Fortune real-time state synchronization
  const [bonusSpinning, setBonusSpinning] = useState(false);
  const [bonusTargetPrize, setBonusTargetPrize] = useState<string | null>(null);
  const [bonusSpinAngle, setBonusSpinAngle] = useState(0);
  const [bonusStatusMessage, setBonusStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!winnerReveal) {
      setBonusSpinning(false);
      setBonusTargetPrize(null);
      setBonusSpinAngle(0);
      setBonusStatusMessage(null);
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const url = `https://kvdb.io/b_d4a2760d_b4b4_4617_8bb1_58f2e77564ac/bonus_${winnerReveal.id}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.action === "spinning" && !bonusSpinning && !bonusTargetPrize) {
            const finalAngle = Number(data.targetAngle) || (1445 + Math.random() * 320);
            setBonusTargetPrize(data.additionalPrize);
            setBonusSpinAngle(finalAngle);
            setBonusSpinning(true);
            setBonusStatusMessage(`🚨 ${winnerReveal.participant.fullName.toUpperCase()} HAS TOUCH-SPUN THE BONUS WHEEL FROM THE SMARTPHONE! 🚨`);
            
            // Trigger rotational click ticking sounds during motion
            let tickCounter = 0;
            const clickNoise = setInterval(() => {
              if (tickCounter++ < 20) {
                try {
                  import("../utils/audio").then(m => m.playTick(450 - tickCounter * 12, 0.012));
                } catch (e) {}
              } else {
                clearInterval(clickNoise);
              }
            }, 180);

            // Finish the rotational deceleration matching the 5 seconds duration
            setTimeout(() => {
              setBonusSpinning(false);
              setBonusStatusMessage(`🎉 WHEEL BONUS REWARD WON: ${data.additionalPrize.toUpperCase()}! 🎉`);
              
              // Invoke local and parent persistence mutations
              if (onAdditionalPrizeWon) {
                onAdditionalPrizeWon(winnerReveal.id, data.additionalPrize);
              }
              
              try {
                import("../utils/audio").then(m => m.playCelebration());
              } catch (e) {}
            }, 5200);
          }
        }
      } catch (err) {
        console.warn("KVDB polling error:", err);
      }
    }, 1200);

    return () => clearInterval(intervalId);
  }, [winnerReveal, bonusSpinning, bonusTargetPrize, onAdditionalPrizeWon]);

  useEffect(() => {
    if (!isSimpleMode || !winnerReveal) {
      setCountdownSeconds(11 * 60);
      return;
    }

    setCountdownSeconds(11 * 60);

    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // 11 minutes are up! Automatically go back to video, then to winners wall
          setWinnerReveal(null);
          setTickerFlash(false);
          setVideoTarget("winners");
          setSimpleState("video");
          return 11 * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimpleMode, winnerReveal]);

  // Sound toggler connection
  useEffect(() => {
    import("../utils/audio").then((m) => m.toggleGlobalSound(soundEnabled));
  }, [soundEnabled]);

  // Draw screen sponsor image states
  const [activeLogoError, setActiveLogoError] = useState(false);
  const [activeStampError, setActiveStampError] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [activePhotoErrors, setActivePhotoErrors] = useState<Record<number, boolean>>({});
  const [randomizedSlides, setRandomizedSlides] = useState<string[]>([]);

  useEffect(() => {
    setActiveLogoError(false);
    setActiveStampError(false);
    setActivePhotoErrors({});
    setActivePhotoIdx(0);

    const prize = prizes.find(p => p.id === selectedPrizeId);
    if (prize) {
      const customSponsor = sponsors.find(s => s.name.toLowerCase().trim() === prize.sponsor.toLowerCase().trim());
      const activeKey = getSponsorKey(prize.sponsor);
      
      let prizeSlides: string[] = [];
      if (prize.prizeImages) {
        prizeSlides = prize.prizeImages
          .split(",")
          .map(img => img.trim())
          .filter(Boolean)
          .map(img => getImageUrl(img, `/GAMEFILES/${img}`, prize.sponsor));
      }

      let baseAdImages = [...prizeSlides];
      if (customSponsor?.adImages && customSponsor.adImages.length > 0) {
        const resolvedCustomAds = customSponsor.adImages.map(img => getImageUrl(img, `/GAMEFILES/${img}`, prize.sponsor));
        baseAdImages = [...baseAdImages, ...resolvedCustomAds];
      }

      if (baseAdImages.length === 0) {
        baseAdImages = [
          getImageUrl(`${activeKey}-photo1.jpg`, `/GAMEFILES/${activeKey}-photo1.jpg`, prize.sponsor),
          getImageUrl(`${activeKey}-photo2.jpg`, `/GAMEFILES/${activeKey}-photo2.jpg`, prize.sponsor),
          getImageUrl(`${activeKey}-photo3.jpg`, `/GAMEFILES/${activeKey}-photo3.jpg`, prize.sponsor)
        ];
      }
      
      // Shuffle/randomize
      const shuffled = [...baseAdImages].sort(() => Math.random() - 0.5);
      setRandomizedSlides(shuffled);
    } else {
      setRandomizedSlides([]);
    }
  }, [selectedPrizeId, prizes, sponsors]);

  useEffect(() => {
    const total = randomizedSlides.length > 0 ? randomizedSlides.length : 3;
    const timer = setInterval(() => {
      setActivePhotoIdx(prev => (prev + 1) % total);
    }, 3000);
    return () => clearInterval(timer);
  }, [randomizedSlides.length]);

  // Compute available prizes
  const availablePrizes = prizes.filter(p => {
    // A prize is available if it has remaining quantity based on session drawn counts
    // Sum drawings of this prize from history
    const drawnThisPrize = drawHistory.filter(h => h.prize.label === p.label).length;
    return p.quantity > drawnThisPrize;
  });

  // Automatically select first available prize
  useEffect(() => {
    if (availablePrizes.length > 0 && (!selectedPrizeId || !availablePrizes.some(p => p.id === selectedPrizeId))) {
      setSelectedPrizeId(availablePrizes[0].id);
    }
  }, [prizes, drawHistory, selectedPrizeId]);

  // Selected prize details
  const activePrize = prizes.find(p => p.id === selectedPrizeId);

  // Create drawing list based on configurations
  const buildTicketPool = (): TicketEntry[] => {
    // 1. Filter participants
    let pool = participants;
    if (paidOnly) {
      pool = pool.filter(p => p.status === "Paid");
    }
    
    // Unconditionally exclude attendees who have already won any prize in the history from remaining draws.
    const pastWinnerEmails = new Set(drawHistory.map(h => h.participant.email?.toLowerCase().trim()));
    const pastWinnerIds = new Set(drawHistory.map(h => h.participant.id));
    pool = pool.filter(p => {
      const isPastEmail = p.email && pastWinnerEmails.has(p.email.toLowerCase().trim());
      const isPastId = pastWinnerIds.has(p.id);
      return !isPastEmail && !isPastId;
    });

    // 2. Map into entries (either 1 per person or replicates based on ticketsCount)
    const entries: TicketEntry[] = [];
    pool.forEach(p => {
      const chancesCount = useTicketsWeighted ? p.ticketsCount : 1;
      for (let i = 1; i <= chancesCount; i++) {
        entries.push({
          id: `${p.id}-ticket-${i}`,
          participantId: p.id,
          participant: p,
          ticketIndex: i,
        });
      }
    });

    return entries;
  };

  const poolEntries = buildTicketPool();

  // Automatically start the draw when entering the "spinner" state in Simple Mode
  useEffect(() => {
    if (isSimpleMode && simpleState === "spinner" && drawPhase === "idle" && poolEntries.length > 0) {
      // Initialize countdown value to the configurable id4_pause duration (defaults to 20 seconds)
      setCountdownVal(timers.id4_pause !== undefined ? timers.id4_pause : 20);
      
      // Randomize the selected prize (campaign) for this round
      const available = prizes.filter(p => {
        const drawnThisPrize = drawHistory.filter(h => h.prize.label === p.label).length;
        return p.quantity > drawnThisPrize;
      });
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        setSelectedPrizeId(available[randomIndex].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimpleMode, simpleState, drawPhase, poolEntries.length, timers.id4_pause]);

  const executeSpinningWinner = () => {
    // Start drawing!
    setDrawPhase("spinning_winner");
    setDrawnWinner(null);
    setWonPrize(null);
    setWonSponsor("");
    setIsWheelZoomed(false);
    setTickerFlash(false);

    // Pick a winner immediately
    const winnerIndex = Math.floor(Math.random() * poolEntries.length);
    const winningEntry = poolEntries[winnerIndex];

    const currentDuration = turboMode ? 1.0 : duration;
    const totalTicks = Math.floor(currentDuration * 25);
    let currentTick = 0;

    const runTicker = () => {
      if (currentTick >= totalTicks) {
        // Tumble complete! Landing on winner
        setDrawnWinner(winningEntry.participant);
        setDrawnTicketIndex(winningEntry.ticketIndex);
        setCountdownVal(timers.congrats_countdown);
        setDrawPhase("congrats_countdown");
        
        // Play success tone
        playCelebration();
        return;
      }

      currentTick++;
      // Choose random participant entry for tick view
      const randomEntry = poolEntries[Math.floor(Math.random() * poolEntries.length)];
      setActiveRollName(randomEntry.participant.fullName);
      setActiveRollTicket(`ID: #${randomEntry.participant.orderId} (Ticket ${randomEntry.ticketIndex} of ${randomEntry.participant.ticketsCount})`);

      // Tick noise
      const progressPercent = currentTick / totalTicks;
      if (progressPercent < 0.6) {
        playTick(1200 - (progressPercent * 600), 0.012);
      } else if (progressPercent < 0.85) {
        playTick(600 - (progressPercent * 300), 0.025);
      } else {
        playTick(300, 0.04);
      }

      // Exponential delay slowdown
      const startDelay = 40;
      const endDelay = 550;
      const delay = startDelay + (endDelay - startDelay) * Math.pow(progressPercent, 2.5);

      setTimeout(runTicker, delay);
    };

    runTicker();
  };

  const handleStartDraw = () => {
    if (drawPhase !== "idle") return;

    // Check if there are available prizes left
    const remainingPrizes = prizes.filter(p => {
      const drawnCount = drawHistory.filter(h => h.prize.label === p.label).length;
      return p.quantity > drawnCount;
    });

    if (remainingPrizes.length === 0) {
      alert("No prizes left to draw! All prizes are already fully drawn.");
      return;
    }

    if (poolEntries.length === 0) {
      alert("No available participants in the raffle pool matching active filters!");
      return;
    }

    // Start with Round Intro Countdown
    setCountdownVal(10);
    setDrawPhase("round_intro");
    playChime();
  };

  const handleTransitionToWheelIntro = () => {
    // 1. Get all sponsors with available prizes
    const availablePrizesList = prizes.filter(p => {
      const drawnCount = drawHistory.filter(h => h.prize.label === p.label).length;
      return p.quantity > drawnCount;
    });

    if (availablePrizesList.length === 0) {
      alert("No available prizes remaining!");
      setDrawPhase("idle");
      return;
    }

    const availableSponsorsNames = Array.from(new Set(availablePrizesList.map(p => p.sponsor)));

    // Build segments list of size 12
    const segments: string[] = [];
    for (let i = 0; i < 12; i++) {
      segments.push(availableSponsorsNames[i % availableSponsorsNames.length]);
    }
    setWheelSponsors(segments);

    // Pick a random prize from available
    const randomPrizeIndex = Math.floor(Math.random() * availablePrizesList.length);
    const selectedWinningPrize = availablePrizesList[randomPrizeIndex];
    setWonPrize(selectedWinningPrize);
    setWonSponsor(selectedWinningPrize.sponsor);

    // Find custom sector index matching selected sponsor
    const matchingIndices: number[] = [];
    segments.forEach((s, idx) => {
      if (s === selectedWinningPrize.sponsor) {
        matchingIndices.push(idx);
      }
    });

    const targetIdx = matchingIndices.length > 0 
      ? matchingIndices[Math.floor(Math.random() * matchingIndices.length)] 
      : 0;

    // Highlight and center the target sector on the wheel immediately in the intro
    setActiveWedgeIndex(targetIdx);

    // Calculate rotational angle
    // Sector is rotated by targetIdx * 30 + 15 degrees to match top pointer centered perfectly
    // Spin 7 full rotations (7 * 360 = 2520) plus sector offset
    const targetAngle = 2520 + targetIdx * 30 + 15;
    
    setWheelAngle(targetAngle);
    setCountdownVal(12); // Hardcoded to 12s so 12 wedges unveil (1 per sec)
    setDrawPhase("wheel_intro");
    playChime();
  };

  const getActiveWedgeIdx = (currentAngle: number) => {
    const normAngle = ((currentAngle % 360) + 360) % 360;
    return Math.floor(normAngle / 30) % 12;
  };

  const handleStartWheelSpinning = () => {
    setDrawPhase("wheel_spinning");
    setIsWheelZoomed(false);
    
    const startTime = Date.now();
    const spinDuration = 10000; // 10 seconds
    const startAngle = 0; // always spin from 0 for clean math
    const targetAngle = wheelAngle; // targetAngle is set in handleTransitionToWheelIntro

    lastWedgeRef.current = -1;

    let animId: number;

    const animateWheel = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= spinDuration) {
        setWheelAngle(targetAngle);
        const finalWedge = getActiveWedgeIdx(targetAngle);
        setActiveWedgeIndex(finalWedge);
        handleRevealVictoryOverlay();
        return;
      }

      // Smooth Quartic ease out
      const p = elapsed / spinDuration;
      const ease = 1 - Math.pow(1 - p, 4);
      const currentAngle = startAngle + targetAngle * ease;
      setWheelAngle(currentAngle);

      // Programmatic zoom in at 55% progress (5.5s)
      if (elapsed >= 5500) {
        setIsWheelZoomed(true);
      }

      // Physics boundary clicker detection! Only plays ticks as pins pass the arrow
      const currentWedge = getActiveWedgeIdx(currentAngle);
      if (currentWedge !== lastWedgeRef.current) {
        const remainingFraction = 1 - ease; // ticks slow down
        playTick(Math.max(220, 350 + (remainingFraction * 600)), 0.02);
        setActiveWedgeIndex(currentWedge);
        lastWedgeRef.current = currentWedge;
      }

      animId = requestAnimationFrame(animateWheel);
    };

    animId = requestAnimationFrame(animateWheel);
  };

  const handleRevealVictoryOverlay = () => {
    if (!drawnWinner || !wonPrize) {
      setDrawPhase("idle");
      return;
    }

    playCelebration();

    const nowMs = Date.now();
    const drawId = `draw-${nowMs}-${Math.random().toString(36).substring(2, 6)}`;
    const drawTimestamp = new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString("en-GB", {day: "numeric", month: "short"});

    // Let's create the winnerReveal so that history & claim systems are standard
    setWinnerReveal({
      id: drawId,
      participant: drawnWinner,
      prize: wonPrize,
      ticketNum: drawnTicketIndex,
      timestamp: drawTimestamp,
      drawnTimeMs: nowMs,
    });

    onDrawComplete({
      id: drawId,
      timestamp: drawTimestamp,
      participant: drawnWinner,
      prize: wonPrize,
      ticketNumber: drawnTicketIndex,
      notes: `Chance #${drawnTicketIndex} (Won via gameshow Sponsor Wheel)`
    });

    setDrawPhase("victory_screen");
  };

  const getSponsorColor = (sponsorName: string): string => {
    const key = sponsorName.toLowerCase().trim();
    if (key.includes("spizzicco") || key.includes("spizzico")) return "#FBBF24";
    if (key.includes("pally")) return "#10B981";
    if (key.includes("waka") || key.includes("gold")) return "#F59E0B";
    if (key.includes("superfina")) return "#EC4899";
    if (key.includes("equilibrium")) return "#14B8A6";
    if (key.includes("vonuts")) return "#E0338F";
    return "#FABE00";
  };

  const handleTransitionToBallIntro = () => {
    // 1. Get all sponsors with available prizes
    const availablePrizesList = prizes.filter(p => {
      const drawnCount = drawHistory.filter(h => h.prize.label === p.label).length;
      return p.quantity > drawnCount;
    });

    if (availablePrizesList.length === 0) {
      alert("No available prizes remaining!");
      setDrawPhase("idle");
      return;
    }

    // Pick a random prize from available
    const randomPrizeIndex = Math.floor(Math.random() * availablePrizesList.length);
    const selectedWinningPrize = availablePrizesList[randomPrizeIndex];
    setWonPrize(selectedWinningPrize);
    setWonSponsor(selectedWinningPrize.sponsor);

    setCountdownVal(timers.ball_intro);
    setDrawPhase("ball_intro");
    playChime();
  };

  const handleStartBallSpinning = () => {
    setDrawPhase("ball_spinning");
    setCountdownVal(timers.ball_spinning);
    setIsSpatActive(false);
    setSpatBallY(180);
    setBallFlipState("hidden");
  };

  const handleSpatBallReveal = () => {
    setIsSpatActive(true);
    setSpatBallY(180);

    // Play spitting mechanical tube sound
    playTick(200, 0.4);

    let currentY = 180;
    const dropTime = Date.now();
    let animId: number;

    const animateDrop = () => {
      const elapsed = Date.now() - dropTime;
      if (elapsed >= 1500) {
        setSpatBallY(390); //resting socket y
        // Wait a small moment to let the ball land before full flip reveal
        setTimeout(() => {
          handleRevealBallVictoryOverlay();
        }, 600);
        return;
      }

      // Smooth acceleration easeInQuad
      const progress = elapsed / 1500;
      currentY = 180 + (390 - 180) * Math.pow(progress, 1.8);
      setSpatBallY(currentY);

      animId = requestAnimationFrame(animateDrop);
    };

    animateDrop();
  };

  const handleRevealBallVictoryOverlay = () => {
    if (!drawnWinner || !wonPrize) {
      setDrawPhase("idle");
      return;
    }

    playCelebration();

    const nowMs = Date.now();
    const drawId = `draw-${nowMs}-${Math.random().toString(36).substring(2, 6)}`;
    const drawTimestamp = new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString("en-GB", {day: "numeric", month: "short"});

    setWinnerReveal({
      id: drawId,
      participant: drawnWinner,
      prize: wonPrize,
      ticketNum: drawnTicketIndex,
      timestamp: drawTimestamp,
      drawnTimeMs: nowMs,
    });

    onDrawComplete({
      id: drawId,
      timestamp: drawTimestamp,
      participant: drawnWinner,
      prize: wonPrize,
      ticketNumber: drawnTicketIndex,
      notes: `Chance #${drawnTicketIndex} (Won via gameshow Magic Ball Lotterydrum)`
    });

    setDrawPhase("ball_reveal");
    setCountdownVal(timers.ball_reveal);
  };

  const handleSkipToWheel = () => {
    if (nextDrawType === "wheel") {
      handleTransitionToWheelIntro();
    } else {
      handleTransitionToBallIntro();
    }
  };

  const handleSkipToSpin = () => {
    if (drawPhase === "wheel_intro") {
      handleStartWheelSpinning();
    } else if (drawPhase === "ball_intro") {
      handleStartBallSpinning();
    }
  };

  const handleCloseVictory = () => {
    setDrawPhase("idle");
    setDrawnWinner(null);
    setWonPrize(null);
    setWonSponsor("");
    setIsWheelZoomed(false);
    setWinnerReveal(null);
    setTickerFlash(false);
    if (isSimpleMode) {
      setSimpleState("spinner");
    }
  };

  // Master timer manager drives all sequential visual states
  useEffect(() => {
    let activePhases = [
      "round_intro",
      "spinning_winner",
      "congrats_countdown",
      "wheel_intro",
      "wheel_spinning",
      "ball_intro",
      "ball_spinning",
      "ball_reveal",
      "victory_screen",
      "victory_promo_flip",
      "autopilot_countdown"
    ];

    const timer = setInterval(() => {
      // 1) Handle drawPhase countdowns
      if (activePhases.includes(drawPhase)) {
        setCountdownVal((prev) => {
          if (prev <= 1) {
            if (drawPhase === "round_intro") {
              executeSpinningWinner();
            } else if (drawPhase === "congrats_countdown") {
              if (nextDrawType === "wheel") {
                handleTransitionToWheelIntro();
              } else {
                handleTransitionToBallIntro();
              }
            } else if (drawPhase === "wheel_intro") {
              handleStartWheelSpinning();
            } else if (drawPhase === "ball_intro") {
              handleStartBallSpinning();
            } else if (drawPhase === "ball_spinning") {
              handleSpatBallReveal();
            } else if (drawPhase === "ball_reveal") {
              playChime();
              setCountdownVal(timers.victory_promo_flip);
              setDrawPhase("victory_promo_flip");
              // Toggle drawing type to alternate next draw (from ball reveal -> prepare wheel next)
              setNextDrawType("wheel");
            } else if (drawPhase === "victory_screen") {
              playChime();
              setCountdownVal(timers.victory_promo_flip);
              setDrawPhase("victory_promo_flip");
              // Set next draw type to ball after wheel spin
              setNextDrawType("ball");
            } else if (drawPhase === "victory_promo_flip") {
              if (isSimpleMode) {
                // Clean current states
                setDrawnWinner(null);
                setWonPrize(null);
                setWonSponsor("");
                setWinnerReveal(null);
                
                // Show winners leaderboard for 30s ("even in debug mode")
                setSimpleState("winners");
                setCountdownVal(timers.winners_leaderboard);
                setDrawPhase("idle");
                playChime();
              } else {
                setDrawPhase("idle");
                setDrawnWinner(null);
                setWonPrize(null);
                setWonSponsor("");
                setWinnerReveal(null);
              }
            } else if (drawPhase === "autopilot_countdown") {
              // Reached 0 seconds left for the "next prize draw coming up" banner
              // Move onto next round: play the video, then showing the leaderboard, etc.
              setVideoTarget("winners");
              setSimpleState("video");
              setCountdownVal(timers.presentation_video || 30);
              setDrawPhase("idle");
            }
            return 0;
          }
          return prev - 1;
        });
      }

      // 2) Handle leaderboard automatic TV transition
      if (isSimpleMode && simpleState === "winners" && drawPhase === "idle") {
        setCountdownVal((prev) => {
          if (prev <= 1) {
            // Move onto the next round by loading id2 video page
            setVideoTarget("spin");
            setSimpleState("video");
            setCountdownVal(timers.presentation_video || 30);
            setDrawPhase("idle");
            playChime();
            return 0;
          }
          return prev - 1;
        });
      }

      // 2.5) Handle video automatic fallback transition
      if (isSimpleMode && simpleState === "video" && drawPhase === "idle") {
        setCountdownVal((prev) => {
          if (prev <= 1) {
            // Video timer ended, move to target
            if (videoTarget === "winners") {
              setSimpleState("winners");
            } else if (videoTarget === "spin") {
              setSimpleState("spinner");
              if (nextDrawType === "wheel") {
                // Wheel begins with state 4 (spinner idle, id4_pause)
                setCountdownVal(timers.id4_pause || 20);
                setDrawPhase("idle");
              } else {
                // Ping Pong skipped id4 and strictly begins with state 5
                handleStartDraw();
              }
            } else {
              setSimpleState("spinner");
            }
            playChime();
            return 0;
          }
          return prev - 1;
        });
      }

      // 3) Handle ID4 auto-draw countdown (simpleState === "spinner" && drawPhase === "idle")
      if (isSimpleMode && simpleState === "spinner" && drawPhase === "idle" && poolEntries.length > 0) {
        setCountdownVal((prev) => {
          if (prev <= 1) {
            handleStartDraw();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [drawPhase, isAutopilot, isSimpleMode, simpleState, timers, poolEntries.length]);

  // Handle leaderboard automatic timer trigger init
  useEffect(() => {
    if (isSimpleMode && simpleState === "winners" && drawPhase === "idle") {
      setCountdownVal(timers.winners_leaderboard);
    }
  }, [simpleState, drawPhase, isSimpleMode, timers]);

  // Clean drawPhase if winnerReveal is cleared by parent / autopilot reset
  useEffect(() => {
    if (winnerReveal === null && (drawPhase === "victory_screen" || drawPhase === "victory_promo_flip")) {
      setDrawPhase("idle");
    }
  }, [winnerReveal, drawPhase]);

  if (isSimpleMode) {
    const activeKey = activePrize ? getSponsorKey(activePrize.sponsor) : "";
    const customSponsor = activePrize ? sponsors.find(s => s.name.toLowerCase().trim() === activePrize.sponsor.toLowerCase().trim()) : null;

    const getImageUrlLocal = (src: string | undefined, defaultPath: string) => {
      return getImageUrl(src, defaultPath, activePrize?.sponsor);
    };

    const sponsorLogoSrc = getImageUrlLocal(customSponsor?.logo, `/GAMEFILES/${activeKey}.jpg`);
    const stampPhotoSrc = getImageUrlLocal(customSponsor?.adImages?.[0], `/GAMEFILES/${activeKey}-photo1.jpg`);
    const slideSrc = randomizedSlides[activePhotoIdx] || getImageUrlLocal(customSponsor?.adImages?.[activePhotoIdx], `/GAMEFILES/${activeKey}-photo${activePhotoIdx + 1}.jpg`);

    const getDebugNumber = () => {
      if (simpleState === "ready") return "1";
      if (simpleState === "video") return "2";
      if (simpleState === "winners") return "3";
      if (simpleState === "spinner") {
        switch (drawPhase) {
          case "idle": return "4";
          case "round_intro": return "4.5";
          case "spinning_winner": return "5";
          case "congrats_countdown": return "6";
          case "wheel_intro": return "7";
          case "wheel_spinning": return "8";
          case "ball_intro": return "9";
          case "ball_spinning": return "10";
          case "ball_reveal": return "11";
          case "victory_screen": return "12";
          case "victory_promo_flip": return "13";
          case "autopilot_countdown": return "14";
          default: return "4";
        }
      }
      return "0";
    };

    return (
      <div className={isTotallyFullScreen ? "w-full h-[calc(100vh-20px)] my-2 relative z-10 p-2 flex flex-col justify-stretch" : "max-w-4xl mx-auto w-full my-8 relative z-10"}>
        {/* Debug Mode Indicator */}
        {isDebugMode && (
          <div className="absolute top-4 left-4 z-[9999] bg-white text-black font-mono font-black text-xs px-3 py-1.5 rounded-lg border-2 border-black shadow-md flex items-center justify-center min-w-[36px] min-h-[36px] select-none pointer-events-none">
            {getDebugNumber()}
          </div>
        )}
        {/* Sleek presentation TV bezel frame */}
        <div className={`w-full ${isTotallyFullScreen ? "h-full flex-1 flex flex-col justify-stretch p-3 md:p-4" : "p-3"} bg-zinc-950/90 rounded-[54px] backdrop-blur-md relative overflow-hidden transition-all duration-300 ${
          isTotallyFullScreen 
            ? "border-[24px] md:border-[36px] border-pink-500 shadow-[0_0_120px_rgba(224,51,143,0.7)]"
            : "border-8 border-pink-500/35 shadow-[0_32px_80px_-16px_rgba(224,51,143,0.45)]"
        }`}>
          
          {/* Inner presentation box with deep drop shadow */}
          <div className={`relative bg-zinc-900 text-white rounded-[42px] text-center flex flex-col justify-between shadow-[16px_16px_0px_0px_rgba(224,51,143,0.30)] overflow-hidden ${
            isTotallyFullScreen ? "h-full flex-1 border-0 p-4 md:p-6" : "min-h-[500px] border-4 border-pink-500/80 p-6 md:p-8"
          }`}>
            
            {/* 1) State "ready": Large Play Showcase Intro */}
            {simpleState === "ready" && (
              <div className="flex-1 flex flex-col justify-center items-center py-16 px-6 space-y-8 animate-fade-in select-none text-white">
                <div className="space-y-3.5 max-w-lg">
                  <span className="bg-[#E0338F] text-white text-[10px] font-black px-4 py-1.5 rounded-full border-2 border-black uppercase tracking-widest inline-block animate-pulse">
                    📺 Presenter Screen
                  </span>
                  <h2 className="font-display font-black text-3xl md:text-5xl italic uppercase tracking-tighter text-white leading-none">
                    Campaign Broadcast
                  </h2>
                  <p className="text-zinc-300 font-sans text-xs md:text-sm font-semibold max-w-md mx-auto leading-relaxed">
                    Watch the live sponsor broadcast below, followed by the active prize draw! Thank you for supporting Charity Lotteries.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-r from-pink-500 via-indigo-500 to-emerald-500 opacity-20 blur-md animate-pulse"></div>
                  
                  <button
                    onClick={() => {
                      setSimpleState("video");
                      playChime();
                    }}
                    className="group relative px-12 py-5.5 bg-yellow-400 hover:bg-yellow-300 border-4 border-neutral-950 text-black font-display font-black text-xl uppercase tracking-wider rounded-[32px] shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-4 mx-auto"
                  >
                    <div className="bg-black p-2 rounded-full border border-black text-yellow-400 group-hover:rotate-12 transition-transform">
                      <Play size={18} className="fill-yellow-400 stroke-yellow-400 translate-x-[1px]" />
                    </div>
                    <span>▶ Play Show Video</span>
                  </button>
                </div>

                <span className="text-[10px] font-mono uppercase font-black tracking-widest text-[#E0338F]">
                  🎥 video id: 79LSKFMPwx4
                </span>
              </div>
            )}

            {/* 2) State "video": YouTube Broadcaster taking 100% capacity */}
            {simpleState === "video" && (
              <div className="absolute inset-0 bg-black z-20 flex flex-col justify-center items-center animate-fade-in animate-duration-500 rounded-[38px] overflow-hidden">
                {isAutopilot && (
                  <div className="absolute top-5 right-6 bg-black/80 border-2 border-zinc-800 text-pink-400 font-mono text-[10px] font-black px-3.5 py-1.5 rounded-xl uppercase tracking-widest leading-none z-30 animate-pulse shadow-lg">
                    ⏱️ Skipping Sponsor Video in {countdownVal}s...
                  </div>
                )}
                <iframe
                  id="youtube-player-iframe"
                  src="https://www.youtube.com/embed/79LSKFMPwx4?si=zuDhD_RMDnzcuw1S&autoplay=1&mute=1&controls=1&enablejsapi=1&rel=0"
                  title="Sponsor Presentation Video"
                  className="w-full h-full absolute inset-0 rounded-[38px] border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                ></iframe>

                {/* Overlaid Bottom Skip Button */}
                <div className="absolute bottom-6 right-6 z-30">
                  <button
                    onClick={() => {
                      if (videoTarget === "winners") {
                        setSimpleState("winners");
                      } else if (videoTarget === "spin") {
                        setSimpleState("spinner");
                        if (nextDrawType === "wheel") {
                          setCountdownVal(timers.id4_pause || 20);
                          setDrawPhase("idle");
                        } else {
                          handleStartDraw();
                        }
                      } else {
                        setSimpleState("spinner");
                      }
                      playChime();
                    }}
                    className="px-6 py-3.5 bg-yellow-450 hover:bg-yellow-400 text-black border-4 border-black font-display font-black text-xs uppercase tracking-wider rounded-2xl shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>Skip Video ⏭️</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3) State "spinner": Simple presentation layout */}
            {simpleState === "spinner" && (
              <div className="animate-fade-in flex flex-col justify-between flex-1 select-none">
                
                {/* Flat TV Badge accents */}
                <div className="absolute top-5 left-5 bg-black text-yellow-400 font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-xl border-2 border-zinc-800 font-black rotate-1">
                  <Sparkle size={10} className="inline mr-1 text-yellow-400 fill-yellow-450" />
                  <span>Prize Draw Arena v2.0</span>
                </div>

                <div className="absolute top-5 right-5 flex items-center space-x-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full border border-black ${isDrawing ? "bg-yellow-400 animate-ping" : "bg-emerald-400"}`}></span>
                  <span className="text-[10px] font-mono font-black text-zinc-300 uppercase tracking-widest bg-zinc-950 border-2 border-zinc-800 px-2 py-0.5 rounded-md">
                    {isDrawing ? "Rolling" : drawPhase === "idle" && countdownVal > 0 ? `Drawing in ${countdownVal}s` : "Live Ready"}
                  </span>
                </div>

                {/* Grid layout within bezel frame */}
                <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center my-auto ${isTotallyFullScreen ? "py-1 mt-1" : "py-6 mt-4"} w-full`}>
                  {/* Left segment: Presenting sponsor */}
                  <div className={`col-span-12 lg:col-span-4 flex flex-col justify-center items-center bg-zinc-950/60 rounded-3xl border-2 border-dashed border-zinc-800 p-4 space-y-2 lg:space-y-3 ${
                    isTotallyFullScreen ? "min-h-[160px] py-2" : "min-h-[220px]"
                  }`}>
                    {activePrize ? (
                      <>
                        <span className="text-[9px] font-mono font-black text-pink-400 uppercase tracking-widest block text-glow-pink">
                          🎯 Presenting Sponsor
                        </span>
                        
                        <div className="h-12 flex items-center justify-center relative w-full">
                          {!activeLogoError ? (
                            <img
                              src={sponsorLogoSrc}
                              alt={`${activePrize.sponsor} Logo`}
                              className="max-h-12 w-auto object-contain filter drop-shadow-md brightness-110"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src.includes("/GAMEFILES/")) {
                                  target.src = `/${activeKey}.jpg`;
                                } else {
                                  setActiveLogoError(true);
                                }
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-display font-black text-sm text-white uppercase tracking-tight leading-none bg-zinc-850 px-3 py-1.5 rounded-lg border border-zinc-700">{activePrize.sponsor}</span>
                          )}
                        </div>

                        <div className="relative">
                          <div className="w-20 h-20 rounded-full border-4 border-pink-500 overflow-hidden bg-zinc-900 mx-auto relative shadow-[4px_4px_0px_0px_rgba(224,51,143,0.3)] rotate-[-3deg]">
                            {!activeStampError ? (
                              <img
                                src={stampPhotoSrc}
                                alt={`${activePrize.sponsor} badge`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (target.src.includes("/GAMEFILES/")) {
                                    target.src = `/${activeKey}-photo1.jpg`;
                                  } else {
                                    setActiveStampError(true);
                                  }
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full bg-pink-950/40 flex flex-col items-center justify-center text-center p-2 text-pink-300 border border-pink-550/20">
                                <span className="font-display text-[8px] font-black uppercase tracking-tight leading-none">{activePrize.sponsor}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-zinc-500 text-xs font-semibold py-4 text-center uppercase tracking-widest">
                        No Active Prize
                      </div>
                    )}
                  </div>

                  {/* Middle segment: Rolling displays */}
                  <div className={`col-span-12 lg:col-span-12 xl:col-span-5 lg:order-none flex flex-col justify-center ${
                    isTotallyFullScreen ? "space-y-2" : "space-y-4"
                  } lg:col-span-12`}>
                    
                    {/* Compact selector */}
                    <div className="max-w-md mx-auto w-full text-left bg-zinc-950/50 rounded-xl p-3 border-2 border-zinc-800 text-white shadow-inner">
                      <label className="block text-[9px] font-black text-pink-400 font-display uppercase tracking-widest text-center mb-1">
                        💖 Campaign active prize for TV
                      </label>
                      {prizes.length === 0 ? (
                        <p className="text-xs text-center font-bold text-zinc-500">No prizes created.</p>
                      ) : availablePrizes.length === 0 ? (
                        <p className="text-xs text-center font-bold text-emerald-400 font-sans">🎉 All prizes drawn! Reset dataset.</p>
                      ) : (
                        <select
                          value={selectedPrizeId}
                          disabled={isDrawing}
                          onChange={(e) => setSelectedPrizeId(e.target.value)}
                          className="w-full text-[11px] font-sans font-black py-1.5 px-2 bg-zinc-900 border-2 border-zinc-800 rounded-lg text-white cursor-pointer text-center focus:outline-none focus:border-pink-500"
                        >
                          {availablePrizes.map(p => {
                            const drawnCount = drawHistory.filter(h => h.prize.label === p.label).length;
                            const itemsLeft = p.quantity - drawnCount;
                            return (
                              <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                                🎁 {p.sponsor} : {p.label} ({itemsLeft} Left)
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    <span className="text-[10px] text-pink-400 font-display font-black tracking-widest uppercase text-center animate-pulse text-glow-pink">
                      {isDrawing ? "🔄 DRUM IS ROLLING... 🔄" : "🎰 READY FOR DRAW 🎰"}
                    </span>

                    {/* Drum Display */}
                    <div className={`relative mx-auto w-full max-w-lg transition-all duration-150 ${tickerFlash ? "scale-105" : ""}`}>
                      <div className="absolute -inset-1 rounded-[28px] bg-black bg-gradient-to-r from-pink-500 to-indigo-500 opacity-30"></div>
                      <div className={`relative bg-gradient-to-br from-indigo-950 via-zinc-900 to-pink-950 border-4 border-pink-500/80 rounded-[28px] p-6 flex flex-col items-center justify-center min-h-[120px] text-white shadow-[0_0_20px_rgba(224,51,143,0.25)] ${
                        tickerFlash ? "bg-gradient-none bg-yellow-400 text-black border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.5)]" : ""
                      }`}>
                        <h1 className={`font-display font-black text-xl sm:text-3xl px-2 overflow-hidden text-ellipsis w-full tracking-tighter transition-all leading-tight uppercase text-center ${
                          tickerFlash ? "text-black text-glow-gold" : "text-white text-glow-pink font-extrabold"
                        }`}>
                          {activeRollName}
                        </h1>
                        <p className={`font-mono text-[9px] mt-2.5 tracking-wider px-3 py-1 border-2 font-bold uppercase shrink-0 text-center ${
                          tickerFlash ? "bg-black text-yellow-400 border-yellow-500" : "bg-black/55 text-zinc-300 border-zinc-800"
                        }`}>
                          {activeRollTicket}
                        </p>
                      </div>
                    </div>

                    {activePrize && (
                      <div className="inline-flex items-center space-x-1.5 bg-pink-500/10 border-2 border-pink-500 rounded-2xl px-4 py-1.5 mx-auto justify-center text-pink-300 font-black uppercase text-center text-[10px] text-glow-pink">
                        <span>🎁 {activePrize.sponsor} : {activePrize.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Right segment: Slide show billboard */}
                  <div className="col-span-12 lg:col-span-3 flex flex-col justify-stretch">
                    {activePrize ? (
                      <div className="relative overflow-hidden rounded-2xl border-4 border-zinc-800 bg-zinc-950 flex flex-col justify-between h-48 shadow-[4px_4px_16px_rgba(0,0,0,0.5)]">
                        <div className="absolute top-0 inset-x-0 bg-black/80 border-b border-white/5 px-2 py-1 z-10 font-mono text-[7px] font-black uppercase text-pink-400 tracking-widest text-center">
                          📢 Sponsor Billboard
                        </div>
                        <div className="relative w-full flex-grow overflow-hidden bg-black/60">
                          {!activePhotoErrors[activePhotoIdx] ? (
                            <img
                              src={slideSrc}
                              alt={`${activePrize.sponsor} slide ${activePhotoIdx + 1}`}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src.includes("/GAMEFILES/")) {
                                  target.src = `/${activeKey}-photo${activePhotoIdx + 1}.jpg`;
                                } else {
                                  setActivePhotoErrors(prev => ({ ...prev, [activePhotoIdx]: true }));
                                }
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-zinc-900 p-2 flex flex-col justify-center items-center text-center">
                              <span className="text-sm">⭐</span>
                              <p className="text-[8px] font-bold text-white uppercase italic font-sans">{activePrize.sponsor}</p>
                            </div>
                          )}
                        </div>
                        <div className="bg-black/85 text-[7px] text-zinc-400 font-mono py-1 px-2 border-t border-white/5 flex justify-between uppercase">
                          <span>Photo {activePhotoIdx + 1}/{randomizedSlides.length || 3}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-[10px] py-4 text-center uppercase tracking-widest bg-zinc-900 border border-zinc-800 rounded-2xl font-sans">
                        Offline
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Spin drawer trigger */}
                <div className="pt-4 border-t-2 border-zinc-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="text-left">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Available pool</p>
                    <p className="font-sans font-black text-xs text-white">
                      {poolEntries.length > 0 ? (
                        <>{poolEntries.length} physical tickets ready</>
                      ) : (
                        <span className="text-rose-400 font-black">Pool is empty!</span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      handleStartDraw();
                    }}
                    disabled={isDrawing || poolEntries.length === 0 || !activePrize}
                    className={`w-full sm:w-auto h-16 px-8 bg-yellow-400 hover:bg-yellow-300 border-4 border-neutral-950 text-black rounded-[24px] flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-lg font-black italic cursor-pointer ${
                      isDrawing
                        ? "bg-amber-500 text-black cursor-not-allowed opacity-80"
                        : poolEntries.length === 0 || !activePrize
                        ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed shadow-none"
                        : ""
                    }`}
                  >
                    {isDrawing ? (
                      <>
                        <RefreshCw className="animate-spin text-black" size={16} />
                        <span>Drawing Winner...</span>
                      </>
                    ) : (
                      <>
                        <Play size={16} className="fill-black stroke-black" />
                        <span>Spin & Draw Now!</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

            {/* 4) State "winners": Winners list on TV bezel screen */}
            {simpleState === "winners" && (
              <div className="animate-fade-in flex flex-col justify-between flex-grow overflow-y-auto max-h-[720px] scrollbar-thin scrollbar-thumb-zinc-800 pr-1 relative min-h-[480px]">
                {isAutopilot && (
                  <div className="absolute top-5 right-20 bg-black/80 border-2 border-zinc-800 text-yellow-500 font-mono text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest leading-none z-10 animate-pulse">
                    ⏱️ Next draw starts in {countdownVal}s
                  </div>
                )}
                <PrizeWinnersWall
                  drawHistory={drawHistory}
                  onToggleClaim={(id, currentClaimed) => {
                    if (onToggleClaim) {
                      onToggleClaim(id, currentClaimed);
                    }
                  }}
                  isSimpleMode={true}
                  onGoToDraw={() => {
                    setVideoTarget("spinner");
                    setSimpleState("spinner");
                    playChime();
                  }}
                />
              </div>
            )}

          </div>
        </div>

        {/* Unified Gameshow Drawing Overlay */}
        {renderUnifiedDrawingOverlay()}

      </div>
    );
  }

  const getAdvancedDebugNumber = () => {
    if (drawPhase && drawPhase !== "idle") {
      switch (drawPhase) {
        case "round_intro": return "24";
        case "spinning_winner": return "25";
        case "congrats_countdown": return "26";
        case "wheel_intro": return "27";
        case "wheel_spinning": return "28";
        case "ball_intro": return "29";
        case "ball_spinning": return "30";
        case "ball_reveal": return "31";
        case "victory_screen": return "32";
        case "victory_promo_flip": return "33";
        case "autopilot_countdown": return "34";
        default: return "20";
      }
    }
    return "20";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
      {/* Debug Mode Indicator */}
      {isDebugMode && (
        <div className="absolute top-0 left-0 z-[9999] bg-white text-black font-mono font-black text-xs px-3 py-1.5 rounded-lg border-2 border-black shadow-md flex items-center justify-center min-w-[36px] min-h-[36px] select-none pointer-events-none">
          {getAdvancedDebugNumber()}
        </div>
      )}
      {/* Left Column: Draw Controls & Customization - Hidden in Simple TV mode */}
      {!isSimpleMode ? (
        <div className="lg:col-span-1 space-y-6">
        <div className="bg-white text-black rounded-[32px] border-4 border-black p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex items-center space-x-2 border-b-4 border-black pb-3">
            <Trophy className="text-yellow-500 shrink-0 stroke-[3]" size={24} />
            <h2 className="font-display font-black text-black text-xl uppercase tracking-tight">Draw Customizer</h2>
          </div>

          {/* Sound, Weight, and Filter Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black font-display uppercase tracking-wider mb-2">Select Target Prize</label>
              {prizes.length === 0 ? (
                <div className="bg-yellow-100 border-2 border-black rounded-xl p-3 text-black text-xs flex gap-2 font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <AlertTriangle size={16} className="shrink-0 text-yellow-600" />
                  <p>No prizes available. Please add or restore prizes in spreadsheet tab first!</p>
                </div>
              ) : availablePrizes.length === 0 ? (
                <div className="bg-green-100 border-2 border-black rounded-xl p-3 text-black text-xs flex gap-2 font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <p>All prizes have been successfully awarded! Reset database to draw again.</p>
                </div>
              ) : (
                <select
                  value={selectedPrizeId}
                  disabled={isDrawing}
                  onChange={(e) => setSelectedPrizeId(e.target.value)}
                  className="w-full text-sm font-sans font-bold py-3 px-3 border-4 border-black rounded-xl bg-yellow-400 text-black focus:outline-hidden focus:ring-2 focus:ring-black disabled:opacity-50 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  {availablePrizes.map(p => {
                    const drawnCount = drawHistory.filter(h => h.prize.label === p.label).length;
                    const itemsLeft = p.quantity - drawnCount;
                    return (
                      <option key={p.id} value={p.id}>
                        🎁 {p.sponsor} - {p.label} ({itemsLeft} free)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {activePrize && (
              <div className="bg-indigo-600 text-white rounded-[24px] p-5 border-4 border-black space-y-1.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-[9px] uppercase font-black text-indigo-200 tracking-wider">Current Sponsor / Contributor</span>
                <h4 className="font-display font-black text-lg text-yellow-300 leading-tight">{activePrize.sponsor}</h4>
                <div className="border-t border-indigo-500/50 my-2 pt-2">
                  <p className="text-xs text-white leading-relaxed font-bold">
                    <span className="text-indigo-250 uppercase font-black tracking-widest text-[10px] block mb-1">Contributor Item:</span>
                    {activePrize.details || activePrize.label} 
                    {activePrize.value > 0 && (
                      <span className="block mt-1 font-mono text-[10px] text-yellow-300">ESTIMATED VALUE: NZD ${activePrize.value}</span>
                    )}
                  </p>
                </div>
                {activePrize.notes && (
                  <p className="text-[10px] text-indigo-200 italic mt-1 font-sans">Notes: {activePrize.notes}</p>
                )}
              </div>
            )}

            <div className="border-t-4 border-black pt-4 space-y-3.5">
              <span className="block text-xs font-black text-black font-display uppercase tracking-wider mb-2">Rules & Engine Filters</span>
              
              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isDrawing}
                  checked={useTicketsWeighted}
                  onChange={e => setUseTicketsWeighted(e.target.checked)}
                  className="rounded-md border-2 border-black text-black bg-white focus:ring-black w-4 h-4 mt-0.5"
                />
                <div className="text-xs font-sans text-black font-bold">
                  <p className="text-black font-black uppercase tracking-tight">Weight by Tickets Bought</p>
                  <p className="text-zinc-650 text-[10px] font-sans font-medium mt-0.5">E.g. James Stokes bought 2 tickets → 2 chances.</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isDrawing}
                  checked={paidOnly}
                  onChange={e => setPaidOnly(e.target.checked)}
                  className="rounded-md border-2 border-black text-black bg-white focus:ring-black w-4 h-4 mt-0.5"
                />
                <div className="text-xs font-sans text-black font-bold">
                  <p className="text-black font-black uppercase tracking-tight">Exclude Unpaid Bookings</p>
                  <p className="text-zinc-650 text-[10px] font-sans font-medium mt-0.5">Filters order status to strictly "Paid".</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isDrawing}
                  checked={excludePastWinners}
                  onChange={e => setExcludePastWinners(e.target.checked)}
                  className="rounded-md border-2 border-black text-black bg-white focus:ring-black w-4 h-4 mt-0.5"
                />
                <div className="text-xs font-sans text-black font-bold">
                  <p className="text-black font-black uppercase tracking-tight">Deduplicate Winners (1 limits)</p>
                  <p className="text-zinc-650 text-[10px] font-sans font-medium mt-0.5">Emails that won are fully removed from future pools.</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isDrawing}
                  checked={turboMode}
                  onChange={e => setTurboMode(e.target.checked)}
                  className="rounded-md border-2 border-black bg-white checked:bg-pink-500 checked:border-black focus:ring-black w-4 h-4 mt-0.5"
                />
                <div className="text-xs font-sans text-black font-bold">
                  <p className="text-black font-black uppercase tracking-tight">🚀 Turbo Mode (1.0s Spin)</p>
                  <p className="text-zinc-650 text-[10px] font-sans font-medium mt-0.5">Reduces the spinning animation duration to exactly 1 second for rapid-fire prize drawings.</p>
                </div>
              </label>
            </div>

            <div className="border-t-4 border-black pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs font-black text-zinc-900 font-display uppercase tracking-widest">
                <span>Raffle Spin Speed</span>
                <span className="bg-black text-yellow-400 font-mono text-[11px] px-2 py-0.5 rounded-md border border-black font-bold">
                  {turboMode ? "1.0s (Turbo)" : `${duration}s`}
                </span>
              </div>
              <input
                type="range"
                min="1.5"
                max="8.0"
                step="0.5"
                disabled={isDrawing || turboMode}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full accent-black h-2.5 rounded-lg bg-zinc-200 border-2 border-black cursor-pointer disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] text-zinc-600 uppercase font-bold px-1">
                <span>Fast Sweep (1.5s)</span>
                <span>Suspense Climax (8s)</span>
              </div>
            </div>

            <div className="border-t-4 border-black pt-4 flex items-center justify-between">
              <span className="text-xs font-black text-zinc-900 font-display uppercase tracking-wider">Synthesizer Sounds</span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                disabled={isDrawing}
                className={`py-2 px-4 rounded-xl border-2 border-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all text-black hover:scale-105 active:scale-95 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                  soundEnabled 
                    ? "bg-yellow-400 text-black" 
                    : "bg-zinc-200 text-zinc-700"
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 size={13} className="stroke-[3]" />
                    <span>On / Live</span>
                  </>
                ) : (
                  <>
                    <VolumeX size={13} />
                    <span>Muted</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic pool status summary */}
        <div className="bg-black text-white rounded-[24px] p-5 border-4 border-black space-y-2.5 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-800">
            <span className="text-xs text-zinc-400 font-black uppercase tracking-wider">Eligible Voters Pool:</span>
            <span className="font-mono text-xs font-black text-black bg-yellow-400 px-2.5 py-1 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {poolEntries.length} entries
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400 uppercase font-bold tracking-wider">Total physical tickets:</span>
            <span className="text-yellow-400 font-black">{participants.reduce((acc, p) => acc + p.ticketsCount, 0)} tickets</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400 uppercase font-bold tracking-wider">Unique attendees:</span>
            <span className="text-white font-black">{participants.length} customers</span>
          </div>
        </div>
      </div>
    ) : null}

      {/* Right Column: The main drawing box and confetti results - Spans full width in TV mode */}
      <div className={`${isSimpleMode ? "lg:col-span-3" : "lg:col-span-2"} space-y-6`}>
        {/* Dynamic Raffle Arena */}
        <div className="relative bg-white text-black rounded-[48px] border-4 border-black p-8 text-center overflow-hidden min-h-[480px] flex flex-col justify-between shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
          
          {/* R4R Heading Logo perfectly centered at top */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 select-none">
            <img src="/r4r-logo.png" alt="Rhythm for Ribbons" className="h-10 md:h-12 w-auto object-contain filter drop-shadow-md" />
          </div>

          {/* Flat Corner Accents */}
          <div className="absolute top-5 left-5 bg-black text-yellow-400 font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-xl border-2 border-black font-black rotate-1 select-none flex flex-col items-start leading-tight">
            <span>
              <Sparkle size={10} className="inline mr-1 text-yellow-400 fill-yellow-450" />
              Prize Draw Arena v2.0
            </span>
          </div>

          <div className="absolute top-5 right-5 flex items-center space-x-2 select-none">
            <span className={`inline-block w-2.5 h-2.5 rounded-full border border-black ${isDrawing ? "bg-yellow-400 animate-ping" : "bg-emerald-400"}`}></span>
            <span className="text-[10px] font-mono font-black text-black uppercase tracking-widest bg-zinc-100 border-2 border-black px-2 py-0.5 rounded-md">{isDrawing ? "Rolling" : "Live Ready"}</span>
          </div>

          {/* Central content area split into 3 columns matching the design mockup and user request */}
          {(() => {
            const activeKey = activePrize ? getSponsorKey(activePrize.sponsor) : "";
            const customSponsor = activePrize ? sponsors.find(s => s.name.toLowerCase().trim() === activePrize.sponsor.toLowerCase().trim()) : null;

            const getImageUrl = (src: string | undefined, defaultPath: string) => {
              if (!src) return defaultPath;
              if (src.startsWith("data:") || src.startsWith("/")) return src;
              return `/GAMEFILES/${src}`;
            };

            const sponsorLogoSrc = getImageUrl(customSponsor?.logo, `/GAMEFILES/${activeKey}.jpg`);
            const stampPhotoSrc = getImageUrl(customSponsor?.adImages?.[0], `/GAMEFILES/${activeKey}-photo1.jpg`);
            const slideSrc = randomizedSlides[activePhotoIdx] || getImageUrl(customSponsor?.adImages?.[activePhotoIdx], `/GAMEFILES/${activeKey}-photo${activePhotoIdx + 1}.jpg`);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center my-auto py-6 w-full">
                
                {/* Left Column: Sponsor Branding (Sponsor Logo & Circular Stamp) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col justify-center items-center bg-zinc-50/50 rounded-3xl p-5 border-2 border-dashed border-zinc-200 min-h-[300px] space-y-4">
                  {activePrize ? (
                    <>
                      <span className="text-[10px] font-mono font-black text-pink-600 uppercase tracking-widest block mb-1">
                        🎯 Presenting Sponsor
                      </span>
                      
                      {/* Sponsor Logo with fallback */}
                      <div className="h-16 flex items-center justify-center relative w-full mb-1">
                        {!activeLogoError ? (
                          <img
                            src={sponsorLogoSrc}
                            alt={`${activePrize.sponsor} Logo`}
                            className="max-h-16 w-auto object-contain filter drop-shadow-md select-none"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src.includes("/GAMEFILES/")) {
                                target.src = `/${activeKey}.jpg`;
                              } else {
                                setActiveLogoError(true);
                              }
                            }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="font-display font-black text-xl text-black uppercase tracking-tight leading-none bg-zinc-200 px-4 py-2 rounded-xl border border-black">{activePrize.sponsor}</span>
                        )}
                      </div>

                      {/* Stamp Photo (Photo 1 stylized with a circular thick border and shadow) */}
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-white mx-auto relative shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-3deg] hover:rotate-[3deg] transition-all">
                          {!activeStampError ? (
                            <img
                              src={stampPhotoSrc}
                              alt={`${activePrize.sponsor} badge`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src.includes("/GAMEFILES/")) {
                                  target.src = `/${activeKey}-photo1.jpg`;
                                } else {
                                  setActiveStampError(true);
                                }
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-pink-100 flex flex-col items-center justify-center text-center p-3 text-red-600">
                              <span className="text-xl">🍕</span>
                              <span className="font-display text-[9px] font-black uppercase tracking-tight mt-1 leading-none">{activePrize.sponsor}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-zinc-400 text-xs font-semibold py-8 text-center uppercase tracking-widest">
                      No Active Prize
                    </div>
                  )}
                </div>

                {/* Center Column: Interactive Ticker Drum and Selection Control */}
                <div className="col-span-12 lg:col-span-12 xl:col-span-5 lg:order-none col-span-12 xl:order-none flex flex-col justify-center space-y-6 lg:col-span-5">
                  
                  {/* Dynamic Droplist Prize Selector */}
                  {isSimpleMode && (
                    <div className="max-w-md mx-auto w-full text-left bg-zinc-50 rounded-2xl p-4 border-2 border-zinc-200 shadow-sm animate-fade-in text-black select-none">
                      <label className="block text-[10px] font-black text-pink-600 font-display uppercase tracking-widest text-center mb-1.5">
                        💖 Pally Active Ribbon Prize Drawing for TV
                      </label>
                      {prizes.length === 0 ? (
                        <p className="text-xs text-center font-bold text-zinc-500">No prizes created. Pop open normal mode to add!</p>
                      ) : availablePrizes.length === 0 ? (
                        <p className="text-xs text-center font-bold text-emerald-600">🎉 All campaign prizes drawn! Great job!</p>
                      ) : (
                        <select
                          value={selectedPrizeId}
                          disabled={isDrawing}
                          onChange={(e) => {
                            setSelectedPrizeId(e.target.value);
                          }}
                          className="w-full text-xs font-sans font-black py-2.5 px-3 bg-white border-2 border-black rounded-xl text-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center focus:outline-none"
                        >
                          {availablePrizes.map(p => {
                            const drawnCount = drawHistory.filter(h => h.prize.label === p.label).length;
                            const itemsLeft = p.quantity - drawnCount;
                            return (
                              <option key={p.id} value={p.id}>
                                🎁 {p.sponsor} : {p.label} ({itemsLeft} Units Left)
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  )}

                  <span className="text-xs text-indigo-600 font-display font-black tracking-widest uppercase mb-1 block animate-bounce text-center">
                    {isDrawing ? "🔄 DRUM IS SPINNING... DRUMROLL... 🔄" : "🎰 CLICK SPIN TO DRAW A WINNER BELOW! 🎰"}
                  </span>

                  {/* Rolling Display Drum */}
                  <div className={`relative mx-auto w-full max-w-xl transition-all duration-150 ${tickerFlash ? "scale-105" : ""}`}>
                    {/* Flat Solid Shadows background stack */}
                    <div className="absolute -inset-1 rounded-[36px] bg-black"></div>
                    
                    <div className={`relative bg-indigo-600 border-4 border-black rounded-[36px] p-8 flex flex-col items-center justify-center min-h-[160px] text-white ${
                      tickerFlash ? "bg-yellow-400 text-black border-yellow-400" : ""
                    }`}>
                      {/* Scrolling ticker display */}
                      <h1 className={`font-display font-black text-2xl sm:text-4xl px-2 overflow-hidden text-ellipsis w-full tracking-tighter transition-all leading-tight uppercase text-center ${
                        tickerFlash ? "text-black text-glow-gold" : "text-white"
                      }`}>
                        {activeRollName}
                      </h1>
                      
                      <p className={`font-mono text-[10px] sm:text-xs mt-4 tracking-widest px-4 py-1.5 border-2 border-black rounded-full font-bold uppercase shrink-0 text-center ${
                        tickerFlash ? "bg-black text-yellow-400" : "bg-black/45 text-indigo-205"
                      }`}>
                        {activeRollTicket}
                      </p>
                    </div>
                  </div>

                  {/* Target Prize description banner below drum */}
                  {activePrize && (
                    <div className="mt-4 inline-flex flex-col sm:flex-row sm:items-center sm:space-x-2.5 bg-yellow-400 border-4 border-black rounded-3xl px-6 py-3 mx-auto justify-center text-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
                      <span className="text-[10px] font-mono font-black tracking-widest text-[#FF3D00]">Awarding Prize:</span>
                      <span className="font-display font-[900] text-xs sm:text-sm flex items-center justify-center gap-1.5 mt-0.5 sm:mt-0 leading-none">
                        🎁 {activePrize.sponsor} — <span className="underline decoration-wavy decoration-black">{activePrize.label}</span>
                      </span>
                    </div>
                  )}

                </div>

                {/* Right Column: Active Ad Campaign Slideshow / Poster */}
                <div className="col-span-12 lg:col-span-3 flex flex-col justify-stretchy min-h-[300px]">
                  {activePrize ? (
                    <div className="relative overflow-hidden rounded-3xl border-4 border-black bg-zinc-900 flex flex-col justify-between h-80 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                      {/* Subtle header */}
                      <div className="absolute top-0 inset-x-0 bg-black/60 backdrop-blur-xs border-b border-white/10 px-3 py-1.5 z-10 font-mono text-[8px] font-black uppercase text-pink-400 tracking-widest text-center">
                        📢 Sponsor Slideshow
                      </div>
                      
                      {/* Slide Container */}
                      <div className="relative w-full flex-grow overflow-hidden bg-black/50">
                        {!activePhotoErrors[activePhotoIdx] ? (
                          <img
                            src={slideSrc}
                            alt={`${activePrize.sponsor} slide ${activePhotoIdx + 1}`}
                            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src.includes("/GAMEFILES/")) {
                                target.src = `/${activeKey}-photo${activePhotoIdx + 1}.jpg`;
                              } else {
                                setActivePhotoErrors(prev => ({ ...prev, [activePhotoIdx]: true }));
                              }
                            }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950 p-4 flex flex-col justify-center items-center text-center">
                            <span className="text-2xl animate-spin mb-1 text-pink-500">⭐</span>
                            <p className="text-xs font-black text-white italic uppercase tracking-tight">{activePrize.sponsor}</p>
                            <p className="text-[9px] text-zinc-400 mt-0.5 leading-snug">Proud sponsor of this prize draw campaign!</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Caption bar */}
                      <div className="bg-black/85 text-[9px] text-zinc-300 font-mono py-1.5 px-3 border-t border-white/10 flex justify-between uppercase">
                        <span>Photo {activePhotoIdx + 1} / {randomizedSlides.length || 3}</span>
                        <span className="truncate max-w-[120px]">{randomizedSlides[activePhotoIdx]?.split("/").pop() || `${activeKey}-photo${activePhotoIdx + 1}`}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-400 text-xs font-semibold py-8 text-center uppercase tracking-widest">
                      Slideshow Offline
                    </div>
                  )}
                </div>

              </div>
            );
          })()}
          <div className="pt-6 border-t-4 border-black z-10 flex flex-col sm:flex-row gap-5 items-center justify-between">
            <div className="text-left">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Pool Status</p>
              <h5 className="font-sans font-black text-sm text-black">
                {poolEntries.length > 0 ? (
                  <>Ready to pick winner from <strong className="text-indigo-600 font-mono tracking-tighter">{poolEntries.length} tickets</strong></>
                ) : (
                  <span className="text-rose-600 font-black uppercase tracking-tight">Raffle pool is empty! Change filters.</span>
                )}
              </h5>
            </div>

            <button
              onClick={handleStartDraw}
              disabled={drawPhase !== "idle" || poolEntries.length === 0}
              className={`w-full sm:w-auto h-24 px-12 bg-yellow-400 hover:bg-yellow-300 border-4 border-black text-black rounded-[32px] flex items-center justify-center gap-4 transition-transform active:scale-95 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] uppercase text-2xl font-black italic cursor-pointer ${
                drawPhase !== "idle"
                  ? "bg-amber-500 text-black cursor-not-allowed opacity-80"
                  : poolEntries.length === 0
                  ? "bg-zinc-350 text-zinc-500 cursor-not-allowed shadow-none"
                  : ""
              }`}
            >
              {drawPhase !== "idle" ? (
                <>
                  <RefreshCw className="animate-spin text-black" size={24} />
                  <span>Drawing...</span>
                </>
              ) : (
                <>
                  <Play size={24} className="fill-black stroke-black" />
                  <span>Spin & Draw Now!</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Unified Gameshow Drawing Overlay */}
        {renderUnifiedDrawingOverlay()}
      </div>
    </div>
  );
}
