const SAFE_ENV = { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LC_ALL: "C" };
const MAX_OUTPUT_CHARS = 200_000;

export async function run(argv: readonly string[], timeoutMs = 10_000): Promise<string> {
  const process = Bun.spawn([...argv], {
    env: SAFE_ENV,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${argv[0]} exited with ${code}: ${stderr.trim().slice(0, 500)}`);
  }
  return stdout.length > MAX_OUTPUT_CHARS ? stdout.slice(-MAX_OUTPUT_CHARS) : stdout;
}
