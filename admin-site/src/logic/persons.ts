import { Person } from "./interfaces";
import { backendRequest } from "./request"

export const getAllPersons = async (page = 1, pageSize = 10) => {
    const response = await backendRequest(`person?page=${page}&pageSize=${pageSize}`, "GET", true);
    const data = await response.json();
    return data;
};

export const updatePerson = async (data: Person) => {
    const response = await backendRequest(`person/${data.id}`, "PUT", true, data);
    return response.status;
}