import { Competition } from "@wca/helpers";
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

export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
  const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
  return `${hours}:${minutes}`;
};

export const getPersonFromWcif = (registrantId: number, wcif: Competition) => {
  return wcif.persons.find(person => person.registrantId === registrantId);
};

export const getPrettyCompetitionEndDate = (startDate: string, numberOfDays: number) => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + numberOfDays - 1);
  return date.toLocaleDateString();
};