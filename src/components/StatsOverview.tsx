import React, { useState } from "react";
import { Prize, Participant, DrawResult } from "../types";
import { TrendingUp, Coins, Users, Ticket, Award, Calendar, Trash2, ShieldCheck, Download, AlertCircle, Volume2, Sparkles, UserCheck, CloudRain, Mail } from "lucide-react";

interface ServerLogEntry {
  id: string;
  round: number;
  winner: string;
  participantId?: string;
  participantEmail?: string;
  prize: string;
  sponsor: string;
  timestamp: string;
}

interface StatsOverviewProps {
  prizes: Prize[];
  participants: Participant[];
  drawHistory: DrawResult[];
  onDeleteLog: (id: string) => void;
  onClearHistory: () => void;
  onImportLogs: (logs: ServerLogEntry[]) => void;
}

interface EmailLogEntry {
  timestamp: string;
  recipient: string;
  subject: string;
  status: 'success' | 'failed';
  messageId?: string;
  error?: string;
}

export default function StatsOverview({
  prizes,
  participants,
  drawHistory,
  onDeleteLog,
  onClearHistory,
  onImportLogs,
}: StatsOverviewProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [serverLogs, setServerLogs] = useState<ServerLogEntry[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const [showEmailLogsModal, setShowEmailLogsModal] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);

  const handleFetchEmails = async () => {
    setIsLoadingEmails(true);
    try {
      const res = await fetch('/api/emails');
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data.logs || []);
        setShowEmailLogsModal(true);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to fetch email logs from server');
    }
    setIsLoadingEmails(false);
  };

  const handleFetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setServerLogs(data.logs || []);
        setShowImportModal(true);
        // Select all by default
        setSelectedLogs(new Set((data.logs || []).map((l: ServerLogEntry) => l.id)));
      }
    } catch (e) {
      console.error(e);
      alert('Failed to fetch logs from server');
    }
    setIsLoadingLogs(false);
  };

  const handleConfirmImport = () => {
    const logsToImport = serverLogs.filter(l => selectedLogs.has(l.id));
    onImportLogs(logsToImport);
    setShowImportModal(false);
  };
  
  // Group prizes by sponsor
  const sponsorGroup: { [sponsor: string]: Prize[] } = {};
  prizes.forEach(p => {
    if (!sponsorGroup[p.sponsor]) {
      sponsorGroup[p.sponsor] = [];
    }
    sponsorGroup[p.sponsor].push(p);
  });
  const sponsorList = Object.entries(sponsorGroup);

  // Analytics computations
  const totalTicketsBought = participants.reduce((sum, p) => sum + p.ticketsCount, 0);
  const totalRevenue = participants.reduce((sum, p) => sum + (p.status === "Paid" ? p.netRevenue : 0), 0);
  const totalCustomers = participants.length;
  const totalSponsors = prizes.length;
  
  // Confirmed vs Tentative Sporsors
  const confirmedSponsorsCount = prizes.filter(p => p.confirmed).length;

  // Prizes states
  const totalPrizesQty = prizes.reduce((sum, p) => sum + p.quantity, 0);
  const totalDrawnCount = drawHistory.length;
  const prizesLeft = totalPrizesQty - totalDrawnCount;

  // Export history logs to CSV
  const handleExportLogsCSV = () => {
    if (drawHistory.length === 0) return;
    const headers = "Timestamp,Winner Name,Winner Email,OrderId,Ticket Chance,Prize Title,Sponsor Name";
    const rows = drawHistory.map(h => {
      const cleanName = h.participant.fullName.includes(",") ? `"${h.participant.fullName}"` : h.participant.fullName;
      const cleanPrize = h.prize.label.includes(",") ? `"${h.prize.label}"` : h.prize.label;
      const cleanSponsor = h.prize.sponsor.includes(",") ? `"${h.prize.sponsor}"` : h.prize.sponsor;
      return `${h.timestamp},${cleanName},${h.participant.email},${h.participant.orderId},Chance #${h.ticketNumber},${cleanPrize},${cleanSponsor}`;
    }).join("\n");

    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `draw_results_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 select-none">
      {/* Analytics stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {/* Total Funds raised */}
        <div className="bg-white p-5 rounded-[24px] border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex items-center space-x-4 text-black">
          <div className="bg-yellow-405 border-2 border-black text-black p-3 rounded-full shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
            <Coins size={22} className="stroke-[3]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-550 font-black uppercase tracking-wider font-display">Revenue Raised</p>
            <h3 className="font-display font-black text-black text-lg sm:text-xl tracking-tight leading-none mt-1">
              ${totalRevenue.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD
            </h3>
            <p className="text-[9px] text-zinc-500 font-sans font-medium mt-1">From Paid transactions</p>
          </div>
        </div>

        {/* Total Tickets Sold */}
        <div className="bg-white p-5 rounded-[24px] border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex items-center space-x-4 text-black">
          <div className="bg-indigo-600 border-2 border-black text-white p-3 rounded-full shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
            <Ticket size={22} className="stroke-[3]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-555 font-black uppercase tracking-wider font-display">Total Tickets Sold</p>
            <h3 className="font-display font-black text-black text-xl tracking-tight leading-none mt-1">
              {totalTicketsBought} Tickets
            </h3>
            <p className="text-[9px] text-zinc-500 font-sans font-medium mt-1">{totalCustomers} unique booking buyers</p>
          </div>
        </div>

        {/* Total Prizes status */}
        <div className="bg-white p-5 rounded-[24px] border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex items-center space-x-4 text-black">
          <div className="bg-[#FF3D00] border-2 border-black text-white p-3 rounded-full shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
            <Award size={22} className="stroke-[3]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-555 font-black uppercase tracking-wider font-display">Prizes remaining</p>
            <h3 className="font-display font-black text-black text-xl tracking-tight leading-none mt-1">
              {prizesLeft} / {totalPrizesQty} units
            </h3>
            <p className="text-[9px] text-zinc-500 font-sans font-medium mt-1">{totalDrawnCount} prizes awarded so far</p>
          </div>
        </div>

        {/* Sponsors Count */}
        <div className="bg-white p-5 rounded-[24px] border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex items-center space-x-4 text-black">
          <div className="bg-emerald-400 border-2 border-black text-black p-3 rounded-full shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
            <Users size={22} className="stroke-[3]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-550 font-black uppercase tracking-wider font-display">Sponsors Joined</p>
            <h3 className="font-display font-black text-black text-xl tracking-tight leading-none mt-1">
              {totalSponsors} Sponsors
            </h3>
            <p className="text-[9px] text-zinc-500 font-sans font-medium mt-1">{confirmedSponsorsCount} fully confirmed & active</p>
          </div>
        </div>
      </div>

      {/* Main split dashboard: History log (left/2-widths), Sponsors directory (right/1-width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Draw History List (Left) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white text-black rounded-[32px] border-4 border-black p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-black pb-4 gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="text-indigo-600 shrink-0 stroke-[3]" size={18} />
                <h3 className="font-display font-black text-black text-lg uppercase tracking-tight">Historical Draw Records</h3>
              </div>

              {drawHistory.length > 0 && (
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={handleFetchEmails}
                    disabled={isLoadingEmails}
                    className="flex items-center space-x-2 bg-pink-100 hover:bg-pink-300 disabled:opacity-50 border-2 border-black text-black font-black uppercase text-xs py-2 px-3.5 rounded-xl transition-transform active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Mail size={13} className="stroke-[3]" />
                    <span>{isLoadingEmails ? 'Loading...' : 'View Email Logs'}</span>
                  </button>

                  <button
                    onClick={handleFetchLogs}
                    disabled={isLoadingLogs}
                    className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 border-2 border-black text-black font-black uppercase text-xs py-2 px-3.5 rounded-xl transition-transform active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <CloudRain size={13} className="stroke-[3]" />
                    <span>{isLoadingLogs ? 'Loading...' : 'Recover Logs'}</span>
                  </button>

                  <button
                    onClick={handleExportLogsCSV}
                    className="flex items-center space-x-2 bg-yellow-405 hover:bg-yellow-300 border-2 border-black text-black font-black uppercase text-xs py-2 px-3.5 rounded-xl transition-transform active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Download size={13} className="stroke-[3]" />
                    <span>Download CSV Results</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to clear ALL completed draws in this session? This will return all prize stocks and re-enable participants.")) {
                        onClearHistory();
                      }
                    }}
                    className="text-xs font-black uppercase bg-[#FF3D00] hover:bg-red-500 border-2 border-black text-white py-2 px-3.5 rounded-xl cursor-pointer transition-transform active:scale-95 shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                  >
                    Clear History
                  </button>
                </div>
              )}
            </div>

            {drawHistory.length === 0 ? (
              <div className="text-center py-16 text-zinc-400 font-sans space-y-3">
                <AlertCircle className="mx-auto text-zinc-300" size={36} />
                <p className="text-sm font-black text-black uppercase tracking-tight">No lottery draws completed yet.</p>
                <p className="text-xs text-zinc-500 font-medium">Head to the "🎯 DRAWS" tab to run some spins!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-black border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 border-b-4 border-black font-display font-black text-black uppercase tracking-widest text-[9px]">
                      <th className="px-4 py-3.5 border-r border-zinc-200">Timestamp</th>
                      <th className="px-4 py-3.5 border-r border-zinc-200">Winner Details</th>
                      <th className="px-4 py-3.5 border-r border-zinc-200">Prize Awarded</th>
                      <th className="px-4 py-3.5 border-r border-zinc-200">Sponsor</th>
                      <th className="scroll-p-1 px-4 py-3.5 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black font-sans">
                    {drawHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3.5 text-zinc-650 font-mono text-[10px] whitespace-nowrap">
                          {h.timestamp}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-black text-black text-sm uppercase">{h.participant.fullName}</div>
                          <div className="text-[10px] text-pink-600 font-bold">Ticket ID #{h.participant.orderId}</div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-indigo-650">
                          🎁 {h.prize.label}
                        </td>
                        <td className="px-4 py-3.5 font-black text-black">
                          {h.prize.sponsor}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Remove this draw? This will re-add ${h.participant.fullName} to the eligible ticket pool and return the prize to stock.`)) {
                                onDeleteLog(h.id);
                              }
                            }}
                            className="bg-zinc-100 hover:bg-[#FF3D00] text-black hover:text-white p-2 rounded-lg border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-transform active:scale-90"
                            title="Undo draw & restore participant + prize"
                          >
                            <Trash2 size={13} className="stroke-[3]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sponsor Quick Shoutouts Directory (Right) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white text-black rounded-[32px] border-4 border-black p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] space-y-4">
            <div className="border-b-4 border-black pb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="text-emerald-555 shrink-0 stroke-[3]" size={18} />
                <h3 className="font-display font-black text-black text-lg uppercase tracking-tight">Sponsors Directory</h3>
              </div>
              <p className="text-zinc-500 text-[10px] font-semibold mt-1">Quick lookup summary of donor entities</p>
            </div>

            {prizes.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No sponsors listed.</p>
            ) : (
              <div className="space-y-4.5 max-h-[420px] overflow-y-auto pr-1">
                {sponsorList.map(([sponsorName, donations]) => {
                  const hasLogo = donations.some(d => d.logoReceived);
                  const needsShoutout = donations.some(d => d.needShoutout);
                  return (
                    <div key={sponsorName} className="bg-yellow-100 border-2 border-black rounded-[20px] p-4 flex justify-between items-start shadow-[3px_3px_0_-1px_rgba(0,0,0,1)] font-sans">
                      <div className="space-y-1">
                        <h5 className="font-display font-black text-xs text-black uppercase leading-tight">{sponsorName}</h5>
                        <p className="text-[10px] text-zinc-700 font-medium leading-normal pt-1">
                          Donated: <span className="font-semibold text-black">{donations.map(d => d.label).join(", ")}</span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 items-end shrink-0">
                        {hasLogo && (
                          <span className="text-[8px] uppercase tracking-wider font-extrabold bg-emerald-400 border border-black text-black px-1.5 py-0.5 rounded-sm shadow-[1px_1px_0_0_rgba(0,0,0,1)]">Logo Ok</span>
                        )}
                        {needsShoutout && (
                          <span className="text-[8px] uppercase tracking-wider font-extrabold bg-yellow-405 border border-black text-black px-1.5 py-0.5 rounded-sm shadow-[1px_1px_0_0_rgba(0,0,0,1)]">Shoutout</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl border-4 border-black p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-black uppercase mb-4">Restore Server Logs</h2>
            {serverLogs.length === 0 ? (
              <p className="p-4 text-center">No logs found on the server.</p>
            ) : (
              <div className="overflow-y-auto flex-1 border-2 border-black bg-zinc-50 rounded-xl p-2 space-y-2">
                {serverLogs.map(log => (
                  <label key={log.id} className="flex items-center space-x-3 p-3 bg-white border-2 border-black rounded-lg cursor-pointer hover:bg-yellow-50">
                    <input
                      type="checkbox"
                      checked={selectedLogs.has(log.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedLogs);
                        if (e.target.checked) newSet.add(log.id);
                        else newSet.delete(log.id);
                        setSelectedLogs(newSet);
                      }}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <div className="font-bold">Round {log.round} - {log.winner}</div>
                      <div className="text-sm text-zinc-600">Won: {log.prize} from {log.sponsor}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border-2 border-black font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={serverLogs.length === 0 || selectedLogs.size === 0}
                className="px-4 py-2 bg-pink-500 font-black text-white border-2 border-black rounded-xl disabled:opacity-50"
              >
                Import Selected ({selectedLogs.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailLogsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl border-4 border-black p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-black uppercase mb-4 flex items-center gap-2"><Mail size={24} /> Email Delivery History</h2>
            {emailLogs.length === 0 ? (
              <p className="p-4 text-center">No emails sent yet.</p>
            ) : (
              <div className="overflow-y-auto flex-1 border-2 border-black bg-zinc-50 rounded-xl p-2 space-y-2">
                {emailLogs.map((log, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 bg-white border-2 border-black rounded-lg">
                    <div className="flex-1">
                      <div className="font-bold">{log.subject}</div>
                      <div className="text-sm text-zinc-600">To: {log.recipient} | {new Date(log.timestamp).toLocaleString()}</div>
                      {log.error && <div className="text-xs text-red-600 font-medium">Error: {log.error}</div>}
                    </div>
                    <div className="flex items-center space-x-1">
                      {log.status === 'success' ? (
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-md border-2 border-green-800">Delivered</span>
                      ) : (
                        <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-md border-2 border-red-800">Failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setShowEmailLogsModal(false)}
                className="px-4 py-2 font-bold bg-pink-500 text-white rounded-xl border-2 border-black hover:bg-pink-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
