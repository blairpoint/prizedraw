import React, { useState, useEffect } from "react";
import { Sparkle, MessageSquareCode, CheckCircle2, Award, Tv, Heart, Database, Trophy, Play } from "lucide-react";
import { playChime } from "../utils/audio";

interface FeatureItem {
  id: string;
  name: string;
  description: string;
  category: "Visuals" | "Automation" | "Data" | "Sponsor Promotion";
  icon: React.ReactNode;
  testingStatus: "Fully Integrated" | "Awaiting TV Review" | "Operational";
}

interface FeatureComment {
  id: string;
  featureId: string;
  text: string;
  timestamp: string;
}

export default function FeatureCommentBoard() {
  const features: FeatureItem[] = [
    {
      id: "spinner",
      name: "Raffle Spinner & Core Live Arena",
      description: "Interactive visual draw widget that slides seamlessly through customer rosters to pick a random prize winner.",
      category: "Visuals",
      icon: <Award className="w-5 h-5 text-pink-400" />,
      testingStatus: "Fully Integrated"
    },
    {
      id: "autopilot",
      name: "6-Hour Autopilot Draw Scheduler",
      description: "Evenly distributes prize distributions over a 6-hour event blocks, ensuring the entire prize pool is fully and evenly drawn.",
      category: "Automation",
      icon: <Play className="w-5 h-5 text-emerald-400" />,
      testingStatus: "Fully Integrated"
    },
    {
      id: "tv-mode",
      name: "TV Broadcast Thick Bezel Frame",
      description: "Ultra-high visibility layout designed strictly for TV displays, using enhanced 36px font sizing and safe negative spacing.",
      category: "Visuals",
      icon: <Tv className="w-5 h-5 text-amber-400" />,
      testingStatus: "Fully Integrated"
    },
    {
      id: "sponsor-slider",
      name: "Sponsor Promo & Logo Slideshow",
      description: "Maximizes charity donor exposure by rotating brand images, vector logos, custom product vouchers, and sponsor descriptions.",
      category: "Sponsor Promotion",
      icon: <Heart className="w-5 h-5 text-red-400" />,
      testingStatus: "Operational"
    },
    {
      id: "csv-importer",
      name: "Excel & CSV Data Importer",
      description: "Upload custom lists of ticket owners (names, emails, ticket indexes) and prizes pool datasets on the fly.",
      category: "Data",
      icon: <Database className="w-5 h-5 text-sky-400" />,
      testingStatus: "Operational"
    },
    {
      id: "winners-wall",
      name: "Live Winners Ledger",
      description: "Persistent board displaying historically drawn winners, sponsor categories, the value of prizes, and door-claim logs.",
      category: "Sponsor Promotion",
      icon: <Trophy className="w-5 h-5 text-yellow-400" />,
      testingStatus: "Fully Integrated"
    }
  ];

  const [comments, setComments] = useState<FeatureComment[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Load comments from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pally_feature_comments");
      if (stored) {
        setComments(JSON.parse(stored));
      } else {
        // Pre-populate with a couple of friendly demo instructions so the view isn't boring
        const initial: FeatureComment[] = [
          {
            id: "init-1",
            featureId: "tv-mode",
            text: "Tested on 65 inch TV, high contrast colors are incredibly bright!",
            timestamp: "26 May, 19:50"
          },
          {
            id: "init-2",
            featureId: "sponsor-slider",
            text: "Ad images show up nicely with crisp scaling.",
            timestamp: "26 May, 19:55"
          }
        ];
        setComments(initial);
        localStorage.setItem("pally_feature_comments", JSON.stringify(initial));
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, []);

  // Update change handlers
  const handleInputChange = (featureId: string, val: string) => {
    setCommentInputs(prev => ({
      ...prev,
      [featureId]: val
    }));
  };

  // Submit comment
  const handleSubmit = (featureId: string) => {
    const text = commentInputs[featureId]?.trim();
    if (!text) return;

    const newComment: FeatureComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      featureId,
      text,
      timestamp: new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })
    };

    const updated = [newComment, ...comments];
    setComments(updated);
    localStorage.setItem("pally_feature_comments", JSON.stringify(updated));

    // Clear input
    setCommentInputs(prev => ({
      ...prev,
      [featureId]: ""
    }));

    playChime();
  };

  // Delete a comment
  const handleDeleteComment = (id: string) => {
    const updated = comments.filter(c => c.id !== id);
    setComments(updated);
    localStorage.setItem("pally_feature_comments", JSON.stringify(updated));
    playChime();
  };

  return (
    <div className="bg-zinc-900/90 rounded-[40px] border-4 border-zinc-800 p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-white relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/30 text-[10px] uppercase font-black tracking-widest font-mono">
              Review Board v2
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-black text-white mt-1 uppercase tracking-tight">
            📋 APPLICATION FEATURES REVIEW & COMMENT FEEDBACK
          </h2>
          <p className="text-zinc-400 text-xs mt-1 font-sans">
            Review the isolated core modules of our digital raffle system below. Input your comment, request adjustments, or leave feedback for each component.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => {
          const featureComments = comments.filter(c => c.featureId === feature.id);

          return (
            <div
              key={feature.id}
              className="bg-zinc-950/70 border-2 border-zinc-805 hover:border-zinc-700 rounded-3xl p-5 flex flex-col justify-between transition-all shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-black font-display uppercase tracking-tight text-zinc-100">
                        {feature.name}
                      </h3>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                        {feature.category}
                      </span>
                    </div>
                  </div>
                  
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black font-mono px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    {feature.testingStatus}
                  </span>
                </div>

                <p className="text-zinc-400 text-xs leading-relaxed font-sans mt-1">
                  {feature.description}
                </p>
              </div>

              {/* Comments Section */}
              <div className="mt-5 pt-4 border-t border-zinc-900 space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <MessageSquareCode className="w-3.5 h-3.5 text-pink-400" />
                    Operator Comments ({featureComments.length})
                  </span>

                  {featureComments.length === 0 ? (
                    <div className="bg-zinc-900/30 border border-zinc-850/40 rounded-xl p-3 text-center text-zinc-500 italic text-[11px] font-sans">
                      No feedback comments submitted for this component yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {featureComments.map((comment) => (
                        <div
                          key={comment.id}
                          className="bg-zinc-900/60 border border-zinc-850 rounded-xl p-2 md:p-2.5 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <p className="text-zinc-200 text-xs font-medium font-sans">
                              {comment.text}
                            </p>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              {comment.timestamp}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-zinc-600 hover:text-red-400 transition-colors text-[10px] uppercase font-black font-mono hover:underline cursor-pointer"
                          >
                            delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* New Comment Input */}
                <div className="flex gap-2 items-start pt-1">
                  <textarea
                    value={commentInputs[feature.id] || ""}
                    onChange={(e) => handleInputChange(feature.id, e.target.value)}
                    placeholder={`Comment on ${feature.name}...`}
                    className="flex-1 min-h-[38px] max-h-[80px] bg-zinc-900 border-2 border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans leading-relaxed resize-none"
                  />
                  <button
                    onClick={() => handleSubmit(feature.id)}
                    disabled={!commentInputs[feature.id]?.trim()}
                    className="bg-pink-500 hover:bg-pink-400 disabled:bg-zinc-800 disabled:text-zinc-600 border-2 border-black font-black uppercase text-[10px] tracking-wider px-3.5 py-2 rounded-xl text-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:shadow-none translate-y-0.5 active:translate-y-1 select-none transition-all cursor-pointer"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
