const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    console.log("Flashcard function started");

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "POST requests only.",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    console.log(
      "OpenAI key exists:",
      Boolean(apiKey)
    );

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is missing from Supabase."
      );
    }

    const body = await req.json();

    const topic = String(
      body?.topic || ""
    ).trim();

    const amount = Math.min(
      Math.max(
        Number(body?.amount) || 10,
        1
      ),
      20
    );

    const difficulty = String(
      body?.difficulty || "mixed"
    );

    console.log(
      "Generating cards:",
      topic,
      amount,
      difficulty
    );

    if (!topic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please provide a topic.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const prompt = `
You are a sixth-form revision assistant.

Generate ${amount} high-quality multiple-choice
revision questions about:

${topic}

Difficulty: ${difficulty}

Each question must contain:

question
option_a
option_b
option_c
option_d
correct_option
explanation

Rules:

- Exactly four options.
- Exactly one correct answer.
- Incorrect answers must be plausible.
- Questions must test genuine understanding.
- Avoid duplicate questions.
- Check mathematical answers carefully.
- Do not invent facts.
- correct_option must be A, B, C or D.

Return ONLY valid JSON.

{
  "cards": [
    {
      "question": "...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_option": "A",
      "explanation": "..."
    }
  ]
}
`;

    console.log("Calling OpenAI...");

    // Abort the request if OpenAI takes too long.
    const controller =
      new AbortController();

    const timeout = setTimeout(() => {
      console.log(
        "OpenAI request timed out."
      );

      controller.abort();
    }, 30000);

    let openaiResponse;

    try {
      openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },

          body: JSON.stringify({
            model: "gpt-5-mini",

            input: prompt,

            text: {
              format: {
                type: "json_object",
              },
            },
          }),

          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    console.log(
      "OpenAI request completed."
    );

    const responseText =
      await openaiResponse.text();

    console.log(
      "OpenAI status:",
      openaiResponse.status
    );

    if (!openaiResponse.ok) {
      console.error(
        "OpenAI response:",
        responseText
      );

      throw new Error(
        `OpenAI returned status ${openaiResponse.status}.`
      );
    }

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        "OpenAI returned invalid JSON."
      );
    }

    const outputText =
      result.output
        ?.flatMap(
          (item: any) =>
            item.content || []
        )
        ?.filter(
          (item: any) =>
            item.type === "output_text"
        )
        ?.map(
          (item: any) =>
            item.text
        )
        ?.join("") || "";

    console.log(
      "OpenAI output received:",
      Boolean(outputText)
    );

    if (!outputText) {
      throw new Error(
        "OpenAI returned an empty response."
      );
    }

    let generated;

    try {
      generated =
        JSON.parse(outputText);
    } catch {
      console.error(
        "Invalid generated JSON:",
        outputText
      );

      throw new Error(
        "The AI returned invalid flashcard data."
      );
    }

    if (
      !generated.cards ||
      !Array.isArray(generated.cards)
    ) {
      throw new Error(
        "The AI response did not contain cards."
      );
    }

    const validCards =
      generated.cards
        .slice(0, amount)
        .filter((card: any) => {
          return (
            typeof card.question ===
              "string" &&
            typeof card.option_a ===
              "string" &&
            typeof card.option_b ===
              "string" &&
            typeof card.option_c ===
              "string" &&
            typeof card.option_d ===
              "string" &&
            typeof card.explanation ===
              "string" &&
            ["A", "B", "C", "D"].includes(
              card.correct_option
            )
          );
        });

    if (validCards.length === 0) {
      throw new Error(
        "No valid flashcards were generated."
      );
    }

    console.log(
      "Successfully generated:",
      validCards.length
    );

    return new Response(
      JSON.stringify({
        success: true,
        topic,
        cards: validCards,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Flashcard generation error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong.";

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});