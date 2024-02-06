const BACKEND_URL = "http://10.119.70.139:5000/";
//const BACKEND_URL = "http://192.168.2.39:5000/";

export const backendRequest = (
  path: string,
  method: string,
  useAuth: boolean,
  body?: unknown,
) => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJERUxFR0FURSIsImlhdCI6MTcwNzIyNTQ1OCwiZXhwIjoxNzA5ODE3NDU4fQ.pUHDdvL-nh4TFvIUGVsrR7HaukdLczD8GdrVZymQci0";
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
