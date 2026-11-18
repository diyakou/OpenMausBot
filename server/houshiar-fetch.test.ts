import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { fetchHoushiarDirect } from "./houshiar-fetch.ts";
import { directConnectionEnvironment } from "../electron/direct-network.mjs";

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); } });
const listen = async (server: Server) => {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

it("bypasses even a configured global HTTP proxy with a direct dispatcher", async () => {
  let proxyRequests = 0;
  const proxyServer = createServer((_req, res) => { proxyRequests++; res.writeHead(502).end(); });
  proxyServer.on("connect", (_req, socket) => { proxyRequests++; socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); });
  const proxy = await listen(proxyServer);
  const target = await listen(createServer((_req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ data: [{ id: "fixture-model" }] })); }));
  const previous = getGlobalDispatcher();
  const intercepted = new EnvHttpProxyAgent({ httpProxy: proxy, httpsProxy: proxy, noProxy: "" });
  setGlobalDispatcher(intercepted);
  try {
    const response = await fetchHoushiarDirect(`${target}/models`, { signal: AbortSignal.timeout(3000) });
    expect(await response.json()).toEqual({ data: [{ id: "fixture-model" }] });
    expect(proxyRequests).toBe(0);
  } finally { setGlobalDispatcher(previous); await intercepted.close(); }
});

it("overrides proxy environment variables without changing unrelated credentials or the parent", () => {
  const source = { HTTPS_PROXY: "http://fixture-proxy:8", https_proxy: "http://fixture-proxy:9", ALL_PROXY: "socks5://fixture-proxy:10", NODE_USE_ENV_PROXY: "1", NO_PROXY: "example.test", npm_config_proxy: "http://fixture-proxy:11", HOUSHIAR_API_KEY: "fixture-key" };
  const direct = directConnectionEnvironment(source);
  expect(direct).toMatchObject({ HTTPS_PROXY: "", https_proxy: "", ALL_PROXY: "", HTTP_PROXY: "", http_proxy: "", NODE_USE_ENV_PROXY: "0", NO_PROXY: "*", no_proxy: "*", npm_config_proxy: "", HOUSHIAR_API_KEY: "fixture-key" });
  expect(source.HTTPS_PROXY).toBe("http://fixture-proxy:8");
});
