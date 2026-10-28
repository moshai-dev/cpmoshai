export function promptSecret(label: string): Promise<string> {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) {
    return Promise.reject(new Error("This command needs an interactive terminal"));
  }
  stderr.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve) => {
    let input = "";
    const finish = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stderr.write("\n");
    };
    const onData = (chunk: Buffer): void => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          finish();
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(input);
          return;
        }
        input = char === "\u007f" ? input.slice(0, -1) : input + char;
      }
    };
    stdin.on("data", onData);
  });
}
