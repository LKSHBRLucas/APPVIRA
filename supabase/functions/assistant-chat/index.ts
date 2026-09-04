const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
};

const API_BASE_URL = "https://api.enter.pro";
const AI_API_TOKEN_SECRET = "AI_API_TOKEN_feaa78ccc1f0";
const PROJECT_ID = "feaa78ccc1f0408e947431ca2d3f0c10";
const MODEL = "alibaba/qwen-3.8-max";

const SYSTEM_PROMPT = `Você é o assistente do VIRA, um app comportamental contra procrastinação. Seu papel: ajudar a pessoa a IDENTIFICAR o que está travando o início de uma tarefa e dar UM próximo passo concreto e iniciável.

Regras rígidas:
- Responda em pt-BR, em no máximo 3-5 frases curtas e diretas.
- NUNCA faça diagnóstico clínico. NUNCA invente evidências ou cite pesquisas específicas.
- Não seja genérico/motivacional. Seja operacional: o que fazer AGORA, em até 5-15 minutos.
- Se detectar sofrimento intenso ou risco (frases como "não aguento mais", "vou me machucar", "não vale a pena viver"), interrompa o fluxo normal e oriente a procurar ajuda profissional e o CVV (ligue 188), com tom calmo.
- Não substitui terapia nem apoio profissional.
- Contexto permitido: tarefas, obstáculos (celular, cansaço, perfeccionismo, ansiedade, tarefa grande), planos SE→ENTÃO, sessões de foco.`;

const CRISIS_KEYWORDS = [
  "não aguento mais",
  "nao aguento mais",
  "vou me machucar",
  "vou me matar",
  "não quero viver",
  "nao quero viver",
  "acabar com minha vida",
  "não vale a pena viver",
  "quero sumir",
  "suicíd",
];

const CRISIS_RESPONSE = `Parece que você está passando por um momento muito difícil. O que você está sentindo é importante e você não precisa lidar com isso sozinho(a).

Procure agora o CVV — Centro de Valorização da Vida — ligando para o 188 (gratuito, 24h). Você também pode acessar cvv.org.br para conversar por chat.

Se houver risco imediato, procure o serviço de emergência mais próximo. Você importa, e pedir ajuda é um ato de coragem, não de fraqueza.`;

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/** Serialize one SSE data frame: "data: {json}\n\n" */
function sseFrame(payload: unknown): string {
  return "data: " + JSON.stringify(payload) + "\n\n";
}

/** Build a minimal OpenAI-style chunk used for fallback/crisis streaming. */
function chunk(content: string, finishReason: string | null) {
  return {
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        delta: finishReason ? {} : { role: "assistant", content },
        finish_reason: finishReason,
      },
    ],
  };
}

/** Rule-based fallback when the LLM is unavailable — short, action-oriented. */
function buildFallback(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("grande") || lower.includes("muita coisa") || lower.includes("enorme")) {
    return "A tarefa parece grande porque você está enxergando tudo de uma vez. Reduza: escolha um pedaço e faça só 15 minutos dele agora. Qual é o menor pedaço possível?";
  }
  if (lower.includes("celular") || lower.includes("distra")) {
    return "Celular é o estímulo mais forte competindo com a tarefa. Guarde-o em outro cômodo (não só do lado), ative o modo foco e comece por 5 minutos.";
  }
  if (lower.includes("cansa") || lower.includes("sem energia") || lower.includes("sono")) {
    return "Cansaço não precisa virar desistência: uma sessão de 5 minutos exige menos energia do que parece. Combine com você mesmo(a): 5 minutos e depois você decide.";
  }
  if (lower.includes("perfeit") || lower.includes("medo de errar") || lower.includes("ansios")) {
    return "Exigência alta aumenta o custo de começar. Defina agora a versão mínima aceitável — o feio e funcional — e comece por ela. Perfeição vem depois, começar vem antes.";
  }
  if (lower.includes("não sei") || lower.includes("nao sei") || lower.includes("por onde")) {
    return "Falta um ponto de partida concreto. Defina UMA ação física e observável (ex.: abrir o arquivo, pegar o caderno, resolver a primeira questão) e faça só isso.";
  }
  return "Vamos direto ao ponto: o que exatamente você precisa começar? Descreva em uma frase. Depois, defina o primeiro passo físico (abrir, escrever, montar) e faça 10 minutos dele. Começar reduz a resistência — não espere a vontade aparecer.";
}

function streamResponse(...frames: string[]): Response {
  const body = frames.join("") + "data: [DONE]\n\n";
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
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
    const { messages } = await req.json();

    const lastUserText =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")
        ?.content ?? "";

    if (detectCrisis(lastUserText)) {
      return streamResponse(
        sseFrame(chunk(CRISIS_RESPONSE, null)),
        sseFrame(chunk("", "stop")),
      );
    }

    const upstreamBody = {
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      temperature: 0.4,
    };

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
        body: JSON.stringify(upstreamBody),
      },
    );

    if (!upstream.ok) {
      const text = await upstream.text();
      let errorMessage = "AI service error";
      let errorCode = "api_error";

      const dataMatch = text.match(/data: (.+)/);
      if (dataMatch) {
        try {
          const errorData = JSON.parse(dataMatch[1]);
          errorMessage = errorData.error?.message || errorMessage;
          errorCode = errorData.error?.type || errorCode;
        } catch {
          /* use defaults */
        }
      }

      const errorSSE = "event: error\n\n" +
        sseFrame({ error: { message: errorMessage, type: errorCode } });

      return new Response(errorSSE, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    const fallback = buildFallback("fallback");
    return streamResponse(sseFrame(chunk(fallback, null)), sseFrame(chunk("", "stop")));
  }
});
