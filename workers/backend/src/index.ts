import type { Env, AgentEvent, WSMessage } from './types';
import { runAgent } from './agent';
import { listRoles } from './roles';
import { listSkills, categorize, shortDescription } from './skills';
import { listProviders } from './providers';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket endpoint
    if (url.pathname === '/ws') {
      return handleWebSocket(request, env);
    }

    // REST API endpoints
    if (url.pathname === '/api/roles') {
      return jsonResponse(listRoles());
    }
    if (url.pathname === '/api/skills') {
      const categorized = categorize();
      const flat = categorized.flatMap(([cat, skills]) =>
        skills.map(s => ({ name: s.name, description: shortDescription(s.description), category: cat }))
      );
      return jsonResponse({ categories: categorized.map(([c, skills]) => ({ category: c, skills: skills.map(s => s.name) })), skills: flat });
    }
    if (url.pathname === '/api/providers') {
      return jsonResponse(listProviders().map(p => ({ name: p.name, title: p.title, description: p.description })));
    }

    // Everything else (static files) is handled by the assets binding
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

  server.accept();

  let role: string | undefined;
  let skill: string | undefined;
  let language = 'zh';

  server.addEventListener('message', async (event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data as string);

      switch (msg.type) {
        case 'session':
          role = msg.role || role;
          skill = msg.skill || skill;
          language = msg.language || language;
          server.send(JSON.stringify({ type: 'session', role, skill, language }));
          break;

        case 'set_role':
          role = msg.role;
          server.send(JSON.stringify({ type: 'role_set', role }));
          break;

        case 'set_skill':
          skill = msg.skill;
          server.send(JSON.stringify({ type: 'skill_set', skill }));
          break;

        case 'list_roles':
          server.send(JSON.stringify({ type: 'roles', roles: listRoles().map(r => ({ name: r.name, title: r.title })) }));
          break;

        case 'list_skills': {
          const cats = categorize();
          server.send(JSON.stringify({ type: 'skills', categories: cats.map(([c, skills]) => ({ category: c, skills: skills.map(s => s.name) })) }));
          break;
        }

        case 'list_providers':
          server.send(JSON.stringify({ type: 'providers', providers: listProviders().map(p => ({ name: p.name, title: p.title })) }));
          break;

        case 'message':
          if (!msg.content) break;
          const generator = runAgent(msg.content, { role, skill, language }, env);
          for await (const ev of generator) {
            if (server.readyState === WebSocket.OPEN) {
              server.send(JSON.stringify(ev));
            }
          }
          if (server.readyState === WebSocket.OPEN) {
            server.send(JSON.stringify({ type: 'done' }));
          }
          break;
      }
    } catch (err) {
      if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({ type: 'error', content: String(err) }));
      }
    }
  });

  server.addEventListener('close', () => {});
  server.addEventListener('error', () => {});

  return new Response(null, { status: 101, webSocket: client });
}
