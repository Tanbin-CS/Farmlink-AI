/** Public, non-secret build configuration. No API keys may ever be read here. */
const rawApi = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

export const config = {
  apiBaseUrl: rawApi.replace(/\/+$/, ''),
  buildSha: (import.meta.env.VITE_BUILD_SHA as string | undefined) || 'local-dev',
  repoUrl: (import.meta.env.VITE_REPO_URL as string | undefined) || 'https://github.com/Tanbin-CS/Farmlink-AI',
  basePath: import.meta.env.BASE_URL,
};

export const liveModeConfigured = config.apiBaseUrl.length > 0;
