import { Person } from "./interfaces";
import { backendRequest } from "./request"

export const getAllPersons = async (page = 1, pageSize = 10, search?: string) => {
    const query = `person?page=${page}&pageSize=${pageSize}${search ? `&search=${search}` : ""}`;
    const response = await backendRequest(query, "GET", true);
    const data = await response.json();
    return data;
};

export const updatePerson = async (data: Person) => {
    const response = await backendRequest(`person/${data.id}`, "PUT", true, data);
    return response.status;
}