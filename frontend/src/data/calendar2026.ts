export interface RaceInfo {
  round: number;
  name: string;
  short: string;
  country: string;
  flag: string;
  trackType: "Permanent" | "Street";
  date: string; // ISO
  isSprint: boolean;
}

// From src/calendar_manager.py SCHEDULE_2026 + SPRINT_RACES_2026
export const CALENDAR_2026: RaceInfo[] = [
  { round: 1,  name: "Australian Grand Prix",  short: "Melbourne",  country: "Australia",     flag: "🇦🇺", trackType: "Permanent", date: "2026-03-08", isSprint: false },
  { round: 2,  name: "Chinese Grand Prix",     short: "Shanghai",   country: "China",         flag: "🇨🇳", trackType: "Permanent", date: "2026-03-22", isSprint: true  },
  { round: 3,  name: "Japanese Grand Prix",    short: "Suzuka",     country: "Japan",         flag: "🇯🇵", trackType: "Permanent", date: "2026-04-12", isSprint: false },
  { round: 4,  name: "Miami Grand Prix",       short: "Miami",      country: "USA",           flag: "🇺🇸", trackType: "Street",    date: "2026-05-03", isSprint: true  },
  { round: 5,  name: "Canadian Grand Prix",    short: "Montréal",   country: "Canada",        flag: "🇨🇦", trackType: "Street",    date: "2026-06-14", isSprint: false },
  { round: 6,  name: "Monaco Grand Prix",      short: "Monaco",     country: "Monaco",        flag: "🇲🇨", trackType: "Street",    date: "2026-06-28", isSprint: false },
  { round: 7,  name: "British Grand Prix",     short: "Silverstone",country: "UK",            flag: "🇬🇧", trackType: "Permanent", date: "2026-07-05", isSprint: false },
  { round: 8,  name: "Austrian Grand Prix",    short: "Spielberg",  country: "Austria",       flag: "🇦🇹", trackType: "Permanent", date: "2026-07-19", isSprint: true  },
  { round: 9,  name: "Hungarian Grand Prix",   short: "Budapest",   country: "Hungary",       flag: "🇭🇺", trackType: "Permanent", date: "2026-08-02", isSprint: false },
  { round: 10, name: "Belgian Grand Prix",     short: "Spa",        country: "Belgium",       flag: "🇧🇪", trackType: "Permanent", date: "2026-08-23", isSprint: false },
  { round: 13, name: "Italian Grand Prix",     short: "Monza",      country: "Italy",         flag: "🇮🇹", trackType: "Permanent", date: "2026-09-06", isSprint: false },
  { round: 14, name: "Spanish Grand Prix",     short: "Barcelona",  country: "Spain",         flag: "🇪🇸", trackType: "Permanent", date: "2026-09-13", isSprint: false },
  { round: 15, name: "Azerbaijan Grand Prix",  short: "Baku",       country: "Azerbaijan",    flag: "🇦🇿", trackType: "Street",    date: "2026-09-26", isSprint: false },
  { round: 16, name: "Singapore Grand Prix",   short: "Marina Bay", country: "Singapore",     flag: "🇸🇬", trackType: "Street",    date: "2026-10-11", isSprint: false },
  { round: 17, name: "United States Grand Prix",short:"Austin",     country: "USA",           flag: "🇺🇸", trackType: "Permanent", date: "2026-10-25", isSprint: true  },
  { round: 18, name: "Mexico City Grand Prix", short: "Mexico City",country: "Mexico",        flag: "🇲🇽", trackType: "Permanent", date: "2026-11-01", isSprint: false },
  { round: 19, name: "São Paulo Grand Prix",   short: "Interlagos", country: "Brazil",        flag: "🇧🇷", trackType: "Permanent", date: "2026-11-08", isSprint: true  },
  { round: 20, name: "Las Vegas Grand Prix",   short: "Las Vegas",  country: "USA",           flag: "🇺🇸", trackType: "Street",    date: "2026-11-21", isSprint: false },
  { round: 21, name: "Qatar Grand Prix",       short: "Lusail",     country: "Qatar",         flag: "🇶🇦", trackType: "Permanent", date: "2026-11-29", isSprint: true  },
  { round: 22, name: "Abu Dhabi Grand Prix",   short: "Yas Marina", country: "UAE",           flag: "🇦🇪", trackType: "Permanent", date: "2026-12-06", isSprint: false },
];

// Pin the "next race" to Mexico City for demo. In production: pick by Date.now().
export const NEXT_RACE: RaceInfo =
  CALENDAR_2026.find((r) => r.round === 18) ?? CALENDAR_2026[0];
