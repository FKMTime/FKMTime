export const SKIPPED_VALUE = 0;
export const DNF_VALUE = -1;
export const DNS_VALUE = -2;
export const AVAILABLE_PENALTIES = [
    { value: 0, label: "No penalty", shortVersion: "-" },
    { value: 2, label: "+2" },
    { value: DNF_VALUE, label: "DNF" },
    { value: DNS_VALUE, label: "DNS" },
    { value: 4, label: "+4" },
    { value: 6, label: "+6" },
    { value: 8, label: "+8" },
    { value: 10, label: "+10" },
    { value: 12, label: "+12" },
    { value: 14, label: "+14" },
    { value: 16, label: "+16" },
];
export const CUTOFF_ALLOWED = ["a", "m"];
export const GITHUB_URL = "https://github.com/FKMTime/FKMTime";
export const THEME_STORAGE_KEY = "fkmtime-theme";
export const POSSIBLE_GENDERS = ["m", "f", "o"];
