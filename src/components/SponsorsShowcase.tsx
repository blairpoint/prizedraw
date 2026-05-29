import React from "react";
import { Sponsor } from "../types";

// 1. SPIZZICO (Taste of Rome) Logo (Sharp, authentic Bistro style)
export function SpizzicoLogo({ className = "h-12" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-white ${className} select-none`}>
      <span className="font-display font-black text-2xl md:text-3xl tracking-tight leading-none uppercase text-white font-sans">
        spizzico
      </span>
      <span className="text-[7px] md:text-[8px] font-sans font-extrabold tracking-[0.25em] text-pink-500 uppercase leading-none mt-1">
        taste of rome
      </span>
    </div>
  );
}

// 2. SUPERFINA Logo (Elegant, classic serif layout with outline text and stars)
export function SuperfinaLogo({ className = "h-12" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-white ${className} select-none font-serif`}>
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-sm md:text-base animate-pulse">★</span>
        <span 
          className="text-xl md:text-2xl font-black tracking-[0.08em] uppercase text-transparent skew-x-1"
          style={{ WebkitTextStroke: "1px white" }}
        >
          SUPERFINA
        </span>
        <span className="text-yellow-400 text-sm md:text-base animate-pulse">★</span>
      </div>
      <div className="w-full h-[3px] border-b-2 border-t border-white/40 mt-1 max-w-[120px]"></div>
    </div>
  );
}

// 3. WAKA GOLD Logo (Gorgeous deluxe golden emblem with fern leaves)
export function WakaGoldLogo({ className = "h-16" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center justify-center ${className} select-none`}>
      <svg className="h-full w-auto" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF1B8" />
            <stop offset="30%" stopColor="#E5C158" />
            <stop offset="70%" stopColor="#C39A36" />
            <stop offset="100%" stopColor="#876510" />
          </linearGradient>
        </defs>
        {/* Outer Shiny Circle ring boundary */}
        <circle cx="80" cy="80" r="74" stroke="url(#goldGrad)" strokeWidth="3" />
        <circle cx="80" cy="80" r="69" stroke="url(#goldGrad)" strokeWidth="0.75" strokeDasharray="3 2" />
        
        {/* Core detailed feather-light fern leaf background path */}
        <path d="M52,112 C62,102 78,78 80,48 C80,48 78,41 76,38 C80,35 88,48 88,48 C84,78 66,102 56,112 Z" fill="url(#goldGrad)" className="opacity-80" />
        
        {/* Fern foliage branches */}
        <path d="M78,48 C83,45 92,47 96,50 L93,53 C88,51 81,50 78,48 Z" fill="url(#goldGrad)" />
        <path d="M76,57 C83,54 94,56 100,60 L96,63 C90,60 82,58 76,57 Z" fill="url(#goldGrad)" />
        <path d="M73,67 C81,63 95,66 101,71 L96,74 C90,70 80,68 73,67 Z" fill="url(#goldGrad)" />
        <path d="M68,77 C76,73 92,77 98,83 L93,86 C87,81 76,78 68,77 Z" fill="url(#goldGrad)" />
        <path d="M62,87 C70,83 86,88 91,95 L86,97 C81,92 70,88 62,87 Z" fill="url(#goldGrad)" />
        <path d="M55,97 C63,93 78,99 82,106 L77,108 C73,103 63,98 55,97 Z" fill="url(#goldGrad)" />

        {/* Brand Core Labels */}
        <text x="80" y="85" fill="url(#goldGrad)" fontFamily="'Georgia', serif" fontSize="15" fontWeight="900" textAnchor="middle" letterSpacing="1">WAKA</text>
        <text x="80" y="101" fill="url(#goldGrad)" fontFamily="'Georgia', serif" fontSize="15" fontWeight="900" textAnchor="middle" letterSpacing="1.5">GOLD</text>
        
        {/* Arced Top text */}
        <path id="curveTopId" d="M 28 80 A 52 52 0 0 1 132 80" fill="none" />
        <text fontSize="5.5" fontWeight="900" fill="url(#goldGrad)" letterSpacing="0.8">
          <textPath href="#curveTopId" startOffset="50%" textAnchor="middle">
            OUR HIVES TO YOUR TABLE
          </textPath>
        </text>

        {/* Arced Bottom text */}
        <path id="curveBotId" d="M 28 80 A 52 52 0 0 0 132 80" fill="none" />
        <text fontSize="5" fontWeight="900" fill="url(#goldGrad)" letterSpacing="0.6">
          <textPath href="#curveBotId" startOffset="50%" textAnchor="middle">
            100% PURE NZ IN EVERY DROP
          </textPath>
        </text>
      </svg>
    </div>
  );
}

// 4. PALLY Logo (Cursive green signature style as attached)
export function PallyLogo({ className = "h-14" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center ${className} select-none`}>
      <svg className="h-full w-auto" viewBox="0 0 250 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pallyGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E5E4A" />
            <stop offset="100%" stopColor="#0B3C2F" />
          </linearGradient>
        </defs>
        
        {/* Elegant vector path */}
        <path d="M52,85 C51,70 54,42 63,30 C72,18 85,14 91,25 C95,35 78,55 58,58 C45,60 38,70 42,88 C45,100 52,100 54,82 M48,45 C55,42 90,26 95,12 C95,2 78,2 74,18 C65,35 55,68 45,95 C41,105 32,103 26,92" stroke="url(#pallyGreen)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Low-case cursive 'a' join */}
        <path d="M96,68 C92,75 106,85 113,80 C120,74 121,58 112,56 C102,54 103,74 115,74 C120,74 125,60 128,52 L131,80" stroke="url(#pallyGreen)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Double 'l' elements */}
        <path d="M129,52 C132,40 142,20 146,28 C150,34 140,65 137,80 M144,52 C147,40 157,20 161,28 C165,34 155,65 152,80" stroke="url(#pallyGreen)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Cursive letter 'y' looping downwards */}
        <path d="M162,54 C166,75 174,80 180,68 L170,98 C163,115 152,112 153,98 C155,83 172,74 184,80 C198,88 205,80 216,72" stroke="url(#pallyGreen)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Leaf tail */}
        <path d="M216,72 C226,56 242,54 246,58 C250,62 248,72 235,76 C221,80 218,74 216,72 Z" fill="#2E7D32" stroke="url(#pallyGreen)" strokeWidth="3" />
        <path d="M218,71 C227,65 237,63 241,63" stroke="url(#pallyGreen)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

interface SponsorsShowcaseProps {
  layout?: "grid" | "marquee" | "simple";
  sponsors?: Sponsor[];
}

export default function SponsorsShowcase({ layout = "grid", sponsors = [] }: SponsorsShowcaseProps) {
  // Built-in major sponsors list
  const builtInSponsorNames = ["pally", "spizzicco", "wakagold", "superfina", "equilibrium", "vonuts", "3333events"];

  // Filter custom sponsors to show those not in standard built-in
  const customToDisplay = sponsors.filter(s => {
    const nameLower = s.name.toLowerCase().trim();
    const isBuiltIn = builtInSponsorNames.includes(nameLower) ||
      nameLower.includes("pally") ||
      nameLower.includes("spizzicco") ||
      nameLower.includes("spizzico") ||
      nameLower.includes("waka") ||
      nameLower.includes("superfina") ||
      nameLower.includes("equilibrium") ||
      nameLower.includes("vonuts") ||
      nameLower.includes("afters") ||
      nameLower.includes("spotlight") ||
      nameLower.includes("3333");
    return !isBuiltIn;
  });

  if (layout === "marquee") {
    return (
      <div className="w-full bg-black/40 border-y-2 border-zinc-800 py-3 overflow-hidden">
        <div className="flex items-center space-x-12 animate-marquee-smooth whitespace-nowrap">
          <div className="flex items-center space-x-12 shrink-0">
            <SpizzicoLogo className="h-8" />
            <SuperfinaLogo className="h-8" />
            <WakaGoldLogo className="h-12" />
            <PallyLogo className="h-10" />
            {customToDisplay.map((s, i) => (
              <span key={`custom-mar-1-${i}`} className="inline-flex items-center space-x-2">
                {s.logo ? <img src={s.logo} alt={s.name} className="h-8 object-contain" referrerPolicy="no-referrer" /> : <span className="font-display font-black text-sm text-white uppercase">{s.name}</span>}
              </span>
            ))}
            <span className="text-zinc-650 font-black text-sm uppercase">★</span>
          </div>
          <div className="flex items-center space-x-12 shrink-0">
            <SpizzicoLogo className="h-8" />
            <SuperfinaLogo className="h-8" />
            <WakaGoldLogo className="h-12" />
            <PallyLogo className="h-10" />
            {customToDisplay.map((s, i) => (
              <span key={`custom-mar-2-${i}`} className="inline-flex items-center space-x-2">
                {s.logo ? <img src={s.logo} alt={s.name} className="h-8 object-contain" referrerPolicy="no-referrer" /> : <span className="font-display font-black text-sm text-white uppercase">{s.name}</span>}
              </span>
            ))}
            <span className="text-zinc-650 font-black text-sm uppercase">★</span>
          </div>
        </div>
      </div>
    );
  }

  if (layout === "simple") {
    return null;
  }

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md rounded-[40px] border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between border-b-4 border-black pb-4 gap-4">
        <div>
          <h3 className="font-display font-black text-xl text-yellow-405 uppercase tracking-tight flex items-center gap-2">
            <span>🎗️ PROUD CAMPAIGN PARTNERS</span>
          </h3>
          <p className="text-xs text-zinc-400 font-medium font-sans">
            Sponsor groups contributing high-value lottery giveaways for cancer charity research.
          </p>
        </div>
        <div className="bg-pink-500/10 border-2 border-pink-500 text-pink-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl font-display">
          100% Proceeds Donated
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Pally Sponsor Card */}
        <div className="bg-white/5 border-2 border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-3 relative hover:border-emerald-500/50 transition-colors group">
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[8px] font-bold">
            HOST PARTNER
          </div>
          <div className="h-20 flex items-center justify-center">
            <PallyLogo className="h-12 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h4 className="font-serif italic text-sm font-black text-emerald-300">Pally platform</h4>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Donated 3x Pally Git Packs</p>
          </div>
        </div>

        {/* Spizzico Sponsor Card */}
        <div className="bg-white/5 border-2 border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-3 relative hover:border-pink-500/50 transition-colors group">
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[8px] font-bold">
            GOLD MEMBER
          </div>
          <div className="h-20 flex items-center justify-center">
            <SpizzicoLogo className="h-10 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h4 className="font-sans font-black text-xs uppercase text-zinc-300">Spizzico Taste of Rome</h4>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Donated 2x $25 Pizza Vouchers</p>
          </div>
        </div>

        {/* Waka Gold Sponsor Card */}
        <div className="bg-white/5 border-2 border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-3 relative hover:border-yellow-500/50 transition-colors group">
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-mono text-[8px] font-bold">
            PREMIUM PARTNER
          </div>
          <div className="h-20 flex items-center justify-center">
            <WakaGoldLogo className="h-16 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h4 className="font-sans font-black text-xs uppercase text-yellow-101">Waka Gold NZ Honey</h4>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Donated 3x Pure Honey Bundles</p>
          </div>
        </div>

        {/* Superfina Sponsor Card */}
        <div className="bg-white/5 border-2 border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-3 relative hover:border-white/30 transition-colors group">
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[8px] font-bold">
            SUPPORTER
          </div>
          <div className="h-20 flex items-center justify-center">
            <SuperfinaLogo className="h-10 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h4 className="font-sans font-black text-xs uppercase text-zinc-300">Superfina Design</h4>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Donated 2x $30 Multi Vouchers</p>
          </div>
        </div>

        {/* Render Custom Sponsors Dynamically */}
        {customToDisplay.map((s) => (
          <div key={s.id} className="bg-white/5 border-2 border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-3 relative hover:border-pink-500/50 transition-colors group">
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-400 font-mono text-[8px] font-bold">
              CONTRIBUTOR
            </div>
            <div className="h-20 flex items-center justify-center max-w-full">
              {s.logo ? (
                <img src={s.logo} alt={`${s.name} logo`} className="max-h-14 w-auto object-contain group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-semibold text-xs text-white uppercase bg-zinc-800 px-3 py-1.5 rounded-xl block border border-black">{s.name}</span>
              )}
            </div>
            <div>
              <h4 className="font-sans font-black text-xs uppercase text-zinc-300 truncate max-w-[120px]" title={s.name}>{s.name}</h4>
              <p className="text-[10px] text-zinc-500 font-sans mt-0.5 font-bold">Custom Sponsor Option</p>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
