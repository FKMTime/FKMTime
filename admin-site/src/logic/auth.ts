import { backendRequest } from "./request";

const TOKEN_NAME = "fkmtime-token";
const USER_INFO_NAME = "fkmtime-userInfo";
export const login = async (
  username: string,
  password: string
): Promise<number> => {
  const response = await backendRequest("auth/login", "POST", false, {
    username: username,
    password: password,
  });
  if (response.status === 200) {
    const data = await response.json();
    localStorage.setItem(TOKEN_NAME, data.token);
    localStorage.setItem(USER_INFO_NAME, JSON.stringify(data.userInfo));
  }
  return response.status;
};

export const getToken = () => {
  return localStorage.getItem(TOKEN_NAME);
};

export const logout = async () => {
  localStorage.removeItem(TOKEN_NAME);
  localStorage.removeItem(USER_INFO_NAME);
};

export const isUserLoggedIn = () => {
  return localStorage.getItem(TOKEN_NAME) !== null;
};

export const getUserInfo = () => {
  const userInfo = localStorage.getItem(USER_INFO_NAME);
  if (userInfo === null) {
    return null;
  }
  return JSON.parse(userInfo);
};