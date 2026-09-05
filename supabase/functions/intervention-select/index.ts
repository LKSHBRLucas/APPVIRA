const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
};

const API_BASE_URL = "https://api.enter.pro";
const AI_API_TOKEN_SECRET = "AI_API_TOKEN_feaa78ccc1f0";
const PROJECT_ID = "feaa78ccc1f0408e947431ca2d3f0c10";
const MODEL = "openai/gpt-5.6-luna";

const VALID_CODES = [
  "micro_start",
  "first_step",
  "implementation_intention",
  "restructuring",
  "distraction_removal",
  "cognitive_restructuring",
  "recovery",
  "replan",
];

const CATALOG_HINT = [
  "micro_start — sessão mínima de 5-15 min; ideal para tarefa grande, energia baixa, sem vontade",
  "first_step — ação física e observável; ideal quando não sabe por onde começar ou a tarefa é abstrata",
  "implementation_intention — plano SE -> ENTÃO; ideal para falhas recorrentes em contexto previsível",
  "restructuring — mudar fisicamente o ambiente; ideal para ambiente inadequado",
  "distraction_removal — remover estímulos concorrentes; ideal para preso no celular/distraído",
  "cognitive_restructuring — reformular o padrão exigente; ideal para perfeccionismo, ansiedade, medo de errar",
  "recovery — recuperar sessão perdida com versão menor, sem culpa",
  "replan — mover a atividade para uma ocasião viável hoje; ideal para horário inadequado",
].join("\n");

const SYSTEM_PROMPT = `Você é o motor de personalização do VIRA, um app comportamental contra procrastinação. Sua tarefa: escolher a intervenção mais adequada para o usuário AGORA, usando os dados reais dele (histórico de intervenções, obstáculos frequentes e check-ins).

Códigos válidos e quando usá-los:
${CATALOG_HINT}

Regras rígidas:
- Responda APENAS com JSON válido no formato: {"code":"<codigo>","rationale":"<pt-BR, 1-2 frases curtas, operacional, sem julgamento>"}.
- Considere a combinação de obstáculos como um todo, não cada um isoladamente.
- Use o histórico do usuário (interventionHistory) como sinal forte: prefira intervenções com boa taxa de conclusão para ELE; evite as que falharam repetidamente.
- Obstáculos frequentes (obstacleFrequency) reforçam qual barreira tratar primeiro.
- Se o histórico for vazio ou pequeno, use bom senso comportamental: menor custo possível para começar.
- Nunca invente dados, nunca faça diagnóstico clínico. Não é terapia.
- Escolha EXATAMENTE um dos códigos válidos.`;

function extractJson(text: string): { code?: string; rationale?: string } | null {
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

  try {
    const AI_API_TOKEN = Deno.env.get(AI_API_TOKEN_SECRET);
    if (!AI_API_TOKEN) {
      throw new Error("AI_API_TOKEN is not configured");
    }

    const upstreamSessionID =
      req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const body = await req.json();

    const userMessage = [
      `Obstáculos selecionados: ${(body.obstacles ?? []).join(", ")}`,
      body.note ? `Nota do usuário: ${body.note}` : null,
      body.task?.title
        ? `Tarefa: ${body.task.title}${body.task.first_step ? ` — primeiro passo sugerido: ${body.task.first_step}` : ""}`
        : null,
      body.context
        ? `Contexto real do usuário:\n${JSON.stringify(body.context)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const upstream = await fetch(
      `${API_BASE_URL}/code/api/v1/ai/chat/completions`,
      {
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
          temperature: 0.2,
          max_tokens: 300,
        }),
      },
    );

    if (!upstream.ok) {
      let errorMessage = "AI service error";
      const text = await upstream.text();
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        /* keep default */
      }
      return jsonResponse(
        { error: { message: errorMessage, type: "api_error" } },
        upstream.status,
      );
    }

    const data = await upstream.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const picked = extractJson(content);
    if (!picked || !VALID_CODES.includes(picked.code ?? "")) {
      return jsonResponse(
        {
          error: {
            message: "Model returned an invalid intervention code",
            type: "invalid_request_error",
          },
        },
        422,
      );
    }

    return jsonResponse({
      code: picked.code,
      rationale: typeof picked.rationale === "string" ? picked.rationale : "",
    });
  } catch (error) {
    return jsonResponse(
      { error: { message: (error as Error).message ?? "internal error", type: "api_error" } },
      500,
    );
  }
});
