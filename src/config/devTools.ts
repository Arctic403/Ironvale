/**
 * RiftCity development-tool switches.
 *
 * IMPORTANT: this is a convenience kill switch, not authentication.
 * Before a public production launch, also protect/remove the dev editor at
 * the Cloudflare/server layer so /dev-editor cannot be served publicly.
 */
export const DEV_TOOLS = {
  enabled: true,
  route: "/admin-dev",
  editorPath: "/dev-editor/index.html",
} as const;
