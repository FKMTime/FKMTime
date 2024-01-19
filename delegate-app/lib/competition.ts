import { backendRequest } from "./request";

export const getCompetitionInfo = async () => {
  const response = await backendRequest("competition", "GET", true);
  return await response.json();
};
