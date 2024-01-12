import regions from "./regions";

export const calculateTotalPages = (count: number, pageSize: number) => {
  return Math.ceil(count / pageSize);
};

export const prettyGender = (gender: string) => {
  switch (gender) {
    case "m":
      return "Male";
    case "f":
      return "Female";
    default:
      return "Other";
  }
};

export const regionNameByIso2 = (iso2: string) => {
    return regions.find(region => region.iso2 === iso2)?.name;
};
