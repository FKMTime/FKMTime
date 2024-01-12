import { Competition } from "./interfaces";
import { backendRequest } from "./request";

export const getCompetitionInfo = async () => {
  const response = await backendRequest("competition", "GET", true);
  const data = await response.json();
  return {
    status: response.status,
    data,
  };
};

export const importCompetition = async (id: string) => {
  const response = await backendRequest(
    `competition/import/${id}`,
    "GET",
    true
  );
  const data = await response.json();
  return {
    status: response.status,
    data,
  };
};

export const syncCompetition = async (id: string) => {
  const response = await backendRequest(`competition/sync/${id}`, "GET", true);
  return response.status;
};

export const updateCompetition = async (id: number, data: Competition) => {
  const response = await backendRequest(
    `competition/update/${id}`,
    "PUT",
    true,
    data
  );
  return response.status;
};


