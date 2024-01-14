import { backendRequest } from "./request";

export const getResultsByRoundId = async (
  roundId: string,
  search?: string,
  groupId?: string
) => {
  let route = `result/round/${roundId}`;
  const params = [];
  if (search && search.length > 0) {
    params.push(`search=${search}`);
  }
  if (groupId) {
    params.push(`groupId=${groupId}`);
  }
  const paramsString = params.join("&");
  if (paramsString.length > 0) {
    route += `?${paramsString}`;
  }
  const response = await backendRequest(route, "GET", true);
  return await response.json();
};

export const getResultById = async (id: number) => {
  const response = await backendRequest(`result/${id}`, "GET", true);
  return await response.json();
};
