import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Megaphone, Volume2, ShieldCheck, Heart } from "lucide-react";
import { SpizzicoLogo, SuperfinaLogo, WakaGoldLogo, PallyLogo } from "./SponsorsShowcase";
import { matchSponsorFiles } from "../utils/sponsorFiles";
import sponsorFilesManifest from "../data/sponsorFilesManifest.json";

interface SponsorSlideshowProps {
  sponsorName: string;
  className?: string;
}

// Map user sponsor names to stylized keys and branding colors
export function getSponsorKey(name: string): string {
  const norm = name.toLowerCase().trim();
  if (norm.includes("spizzicco") || norm.includes("spizzico")) return "spizzicco";
  if (norm.includes("3333")) return "3333events";
  if (norm.includes("vonuts")) return "vonuts";
  if (norm.includes("afters")) return "afters";
  if (norm.includes("equilibrium")) return "equilibrium";
  if (norm.includes("pally")) return "pally";
  if (norm.includes("spotlight")) return "spotlight";
  if (norm.includes("waka")) return "wakagold";
  if (norm.includes("superfina")) return "superfina";
  return norm.replace(/[^a-z0-9]/g, "");
}

interface SponsorConfig {
  bgColor: string;
  borderColor: string;
  glowColor: string;
  textColor: string;
  vectorLogo: React.ReactNode;
  tagline: string;
  fallbackAdTopic: string;
}

export default function SponsorSlideshow({ sponsorName, className = "" }: SponsorSlideshowProps) {
  const key = getSponsorKey(sponsorName);
  const { logo, adImages } = matchSponsorFiles(sponsorName, sponsorFilesManifest);
  
  // Define naming convention slideshow files based on prompt, checking first inside GAMEFILES
  const slides = adImages && adImages.length > 0
    ? adImages
    : [
        `/GAMEFILES/${key}-photo1.jpg`,
        `/GAMEFILES/${key}-photo2.jpg`,
        `/GAMEFILES/${key}-photo3.jpg`
      ];

  const logoSrc = logo || `/GAMEFILES/${key}.jpg`;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [logoHasError, setLogoHasError] = useState(false);
  const [slideErrors, setSlideErrors] = useState<Record<number, boolean>>({});

  // Slideshow interval timer (loops every 3 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Reset errors when sponsor changes
  useEffect(() => {
    setLogoHasError(false);
    setSlideErrors({});
    setCurrentIdx(0);
  }, [sponsorName]);

  // Stylized branding specifications based on sponsor
  const branding: Record<string, SponsorConfig> = {
    spizzicco: {
      bgColor: "bg-red-950/40",
      borderColor: "border-[#E0338F]",
      glowColor: "rgba(224, 51, 143, 0.4)",
      textColor: "text-rose-400",
      vectorLogo: <SpizzicoLogo className="h-10" />,
      tagline: "Taste of Rome - Authentic Roman Wood-Fired Pizza",
      fallbackAdTopic: "Crisp hand-stretched pinsas & secret recipe sauces straight from Romagna!"
    },
    pally: {
      bgColor: "bg-emerald-950/40",
      borderColor: "border-emerald-500",
      glowColor: "rgba(16, 185, 129, 0.4)",
      textColor: "text-emerald-400",
      vectorLogo: <PallyLogo className="h-11" />,
      tagline: "Built for developers, loved by communities",
      fallbackAdTopic: "Supercharge your dev workspace setups with our custom Git Packs!"
    },
    wakagold: {
      bgColor: "bg-amber-950/40",
      borderColor: "border-yellow-500",
      glowColor: "rgba(234, 179, 8, 0.4)",
      textColor: "text-yellow-400",
      vectorLogo: <WakaGoldLogo className="h-14" />,
      tagline: "Our Hives To Your Table - 100% Raw Kiwi Honey",
      fallbackAdTopic: "Delicate honeycombs & sweet golden elixirs direct from NZ's pristine forests."
    },
    superfina: {
      bgColor: "bg-zinc-950/40",
      borderColor: "border-sky-400",
      glowColor: "rgba(56, 189, 248, 0.4)",
      textColor: "text-sky-400",
      vectorLogo: <SuperfinaLogo className="h-10" />,
      tagline: "Superfina - Elegant Premium Interior Designs",
      fallbackAdTopic: "Aesthetic spaces crafted through meticulous textures, gold stars & outline symmetry."
    },
    equilibrium: {
      bgColor: "bg-indigo-950/40",
      borderColor: "border-indigo-500",
      glowColor: "rgba(99, 102, 241, 0.4)",
      textColor: "text-indigo-400",
      vectorLogo: <span className="font-serif italic font-bold text-lg text-white">Equilibrium Massage</span>,
      tagline: "Relieve Pain & Rebalance Your Energies",
      fallbackAdTopic: "Professional deep-tissue releases combined with luxury therapeutic hot stones."
    },
    vonuts: {
      bgColor: "bg-fuchsia-950/40",
      borderColor: "border-fuchsia-400",
      glowColor: "rgba(232, 121, 249, 0.4)",
      textColor: "text-fuchsia-400",
      vectorLogo: <span className="font-sans font-black text-lg tracking-widest text-[#E0338F]">VONUTS</span>,
      tagline: "Vegan Artisanal High-Rise Doughnuts",
      fallbackAdTopic: "Glazed wildberry, double-chocolate crumbs & guilt-free heavenly ring bakeries!"
    }
  };

  // Default fallback if sponsor is not major mapped
  const currentBrand: SponsorConfig = branding[key] || {
    bgColor: "bg-zinc-950/40",
    borderColor: "border-zinc-700",
    glowColor: "rgba(255, 255, 255, 0.1)",
    textColor: "text-pink-400",
    vectorLogo: <span className="font-display font-black tracking-tight text-white">{sponsorName}</span>,
    tagline: `Proud Supporter of NZ Cancer Charity Fund`,
    fallbackAdTopic: "Generous campaign gift bundles and sponsor vouchers helping power cancer research."
  };

  const handleLogoError = () => {
    setLogoHasError(true);
  };

  const handleSlideError = (index: number) => {
    setSlideErrors((prev) => ({ ...prev, [index]: true }));
  };

  // Determine if all slide images are failing
  const allSlidesFailed = slides.every((_, idx) => slideErrors[idx]);
  const currentSlideFailed = slideErrors[currentIdx];

  return (
    <div 
      className={`relative overflow-hidden rounded-[36px] border-4 ${currentBrand.borderColor} ${currentBrand.bgColor} p-6 flex flex-col justify-between transition-all duration-500 shadow-[0_16px_32px_-10px_rgba(0,0,0,0.8)] ${className}`}
      style={{
        boxShadow: `12px 12px 0px 0px ${currentBrand.glowColor}, inset 0 0 40px rgba(0,0,0,0.6)`
      }}
    >
      {/* Visual scanning line effect to look like a premium digital billboard screen */}
      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-20 z-10"></div>
      
      {/* Top micro status bar */}
      <div className="flex items-center justify-between border-b-2 border-white/5 pb-3 mb-4 z-15 relative">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping"></span>
          <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-1">
            <Megaphone size={10} className="text-pink-500" /> LIVE AD PROJECTION
          </span>
        </div>
        <div className="bg-black/50 text-[8px] font-black text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 font-mono">
          SLIDE {currentIdx + 1} / 3
        </div>
      </div>

      {/* Main Slideshow Frame Display */}
      <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-black/70 border border-white/10 flex items-center justify-center mb-4 group z-0">
        <AnimatePresence mode="wait">
          {!currentSlideFailed ? (
            <motion.img
              key={currentIdx}
              src={slides[currentIdx]}
              alt={`${sponsorName} montage photo ${currentIdx + 1}`}
              initial={{ opacity: 0, scale: 0.93, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(4px)" }}
              transition={{ duration: 0.7 }}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.includes("/GAMEFILES/")) {
                  // Fall back step: try direct root path
                  target.src = `/${key}-photo${currentIdx + 1}.jpg`;
                } else {
                  handleSlideError(currentIdx);
                }
              }}
              referrerPolicy="no-referrer"
            />
          ) : (
            // Gorgeous procedural high-contrast motion graphic fallback if real photos are pending upload
            <motion.div
              key="fallback-visual"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 p-4 flex flex-col justify-center items-center text-center overflow-hidden bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950"
            >
              {/* Spinning background neon light beams */}
              <div className="absolute inset-0 opacity-15 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-pink-500/30 blur-2xl transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
              </div>

              <div className="z-10 max-w-xs space-y-2">
                <div className="inline-flex py-1 px-2.5 bg-white/5 border border-white/10 rounded-full items-center gap-1">
                  <Sparkles size={11} className="text-yellow-400 animate-spin" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-pink-300 font-mono">ESTEEMED CAMPAIGN PARTNER</span>
                </div>
                <p className="text-sm font-black text-white italic leading-tight uppercase font-display">
                  {currentBrand.tagline}
                </p>
                <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                  {currentBrand.fallbackAdTopic}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Small bottom glass-pill overlay describing active slide context */}
        <div className="absolute bottom-2.5 left-2.5 bg-black/70 backdrop-blur-sm border border-white/15 px-3 py-1 rounded-full text-[9px] font-semibold text-zinc-300 pointer-events-none z-10 font-mono flex items-center gap-1">
          <span>📸 {key}-photo{currentIdx + 1}.jpg</span>
        </div>
      </div>

      {/* Official Brand Logo Showcase Center Row */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2.5 relative z-10">
        <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest leading-none block">
          OFFICIAL LOGO
        </span>
        
        <div className="h-14 flex items-center justify-center min-w-32 animate-fade-in relative">
          {!logoHasError ? (
            <img 
              src={logoSrc} 
              alt={`${sponsorName} logo`}
              className="max-h-12 w-auto object-contain select-none filter drop-shadow-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.includes("/GAMEFILES/")) {
                  // Fall back step: try direct root path
                  target.src = `/${key}.jpg`;
                } else {
                  handleLogoError();
                }
              }}
              referrerPolicy="no-referrer"
            />
          ) : (
            // Falls back perfectly to the custom beautiful vector code logo designed in SponsorsShowcase!
            <div className="flex items-center justify-center h-full">
              {currentBrand.vectorLogo}
            </div>
          )}
        </div>

        <div className="pt-1.5 border-t border-white/5 w-full flex justify-center items-center gap-1.5 text-zinc-400 font-bold text-[9px] tracking-wide font-sans text-center">
          <ShieldCheck size={12} className="text-pink-500 shrink-0" />
          <span>Verified Sponsor Contribution</span>
        </div>
      </div>
    </div>
  );
}
