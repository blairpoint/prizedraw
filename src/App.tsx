import { useState, useEffect, useRef, useMemo } from "react";
import { Prize, Participant, DrawResult, Sponsor } from "./types";
import { parsePrizesCSV, parseParticipantsCSV } from "./utils/csvParser";
import { DEFAULT_PRIZES_CSV, DEFAULT_PARTICIPANTS_CSV } from "./data/defaults";
import { enrichSponsorsWithFiles, setSponsorCsvMappings, parseSponsorCsv } from "./utils/sponsorFiles";
import Confetti from "./components/Confetti";
import RaffleSpinner from "./components/RaffleSpinner";
import CsvManager from "./components/CsvManager";
import StatsOverview from "./components/StatsOverview";
import PrizeWinnersWall from "./components/PrizeWinnersWall";
import FeatureCommentBoard from "./components/FeatureCommentBoard";
import { Trophy, Database, BarChart3, Ticket, Award, Volume2, Sparkles, Heart, RefreshCw, AlertCircle, Sparkle, Check, MessageSquare } from "lucide-react";
import { playChime } from "./utils/audio";
import StartupModal from "./components/StartupModal";

export default function App() {
  // Navigation: "arena" | "spreadsheet" | "analytics" | "winners" | "reviews"
  const [activeTab, setActiveTab] = useState<"arena" | "spreadsheet" | "analytics" | "winners" | "reviews">("arena");

  // Core datasets
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drawHistory, setDrawHistory] = useState<DrawResult[]>([]);
  const [rawSponsors, setRawSponsors] = useState<Sponsor[]>([]);
  const [csvLoadedTrigger, setCsvLoadedTrigger] = useState(0);
  
  const setSponsors = (update: Sponsor[] | ((prev: Sponsor[]) => Sponsor[])) => {
    if (typeof update === "function") {
      setRawSponsors(prev => update(prev));
    } else {
      setRawSponsors(update);
    }
  };

  const sponsors = useMemo(() => {
    const derivedSponsors: Sponsor[] = [...rawSponsors];
    
    prizes.forEach(p => {
      const nameNorm = p.sponsor.trim();
      if (nameNorm && !derivedSponsors.some(s => s.name.toLowerCase().trim() === nameNorm.toLowerCase().trim())) {
        derivedSponsors.push({
          id: nameNorm.toLowerCase().replace(/[^a-z0-9]/g, ""),
          name: nameNorm,
          logo: "",
          adImages: []
        });
      }
    });

    return enrichSponsorsWithFiles(derivedSponsors, undefined, prizes);
  }, [rawSponsors, prizes, csvLoadedTrigger]);
  
  // Confetti trigger
  const [showConfetti, setShowConfetti] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(true);
  const [competitionStarted, setCompetitionStarted] = useState(false);
  
  const handleInitialize = (mode: "default" | "test" | "debug", logs: any[] | null, immersive: boolean) => {
    setIsDebugMode(mode === 'debug');
    setIsTestMode(mode === 'test');
    localStorage.setItem("rhythm_ribbons_debug_mode", String(mode === 'debug'));
    localStorage.setItem("rhythm_ribbons_test_mode", String(mode === 'test'));
    
    if (logs) {
      handleImportLogs(logs);
    }
    if (immersive) toggleFullScreen();
    setShowStartupModal(false);
    setCompetitionStarted(true);
  };

  // LCD TV Simple Mode for Large Screen
  const [isSimpleMode, setIsSimpleMode] = useState(true);
  const [isTotallyFullScreen, setIsTotallyFullScreen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(() => {
    try {
      return localStorage.getItem("rhythm_ribbons_debug_mode") === "true";
    } catch (e) {
      return false;
    }
  });

  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("rhythm_ribbons_test_mode") === "true";
    } catch (e) {
      return false;
    }
  });

  const toggleTestMode = () => {
    const nextVal = !isTestMode;
    setIsTestMode(nextVal);
    try {
      localStorage.setItem("rhythm_ribbons_test_mode", String(nextVal));
    } catch (e) {}
    playChime();
  };

  const toggleDebugMode = () => {
    const nextVal = !isDebugMode;
    setIsDebugMode(nextVal);
    try {
      localStorage.setItem("rhythm_ribbons_debug_mode", String(nextVal));
    } catch (e) {}
    playChime();
  };

  // Sync isTotallyFullScreen with HTML Fullscreen API and monitor user exit
  const toggleFullScreen = () => {
    const nextState = !isTotallyFullScreen;
    setIsTotallyFullScreen(nextState);
    if (nextState) {
      setIsSimpleMode(true); // force simple TV mode on when going immersive
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {}
    } else {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}
    }
    playChime();
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsTotallyFullScreen(isFs);
      if (isFs) {
        setIsSimpleMode(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Mobile Claimant Portal Interceptor
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const claimCode = urlParams.get("claimCode");
  const claimName = urlParams.get("name") || "";
  const claimPrize = urlParams.get("prize") || "";
  const claimSponsor = urlParams.get("sponsor") || "";

  // Dedicated Claim Portal State
  const [phoneClaimed, setPhoneClaimed] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(true);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Mobile tactile Wheel of Fortune state management
  const [showPhoneWheelOption, setShowPhoneWheelOption] = useState(true);
  const [phoneBonusWon, setPhoneBonusWon] = useState<string | null>(null);
  const [phoneWheelSpinning, setPhoneWheelSpinning] = useState(false);
  const [phoneWheelAngle, setPhoneWheelAngle] = useState(0);
  const [touchStartAngle, setTouchStartAngle] = useState(0);
  const [isDraggingWheel, setIsDraggingWheel] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Check initial state from KVDB if in Mobile Claimant mode
  useEffect(() => {
    if (!claimCode) return;
    
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/kv/claim_${claimCode}`);
        if (res.ok) {
          const val = await res.text();
          if (val.trim() === "claimed") {
            setPhoneClaimed(true);
          }
        }

        // Preload any existing Bonus Wheel prize for this claim code
        const bonusRes = await fetch(`/api/kv/bonus_${claimCode}`);
        if (bonusRes.ok) {
          const bonusData = await bonusRes.json();
          if (bonusData && bonusData.additionalPrize) {
            setPhoneBonusWon(bonusData.additionalPrize);
            setShowPhoneWheelOption(false);
          }
        }
      } catch (err) {
        console.error("KVDB load error on mobile phone", err);
      } finally {
        setPhoneChecking(false);
      }
    };
    checkStatus();
  }, [claimCode]);

  const handlePhoneConfirm = async () => {
    if (!claimCode) return;
    setPhoneSubmitting(true);
    setPhoneError("");
    try {
      const res = await fetch(`/api/kv/claim_${claimCode}`, {
        method: "PUT",
        body: "claimed",
        headers: {
          "Content-Type": "text/plain"
        }
      });
      if (res.ok) {
        setPhoneClaimed(true);
      } else {
        throw new Error("Unable to save. Please try again.");
      }
    } catch (err: any) {
      setPhoneError(err.message || "Failed to update claim on server.");
    } finally {
      setPhoneSubmitting(false);
    }
  };

  // Poll KVDb for claims status of drawing history
  useEffect(() => {
    if (drawHistory.length === 0) return;

    // Filter only those that are NOT claimed
    const unclaimedHistory = drawHistory.filter(h => !h.claimed);
    if (unclaimedHistory.length === 0) return;

    const interval = setInterval(() => {
      unclaimedHistory.forEach(async (item) => {
        try {
          const res = await fetch(`/api/kv/claim_${item.id}`);
          if (res.ok) {
            const txt = await res.text();
            if (txt.trim() === "claimed") {
              setDrawHistory(prev =>
                prev.map(h => {
                  if (h.id === item.id) {
                    return { ...h, claimed: true };
                  }
                  return h;
                })
              );
              // Trigger a lovely sound feedback!
              try {
                import("./utils/audio").then(m => m.playCelebration());
              } catch (e) {}
            }
          }
        } catch (err) {
          console.error("Failed to check claimed status for", item.id, err);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [drawHistory]);

  // Poll KVDb for any additional spin elements and attach them to local history
  useEffect(() => {
    if (drawHistory.length === 0) return;

    // Filter only those that do NOT have additionalPrize listed yet
    const unsolvedBonusHistory = drawHistory.filter(h => !h.additionalPrize);
    if (unsolvedBonusHistory.length === 0) return;

    const bonusInterval = setInterval(() => {
      unsolvedBonusHistory.forEach(async (item) => {
        try {
          const res = await fetch(`/api/kv/bonus_${item.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.additionalPrize) {
              setDrawHistory(prev =>
                prev.map(h => {
                  if (h.id === item.id) {
                    return { ...h, additionalPrize: data.additionalPrize };
                  }
                  return h;
                })
              );
              try {
                import("./utils/audio").then(m => m.playCelebration());
              } catch (e) {}
            }
          }
        } catch (err) {
          // ignore error
        }
      });
    }, 3000);

    return () => clearInterval(bonusInterval);
  }, [drawHistory]);

  const handleToggleClaim = async (id: string, currentClaimed: boolean) => {
    // Optimistic state toggle
    setDrawHistory(prev =>
      prev.map(h => {
        if (h.id === id) {
          return { ...h, claimed: !currentClaimed };
        }
        return h;
      })
    );

    // Sync to KVDb
    try {
      await fetch(`/api/kv/claim_${id}`, {
        method: "PUT",
        body: !currentClaimed ? "claimed" : "unclaimed",
        headers: {
          "Content-Type": "text/plain"
        }
      });
    } catch (err) {
      console.error("Failed to manual claimed state sync", err);
    }
  };

  const handleAdditionalPrizeWon = (drawId: string, bonusPrize: string) => {
    setDrawHistory(prev =>
      prev.map(h => {
        if (h.id === drawId) {
          return { ...h, additionalPrize: bonusPrize };
        }
        return h;
      })
    );
  };

  if (claimCode) {
    const drawnTimeParam = urlParams.get("drawnTime");
    const isEligibleForWheel = drawnTimeParam 
      ? (Date.now() - Number(drawnTimeParam) < 5 * 60 * 1000)
      : true; // Default to true if not provided for safety/ux

    // Touch rotation drag calculations
    const handleDragStart = (clientX: number, clientY: number) => {
      if (phoneWheelSpinning || phoneBonusWon) return;
      if (!wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      setTouchStartAngle(angle - phoneWheelAngle);
      setIsDraggingWheel(true);
    };

    const handleDragMove = (clientX: number, clientY: number) => {
      if (!isDraggingWheel || !wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      setPhoneWheelAngle(angle - touchStartAngle);
    };

    const handleDragEnd = () => {
      if (!isDraggingWheel) return;
      setIsDraggingWheel(false);
      // Automatically trigger momentum spin on touch-release!
      triggerPhoneSpin();
    };

    const triggerPhoneSpin = async () => {
      if (phoneWheelSpinning || phoneBonusWon) return;
      setPhoneWheelSpinning(true);
      
      const sectorsList = [
        "Free Pint 🍺",
        "Sponsor Cap 🧢",
        "VIP Sofa 🛋️",
        "Drink Cash 💵",
        "Mystery Box 🎁",
        "Spirits Shot 🍹",
        "Raffle Ticket 🎟️",
        "Try Again 🍀"
      ];
      
      // Pick a random prize
      const randomIndex = Math.floor(Math.random() * sectorsList.length);
      const selectedPrize = sectorsList[randomIndex];
      
      // Calculate final spin angle: 4 full rotations + angle to land on that index
      const extraRotations = 1440; // 4 full spins
      const segmentOffset = (360 - 45 * randomIndex);
      const randomOffset = Math.random() * 30 - 15; // slightly off-center for realism
      const targetAngle = extraRotations + segmentOffset + randomOffset;
      
      setPhoneWheelAngle(targetAngle);

      // Write to KVDB
      try {
        await fetch(`/api/kv/bonus_${claimCode}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "spinning",
            targetAngle: targetAngle,
            additionalPrize: selectedPrize,
            timestamp: Date.now()
          })
        });
      } catch (e) {
        console.error("Failed to commit spin state:", e);
      }

      // Spin animation duration matches 5 seconds
      setTimeout(() => {
        setPhoneWheelSpinning(false);
        setPhoneBonusWon(selectedPrize);
        setShowPhoneWheelOption(false);
      }, 5000);
    };

    return (
      <div 
        className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center p-4 font-sans selection:bg-pink-600 relative overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(8, 4, 18, 0.94), rgba(3, 1, 5, 0.98)), url('/ribbon7.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] rounded-full bg-pink-600/10 blur-[90px] animate-pulse pointer-events-none"></div>
        <div className="max-w-md w-full bg-[#121318]/95 border-4 border-[#E0338F] rounded-[48px] p-6 text-center shadow-[16px_16px_0px_0px_rgba(224,51,143,0.3)] space-y-5 z-10 relative">
          <div className="flex justify-center items-center space-x-2">
            <span className="bg-[#E0338F] text-white text-[10px] font-black px-4 py-1.5 rounded-full border-2 border-black uppercase tracking-widest leading-none shadow-[2px_2px_0_0_rgba(0,0,0,1)] text-glow-pink">
              🎉 Pilly Lotteries
            </span>
          </div>
          
          <div className="space-y-1">
            <h1 className="font-display font-black text-2xl italic uppercase tracking-tighter text-white leading-none">
              Campaign Door Pass
            </h1>
            <p className="text-zinc-400 text-[10px] font-bold font-mono uppercase tracking-wide">
              Verified sponsor reward redemption
            </p>
          </div>

          {/* Winner and prize details summary container */}
          <div className="bg-black/65 border border-zinc-800 rounded-3xl p-5 text-left space-y-4">
            <div className="border-b border-zinc-800/60 pb-3">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Prize Winner</span>
              <strong className="text-xl font-display font-black text-white hover:text-pink-300 transition-colors uppercase block mt-0.5 leading-none">{claimName}</strong>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Drawn Reward</span>
                <strong className="text-sm font-black text-yellow-400 block uppercase mt-0.5 leading-snug">{claimPrize}</strong>
              </div>
              <div>
                <span className="text-[8px] font-black text-pink-400 uppercase tracking-widest block font-mono">Contributed By</span>
                <strong className="text-sm font-black text-pink-400 block uppercase mt-0.5 leading-snug">{claimSponsor}</strong>
              </div>
            </div>
            
            <div className="border-t border-zinc-850 pt-3 flex items-center gap-1.5 font-mono text-[9px] text-[#E0338F]">
              <span className="font-bold">Pass Reference:</span>
              <span className="text-zinc-400 break-all">{claimCode}</span>
            </div>
          </div>

          {/* Wheel of Fortune section for eligible users */}
          {isEligibleForWheel && (
            <div className="bg-black/80 border-2 border-yellow-400 rounded-3xl p-5 text-center space-y-4 animate-scale-in">
              <span className="bg-yellow-400 text-black text-[9px] font-black px-4 py-1.5 rounded-full border border-black tracking-widest uppercase block mx-auto w-fit animate-bounce">
                🎡 BONUS ELIGIBILITY ACTIVE! 🎡
              </span>
              
              {phoneBonusWon ? (
                <div className="bg-emerald-950/25 border-2 border-emerald-500 rounded-2xl p-4 text-center space-y-2">
                  <span className="text-2xl">🎉</span>
                  <h4 className="text-sm font-black text-emerald-400 uppercase tracking-tight">BONUS LOCKED IN!</h4>
                  <p className="text-xs text-zinc-350 font-bold uppercase">
                    You Won: {phoneBonusWon}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                    This extra prize has been registered to your receipt & streamed to the venue screen in real-time!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                    Scan within 5 minutes of drawing gives you a <span className="text-yellow-450 font-black uppercase">Wheel of Fortune</span> spin! Drag/swipe the wheel to spin, or press the button below. It streams to the big screen!
                  </p>
                  
                  {/* The interactive touch dragging Wheel visual */}
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="relative w-44 h-44 flex items-center justify-center select-none touch-none">
                      {/* Pointer Indicator */}
                      <div className="absolute -top-1 z-30 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[14px] border-t-yellow-400 drop-shadow-md"></div>
                      
                      {/* Rotary Disc Container */}
                      <div
                        ref={wheelRef}
                        onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                        onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchEnd={handleDragEnd}
                        className="w-40 h-40 rounded-full border-4 border-yellow-400 bg-zinc-900 relative overflow-hidden shadow-xl cursor-grab active:cursor-grabbing transform-gpu"
                        style={{
                          transform: `rotate(${phoneWheelAngle}deg)`,
                          transition: phoneWheelSpinning ? "transform 5s cubic-bezier(0.15, 0.85, 0.35, 1)" : "none"
                        }}
                      >
                        {/* 8 Sector slice segments */}
                        {[
                          "Free Pint 🍺",
                          "Sponsor Cap 🧢",
                          "VIP Sofa 🛋️",
                          "Drink Cash 💵",
                          "Mystery Box 🎁",
                          "Spirits Shot 🍹",
                          "Raffle Ticket 🎟️",
                          "Try Again 🍀"
                        ].map((sectorLabel, sIdx) => {
                          const rotateAngle = sIdx * 45;
                          const isEven = sIdx % 2 === 0;
                          return (
                            <div
                              key={sectorLabel}
                              className="absolute top-0 left-0 w-full h-full origin-center flex flex-col items-center justify-start pt-1.5 pointer-events-none"
                              style={{
                                transform: `rotate(${rotateAngle}deg)`,
                              }}
                            >
                              <div
                                className={`absolute inset-y-0 left-1/2 w-1/2 origin-left -translate-x-full h-full -rotate-[45deg] z-0 opacity-80 ${
                                  isEven ? "bg-pink-600/35" : "bg-neutral-800/80"
                                }`}
                              ></div>
                              <span className="text-[5.5px] font-black uppercase text-yellow-300 font-mono tracking-tighter text-center max-w-[32px] leading-tight z-10 rotate-[22.5deg] translate-x-1.5 translate-y-0.5">
                                {sectorLabel}
                              </span>
                            </div>
                          );
                        })}

                        {/* Center hub */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-yellow-405 border border-black flex items-center justify-center z-20 text-[6px] font-black text-black select-none pointer-events-none">
                          SPIN
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={triggerPhoneSpin}
                      disabled={phoneWheelSpinning || !!phoneBonusWon}
                      className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase text-xs rounded-xl shadow-md tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transform hover:scale-[1.03] active:scale-95 transition-all w-full max-w-[180px]"
                    >
                      {phoneWheelSpinning ? "SPINNING NOW!" : "👈 DRAG OR CLICK TO SPIN!"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {phoneChecking ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="animate-spin text-pink-400" size={24} />
              <span className="text-xs font-mono font-bold text-zinc-500 animate-pulse">Retrieving pass status...</span>
            </div>
          ) : phoneClaimed ? (
            <div className="p-5 bg-emerald-950/25 border-2 border-emerald-500/80 rounded-[28px] text-center space-y-3 animate-scale-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                <Check size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-emerald-400 uppercase tracking-tight">Verified & Redeemed!</h3>
                <p className="text-zinc-350 text-[10px] font-semibold leading-relaxed font-sans">
                  This prize has been successfully registered as claimed and handed over to the winner. Thank you for supporting Charity Lotteries.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="p-4 bg-yellow-400/10 border border-yellow-405/20 rounded-2xl text-left flex gap-3 text-yellow-400 font-sans">
                <AlertCircle size={20} className="shrink-0 mt-0.5 text-yellow-405" />
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider block">Action Required on Door</span>
                  <p className="text-[11px] font-semibold leading-snug text-zinc-350">
                    Show this pass to the entrance coordinator. They will click the authorization button below to claim and hand over your reward.
                  </p>
                </div>
              </div>

              {phoneError && (
                <p className="text-xs font-bold text-rose-400 animate-pulse bg-rose-955/20 border border-rose-550/20 p-2.5 rounded-lg font-sans">
                  ⚠️ {phoneError}
                </p>
              )}

              <button
                onClick={handlePhoneConfirm}
                disabled={phoneSubmitting}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-[#E0338F] hover:shadow-[0_0_24px_rgba(224,51,143,0.4)] text-white font-display font-black tracking-wide uppercase rounded-2xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-lg border-2 border-black"
                id="phone-claim-confirm-btn"
              >
                {phoneSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin text-white" size={18} />
                    <span>Authorizing claim...</span>
                  </>
                ) : (
                  <>
                    <span>🔒 DOOR PERSON: CONFIRM REDEEMED</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="pt-2 text-[9px] font-mono text-zinc-650 flex justify-center items-center gap-1.5 select-none">
            <span>Powered by AI Studio</span>
            <span>•</span>
            <span>Real-time Sync Active</span>
          </div>
        </div>
      </div>
    );
  }

  // Load sponsor master reference CSV on mount
  useEffect(() => {
    fetch("/sponsorfiles/sponsorfiles.csv")
      .then(res => {
        if (res.ok) return res.text();
        throw new Error("Could not load sponsor files CSV");
      })
      .then(text => {
        const mappings = parseSponsorCsv(text);
        setSponsorCsvMappings(mappings);
        setCsvLoadedTrigger(prev => prev + 1);
      })
      .catch(err => {
        console.warn("Fell back to standard matching. Master CSV could not be loaded:", err);
      });
  }, []);

  // Initialize data on mount
  useEffect(() => {
    try {
      // Parse defaults
      const loadedPrizes = parsePrizesCSV(DEFAULT_PRIZES_CSV);
      const loadedParticipants = parseParticipantsCSV(DEFAULT_PARTICIPANTS_CSV);
      
      // Load from localStorage if user was editing previously
      const cachedPrizes = localStorage.getItem("prize-draw-prizes");
      const cachedParticipants = localStorage.getItem("prize-draw-participants");
      const cachedHistory = localStorage.getItem("prize-draw-history");
      const cachedSponsors = localStorage.getItem("prize-draw-sponsors");

      const dbVersion = localStorage.getItem("prize-draw-version-v4");
      if (dbVersion !== "v4") {
        localStorage.removeItem("prize-draw-prizes");
        localStorage.removeItem("prize-draw-history");
        localStorage.removeItem("prize-draw-sponsors");
        localStorage.setItem("prize-draw-version-v4", "v4");
        setPrizes(loadedPrizes);
        setDrawHistory([]);
        
        const initialSponsors: Sponsor[] = [];
        loadedPrizes.forEach(p => {
          if (!initialSponsors.some(s => s.name.toLowerCase() === p.sponsor.toLowerCase())) {
            initialSponsors.push({
              id: p.sponsor.toLowerCase().replace(/[^a-z0-9]/g, ""),
              name: p.sponsor,
              logo: "",
              adImages: []
            });
          }
        });
        setSponsors(initialSponsors);
      } else {
        if (cachedPrizes) {
          setPrizes(JSON.parse(cachedPrizes));
        } else {
          setPrizes(loadedPrizes);
        }

        if (cachedParticipants) {
          setParticipants(JSON.parse(cachedParticipants));
        } else {
          setParticipants(loadedParticipants);
        }

        if (cachedHistory) {
          setDrawHistory(JSON.parse(cachedHistory));
        }

        if (cachedSponsors) {
          setSponsors(JSON.parse(cachedSponsors));
        } else {
          const initialSponsors: Sponsor[] = [];
          loadedPrizes.forEach(p => {
            if (!initialSponsors.some(s => s.name.toLowerCase() === p.sponsor.toLowerCase())) {
              initialSponsors.push({
                id: p.sponsor.toLowerCase().replace(/[^a-z0-9]/g, ""),
                name: p.sponsor,
                logo: "",
                adImages: []
              });
            }
          });
          setSponsors(initialSponsors);
        }
      }
    } catch (e) {
      console.error("Local recovery error:", e);
    }
  }, []);

  // Save changes to localStorage to prevent lost data on browser reloads
  useEffect(() => {
    if (prizes.length > 0) {
      localStorage.setItem("prize-draw-prizes", JSON.stringify(prizes));
    }
  }, [prizes]);

  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem("prize-draw-participants", JSON.stringify(participants));
    }
  }, [participants]);

  useEffect(() => {
    localStorage.setItem("prize-draw-history", JSON.stringify(drawHistory));
  }, [drawHistory]);

  useEffect(() => {
    if (sponsors.length > 0) {
      localStorage.setItem("prize-draw-sponsors", JSON.stringify(sponsors));
    }
  }, [sponsors]);

  const handleDrawComplete = async (result: DrawResult) => {
    const roundNumber = drawHistory.length + 1;
    
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: result.id,
          round: roundNumber,
          winner: result.participant.fullName,
          participantId: result.participant.id,
          participantEmail: result.participant.email,
          prize: result.prize.label,
          sponsor: result.prize.sponsor || 'Unknown Sponsor',
          timestamp: result.timestamp
        })
      });
    } catch (e) {
      console.error('Failed to log draw history:', e);
    }

    const newHistory = [result, ...drawHistory];
    setDrawHistory(newHistory);

    // Update drawn counts for prizes
    const newPrizes = prizes.map(p => {
      if (p.id === result.prize.id) {
        return { ...p, drawnCount: p.drawnCount + 1 };
      }
      return p;
    });
    
    setPrizes(newPrizes);

    // Blast celebration confetti
    setShowConfetti(true);

    // Check if competition is complete or reached 5th round
    const checkAndSendReport = async () => {
      const allDepleted = newPrizes.every(p => p.drawnCount >= p.quantity);
      const isFifthRound = roundNumber > 0 && roundNumber % 5 === 0;

      if (allDepleted || isFifthRound) {
        let title = allDepleted ? 'Spotlight NZ - All Prizes Depleted Final Report' : `Spotlight NZ - Round ${roundNumber} Report`;
        
        const formatHistory = newHistory.map((h, i) => ({
          round: newHistory.length - i,
          winner: h.participant.fullName,
          participantEmail: h.participant.email,
          prize: h.prize.label,
          sponsor: h.prize.sponsor || 'Unknown Sponsor',
          timestamp: h.timestamp
        }));
        
        // Sort ascending by round number
        formatHistory.sort((a, b) => a.round - b.round);

        try {
          await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: formatHistory, title })
          });
        } catch (e) {
          console.error('Failed to send report email:', e);
        }
      }
    };

    checkAndSendReport();
  };

  // Safe reset all history
  const handleClearHistory = () => {
    setDrawHistory([]);
    // Reset all drawn counts in prizes lists
    setPrizes(prev => prev.map(p => ({ ...p, drawnCount: 0 })));
    setShowConfetti(false);
  };

  const handleImportLogs = (logs: any[]) => {
    const newDraws: DrawResult[] = logs.map(log => {
      let part = participants.find(p => p.id === log.participantId || p.email === log.participantEmail);
      if (!part) {
        part = {
          id: log.participantId || `imported-${Date.now()}-${Math.random()}`,
          orderId: '',
          date: '',
          status: 'Paid',
          firstName: log.winner.split(' ')[0] || '',
          lastName: log.winner.split(' ').slice(1).join(' '),
          fullName: log.winner,
          email: log.participantEmail || '',
          ticketsCount: 1,
        };
      }
      let prz = prizes.find(p => p.label === log.prize && p.sponsor === log.sponsor);
      if (!prz) {
        prz = {
          id: `imported-prize-${Date.now()}-${Math.random()}`,
          label: log.prize,
          sponsor: log.sponsor,
          quantity: 1,
          drawnCount: 0,
          value: 0
        };
      }
      return {
        id: log.id,
        timestamp: log.timestamp,
        participant: part,
        prize: prz,
        ticketNumber: 1
      };
    });

    setDrawHistory(prev => {
      const combined = [...newDraws, ...prev];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
      return unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    setPrizes(prev => {
      const next = [...prev];
      logs.forEach(log => {
        const przIndex = next.findIndex(p => p.label === log.prize && p.sponsor === log.sponsor && p.drawnCount < p.quantity);
        if (przIndex !== -1) {
          next[przIndex] = { ...next[przIndex], drawnCount: next[przIndex].drawnCount + 1 };
        }
      });
      return next;
    });
  };

  // Safe undo single log draw
  const handleDeleteLog = (id: string) => {
    const targetLog = drawHistory.find(h => h.id === id);
    if (!targetLog) return;

    // Refund prize quantity
    setPrizes(prev =>
      prev.map(p => {
        if (p.id === targetLog.prize.id) {
          return { ...p, drawnCount: Math.max(0, p.drawnCount - 1) };
        }
        return p;
      })
    );

    // Remove from logs list
    setDrawHistory(prev => prev.filter(h => h.id !== id));
  };

  // Clear confetti overlay on tab click
  const handleTabChange = (tab: "arena" | "spreadsheet" | "analytics" | "winners" | "reviews") => {
    setActiveTab(tab);
    setShowConfetti(false);
    playChime();
  };

  // Quick stat variables
  const totalPrizePoolValue = prizes.reduce((acc, p) => acc + p.value, 0);

  if (showStartupModal) return <StartupModal onStart={handleInitialize} />;

  return (
    <div 
      className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between font-sans selection:bg-pink-600 selection:text-white leading-normal select-none relative overflow-x-hidden"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(8, 4, 18, 0.88), rgba(3, 1, 5, 0.96)), url('/ribbon7.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Laser light show backdrop mimicking ribbon7.jpg styling */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 select-none z-0">
        {/* Spotlights and ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-pink-600/20 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[130px]"></div>
        
        {/* Crossing Laser Lines & Luminous Ribbon Loop */}
        <svg className="absolute top-0 left-0 w-full h-full min-w-[1200px]" viewBox="0 0 1200 1000" fill="none">
          {/* Neon green laser lines */}
          <line x1="-100" y1="150" x2="1300" y2="750" stroke="#22C55E" strokeWidth="2.5" className="opacity-65" style={{ filter: "drop-shadow(0px 0px 8px #22C55E)" }} />
          <line x1="-100" y1="750" x2="1300" y2="150" stroke="#22C55E" strokeWidth="1.5" className="opacity-45" style={{ filter: "drop-shadow(0px 0px 5px #22C55E)" }} />
          
          {/* Colorful lighting shafts */}
          <line x1="600" y1="-100" x2="100" y2="1100" stroke="#A855F7" strokeWidth="2" className="opacity-55" style={{ filter: "drop-shadow(0px 0px 6px #A855F7)" }} />
          <line x1="600" y1="-100" x2="1100" y2="1100" stroke="#E0338F" strokeWidth="3" className="opacity-75 animate-pulse" style={{ filter: "drop-shadow(0px 0px 10px #E0338F)" }} />
          
          {/* Swirling glowing Neon Pink Ribbon Loop */}
          <path 
            d="M 300 800 C 450 650, 480 320, 600 320 C 720 320, 750 480, 650 580 C 550 680, 380 620, 340 750 C 310 850, 500 950, 900 900" 
            stroke="#E0338F" 
            strokeWidth="11" 
            strokeLinecap="round" 
            fill="none"
            style={{ filter: "drop-shadow(0px 0px 14px #E0338F)" }} 
          />
          <path 
            d="M 300 800 C 450 650, 480 320, 600 320 C 720 320, 750 480, 650 580 C 550 680, 380 620, 340 750 C 310 850, 500 950, 900 900" 
            stroke="#FFF" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            fill="none"
            className="opacity-95"
          />
        </svg>
      </div>

      {/* Dynamic Confetti Streamer backdrop */}
      <Confetti active={showConfetti} />
      {/* Startup modal now handled in main return */}

      {/* Primary Top Header Navigation Brand block */}
      {!isTotallyFullScreen && (
        <header className="bg-black border-b-4 border-zinc-900 text-white sticky top-0 z-40 shadow-[0_4px_0_0_rgba(0,0,0,0.5)] py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-2 sm:h-20 gap-4">
            
            {/* Left group: Brand name and Nav Tabs */}
            <div className="flex items-center gap-6">
              {/* Brand name - Rhythm for Ribbons Logo */}
              <div className="flex flex-col">
                <img src="/sponsorfiles/r4r-logo.png" alt="Rhythm for Ribbons" className="h-10 md:h-12 w-auto object-contain" />
                <p className="text-[10px] text-pink-300 font-bold font-sans mt-1 tracking-wide flex items-center gap-1">
                  <span>Charity Draw</span>
                  <span className="text-zinc-700">•</span>
                  <span className="text-yellow-405 font-black uppercase tracking-widest text-[9px]">DONATE.SPOTLIGHTNZ.COM</span>
                </p>
              </div>

              {/* Nav Tab Controls */}
              <nav className="flex space-x-1.5 bg-zinc-900 border-4 border-black p-1 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] selection:bg-none">
              <button
                onClick={() => handleTabChange("arena")}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "arena" 
                    ? "bg-pink-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Trophy size={13} className={activeTab === "arena" ? "stroke-[3]" : ""} />
                <span>🎯 DRAWS</span>
              </button>
              
              <button
                onClick={() => handleTabChange("spreadsheet")}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "spreadsheet" 
                    ? "bg-pink-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Database size={13} className={activeTab === "spreadsheet" ? "stroke-[3]" : ""} />
                <span>📊 TABLES</span>
              </button>

              <button
                onClick={() => handleTabChange("analytics")}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "analytics" 
                    ? "bg-pink-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <BarChart3 size={13} className={activeTab === "analytics" ? "stroke-[3]" : ""} />
                <span>📈 LOGS</span>
              </button>

              <button
                onClick={() => handleTabChange("winners")}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "winners" 
                    ? "bg-pink-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Award size={13} className={activeTab === "winners" ? "stroke-[3]" : ""} />
                <span>🏆 WINNERS!</span>
              </button>

              <button
                onClick={() => handleTabChange("reviews")}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "reviews" 
                    ? "bg-pink-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <MessageSquare size={13} className={activeTab === "reviews" ? "stroke-[3]" : ""} />
                <span>📋 REVIEW BOARD</span>
              </button>
            </nav>
            </div>

            {/* Right side stats metrics showcase with TV toggle */}
            <div className="flex items-center space-x-4 bg-zinc-900 border-4 border-black px-4 py-1.5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <button
                onClick={() => {
                  setIsSimpleMode(!isSimpleMode);
                  playChime();
                }}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border-2 border-black transition-all active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer ${
                  isSimpleMode 
                    ? "bg-pink-500 text-white hover:bg-pink-400" 
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                title="Toggle venue TV layout with hidden configurations and massive size"
              >
                <span className="relative flex h-2.5 w-2.5 mr-0.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSimpleMode ? "bg-pink-300" : "bg-emerald-300"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSimpleMode ? "bg-pink-500" : "bg-emerald-500"}`}></span>
                </span>
                <span>📺 SIMPLE TV MODE: {isSimpleMode ? "ON" : "OFF"}</span>
              </button>

              <button
                onClick={toggleFullScreen}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border-2 border-black transition-all active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer ${
                  isTotallyFullScreen 
                    ? "bg-amber-500 text-black border-yellow-405 font-extrabold" 
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                title="Hide all margins and scroll bars for 100% edge-to-edge layout"
              >
                <span className="relative flex h-2.5 w-2.5 mr-0.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isTotallyFullScreen ? "bg-amber-300" : "bg-purple-300"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isTotallyFullScreen ? "bg-amber-500" : "bg-purple-500"}`}></span>
                </span>
                <span>💥 IMMERSIVE FULLSCREEN: {isTotallyFullScreen ? "ON" : "OFF"}</span>
              </button>

              <button
                onClick={toggleDebugMode}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border-2 border-black transition-all active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer ${
                  isDebugMode 
                    ? "bg-white text-black hover:bg-neutral-100 font-extrabold border-neutral-900" 
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                title="Toggle visual flow progression debug numbers on new screens/phases"
              >
                <span className="relative flex h-2.5 w-2.5 mr-0.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDebugMode ? "bg-amber-300" : "bg-neutral-600"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDebugMode ? "bg-amber-500" : "bg-zinc-500"}`}></span>
                </span>
                <span>⚙️ DEBUG: {isDebugMode ? "ON" : "OFF"}</span>
              </button>

              <button
                onClick={toggleTestMode}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border-2 border-black transition-all active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer ${
                  isTestMode 
                    ? "bg-red-500 text-white hover:bg-red-400 font-extrabold border-red-900" 
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                title="Toggle fast transitions test mode"
              >
                <span className="relative flex h-2.5 w-2.5 mr-0.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isTestMode ? "bg-red-300" : "bg-neutral-600"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isTestMode ? "bg-red-500" : "bg-zinc-500"}`}></span>
                </span>
                <span>🧪 TEST MODE: {isTestMode ? "ON" : "OFF"}</span>
              </button>

              <div className="hidden lg:block h-6 w-0.5 bg-zinc-850"></div>

              <div className="hidden lg:flex items-center space-x-2 font-sans text-right">
                <div>
                  <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Pool Est.</span>
                  <strong className="font-display font-black text-xs text-pink-400 mt-0.5 block">
                    ${totalPrizePoolValue.toLocaleString("en-NZ")} NZD
                  </strong>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>
      )}



      {isTotallyFullScreen && (
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-3">
          <button
            onClick={toggleDebugMode}
            className={`cursor-pointer border-4 uppercase tracking-widest px-4 py-2 rounded-full text-[10px] font-black transition-all active:scale-95 flex items-center gap-2 ${
              isDebugMode 
                ? "bg-white text-black border-pink-500 shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                : "bg-black/85 hover:bg-zinc-950 border-zinc-800 text-zinc-400"
            }`}
          >
            ⚙️ DEBUG: {isDebugMode ? "ON" : "OFF"}
          </button>
          
          <button
            onClick={toggleFullScreen}
            className="bg-black/85 hover:bg-zinc-950 border-4 border-pink-500 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.5)] cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span>EXIT IMMERSIVE TV [ESC]</span>
          </button>
        </div>
      )}

      {/* Main app viewport */}
      <main className={isTotallyFullScreen ? "w-full h-screen p-2 md:p-3 flex-1 flex flex-col justify-stretch overflow-hidden relative z-10" : "max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1"}>
        {activeTab === "arena" && (
          <div className="space-y-6">
            <RaffleSpinner
              prizes={prizes}
              setPrizes={setPrizes}
              participants={participants}
              setParticipants={setParticipants}
              onDrawComplete={handleDrawComplete}
              onDrawStart={() => setShowConfetti(false)}
              drawHistory={drawHistory}
              isSimpleMode={isSimpleMode}
              isTotallyFullScreen={isTotallyFullScreen}
              sponsors={sponsors}
              onToggleClaim={handleToggleClaim}
              onAdditionalPrizeWon={handleAdditionalPrizeWon}
              isDebugMode={isDebugMode}
              isTestMode={isTestMode}
              onImportLogs={handleImportLogs}
            />

            {/* Premium feature comment board below arena for immediate operator reviews when not on large TV Simple Mode */}
            {!isSimpleMode && (
              <div className="mt-12 pt-8 border-t-4 border-dashed border-zinc-850">
                <FeatureCommentBoard />
              </div>
            )}
          </div>
        )}

        {activeTab === "spreadsheet" && (
          <CsvManager
            prizes={prizes}
            setPrizes={setPrizes}
            participants={participants}
            setParticipants={setParticipants}
            sponsors={sponsors}
            setSponsors={setSponsors}
          />
        )}

        {activeTab === "analytics" && (
          <StatsOverview
            prizes={prizes}
            participants={participants}
            drawHistory={drawHistory}
            onDeleteLog={handleDeleteLog}
            onClearHistory={handleClearHistory}
            onImportLogs={handleImportLogs}
          />
        )}

        {activeTab === "winners" && (
          <PrizeWinnersWall
            drawHistory={drawHistory}
            onToggleClaim={handleToggleClaim}
            isSimpleMode={isSimpleMode}
            onGoToDraw={() => {
              setActiveTab("arena");
              playChime();
            }}
          />
        )}

        {activeTab === "reviews" && (
          <FeatureCommentBoard />
        )}
      </main>

      {/* Humble Footer */}
      <footer className="bg-black border-t-4 border-black py-8 text-zinc-400 text-xs font-sans mt-12 shadow-[0_-4px_0_0_rgba(0,0,0,1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left space-y-1.5">
            <p className="font-black text-white flex items-center justify-center md:justify-start gap-2 uppercase tracking-widest text-sm">
              <span className="text-yellow-400">PRIZE DRAW APP</span>
              <span className="text-zinc-650">•</span>
              <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-sm border border-zinc-700 font-mono text-[9px] font-normal">
                Vibrant Edition
              </span>
            </p>
            <p className="text-[10px] text-zinc-500 font-medium">
              An elegant lottery drawer for community mixers and sponsor contribution programs.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 font-mono text-[10px]">
            <span>System Time Check: <strong className="text-yellow-400 font-black">May 2026</strong></span>
            <span className="hidden md:block text-zinc-800">|</span>
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-display font-bold">
              <span>Made with AI Studio</span>
              <Heart size={10} className="text-rose-500 fill-rose-500" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
