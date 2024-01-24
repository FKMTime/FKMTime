const BACKEND_URL = "http://10.119.71.68:5000/";
//const BACKEND_URL = "http://192.168.2.39:5000/";

export const backendRequest = (
  path: string,
  method: string,
  useAuth: boolean,
  body?: unknown,
) => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwNjExNDM1OSwiZXhwIjoxNzA4NzA2MzU5fQ.M5JEQjzMUsyag9SBB7zY2E3Wim1k2PJcxmi-ZM0PVxY";
  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  if (token && useAuth) {
    headers.append("Authorization", `Bearer ${token}`);
  }
  return fetch(`${BACKEND_URL}${path}`, {
    method: method,
    headers: headers,
    redirect: "follow",
    body: JSON.stringify(body),
  });
};
