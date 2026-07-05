export function getCloudflareAiStatus() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID;

  return {
    configured: !!(accountId && apiToken),
    accountIdSet: !!accountId,
    apiTokenSet: !!apiToken,
    model,
    gatewayId: gatewayId || null,
    parserMode: accountId && apiToken ? 'cloudflare' : 'heuristic',
    hint: accountId && apiToken
      ? 'Cloudflare AI is configured for job description parsing.'
      : 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for AI-powered JD parsing. Heuristic fallback is used until then.',
  };
}
