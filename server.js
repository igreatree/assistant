import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// POST /chat { "prompt": "Привет!" }
app.post("/chat", async (req, res) => {
    const { prompt } = req.body;
    let fullResponse = "";

    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "mistral",
            prompt,
            stream: true,
        }),
    });

    for await (const chunk of ollamaRes.body) {
        const lines = chunk.toString().trim().split("\n");
        for (const line of lines) {
            if (!line) continue;
            const data = JSON.parse(line);
            if (data.response) fullResponse += data.response;
        }
    }

    res.json({ text: fullResponse });
});

app.post("/chat/stream", async (req, res) => {
    const { prompt } = req.body;

    // SSE-заголовки
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const ollamaRes = await fetch("http://ollama:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "mistral", prompt, stream: true }),
    });

    let buffer = "";
    for await (const chunk of ollamaRes.body) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.trim()) continue;
            const data = JSON.parse(line);
            if (data.response) {
                res.write(`data: ${JSON.stringify({ token: data.response })}\n\n`);
            }
            if (data.done) {
                res.write("event: done\ndata: {}\n\n");
                res.end();
                return;
            }
        }
    }
});

app.listen(3000, () =>
    console.log("🤖 AI API запущено на http://localhost:3000")
);