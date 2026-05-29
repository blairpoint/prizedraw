import React, { useState, useRef } from "react";
import { Prize, Participant, Sponsor } from "../types";
import { parsePrizesCSV, parseParticipantsCSV, parseCSVLine } from "../utils/csvParser";
import { DEFAULT_PRIZES_CSV, DEFAULT_PARTICIPANTS_CSV } from "../data/defaults";
import { Upload, Plus, Trash2, Edit2, Check, RotateCcw, Search, Download, AlertCircle, Sparkles, Image, CheckCircle, Layers } from "lucide-react";
import { playChime } from "../utils/audio";

interface CsvManagerProps {
  prizes: Prize[];
  setPrizes: React.Dispatch<React.SetStateAction<Prize[]>>;
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  sponsors: Sponsor[];
  setSponsors: React.Dispatch<React.SetStateAction<Sponsor[]>>;
}

export default function CsvManager({
  prizes,
  setPrizes,
  participants,
  setParticipants,
  sponsors,
  setSponsors,
}: CsvManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"prizes" | "participants" | "sponsors-config">("prizes");
  const [searchQuery, setSearchQuery] = useState("");
  
  // CSV Import Drag and Drop States
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Status Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs for creating a custom Sponsor Profile
  const [sponsorForm, setSponsorForm] = useState({
    name: "",
    logo: "",
    logoFilename: "",
    adImages: ["", "", ""],
    adImagesFilenames: ["", "", ""],
  });

  const [activePrizeSponsorAssign, setActivePrizeSponsorAssign] = useState<string | null>(null);

  // Forms for adding individual records
  const [showAddPrizeForm, setShowAddPrizeForm] = useState(false);
  const [newPrize, setNewPrize] = useState({
    sponsor: "",
    label: "",
    quantity: 1,
    sponsorLogo: "",
    prizeImages: "",
  });

  const [showAddParticipantForm, setShowAddParticipantForm] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    firstName: "",
    lastName: "",
    email: "",
    orderId: "",
    ticketsCount: 1,
    status: "Paid",
    netRevenue: 23,
    paymentMethod: "Visa",
    soldByPromoter: "",
    referredBy: "",
  });

  // Edit states
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);

  // Handlers for CSV Uploads & Row Associations
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processCSVContent = (content: string, type: "prizes" | "participants") => {
    try {
      if (type === "prizes") {
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) throw new Error("CSV file is empty.");

        const headers = parseCSVLine(lines[0]);
        // Search columns matching the requested spreadsheet row mapping
        const sponsorIdx = headers.findIndex(h => /sponsor/i.test(h));
        const logoIdx = headers.findIndex(h => /logo/i.test(h));
        const imagesIdx = headers.findIndex(h => /prize images|images|prize image|image/i.test(h));
        const labelIdx = headers.findIndex(h => /label|description|prize/i.test(h));
        const qtyIdx = headers.findIndex(h => /qty|quantity|count/i.test(h));

        const parsedPrizes: Prize[] = [];
        const updatedSponsors = [...sponsors];

        for (let i = 1; i < lines.length; i++) {
          const fields = parseCSVLine(lines[i]);
          if (fields.length < 2 || (!fields[0] && !fields[1])) continue;

          // Resolve dynamic columns or default back to standard indexes
          const sponsorName = sponsorIdx !== -1 ? (fields[sponsorIdx] || "Anonymous Sponsor") : (fields[0] || "Anonymous Sponsor");
          const prizeLabel = labelIdx !== -1 ? (fields[labelIdx] || "Mystery Prize") : (fields[1] || "Mystery Prize");
          
          const rawQty = qtyIdx !== -1 ? fields[qtyIdx] : fields[2];
          const qtyVal = rawQty ? (parseInt(rawQty.replace(/[^0-9]/g, ""), 10) || 1) : 1;

          const logoFilename = logoIdx !== -1 ? (fields[logoIdx] || "") : "";
          const rawImagesStr = imagesIdx !== -1 ? (fields[imagesIdx] || "") : "";
          const parsedImages = rawImagesStr.split(/[,;|]/).map(s => s.trim()).filter(Boolean);

          // Build prize
          parsedPrizes.push({
            id: `prize-csv-${i}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sponsor: sponsorName,
            label: prizeLabel,
            quantity: qtyVal,
            contact: fields[3] || "",
            details: fields[4] || "",
            value: parseFloat(fields[5]?.replace(/[^0-9.]/g, "") || "0") || 0,
            confirmed: fields[6]?.toLowerCase() === "yes" || fields[6] === "Yes",
            notes: fields[7] || "",
            logoReceived: fields[8]?.toLowerCase() === "yes" || fields[8] === "Yes" || logoFilename !== "",
            needShoutout: fields[9]?.toLowerCase() === "yes" || fields[9] === "Yes",
            drawnCount: 0
          });

          // Check if sponsor profile exists, if not, automatically populate association mapping!
          if (sponsorName) {
            let existingSponsor = updatedSponsors.find(s => s.name.toLowerCase().trim() === sponsorName.toLowerCase().trim());
            if (!existingSponsor) {
              updatedSponsors.push({
                id: sponsorName.toLowerCase().replace(/[^a-z0-9]/g, ""),
                name: sponsorName,
                logo: logoFilename,
                logoFilename: logoFilename,
                adImages: parsedImages,
                adImagesFilenames: parsedImages
              });
            } else {
              if (logoFilename && !existingSponsor.logo) {
                existingSponsor.logo = logoFilename;
                existingSponsor.logoFilename = logoFilename;
              }
              if (parsedImages.length > 0 && (!existingSponsor.adImages || existingSponsor.adImages.length === 0)) {
                existingSponsor.adImages = parsedImages;
                existingSponsor.adImagesFilenames = parsedImages;
              }
            }
          }
        }

        setPrizes(parsedPrizes);
        setSponsors(updatedSponsors);
        showFeedback(`Successfully parsed spreadsheet! Imported ${parsedPrizes.length} prizes and configured associated Campaign Sponsors.`, "success");
      } else {
        const parsed = parseParticipantsCSV(content);
        if (parsed.length === 0) throw new Error("Could not parse any valid rows in Ticket Sales CSV.");
        setParticipants(parsed);
        showFeedback(`Successfully loaded ${parsed.length} ticket holders from CSV!`, "success");
      }
      playChime();
    } catch (err: any) {
      showFeedback(err.message || "Failed to parse file. Please verify CSV formatting.", "error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMsg(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        // Map droplet behavior matching active view
        processCSVContent(text, activeSubTab === "prizes" ? "prizes" : "participants");
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processCSVContent(text, activeSubTab === "prizes" ? "prizes" : "participants");
      };
      reader.readAsText(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const showFeedback = (msg: string, type: "success" | "error") => {
    if (type === "success") {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  // Reset to default spreadsheet assets
  const handleResetToDefaults = () => {
    if (confirm("Are you sure you want to restore original mock assets? All uploaded custom logos and profiles will refresh to defaults.")) {
      setPrizes(parsePrizesCSV(DEFAULT_PRIZES_CSV));
      setParticipants(parseParticipantsCSV(DEFAULT_PARTICIPANTS_CSV));
      setSponsors([]);
      showFeedback("Successfully reset database registries to defaults!", "success");
      playChime();
    }
  };

  // Export Prizes/Sponsors to standard CSV download format
  const handleExportCSV = () => {
    let headers = "";
    let rowsStr = "";
    let filename = "";

    if (activeSubTab === "prizes") {
      headers = "Sponsors,Prize Draw Label,Sponsor Logo,Prize Images,Qty";
      rowsStr = prizes.map(p => {
        const cleanSpon = p.sponsor.includes(",") ? `"${p.sponsor}"` : p.sponsor;
        const cleanLbl = p.label.includes(",") ? `"${p.label}"` : p.label;
        const cleanSponLogo = (p.sponsorLogo || "").includes(",") ? `"${p.sponsorLogo}"` : (p.sponsorLogo || "");
        const cleanPrizeImgs = (p.prizeImages || "").includes(",") ? `"${p.prizeImages}"` : (p.prizeImages || "");
        return `${cleanSpon},${cleanLbl},${cleanSponLogo},${cleanPrizeImgs},${p.quantity}`;
      }).join("\n");
      filename = "prizes_exported.csv";
    } else {
      headers = "Order ID,Date,Status,First Name,Last Name,Email,No. of Tickets,Payment Method Type,Currency,Net Revenue,Sold by Promoter,Promoter Email,Referred by Customer,Referrer Email";
      rowsStr = participants.map(p => {
        return `${p.orderId},${p.date},${p.status},${p.firstName},${p.lastName},${p.email},${p.ticketsCount},${p.paymentMethod},${p.currency},${p.netRevenue},${p.soldByPromoter},${p.promoterEmail},${p.referredBy},${p.referrerEmail}`;
      }).join("\n");
      filename = "data_exported.csv";
    }

    const blob = new Blob([`${headers}\n${rowsStr}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback(`Successfully exported spreadsheet ${filename}!`, "success");
  };

  // Support exporting Sponsor & Prize Profile parameters to dynamic JSON File
  const handleExportJSON = () => {
    const profileData = {
      sponsors,
      prizes
    };
    const jsonStr = JSON.stringify(profileData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sponsor_prize_profiles.json");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback("Successfully exported sponsor and prize profiles to sponsor_prize_profiles.json!", "success");
    playChime();
  };

  // Support importing Sponsor & Prize profiles back into system registry
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.sponsors && Array.isArray(parsed.sponsors)) {
            setSponsors(parsed.sponsors);
          }
          if (parsed.prizes && Array.isArray(parsed.prizes)) {
            setPrizes(parsed.prizes);
          }
          showFeedback("Successfully imported Sponsor & Prize profiles data!", "success");
          playChime();
        } catch (e) {
          showFeedback("Invalid JSON profiles file container. Please try again.", "error");
        }
      };
      reader.readAsText(file);
    }
  };

  const triggerJsonInput = () => {
    jsonInputRef.current?.click();
  };

  // Manual Creation handlers
  const handleAddPrize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrize.label.trim()) {
      showFeedback("Prize Draw Label is required.", "error");
      return;
    }
    const created: Prize = {
      id: `prize-manual-${Date.now()}`,
      sponsor: newPrize.sponsor || "Anonymous Sponsor",
      label: newPrize.label,
      quantity: Number(newPrize.quantity) || 1,
      contact: "",
      details: "",
      value: 0,
      confirmed: true,
      notes: "",
      logoReceived: true,
      needShoutout: true,
      drawnCount: 0,
      sponsorLogo: newPrize.sponsorLogo,
      prizeImages: newPrize.prizeImages,
    };
    setPrizes(prev => [created, ...prev]);
    setShowAddPrizeForm(false);
    setNewPrize({
      sponsor: "",
      label: "",
      quantity: 1,
      sponsorLogo: "",
      prizeImages: "",
    });
    showFeedback("Successfully added custom prize giveaway item!", "success");
    playChime();
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipant.firstName.trim()) {
      showFeedback("First Name is required.", "error");
      return;
    }
    const created: Participant = {
      id: `participant-manual-${Date.now()}`,
      orderId: newParticipant.orderId || `O-${Math.floor(10000000 + Math.random() * 90000000)}`,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      status: newParticipant.status,
      firstName: newParticipant.firstName,
      lastName: newParticipant.lastName,
      fullName: `${newParticipant.firstName} ${newParticipant.lastName}`.trim(),
      email: newParticipant.email,
      ticketsCount: Number(newParticipant.ticketsCount) || 1,
      paymentMethod: newParticipant.paymentMethod,
      currency: "NZD",
      netRevenue: Number(newParticipant.netRevenue) || 0,
      soldByPromoter: newParticipant.soldByPromoter,
      promoterEmail: "",
      referredBy: newParticipant.referredBy,
      referrerEmail: "",
    };
    setParticipants(prev => [created, ...prev]);
    setShowAddParticipantForm(false);
    setNewParticipant({
      firstName: "",
      lastName: "",
      email: "",
      orderId: "",
      ticketsCount: 1,
      status: "Paid",
      netRevenue: 23,
      paymentMethod: "Visa",
      soldByPromoter: "",
      referredBy: "",
    });
    showFeedback("Successfully logged manual ticket buyer row!", "success");
    playChime();
  };

  // File to state conversion handlers for Media uploads
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setSponsorForm(prev => ({
          ...prev,
          logo: event.target?.result as string,
          logoFilename: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdPhotoUpload = (slotIdx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setSponsorForm(prev => {
          const updatedAds = [...prev.adImages];
          const updatedNames = [...prev.adImagesFilenames];
          updatedAds[slotIdx] = event.target?.result as string;
          updatedNames[slotIdx] = file.name;
          return {
            ...prev,
            adImages: updatedAds,
            adImagesFilenames: updatedNames
          };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSponsorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorForm.name.trim()) {
      showFeedback("Sponsor Company Name is required.", "error");
      return;
    }

    const created: Sponsor = {
      id: sponsorForm.name.toLowerCase().trim().replace(/[^a-z0-9]/g, ""),
      name: sponsorForm.name.trim(),
      logo: sponsorForm.logo,
      logoFilename: sponsorForm.logoFilename,
      adImages: sponsorForm.adImages.filter(Boolean),
      adImagesFilenames: sponsorForm.adImagesFilenames.filter(Boolean),
    };

    setSponsors(prev => {
      // replace if exists, else append
      const filtered = prev.filter(s => s.name.toLowerCase().trim() !== created.name.toLowerCase().trim());
      return [...filtered, created];
    });

    setSponsorForm({
      name: "",
      logo: "",
      logoFilename: "",
      adImages: ["", "", ""],
      adImagesFilenames: ["", "", ""],
    });

    showFeedback(`Successfully registered Campaign Sponsor Profile for ${created.name}!`, "success");
    playChime();
  };

  const deleteSponsor = (id: string) => {
    setSponsors(prev => prev.filter(s => s.id !== id));
    showFeedback("Deleted sponsor profile.", "success");
  };

  // Collapsible inline shortcut to assign prizes directly to that sponsor
  const handleDirectPrizeAssignSubmit = (e: React.FormEvent, sponsorName: string) => {
    e.preventDefault();
    const mockLabelInput = (e.currentTarget.elements.namedItem("prizeLabel") as HTMLInputElement).value;
    const mockQtyInput = Number((e.currentTarget.elements.namedItem("prizeQty") as HTMLInputElement).value) || 1;
    const mockValueInput = Number((e.currentTarget.elements.namedItem("prizeValue") as HTMLInputElement).value) || 0;

    if (!mockLabelInput.trim()) return;

    const created: Prize = {
      id: `prize-assign-${Date.now()}`,
      sponsor: sponsorName,
      label: mockLabelInput.trim(),
      quantity: mockQtyInput,
      contact: "",
      details: mockLabelInput.trim(),
      value: mockValueInput,
      confirmed: true,
      notes: "Assigned via Sponsor Manager Profile shortcut",
      logoReceived: true,
      needShoutout: true,
      drawnCount: 0
    };

    setPrizes(prev => [created, ...prev]);
    setActivePrizeSponsorAssign(null);
    showFeedback(`Successfully added and assigned prize "${mockLabelInput}" to ${sponsorName}!`, "success");
    playChime();
  };

  // Searching filter
  const filteredPrizes = prizes.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.label.toLowerCase().includes(q) ||
      p.sponsor.toLowerCase().includes(q) ||
      p.details.toLowerCase().includes(q) ||
      p.contact.toLowerCase().includes(q)
    );
  });

  const filteredParticipants = participants.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.orderId.toLowerCase().includes(q) ||
      p.soldByPromoter.toLowerCase().includes(q)
    );
  });

  const filteredSponsors = sponsors.filter(s => {
    return s.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 text-black select-none">
      {/* Dynamic Alerts */}
      {errorMsg && (
        <div className="bg-yellow-101 border-4 border-black text-black p-4 rounded-[18px] flex items-center justify-between shadow-[4px_4px_0_0_rgba(0,0,0,1)] animate-fade-in" id="error-alert">
          <div className="flex items-center space-x-3">
            <AlertCircle size={20} className="shrink-0 text-[#FF3D00]" />
            <p className="font-sans font-bold text-sm uppercase">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-100 border-4 border-black text-black p-4 rounded-[18px] flex items-center justify-between shadow-[4px_4px_0_0_rgba(0,0,0,1)] animate-fade-in" id="success-alert">
          <div className="flex items-center space-x-3">
            <Sparkles size={20} className="text-indigo-650 shrink-0" />
            <p className="font-sans font-bold text-sm uppercase">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Dynamic Tab Switcher bar */}
      <div className="bg-[#FFFCEE] border-4 border-black p-4 rounded-[28px] shadow-[8px_8px_0_0_rgba(0,0,0,1)] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveSubTab("prizes"); setSearchQuery(""); }}
            className={`font-display font-black text-xs md:text-sm py-2 px-5 rounded-2xl border-2 border-black transition-all transform hover:scale-102 active:scale-98 cursor-pointer ${
              activeSubTab === "prizes" ? "bg-yellow-400 text-black shadow-[3px_3px_0_0_rgba(0,0,0,1)]" : "bg-white text-zinc-700"
            }`}
          >
            🎁 Prize List ({prizes.length})
          </button>
          <button
            onClick={() => { setActiveSubTab("participants"); setSearchQuery(""); }}
            className={`font-display font-black text-xs md:text-sm py-2 px-5 rounded-2xl border-2 border-black transition-all transform hover:scale-102 active:scale-98 cursor-pointer ${
              activeSubTab === "participants" ? "bg-yellow-400 text-black shadow-[3px_3px_0_0_rgba(0,0,0,1)]" : "bg-white text-zinc-700"
            }`}
          >
            🎟️ Ticket Holders ({participants.length})
          </button>
          <button
            onClick={() => { setActiveSubTab("sponsors-config"); setSearchQuery(""); }}
            className={`font-display font-black text-xs md:text-sm py-2 px-5 rounded-2xl border-2 border-black transition-all transform hover:scale-102 active:scale-98 cursor-pointer ${
              activeSubTab === "sponsors-config" ? "bg-yellow-400 text-black shadow-[3px_3px_0_0_rgba(0,0,0,1)]" : "bg-white text-zinc-700"
            }`}
          >
            🎗️ Sponsor Ad Config ({sponsors.length})
          </button>
        </div>

        {/* Global actions: Restore defaults / Export profiles */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 font-display font-black text-xs py-2 px-4 rounded-xl border-2 border-black bg-rose-500 hover:bg-rose-400 text-white transition-all transform hover:scale-102 cursor-pointer shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
            title="Restore registry back to defaults"
          >
            <RotateCcw size={13} className="stroke-[3]" />
            <span>Restore Defaults</span>
          </button>
        </div>
      </div>

      {/* Rendering View A: Prizes CSV Uploader / Sheet display */}
      {activeSubTab === "prizes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border-4 border-black p-6 shadow-[12px_12px_0_0_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
              className={`md:col-span-2 border-4 border-dashed rounded-[24px] p-8 flex flex-col items-center justify-center text-center transition-colors ${
                dragActive ? "border-yellow-405 bg-yellow-400/10" : "border-black hover:border-indigo-600 bg-zinc-50"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              style={{ cursor: "pointer" }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".csv"
              />
              <div className="bg-yellow-400 p-4 rounded-full border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-3 text-black">
                <Upload size={24} className="stroke-[3]" />
              </div>
              <p className="font-display font-black text-lg text-black uppercase tracking-tight">
                Drag & Drop or Click to Upload Prize Spreadsheet
              </p>
              <p className="font-sans text-xs text-zinc-605 font-medium mt-1 max-w-lg leading-relaxed">
                Supports column parsing mapping! Will auto-associate <strong>Logo Received</strong> from `Sponsor Logo` column and <strong>Slideshow photos</strong> from `Prize Images` filename columns!
              </p>
            </div>

            <div className="flex flex-col justify-between space-y-4">
              <div className="bg-zinc-900 border-4 border-black rounded-[24px] p-5 space-y-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
                <p className="font-display font-black text-yellow-450 text-xs uppercase tracking-wider">CSV Action Toolbox</p>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center space-x-2 bg-yellow-400 hover:bg-yellow-300 border-2 border-black text-black font-black uppercase text-xs py-3 px-3 rounded-xl transition-transform active:scale-95 shadow-[3px_3px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Download size={14} className="stroke-[3]" />
                    <span>Export CSV Spreadsheet</span>
                  </button>
                  <button
                    onClick={() => setShowAddPrizeForm(true)}
                    className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 border-2 border-black text-white font-black uppercase text-xs py-3 px-3 rounded-xl transition-transform active:scale-95 shadow-[3px_3px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Plus size={14} className="stroke-[3]" />
                    <span>Add Manual Prize Row</span>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 font-sans italic">
                💡 Spreadsheet is fully synced with active pool state. Each draw subtracts quantity by 1. Once hitting zero stock, the arena switches to the next available sponsor prize.
              </p>
            </div>
          </div>

          {/* Table display for Prizes */}
          <div className="bg-[#FFFCEE] border-4 border-black rounded-[36px] p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-black pb-4 gap-4">
              <h3 className="font-display font-black text-xl text-black uppercase tracking-tight">Active Prizes in Stock</h3>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by Sponsor or Label..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="font-sans text-xs bg-white text-black font-bold border-2 border-black py-2 pl-8 pr-4 rounded-xl w-60"
                />
                <Search size={14} className="text-black absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full text-left font-sans text-xs">
                <thead className="bg-zinc-150 uppercase tracking-widest text-[9px] font-black text-zinc-700 border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">Sponsor</th>
                    <th className="py-3 px-4">Prize Label</th>
                    <th className="py-3 px-4 text-center">Qty / Stock</th>
                    <th className="py-3 px-4">Sponsor Logo</th>
                    <th className="py-3 px-4">Prize Images</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-black">
                  {filteredPrizes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 font-bold uppercase tracking-widest">No matching prize rows found</td>
                    </tr>
                  ) : (
                    filteredPrizes.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50 font-bold">
                        <td className="py-3.5 px-4 text-sm font-black">{p.sponsor}</td>
                        <td className="py-3.5 px-4 text-sm text-indigo-700">{p.label}</td>
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="number"
                            min={0}
                            value={p.quantity}
                            onChange={(e) => setPrizes(prev => prev.map(item => item.id === p.id ? { ...item, quantity: Math.max(0, parseInt(e.target.value, 10) || 0) } : item))}
                            className="w-16 border-2 border-black rounded-lg px-2 py-1 text-center font-mono font-bold bg-zinc-50"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-650">{p.sponsorLogo || "—"}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">{p.prizeImages || "—"}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setPrizes(prev => prev.filter(item => item.id !== p.id))}
                            className="p-1 px-1.5 rounded-lg border border-red-500 bg-red-100/50 hover:bg-red-500 text-red-650 hover:text-white transition-colors cursor-pointer"
                            title="Remove prize record"
                          >
                            <Trash2 size={13} className="inline stroke-[2]" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rendering View B: Ticket Holders CSV Uploader / Pool list */}
      {activeSubTab === "participants" && (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border-4 border-black p-6 shadow-[12px_12px_0_0_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
              className={`md:col-span-2 border-4 border-dashed rounded-[24px] p-8 flex flex-col items-center justify-center text-center transition-colors ${
                dragActive ? "border-yellow-405 bg-yellow-400/10" : "border-black hover:border-indigo-600 bg-zinc-50"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              style={{ cursor: "pointer" }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".csv"
              />
              <div className="bg-yellow-400 p-4 rounded-full border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-3 text-black">
                <Upload size={24} className="stroke-[3]" />
              </div>
              <p className="font-display font-black text-lg text-black uppercase tracking-tight">
                Drag & Drop or Click to Upload Ticket sales CSV
              </p>
              <p className="font-sans text-xs text-zinc-650 font-medium mt-1">
                Reads ticket count rows. Converts Jane Doe (Tickets: 3) into 3x entries on the roll ticker drum automatically.
              </p>
            </div>

            <div className="flex flex-col justify-between space-y-4">
              <div className="bg-zinc-900 border-4 border-black rounded-[24px] p-5 space-y-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
                <p className="font-display font-black text-yellow-450 text-xs uppercase tracking-wider font-bold">Ticket Action Toolbox</p>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center space-x-2 bg-yellow-400 hover:bg-yellow-300 border-2 border-black text-black font-black uppercase text-xs py-3 px-3 rounded-xl transition-transform active:scale-95 shadow-[3px_3px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Download size={14} className="stroke-[3]" />
                    <span>Export CSV File</span>
                  </button>
                  <button
                    onClick={() => setShowAddParticipantForm(true)}
                    className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 border-2 border-black text-white font-black uppercase text-xs py-3 px-3 rounded-xl transition-transform active:scale-95 shadow-[3px_3px_0_0_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Plus size={14} className="stroke-[3]" />
                    <span>Add Manual Attendee</span>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 font-sans italic">
                💡 Each manual attendee requires a valid order ID. They are synced with paid and unpaid filtering checkboxes on the main drawing customizer options.
              </p>
            </div>
          </div>

          {/* Table display for Participants */}
          <div className="bg-[#FFFCEE] border-4 border-black rounded-[36px] p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-black pb-4 gap-4">
              <h3 className="font-display font-black text-xl text-black uppercase tracking-tight">Active Ticket Pool Registry</h3>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by Name, Email, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="font-sans text-xs bg-white text-black font-bold border-2 border-black py-2 pl-8 pr-4 rounded-xl w-60"
                />
                <Search size={14} className="text-black absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full text-left font-sans text-xs">
                <thead className="bg-zinc-150 uppercase tracking-widest text-[9px] font-black text-zinc-700 border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Tickets Held</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Revenues</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-black">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500 font-bold uppercase tracking-widest">No matching ticket buyers found</td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50 font-bold">
                        <td className="py-3.5 px-4 font-mono font-black text-zinc-800">{p.orderId}</td>
                        <td className="py-3.5 px-4 text-sm font-black">{p.fullName}</td>
                        <td className="py-3.5 px-4 text-zinc-650">{p.email}</td>
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="number"
                            min={1}
                            value={p.ticketsCount}
                            onChange={(e) => setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, ticketsCount: Math.max(1, parseInt(e.target.value, 10) || 1) } : item))}
                            className="w-16 border-2 border-black rounded-lg px-2 py-1 text-center font-mono font-bold bg-zinc-50"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border-2 ${
                            p.status === "Paid" ? "bg-emerald-100 text-emerald-800 border-emerald-500" : "bg-yellow-100 text-yellow-800 border-yellow-500"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-zinc-600">${p.netRevenue}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setParticipants(prev => prev.filter(item => item.id !== p.id))}
                            className="p-1 px-1.5 rounded-lg border border-red-500 bg-red-100/50 hover:bg-red-500 text-red-650 hover:text-white transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} className="inline stroke-[2]" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rendering View C: Custom Sponsor Profile Config Dashboard */}
      {activeSubTab === "sponsors-config" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Side: Create / Edit Sponsor Profiler Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[32px] border-4 border-black p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] space-y-5">
              <div className="border-b-4 border-black pb-3 bg-yellow-400 -mx-6 -mt-6 p-5 rounded-t-[26px]">
                <h3 className="font-display font-black text-lg text-black uppercase tracking-tight flex items-center gap-1.5 leading-none">
                  <Plus className="stroke-[3]" size={18} />
                  <span>Build Sponsor Profile</span>
                </h3>
                <p className="text-[10px] text-zinc-900 font-bold font-sans mt-1">Configure logos, names, and 3 advertising slideshow slates</p>
              </div>

              <form onSubmit={handleCreateSponsorSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1.5">Sponsor / Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Spizzico, Superfina"
                    value={sponsorForm.name}
                    onChange={e => setSFormName(e.target.value)}
                    className="w-full text-xs font-bold py-3 px-3.5 border-2 border-black rounded-xl bg-zinc-50 focus:outline-none"
                  />
                  <p className="text-[9px] text-zinc-505 font-medium mt-1">Matched automatically to the Prize sponsor column name</p>
                </div>

                {/* Sponsor logo block with file upload */}
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1.5">Upload Brand Logo *</label>
                  <div className="flex items-center gap-3">
                    <label className="flex flex-col items-center justify-center border-2 border-black border-dashed rounded-xl w-14 h-14 bg-zinc-50 hover:bg-zinc-100 cursor-pointer overflow-hidden pb-1">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      {sponsorForm.logo ? (
                        <img src={sponsorForm.logo} alt="brand logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-xl">🎨</span>
                      )}
                    </label>
                    <div className="text-[10px]">
                      <p className="font-black text-black uppercase">Click upload icon</p>
                      <p className="text-zinc-500 font-medium truncate max-w-[150px]">
                        {sponsorForm.logoFilename || "No file uploaded"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Advertising campaign slides uploads (Up to 3 photos loop for slide) */}
                <div className="space-y-3.5 border-t border-dashed border-zinc-200 pt-3">
                  <span className="block text-[10px] font-black text-black font-display uppercase tracking-widest">Upload Loop Slides (Max 3 Campaign ads)</span>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="flex flex-col items-center space-y-1">
                        <label className="flex flex-col items-center justify-center border-2 border-black border-dashed rounded-xl w-full aspect-square bg-zinc-50 hover:bg-zinc-100 cursor-pointer overflow-hidden relative">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAdPhotoUpload(idx)}
                          />
                          {sponsorForm.adImages[idx] ? (
                            <img src={sponsorForm.adImages[idx]} alt={`ad ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-base">📸</span>
                              <span className="text-[7px] font-black uppercase tracking-tight text-zinc-400 mt-0.5">Ad {idx + 1}</span>
                            </div>
                          )}
                        </label>
                        <span className="text-[8px] font-mono text-zinc-550 truncate max-w-[65px]" title={sponsorForm.adImagesFilenames[idx]}>
                          {sponsorForm.adImagesFilenames[idx] ? `${idx+1}. ${sponsorForm.adImagesFilenames[idx]}` : "Empty"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full font-display font-black text-xs py-3 px-4 border-2 border-black rounded-2xl text-black bg-yellow-450 hover:bg-yellow-400 transition-all transform hover:scale-102 cursor-pointer shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                >
                  Save Sponsor & Slideshow
                </button>
              </form>
            </div>
          </div>

          {/* Right Side: Active Profiles Grid & Backup Actions */}
          <div className="lg:col-span-8 space-y-6 text-left">
            <div className="bg-[#FFFCEE] rounded-[32px] border-4 border-black p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-display font-black text-sm uppercase text-black">Event Profiles Config Hub</h4>
                <p className="text-[10px] text-zinc-650 font-medium leading-relaxed font-sans mt-0.5">
                  Backup your active configuration profiles before hard page refreshes or to setup another television stage client.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={jsonInputRef}
                  onChange={handleImportJSON}
                />
                <button
                  onClick={triggerJsonInput}
                  className="inline-flex items-center gap-1 bg-white hover:bg-zinc-55 border-2 border-black text-black font-black uppercase text-[10px] py-2 px-3.5 rounded-xl text-center shadow-[3px_3px_0_0_rgba(0,0,0,1)] cursor-pointer"
                >
                  <Upload size={13} className="stroke-[3]" />
                  <span>Import JSON Profiles</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border-2 border-black text-white font-black uppercase text-[10px] py-2 px-3.5 rounded-xl text-center shadow-[3px_3px_0_0_rgba(0,0,0,1)] cursor-pointer"
                >
                  <Download size={13} className="stroke-[3]" />
                  <span>Export JSON Profiles</span>
                </button>
              </div>
            </div>

            {/* Profiles Lists Grid */}
            <div className="bg-white rounded-[36px] border-4 border-black p-6 shadow-[10px_10px_0_0_rgba(0,0,0,1)] space-y-4">
              <h3 className="font-display font-black text-lg text-black uppercase tracking-tight">Campaign Sponsors Directory ({filteredSponsors.length})</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {filteredSponsors.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">
                    No sponsor configurations mapped yet. Fill left form or upload prizes CSV with logo headers to populate!
                  </div>
                ) : (
                  filteredSponsors.map((s) => {
                    const matchedPrizes = prizes.filter(p => p.sponsor.toLowerCase().trim() === s.name.toLowerCase().trim());
                    return (
                      <div key={s.id} className="bg-zinc-50 border-4 border-black rounded-[24px] p-4 flex flex-col justify-between space-y-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)] relative">
                        <button
                          onClick={() => deleteSponsor(s.id)}
                          className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors"
                          title="Delete sponsor"
                        >
                          <Trash2 size={14} className="stroke-[2.5]" />
                        </button>
                        
                        <div>
                          <div className="flex items-center space-x-3.5 mb-2.5">
                            {s.logo ? (
                              <div className="w-11 h-11 border-2 border-black bg-white rounded-xl overflow-hidden flex items-center justify-center p-0.5">
                                <img src={s.logo} alt="logo preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="w-11 h-11 border-2 border-black bg-yellow-400 rounded-xl flex items-center justify-center font-bold font-sans text-xs">
                                Ref
                              </div>
                            )}
                            <div>
                              <h4 className="font-display font-black text-sm uppercase leading-tight text-zinc-900">{s.name}</h4>
                              <p className="text-[9px] text-zinc-500 font-mono tracking-tighter mt-0.5">
                                Logo file: {s.logoFilename || "Linked convention"}
                              </p>
                            </div>
                          </div>

                          {/* Loop slideshow summary indicators */}
                          <div className="p-2 border border-dashed border-zinc-200 rounded-lg bg-zinc-100/60 mb-3 text-[10px]">
                            <p className="font-black text-zinc-700 uppercase tracking-tight text-[8px] mb-1">Ad Slides Loops:</p>
                            <div className="flex items-center gap-2">
                              {Array.from({length: 3}).map((_, i) => (
                                <div key={i} className="flex items-center gap-1 text-[9px]">
                                  <div className={`w-2 h-2 rounded-full border border-black ${s.adImages[i] ? "bg-emerald-400" : "bg-zinc-300"}`}></div>
                                  <span className="font-bold text-zinc-500 font-mono">Slide {i+1}</span>
                                </div>
                              ))}
                            </div>
                            {s.adImagesFilenames && s.adImagesFilenames.length > 0 && (
                              <p className="text-[8px] text-indigo-700 mt-1 truncate font-mono max-w-[250px]">
                                Filenames: {s.adImagesFilenames.filter(Boolean).join(", ")}
                              </p>
                            )}
                          </div>

                          {/* Prizes currently assigned */}
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider block">Campaign Awards Assigned:</span>
                            {matchedPrizes.length === 0 ? (
                              <p className="text-[10px] text-rose-500 italic font-semibold">No prizes mapped! Assign a prize below to draw for them.</p>
                            ) : (
                              <ul className="grid grid-cols-1 gap-1">
                                {matchedPrizes.map((p) => (
                                  <li key={p.id} className="text-[10px] bg-indigo-50 border border-indigo-150 p-1.5 rounded-md flex justify-between font-bold text-indigo-950">
                                    <span>🎁 {p.label}</span>
                                    <span className="text-indigo-650 font-mono">Qty: {p.quantity}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Shortcut Assign Prize Forms */}
                        <div className="pt-2 border-t border-dashed border-zinc-200">
                          {activePrizeSponsorAssign === s.id ? (
                            <form 
                              onSubmit={(e) => handleDirectPrizeAssignSubmit(e, s.name)}
                              className="bg-yellow-400/10 border-2 border-black p-2.5 rounded-xl text-[10px] space-y-2 mt-1.5 animate-fade-in"
                            >
                              <span className="font-display font-black text-black uppercase tracking-tight block">Add and assign prize container:</span>
                              <div>
                                <label className="block text-[8px] font-black text-zinc-650 uppercase">Short label name *</label>
                                <input
                                  type="text"
                                  name="prizeLabel"
                                  required
                                  placeholder="e.g. $50 Cash Voucher"
                                  className="w-full text-[10px] py-1.5 px-2 bg-white border border-black rounded"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[8px] font-black text-zinc-650 uppercase">Count Qty</label>
                                  <input
                                    type="number"
                                    name="prizeQty"
                                    min={1}
                                    defaultValue={1}
                                    className="w-full text-[10px] py-1 px-2 bg-white border border-black rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] font-black text-zinc-650 uppercase">Unit Value ($)</label>
                                  <input
                                    type="number"
                                    name="prizeValue"
                                    min={0}
                                    defaultValue={25}
                                    className="w-full text-[10px] py-1 px-2 bg-white border border-black rounded"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-1.5 pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActivePrizeSponsorAssign(null)}
                                  className="flex-1 bg-zinc-200 text-black py-1 rounded tracking-tight text-[9px] font-bold"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="flex-1 bg-indigo-600 text-white hover:bg-indigo-500 py-1 rounded tracking-tight text-[9px] font-bold"
                                >
                                  Assign
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => setActivePrizeSponsorAssign(s.id)}
                              className="w-full bg-white hover:bg-zinc-5 border-2 border-black text-black font-black uppercase text-[9px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:scale-98 transition-all"
                            >
                              <Plus size={10} className="stroke-[3.5]" />
                              <span>Create & Assign Award</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Attendee Popup */}
      {showAddPrizeForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border-4 border-black p-6 animate-scale-in">
            <h3 className="font-display font-black text-black text-lg mb-4 uppercase leading-none">🎁 Create Prize Row</h3>
            <form onSubmit={handleAddPrize} className="space-y-4 text-left font-bold">
              <div>
                <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Sponsor / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spizzicco, Waka Gold, Vonuts"
                  value={newPrize.sponsor}
                  onChange={e => setNewPrize(prev => ({ ...prev, sponsor: e.target.value }))}
                  className="w-full text-xs py-3 px-3.5 border-2 border-black rounded-xl text-black"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Prize Draw Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. $25 Voucher, Gift Hamper"
                  value={newPrize.label}
                  onChange={e => setNewPrize(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full text-xs py-3 px-3.5 border-2 border-black rounded-xl text-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Quantity Stock</label>
                  <input
                    type="number"
                    min={1}
                    value={newPrize.quantity}
                    onChange={e => setNewPrize(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full text-xs py-2.5 px-3 border-2 border-black rounded-xl text-black text-center bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Sponsor Logo File</label>
                  <input
                    type="text"
                    placeholder="e.g. vonuts-logo.png"
                    value={newPrize.sponsorLogo}
                    onChange={e => setNewPrize(prev => ({ ...prev, sponsorLogo: e.target.value }))}
                    className="w-full text-xs py-2.5 px-3 border-2 border-black rounded-xl text-black bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Prize Images (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. spizzicco1.jpg, spizzicco2.jpg"
                  value={newPrize.prizeImages}
                  onChange={e => setNewPrize(prev => ({ ...prev, prizeImages: e.target.value }))}
                  className="w-full text-xs py-3 px-3.5 border-2 border-black rounded-xl text-black bg-white"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowAddPrizeForm(false)}
                  className="flex-1 bg-zinc-150 border-2 border-black text-black py-2.5 px-4 rounded-xl text-xs font-mono font-black uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 border-2 border-black hover:bg-indigo-505 text-white py-2.5 px-4 rounded-xl text-xs font-display font-black uppercase tracking-wider shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                >
                  Save Prize Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Participant Popup */}
      {showAddParticipantForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border-4 border-black p-6 animate-scale-in">
            <h3 className="font-display font-black text-black text-lg mb-4 uppercase leading-none">🎟️ Add Ticket Buyer Row</h3>
            <form onSubmit={handleAddParticipant} className="space-y-4 text-left font-bold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. June"
                    value={newParticipant.firstName}
                    onChange={e => setNewParticipant(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full text-xs py-2.5 px-3 border-2 border-black rounded-xl bg-zinc-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Higgins"
                    value={newParticipant.lastName}
                    onChange={e => setNewParticipant(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full text-xs py-2.5 px-3 border-2 border-black rounded-xl bg-zinc-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. june@example.com"
                  value={newParticipant.email}
                  onChange={e => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-xs py-2.5 px-3.5 border-2 border-black rounded-xl bg-zinc-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Tickets Count</label>
                  <input
                    type="number"
                    min={1}
                    value={newParticipant.ticketsCount}
                    onChange={e => setNewParticipant(prev => ({ ...prev, ticketsCount: Number(e.target.value) }))}
                    className="w-full text-xs py-2 px-3 border-2 border-black rounded-xl text-center font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-black font-display uppercase tracking-widest mb-1">Net Revenue ($ NZD)</label>
                  <input
                    type="number"
                    min={0}
                    value={newParticipant.netRevenue}
                    onChange={e => setNewParticipant(prev => ({ ...prev, netRevenue: Number(e.target.value) }))}
                    className="w-full text-xs py-2 px-3 border-2 border-black rounded-xl text-center font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowAddParticipantForm(false)}
                  className="flex-1 bg-zinc-150 border-2 border-black text-black py-2.5 px-4 rounded-xl text-xs font-mono font-black uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 border-2 border-black hover:bg-indigo-505 text-white py-2.5 px-4 rounded-xl text-xs font-display font-black uppercase tracking-wider shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                >
                  Log Ticket Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Helper local setters to clean up type checks
  function setSFormName(val: string) {
    setSponsorForm(prev => ({ ...prev, name: val }));
  }
}
