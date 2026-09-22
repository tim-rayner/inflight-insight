export interface Fr24Credentials {
  apiToken: string;
}

export function getFr24Headers({ apiToken }: Fr24Credentials): Record<string, string> {
  if (apiToken.trim() === "") {
    throw new Error("FR24 API token is not configured");
  }

  return {
    Accept: "application/json",
    "Accept-Version": "v1",
    Authorization: `Bearer ${apiToken}`,
  };
}
