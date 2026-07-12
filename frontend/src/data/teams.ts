export type TeamId =
  | "mercedes"
  | "ferrari"
  | "red_bull"
  | "mclaren"
  | "alpine"
  | "rb"
  | "williams"
  | "haas"
  | "aston_martin"
  | "audi"
  | "cadillac";

export const TEAMS: Record<
  TeamId,
  { name: string; short: string; color: string; carRank: number }
> = {
  ferrari:      { name: "Ferrari",         short: "FER", color: "#ED1131", carRank: 2 },
  mercedes:     { name: "Mercedes",        short: "MER", color: "#00D7B6", carRank: 1 },
  red_bull:     { name: "Red Bull Racing", short: "RBR", color: "#4781D7", carRank: 3 },
  mclaren:      { name: "McLaren",         short: "MCL", color: "#F47600", carRank: 4 },
  williams:     { name: "Williams",        short: "WIL", color: "#1868DB", carRank: 5 },
  aston_martin: { name: "Aston Martin",    short: "AST", color: "#229971", carRank: 6 },
  rb:           { name: "VCARB",           short: "VCARB", color: "#6C98FF", carRank: 7 },
  alpine:       { name: "Alpine",          short: "ALP", color: "#00A1E8", carRank: 8 },
  haas:         { name: "Haas F1 Team",    short: "HAA", color: "#9C9FA2", carRank: 9 },
  audi:         { name: "Audi",            short: "AUD", color: "#F50537", carRank: 10 },
  cadillac:     { name: "Cadillac",        short: "CAD", color: "#909090", carRank: 11 },
};
