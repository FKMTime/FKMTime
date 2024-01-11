import { backendRequest } from "./request";

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
    localStorage.setItem("token", data.token);
    localStorage.setItem("userInfo", JSON.stringify(data.userInfo));
  }
  return response.status;
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