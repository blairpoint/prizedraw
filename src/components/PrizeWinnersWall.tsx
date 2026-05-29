import React from "react";
import { DrawResult } from "../types";
import { Clock, CheckCircle2, Award, Zap } from "lucide-react";

interface PrizeWinnersWallProps {
  drawHistory: DrawResult[];
  onToggleClaim: (id: string, currentClaimed: boolean) => void;
  isSimpleMode?: boolean;
  onGoToDraw?: () => void;
}

export default function PrizeWinnersWall({
  drawHistory,
  onToggleClaim,
  isSimpleMode = false,
  onGoToDraw,
}: PrizeWinnersWallProps) {
  // Fresh winners first, deduplicated by name so each winner only displays once
  const seenNames = new Set<string>();
  const sortedWinners: DrawResult[] = [];
  for (const winner of drawHistory) {
    const nameKey = winner.participant.fullName.trim().toLowerCase();
    if (!seenNames.has(nameKey)) {
      seenNames.add(nameKey);
      sortedWinners.push(winner);
    }
  }

  const totalPrizes = drawHistory.length;
  const claimedCount = drawHistory.filter(h => h.claimed).length;

  return (
    <div className={`space-y-6 ${isSimpleMode ? "animate-fade-in text-white p-2" : ""}`}>
      {/* List Header stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-900 border-4 border-black rounded-[28px] p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center space-x-2.5">
            <span className="bg-[#E0338F] text-white text-[9px] font-black px-3 py-1 rounded-full border border-black uppercase tracking-widest leading-none">
              🏆 Prize Winners Leaderboard
            </span>
          </div>
          <h1 className="font-display font-black text-2xl md:text-3xl uppercase tracking-tighter text-white leading-none">
            Prize Winners!
          </h1>
          <p className="text-zinc-400 font-sans text-xs">
            Confirmations and rewards claim tracking so far. Change status inside the list manually or via mobile pass scanning.
          </p>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-black border-2 border-zinc-800 rounded-xl px-3.5 py-1.5 text-center min-w-[75px]">
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Total</span>
            <span className="text-base font-display font-black text-white">{totalPrizes}</span>
          </div>
          <div className="bg-black border-2 border-zinc-800 rounded-xl px-3.5 py-1.5 text-center min-w-[75px]">
            <span className="text-[7px] font-black text-emerald-400 tracking-widest font-mono block uppercase">Claimed</span>
            <span className="text-base font-display font-black text-emerald-400">{claimedCount}</span>
          </div>

          {onGoToDraw && (
            <button
              onClick={onGoToDraw}
              className="bg-yellow-405 hover:bg-yellow-350 border-3 border-black text-black font-display font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95 shrink-0 ml-1"
            >
              <span>Draw Next 🎰</span>
            </button>
          )}
        </div>
      </div>

      {sortedWinners.length === 0 ? (
        <div className="bg-zinc-900/60 border-4 border-zinc-850 rounded-[36px] py-12 px-6 text-center space-y-5 max-w-xl mx-auto shadow-inner">
          <div className="w-16 h-16 rounded-full bg-zinc-950 border-2 border-zinc-800 flex items-center justify-center mx-auto text-zinc-500 shadow-inner">
            <Award size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-black text-lg uppercase tracking-tighter text-zinc-400">No Winners Declared</h2>
            <p className="text-zinc-500 text-xs font-semibold max-w-xs mx-auto">
              Ready to draw? Perform a random raffle in the primary dashboard area!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border-4 border-black rounded-[28px] p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-mono text-[9px] font-black select-none">
                  {!isSimpleMode && <th className="py-3 px-4">#</th>}
                  <th className="py-3 px-4">Winner Name</th>
                  <th className="py-3 px-4">Prize Won</th>
                  <th className="py-3 px-4">Contributor</th>
                  {!isSimpleMode && <th className="py-3 px-4 text-center">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {sortedWinners.map((winner, idx) => {
                  const isClaimed = !!winner.claimed;
                  return (
                    <tr
                      key={winner.id}
                      className="hover:bg-zinc-850/40 transition-colors group"
                    >
                      {!isSimpleMode && (
                        <td className="py-3 px-4 font-mono font-bold text-zinc-500">
                          {sortedWinners.length - idx}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          {isClaimed ? (
                            <CheckCircle2 size={16} className="text-emerald-400 bg-emerald-950/20 rounded-full p-0.5 shrink-0" />
                          ) : (
                            <Clock size={16} className="text-yellow-405 animate-pulse shrink-0" />
                          )}
                          <span className="font-display font-black uppercase text-sm tracking-tight text-white group-hover:text-pink-450 transition-colors">
                            {winner.participant.fullName}
                          </span>
                        </div>
                        {winner.additionalPrize && (
                          <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-yellow-400 bg-yellow-950/20 border border-yellow-500/20 px-2 py-0.5 rounded-md w-max">
                            <Zap size={10} className="fill-yellow-400 text-yellow-500" />
                            <span>WON BONUS WHEEL: {winner.additionalPrize}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-black text-zinc-100 uppercase tracking-tight text-sm text-yellow-400">
                          {winner.prize.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-zinc-400 uppercase font-black">
                        {winner.prize.sponsor}
                      </td>
                      {!isSimpleMode && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onToggleClaim(winner.id, isClaimed)}
                            className={`px-3 py-1.5 font-mono text-[9px] font-black rounded-lg border-2 uppercase transition-all tracking-wider cursor-pointer ${
                              isClaimed
                                ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400"
                                : "bg-yellow-400/10 border-yellow-400/30 hover:bg-yellow-400/20 text-yellow-400"
                            }`}
                          >
                            {isClaimed ? "✓ claimed" : "🕐 wait claim"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
