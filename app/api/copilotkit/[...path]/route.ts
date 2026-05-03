// Catch-all for CopilotKit sub-paths (e.g. /api/copilotkit/info).
import { buildHandler } from "../route";

const handler = buildHandler();
export const GET = handler;
export const POST = handler;
