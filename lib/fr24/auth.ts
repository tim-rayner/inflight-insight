export interface Fr24Credentials {
  apiToken: string;
}

/**
 * gets API headers for FR24 API requests
 * @param apiToken - FR24 API token
 * @returns Record<string, string> - API headers
 */
export function getFr24Headers({
  apiToken,
}: Fr24Credentials): Record<string, string> {
  if (apiToken.trim() === "") {
    throw new Error("FR24 API token is not configured");
  }

  return {
    Accept: "application/json",
    "Accept-Version": "v1",
    Authorization: `Bearer ${apiToken}`,
  };
}
