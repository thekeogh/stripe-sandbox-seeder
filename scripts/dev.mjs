import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const server = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "43187",
    ...process.argv.slice(2),
  ],
  { stdio: ["inherit", "pipe", "inherit"] },
);

let output = "";
let opened = false;
server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  output = (output + chunk.toString().replace(/\x1b\[[0-9;]*m/g, "")).slice(
    -8192,
  );
  const url = output.match(/Local:\s+(https?:\/\/\S+)/)?.[1];
  if (opened || !url || !/\bReady in\b/.test(output)) return;
  opened = true;
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  const browser = spawn(command, args, { stdio: "ignore" });
  const warn = () =>
    console.warn(`Could not open your browser automatically. Open ${url}`);
  browser.on("error", warn);
  browser.on("exit", (code) => {
    if (code && code !== 0) warn();
  });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", (error) => {
  console.error(`Could not start Next.js: ${error.message}`);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => {
  process.exitCode =
    code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
});
