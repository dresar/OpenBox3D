export interface AuthConfig {
  username: string;
  password: string;
}

export const authConfig: AuthConfig = {
  username: 'admin',
  password: 'openbox3d',
};

export const AUTH_CONFIG = authConfig;
export const DEFAULT_CREDENTIALS = authConfig;
export default authConfig;
