import { NewUserData, User } from "./interfaces";
import { backendQuery, backendRequest } from "./request";

export const usersQuery = backendQuery<User[]>("user");

export const createUser = async (body: NewUserData) => {
    const response = await backendRequest("user", "POST", true, body);
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

export const updateUser = async (user: User) => {
    const response = await backendRequest(`user/${user.id}`, "PUT", true, user);
    return {
        status: response.status,
        data: await response.json(),
    };
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
