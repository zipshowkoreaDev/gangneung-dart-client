export function stripDisplayName(name: string): string {
  const [base] = name.split("#");
  return base || name;
}
