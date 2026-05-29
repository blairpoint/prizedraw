import { Prize, Participant } from "../types";

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parsePrizesCSV(csvText: string): Prize[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  
  const sponsorIdx = headers.findIndex(h => h === "sponsors" || h === "sponsor");
  const labelIdx = headers.findIndex(h => h === "prize draw label" || h === "label" || h === "prize" || h === "prize draw");
  const logoIdx = headers.findIndex(h => h === "sponsor logo" || h === "logo");
  const imagesIdx = headers.findIndex(h => h === "prize images" || h === "prize image" || h === "ad images");
  const qtyIdx = headers.findIndex(h => h === "qty" || h === "quantity");
  
  // existing fallback headers
  const contactIdx = headers.findIndex(h => h.includes("contact"));
  const detailsIdx = headers.findIndex(h => h.includes("donate") || h.includes("details") || h.includes("what"));
  const valueIdx = headers.findIndex(h => h === "value");
  const confirmedIdx = headers.findIndex(h => h.includes("confirmed"));
  const notesIdx = headers.findIndex(h => h.includes("notes"));
  const logoRecIdx = headers.findIndex(h => h.includes("logo received"));
  const shoutIdx = headers.findIndex(h => h.includes("shoutout"));

  const prizes: Prize[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length === 0) continue;

    const sponsorVal = sponsorIdx !== -1 && fields[sponsorIdx] ? fields[sponsorIdx].trim() : "";
    const labelVal = labelIdx !== -1 && fields[labelIdx] ? fields[labelIdx].trim() : "";
    
    if (!sponsorVal && !labelVal) continue; // Skip raw empty rows

    const sponsor = sponsorVal || "Anonymous Sponsor";
    const label = labelVal || "Mystery Prize";
    
    let quantity = 1;
    if (qtyIdx !== -1 && fields[qtyIdx]) {
      const qVal = fields[qtyIdx].replace(/[^0-9]/g, "");
      quantity = parseInt(qVal, 10) || 1;
    }

    const contact = contactIdx !== -1 ? fields[contactIdx] : "";
    const details = detailsIdx !== -1 ? fields[detailsIdx] : "";
    
    let value = 0;
    if (valueIdx !== -1 && fields[valueIdx]) {
      const valClean = fields[valueIdx].replace(/[^0-9.]/g, "");
      value = parseFloat(valClean) || 0;
    }

    const confirmed = confirmedIdx !== -1 ? (fields[confirmedIdx]?.toLowerCase() === "yes" || fields[confirmedIdx] === "Yes") : false;
    const notes = notesIdx !== -1 ? fields[notesIdx] : "";
    const logoReceived = logoRecIdx !== -1 ? (fields[logoRecIdx]?.toLowerCase() === "yes" || fields[logoRecIdx] === "Yes") : false;
    const needShoutout = shoutIdx !== -1 ? (fields[shoutIdx]?.toLowerCase() === "yes" || fields[shoutIdx] === "Yes") : false;

    // Optional custom asset columns
    const sponsorLogo = logoIdx !== -1 && fields[logoIdx] ? fields[logoIdx].trim() : "";
    const prizeImages = imagesIdx !== -1 && fields[imagesIdx] ? fields[imagesIdx].trim() : "";

    prizes.push({
      id: `prize-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sponsor,
      label,
      quantity,
      contact,
      details,
      value,
      confirmed,
      notes,
      logoReceived,
      needShoutout,
      drawnCount: 0,
      sponsorLogo,
      prizeImages
    });
  }

  return prizes;
}

export function parseParticipantsCSV(csvText: string): Participant[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const participants: Participant[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 7 || !fields[3]) continue; // Must have at least name and order id

    const orderId = fields[0] || `Order-${i}`;
    const date = fields[1] || "";
    const status = fields[2] || "";
    const firstName = fields[3] || "";
    const lastName = fields[4] || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = fields[5] || "";
    const ticketsStr = fields[6] ? fields[6].replace(/[^0-9]/g, "") : "1";
    const ticketsCount = parseInt(ticketsStr, 10) || 1;
    const paymentMethod = fields[7] || "";
    const currency = fields[8] || "NZD";
    
    const revClean = fields[9] ? fields[9].replace(/[^0-9.]/g, "") : "0";
    const netRevenue = parseFloat(revClean) || 0;

    const soldByPromoter = fields[10] || "";
    const promoterEmail = fields[11] || "";
    const referredBy = fields[12] || "";
    const referrerEmail = fields[13] || "";

    participants.push({
      id: `participant-${i}-${orderId}`,
      orderId,
      date,
      status,
      firstName,
      lastName,
      fullName,
      email,
      ticketsCount,
      paymentMethod,
      currency,
      netRevenue,
      soldByPromoter,
      promoterEmail,
      referredBy,
      referrerEmail
    });
  }

  return participants;
}
