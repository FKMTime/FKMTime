import { backendRequest } from "./request";

export const login = async (
  username: string,
  password: string
) => {
  const response = await backendRequest("auth/login", "POST", false, {
    username: username,
    password: password,
  });
  return await response.json();
};

export const logout = async () => {
  localStorage.removeItem("token");
};

export const isUserLoggedIn = () => {
  return localStorage.getItem("token") !== null;
};

export const getUserInfo = () => {
  const userInfo = localStorage.getItem("userInfo");
  if (userInfo === null) {
    return null;
  }
  return JSON.parse(userInfo);
};