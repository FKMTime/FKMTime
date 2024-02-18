import { Account } from "./interfaces";
import { backendRequest } from "./request";

export const getAllAccounts = async (): Promise<Account[]> => {
  const response = await backendRequest("account", "GET", true);
  const data = await response.json();
  return data;
};

export const createAccount = async (email: string, username: string, role: string, password: string) => {
  const response = await backendRequest("auth/register", "POST", true, {
    email,
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
  const response = await backendRequest(`account/${account.id}`, "PUT", true, account);
  return response.status;
};

export const deleteAccount = async (id: number) => {
  const response = await backendRequest(`account/${id}`, "DELETE", true);
  return response.status;
};
