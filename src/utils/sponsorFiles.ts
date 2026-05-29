import { Sponsor, Prize } from "../types";
import { parseCSVLine } from "./csvParser";
import sponsorFiles from "../data/sponsorFilesManifest.json";

export interface SponsorCsvMapping {
  sponsor: string;
  logo: string;
  prizeImages: string[];
}

let loadedCsvMappings: SponsorCsvMapping[] = [];

export function setSponsorCsvMappings(mappings: SponsorCsvMapping[]) {
  loadedCsvMappings = mappings;
}

export function parseSponsorCsv(csvText: string): SponsorCsvMapping[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const sponsorIdx = headers.findIndex(h => h.includes("sponsor"));
  const logoIdx = headers.findIndex(h => h.includes("logo"));
  const imagesIdx = headers.findIndex(h => h.includes("prize"));

  const mappings: SponsorCsvMapping[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length === 0) continue;

    const sponsor = sponsorIdx !== -1 && fields[sponsorIdx] ? fields[sponsorIdx].trim() : "";
    if (!sponsor) continue;

    const logo = logoIdx !== -1 && fields[logoIdx] ? fields[logoIdx].trim() : "";
    const prizeImagesStr = imagesIdx !== -1 && fields[imagesIdx] ? fields[imagesIdx].trim() : "";
    const prizeImages = prizeImagesStr 
      ? prizeImagesStr.split(/[,;]/).map(img => img.trim()).filter(Boolean) 
      : [];

    mappings.push({
      sponsor,
      logo,
      prizeImages
    });
  }

  return mappings;
}

export function findCsvMapping(sponsorName: string): SponsorCsvMapping | null {
  if (loadedCsvMappings.length === 0) return null;

  const normSponsor = sponsorName.toLowerCase().trim();

  // Try exact match first
  const exact = loadedCsvMappings.find(m => m.sponsor.toLowerCase().trim() === normSponsor);
  if (exact) return exact;

  // Try fuzzy match: one contains another or parts
  const fuzzy = loadedCsvMappings.find(m => {
    const normMapped = m.sponsor.toLowerCase().trim();
    if (normMapped.length >= 3 && normSponsor.length >= 3) {
      return normMapped.includes(normSponsor) || normSponsor.includes(normMapped);
    }
    return false;
  });

  return fuzzy || null;
}

function resolveSponsorFilePath(filename: string, allFiles: string[]): string {
  if (!filename) return "";
  const cleanF = filename.trim();
  if (cleanF.startsWith("/") || cleanF.startsWith("http") || cleanF.startsWith("data:")) {
    return cleanF;
  }
  const baseName = cleanF.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/g, "").toLowerCase().trim();
  const matchedManifest = allFiles.find(f => {
    const fileClean = f.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/g, "");
    return fileClean.includes(baseName) || baseName.includes(fileClean);
  });
  if (matchedManifest) {
    return `/sponsorfiles/${matchedManifest}`;
  }
  return `/sponsorfiles/${cleanF}`;
}

/**
 * Match a sponsor name to its logo and ad files in the sponsorfiles folder
 */
export function matchSponsorFiles(
  sponsorName: string, 
  allFiles: string[] = sponsorFiles, 
  explicitLogo?: string, 
  explicitImages?: string
) {
  const normSponsor = sponsorName.toLowerCase().trim();
  let logoFile = "";
  const explicitAdImages: string[] = [];

  const csvMapping = findCsvMapping(sponsorName);

  // 1) Match logo filename (CSV has highest priority, then explicit parameter)
  if (csvMapping && csvMapping.logo) {
    logoFile = resolveSponsorFilePath(csvMapping.logo, allFiles);
  } else if (explicitLogo) {
    logoFile = resolveSponsorFilePath(explicitLogo, allFiles);
  }

  // 2) Match prize images (CSV has highest priority)
  if (csvMapping && csvMapping.prizeImages && csvMapping.prizeImages.length > 0) {
    for (const img of csvMapping.prizeImages) {
      const resolved = resolveSponsorFilePath(img, allFiles);
      if (resolved) {
        explicitAdImages.push(resolved);
      }
    }
  } else if (explicitImages) {
    const items = explicitImages.split(",").map(i => i.trim()).filter(Boolean);
    for (const item of items) {
      const resolved = resolveSponsorFilePath(item, allFiles);
      if (resolved) {
        explicitAdImages.push(resolved);
      }
    }
  }

  // 3) General Prefix match fallback for other sponsor files (e.g. ad images)
  const prefixes: string[] = [];
  if (normSponsor.includes("spizzicco") || normSponsor.includes("spizzico")) {
    prefixes.push("spizzicco");
    prefixes.push("spizzico");
  } else if (normSponsor.includes("3333")) {
    prefixes.push("3333");
  } else if (normSponsor.includes("equilibrium") || normSponsor.includes("equillibrium")) {
    prefixes.push("equillibrium");
    prefixes.push("equilibrium");
  } else if (normSponsor.includes("pally")) {
    prefixes.push("pally");
  } else if (normSponsor.includes("waka")) {
    prefixes.push("waka");
  } else if (normSponsor.includes("superfina")) {
    prefixes.push("superfina");
  } else if (normSponsor.includes("nails") || normSponsor.includes("naomi")) {
    prefixes.push("nails");
    prefixes.push("naomi");
  } else if (normSponsor.includes("spotlight")) {
    prefixes.push("spotlight");
  } else {
    const firstWord = normSponsor.split(" ")[0].replace(/[^a-z0-9]/g, "");
    if (firstWord.length >= 3) {
      prefixes.push(firstWord);
    }
    const fullAlpha = normSponsor.replace(/[^a-z0-9]/g, "");
    if (fullAlpha && fullAlpha !== firstWord) {
      prefixes.push(fullAlpha);
    }
  }

  const adFiles: string[] = [];
  for (const filename of allFiles) {
    const fileLower = filename.toLowerCase();
    const belongs = prefixes.some(p => fileLower.includes(p));

    if (belongs) {
      const isLogo = fileLower.includes("-logo.") || fileLower.includes("_logo.");
      if (isLogo) {
        if (!logoFile) {
          logoFile = `/sponsorfiles/${filename}`;
        }
      } else {
        const fullAdPath = `/sponsorfiles/${filename}`;
        if (!adFiles.includes(fullAdPath) && !explicitAdImages.includes(fullAdPath)) {
          adFiles.push(fullAdPath);
        }
      }
    }
  }

  // Fallback for logo if still empty
  if (!logoFile) {
    const fallbackLogo = allFiles.find(f => {
      const fLower = f.toLowerCase();
      const belongs = prefixes.some(p => fLower.includes(p));
      return belongs && fLower.includes("logo");
    });
    if (fallbackLogo) {
      logoFile = `/sponsorfiles/${fallbackLogo}`;
    }
  }

  // Merge lists securely
  const finalAds = [...explicitAdImages];
  adFiles.forEach(img => {
    if (!finalAds.includes(img) && img !== logoFile) {
      finalAds.push(img);
    }
  });

  return { logo: logoFile, adImages: finalAds };
}

/**
 * Enrich a list of sponsors with logo and ad images matched from direct sponsorfiles and prizes configuration
 */
export function enrichSponsorsWithFiles(
  rawSponsors: Sponsor[], 
  allFiles: string[] = sponsorFiles, 
  prizes: Prize[] = []
): Sponsor[] {
  return rawSponsors.map(s => {
    const matchedPrizes = prizes.filter(p => p.sponsor.toLowerCase().trim() === s.name.toLowerCase().trim());
    
    let explicitLogo = "";
    const explicitAdImageFiles: string[] = [];
    
    matchedPrizes.forEach(p => {
      if (p.sponsorLogo && !explicitLogo) {
        explicitLogo = p.sponsorLogo;
      }
      if (p.prizeImages) {
        explicitAdImageFiles.push(p.prizeImages);
      }
    });

    const { logo, adImages } = matchSponsorFiles(
      s.name, 
      allFiles, 
      explicitLogo, 
      explicitAdImageFiles.join(",")
    );
    
    // Carry forward any loaded logo/images state
    const finalLogo = logo || s.logo;
    const mergedAdImages = [...(s.adImages || [])];
    
    adImages.forEach(img => {
      if (!mergedAdImages.includes(img) && img !== finalLogo) {
        mergedAdImages.push(img);
      }
    });

    return {
      ...s,
      logo: finalLogo,
      logoFilename: finalLogo ? finalLogo.split("/").pop() : s.logoFilename,
      adImages: mergedAdImages,
      adImagesFilenames: mergedAdImages.map(img => img.split("/").pop() || "")
    };
  });
}
