export interface AuthUser {
  id: string;
  name: string;
}

let _token: string | null = null;
let _user: AuthUser | null = null;

export function setAuth(token: string, user: AuthUser) {
  _token = token;
  _user = user;
}

export function getToken(): string | null {
  return _token;
}

export function getUser(): AuthUser | null {
  return _user;
}

export function clearAuth() {
  _token = null;
  _user = null;
}
