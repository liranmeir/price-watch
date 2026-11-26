/** RFC 9728 protected resource metadata, pointing clients at this app's own AS. */
import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler';

const handler = protectedResourceHandler({
  authServerUrls: [process.env.APP_URL ?? ''],
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
