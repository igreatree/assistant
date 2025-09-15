import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// POST /chat { "prompt": "Привет!" }
app.post("/chat", async (req, res) => {
    const { prompt } = req.body;

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "mistral", // можно поменять на llama3 или другую
            prompt,
        }),
    });

    const data = await response.json();
    // res.json(data);
    res.send(data);
});

app.listen(3000, () =>
    console.log("🤖 AI API запущено на http://localhost:3000")
);
