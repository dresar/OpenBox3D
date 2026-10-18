export interface AuthConfig {
  username: string;
  password: string;
}

export const authConfig: AuthConfig = {
  username: 'INDAH',
  password: 'INDAH1234',
};

export const AUTH_CONFIG = authConfig;
export const DEFAULT_CREDENTIALS = authConfig;
export default authConfig;
