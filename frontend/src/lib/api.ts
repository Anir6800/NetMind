export type Health = { status: string; environment: string };

export async function getHealth(): Promise<Health> {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Backend health check failed");
  return response.json() as Promise<Health>;
}
