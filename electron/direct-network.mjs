export function directConnectionEnvironment(environment) {
  const direct = { ...environment };
  for (const name of Object.keys(direct)) {
    if (/^(?:(?:https?|all|ftp)_proxy|npm_config_(?:https?_)?proxy|global_agent_(?:https?_proxy|environment_variable_namespace))$/i.test(name)) direct[name] = "";
  }
  return { ...direct, HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "", NO_PROXY: "*", no_proxy: "*", NODE_USE_ENV_PROXY: "0", GLOBAL_AGENT_HTTP_PROXY: "", GLOBAL_AGENT_HTTPS_PROXY: "", GLOBAL_AGENT_NO_PROXY: "*" };
}
