interface Closable {
  close(): Promise<void>;
}

export async function closePlayerMotionScenario({
  clients,
  server,
}: {
  clients: readonly Closable[];
  server: Closable | undefined;
}): Promise<void> {
  const results = await Promise.allSettled(clients.map(async (client) => client.close()));
  const failures: unknown[] = [];
  for (const result of results) {
    if (result.status === 'rejected') {
      failures.push(result.reason);
    }
  }
  try {
    await server?.close();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, 'Player motion scenario cleanup failed');
  }
}
