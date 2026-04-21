export function debugLog(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(message);
  }
}
