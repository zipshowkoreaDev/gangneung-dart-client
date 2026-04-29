export function stripDisplayName(name: string): string {
  const [base] = name.split("#");
  return base || name;
}

export function formatDuplicateDisplayNames<T>(
  items: T[],
  getName: (item: T) => string
): string[] {
  const baseNames = items.map((item) => stripDisplayName(getName(item)));
  const totalCounts = new Map<string, number>();
  const currentCounts = new Map<string, number>();

  baseNames.forEach((name) => {
    totalCounts.set(name, (totalCounts.get(name) ?? 0) + 1);
  });

  return baseNames.map((name) => {
    const nextCount = (currentCounts.get(name) ?? 0) + 1;
    currentCounts.set(name, nextCount);

    if ((totalCounts.get(name) ?? 0) <= 1) {
      return name;
    }

    return `${name} (${nextCount})`;
  });
}
