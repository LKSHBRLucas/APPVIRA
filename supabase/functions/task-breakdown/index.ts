const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
};

const API_BASE_URL = "https://api.enter.pro";
const AI_API_TOKEN_SECRET = "AI_API_TOKEN_feaa78ccc1f0";
const PROJECT_ID = "feaa78ccc1f0408e947431ca2d3f0c10";
const MODEL = "openai/gpt-5.6-luna";

const MIN_STEPS = 3;
const MAX_STEPS = 5;

const SYSTEM_PROMPT = `Você é o motor de quebra de tarefas do VIRA, um app comportamental contra procrastinação. A pessoa está travada porque a tarefa parece grande demais ou ela não sabe por onde começar.

Sua única tarefa: transformar a tarefa abstrata em ${MIN_STEPS} a ${MAX_STEPS} passos concretos, pequenos e na ordem em que devem ser feitos.

Regras rígidas:
- Responda APENAS com JSON válido no formato: {"steps": ["passo 1", "passo 2", ...]}.
- Cada passo deve ser uma ação física e observável (algo que dá para checar "fiz" ou "não fiz"), nunca abstrata (ex.: "avançar no projeto" não vale; "abrir o arquivo X e escrever o primeiro parágrafo" vale).
- O primeiro passo deve ser propositalmente pequeno (fazível em até 5-15 minutos), para reduzir a barreira de início.
- Responda em pt-BR, frases curtas, sem numeração dentro do texto (a numeração é a posição no array).
- Nunca invente detalhes específicos que a pessoa não informou (nomes de arquivos, ferramentas, pessoas) — mantenha os passos genéricos o suficiente para a tarefa descrita.
- Nunca faça diagnóstico clínico, nunca seja motivacional genérico ("você consegue!"). Seja operacional.`;

function extractJson(text: string): { steps?: unknown } | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* fallthrough to regex */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeSteps(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const steps = value
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_STEPS);
  return steps.length >= MIN_STEPS - 1 ? steps : null; // tolerate 2 in edge cases
}

/** Rule-based fallback when the LLM is unavailable or returns something invalid. */
function buildFallback(title: string, firstStep?: string | null): string[] {
  const steps = [
    firstStep?.trim() || `Abrir/preparar tudo que "${title}" exige para começar`,
    "Fazer a primeira parte pequena (5-15 min), sem se preocupar com o resto ainda",
    "Revisar o que foi feito e marcar o que falta em uma lista simples",
    "Fazer a próxima parte da lista, também em um bloco pequeno de tempo",
    "Fechar com uma checagem final e marcar a tarefa como concluída",
  ];
  return steps;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: { title?: string; first_step?: string | null; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
      400,
    );
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return jsonResponse(
      { error: { message: "Missing required field: title", type: "invalid_request_error" } },
      422,
    );
  }

  try {
    const AI_API_TOKEN = Deno.env.get(AI_API_TOKEN_SECRET);
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const upstreamSessionID =
      req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();

    const userMessage = [
      `Tarefa: ${title}`,
      body.first_step ? `Primeiro passo já definido pela pessoa: ${body.first_step}` : null,
      body.note ? `Nota da pessoa sobre o que trava: ${body.note}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const upstream = await fetch(`${API_BASE_URL}/code/api/v1/ai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Session-ID": upstreamSessionID,
        "X-Enter-Project-ID": PROJECT_ID,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!upstream.ok) {
      return jsonResponse({
        steps: buildFallback(title, body.first_step),
        source: "fallback",
      });
    }

    const data = await upstream.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const steps = normalizeSteps(parsed?.steps);

    if (!steps) {
      return jsonResponse({ steps: buildFallback(title, body.first_step), source: "fallback" });
    }

    return jsonResponse({ steps, source: "model" });
  } catch (_error) {
    return jsonResponse({ steps: buildFallback(title, body.first_step), source: "fallback" });
  }
});
