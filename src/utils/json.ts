export type JsonObject = Record<string, unknown>;

export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readJsonObject = async (request: Request): Promise<JsonObject> => {
  try {
    const value = await request.json();
    return isJsonObject(value) ? value : {};
  } catch {
    return {};
  }
};

export const getErrorMessage = (value: unknown, fallback: string): string => {
  if (!isJsonObject(value)) return fallback;
  return typeof value.error === 'string' && value.error.trim() ? value.error : fallback;
};
