import React, { useState } from "react";
import { Play, FileText, AlertCircle, Sparkles } from "lucide-react";

interface StartupModalProps {
  onStart: (mode: "default" | "test" | "debug", logs: any[] | null, immersive: boolean) => void;
}

export default function StartupModal({ onStart }: StartupModalProps) {
  const [mode, setMode] = useState<"default" | "test" | "debug">("default");
  const [file, setFile] = useState<File | null>(null);
  const [immersive, setImmersive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (csvText: string): any[] => {
    if (!csvText) return [];
    const lines = csvText.split('\n').map(l => l.trim()).filter(line => line !== '');
    if (lines.length < 2) return [];
    
    // Check if line exists before accessing split
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    return lines.slice(1).map(line => {
      const values = line?.split(',') || [];
      const obj: any = {};
      headers.forEach((header, index) => {
        const val = values[index] ? values[index].trim() : "";
        obj[header] = val;
      });
      
      // Map to expected format
      return {
        id: `imported-${Date.now()}-${Math.random()}`,
        timestamp: obj["Timestamp"],
        participantEmail: obj["Winner Email"],
        winner: obj["Winner Name"],
        prize: obj["Prize Title"],
        sponsor: obj["Sponsor Name"],
      };
    });
  };

  const handleStart = async () => {
    let logs: any[] | null = null;
    if (file) {
      try {
        const text = await file.text();
        // Assuming CSV format based on request
        logs = parseCSV(text);
      } catch (e) {
        console.error("Failed to parse history file", e);
        alert("Invalid history file format.");
        return;
      }
    }
    onStart(mode, logs, immersive);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-3xl w-full max-w-lg border-4 border-black p-8 shadow-2xl flex flex-col gap-6">
        <h1 className="text-3xl font-black uppercase text-center tracking-tight">Rhythm for Ribbons</h1>
        <p className="text-zinc-600 text-center font-medium">Welcome! Please configure the startup environment for this session.</p>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-3">
          {(["default", "test", "debug"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-4 rounded-xl border-2 font-black uppercase text-xs transition-all ${
                mode === m
                  ? "bg-pink-500 text-white border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-zinc-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* File Uploader */}
        <div className="border-2 border-dashed border-zinc-300 rounded-xl p-4 flex flex-col items-center gap-3">
          <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="history-file" />
          <label htmlFor="history-file" className="cursor-pointer flex items-center gap-2 font-bold text-sm hover:text-pink-500">
            <FileText size={20} />
            {file ? file.name : "Import History File (CSV) (Optional)"}
          </label>
        </div>

        {/* Immersive Toggle */}
        <label className="flex items-center gap-3 text-sm font-bold cursor-pointer">
          <input 
            type="checkbox" 
            checked={immersive} 
            onChange={(e) => setImmersive(e.target.checked)} 
            className="w-5 h-5 accent-pink-500"
          />
          Enable Immersive Fullscreen
        </label>

        <button
          onClick={handleStart}
          className="w-full py-4 bg-black text-white font-black uppercase rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-[6px_6px_0_0_rgba(224,51,143,0.5)]"
        >
          <Play size={20} /> Start Competition
        </button>
      </div>
    </div>
  );
}
