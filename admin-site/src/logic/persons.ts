import { Person } from "./interfaces";
import { backendRequest } from "./request";

export const getPersons = async (
  page = 1,
  pageSize = 10,
  search?: string
) => {
  const query = `person?page=${page}&pageSize=${pageSize}${
    search ? `&search=${search}` : ""
  }`;
  const response = await backendRequest(query, "GET", true);
  return await response.json();
};

export const getAllPersons = async () => {
  const response = await backendRequest("person/all", "GET", true);
  return await response.json();
};

export const getPersonsWithoutCardAssigned = async () => {
  const response = await backendRequest("person/without-card", "GET", true);
  return await response.json();
};

export const updatePerson = async (data: Person) => {
  const response = await backendRequest(`person/${data.id}`, "PUT", true, data);
  return response.status;
};

export const assignManyCards = async (data: Person[]) => {
  const response = await backendRequest("person/card/assign-many", "PUT", true, {
    persons: data,
  });
  return response.status;
}