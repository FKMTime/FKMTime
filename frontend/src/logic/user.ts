import { User } from "./interfaces";
import { backendRequest } from "./request";

export const getAllUsers = async (): Promise<User[]> => {
    const response = await backendRequest("user", "GET", true);
    return await response.json();
};

export const createUser = async (
    username: string,
    role: string,
    password: string,
    fullName?: string
) => {
    const response = await backendRequest("user", "POST", true, {
        username,
        role,
        password,
        fullName,
    });
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

export const updateUser = async (user: User) => {
    const response = await backendRequest(`user/${user.id}`, "PUT", true, user);
    return response.status;
};

export const deleteUser = async (id: string) => {
    const response = await backendRequest(`user/${id}`, "DELETE", true);
    return response.status;
};

export const updateUserPassword = async (id: string, password: string) => {
    const response = await backendRequest(`user/password/${id}`, "PUT", true, {
        password,
    });
    return response.status;
};
