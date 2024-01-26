import { Competition, Round } from "@wca/helpers";
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
  return regions.find((region) => region.iso2 === iso2)?.name;
};

export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
  const minutes =
    date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
  return `${hours}:${minutes}`;
};

export const getPersonFromWcif = (registrantId: number, wcif: Competition) => {
  return wcif.persons.find((person) => person.registrantId === registrantId);
};

export const getPrettyCompetitionEndDate = (
  startDate: string,
  numberOfDays: number
) => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + numberOfDays - 1);
  return date.toLocaleDateString();
};

export const getNumberOfAttemptsForRound = (round: Round): number => {
  switch (round.format) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "a":
      return 5;
    case "m":
      return 3;
  }
};

export const prettyRoundFormat = (format: string, cutoffAttempts?: number) => {
  switch (format) {
    case "1":
      return "Best of 1";
    case "2":
      return "Best of 2";
    case "3":
      return "Best of 3";
    case "a":
      if (!cutoffAttempts) {
        return `Average of 5`;
      }
      return `Best of ${cutoffAttempts} / Average of 5`;
    case "m":
      return "Mean of 3";
  }
};
