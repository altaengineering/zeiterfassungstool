export function initialen(name: string): string {
  return name
    .split(/\s+/)
    .map((teil) => teil[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
