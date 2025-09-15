import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// POST /chat { "prompt": "Привет!" }
app.post("/chat", async (req, res) => {
    const { prompt } = req.body;

    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "mistral",
            prompt,
            stream: true,
        }),
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    ollamaRes.body.on("data", (chunk) => {
        console.log({ chunk });
        const lines = chunk.toString().trim().split("\n");
        for (const line of lines) {
            if (!line) continue;
            const data = JSON.parse(line);
            if (data.response) {
                res.write(data.response);
            }
            if (data.done) {
                res.end();
            }
        }
    });
});

app.listen(3000, () =>
    console.log("🤖 AI API запущено на http://localhost:3000")
);