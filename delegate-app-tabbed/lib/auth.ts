import { backendRequest } from "./request";

export const login = async (
  username: string,
  password: string
) => {
  const response = await backendRequest("auth/login", "POST", false, {
    username: username,
    password: password,
  });
  return {
    status: response.status,
    data: await response.json(),
  };
};
