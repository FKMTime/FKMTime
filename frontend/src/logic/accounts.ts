import { Account } from "./interfaces";
import { backendRequest } from "./request";

export const HAS_WRITE_ACCESS = ["ADMIN", "DELEGATE"];
export const getAllAccounts = async (): Promise<Account[]> => {
    const response = await backendRequest("account", "GET", true);
    return await response.json();
};

export const createAccount = async (
    username: string,
    role: string,
    password: string
) => {
    const response = await backendRequest("auth/register", "POST", true, {
        username,
        role,
        password,
    });
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

export const updateAccount = async (account: Account) => {
    const response = await backendRequest(
        `account/${account.id}`,
        "PUT",
        true,
        account
    );
    return response.status;
};

export const deleteAccount = async (id: string) => {
    const response = await backendRequest(`account/${id}`, "DELETE", true);
    return response.status;
};

export const updateAccountPassword = async (id: string, password: string) => {
    const response = await backendRequest(
        `account/${id}/password`,
        "PUT",
        true,
        { password }
    );
    return response.status;
};
