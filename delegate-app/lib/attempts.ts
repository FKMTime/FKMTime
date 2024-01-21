import { Attempt } from "./interfaces";
import { backendRequest } from "./request";

export const getUnresolvedAttempts = async () => {
  const response = await backendRequest("attempt/unresolved", "GET", true);
  return await response.json();
};

export const getAttemptById = async (id: number) => {
  const response = await backendRequest(`attempt/${id}`, "GET", true);
  return await response.json();
};

export const updateAttempt = async (data: Attempt) => {
  const response = await backendRequest(`attempt/${data.id}`, "PUT", true, data);
  return response.status;
};