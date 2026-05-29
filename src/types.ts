export interface Sponsor {
  id: string; // generated or derived from key
  name: string;
  logo: string; // Base64 dataURL or filename
  logoFilename?: string;
  adImages: string[]; // up to 3 images (Base64 dataURL or filenames)
  adImagesFilenames?: string[];
}

export interface Prize {
  id: string;
  sponsor: string;
  label: string;
  quantity: number;
  contact: string;
  details: string;
  value: number;
  confirmed: boolean;
  notes: string;
  logoReceived: boolean;
  needShoutout: boolean;
  drawnCount: number; // How many times this prize has been drawn in session
  sponsorLogo?: string;
  prizeImages?: string;
}

export interface Participant {
  id: string; // Unique index or orderId + index
  orderId: string;
  date: string;
  status: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  ticketsCount: number;
  paymentMethod: string;
  currency: string;
  netRevenue: number;
  soldByPromoter: string;
  promoterEmail: string;
  referredBy: string;
  referrerEmail: string;
}

export interface TicketEntry {
  id: string; // Dynamic unique ID for each actual ticket chance
  participantId: string;
  participant: Participant;
  ticketIndex: number; // e.g., 1 for the first ticket, 2 for the second ticket
}

export interface DrawResult {
  id: string;
  timestamp: string;
  participant: Participant;
  prize: Prize;
  ticketNumber: number; // The ticket index drawn (1-based)
  notes?: string;
  claimed?: boolean;
  additionalPrize?: string;
}
