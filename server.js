import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

let controller = null;

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

app.post("/chat", async (req, res) => {
    if (controller) {
        return res.status(400).send("⚠ Генерация уже идёт. Сначала остановите её.");
    }
    controller = new AbortController();

    try {
        const { prompt } = req.body;
        let fullResponse = "";

        const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "mistral",
                stream: true,
                messages: [
                    {
                        role: "system",
                        content: "Отвечай очень кратко, максимум 1-2 предложения."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                // options: {
                //     num_predict: 30
                // },
                signal: controller.signal,
            }),
        });

        ollamaRes.body.on("data", (chunk) => {
            const lines = chunk.toString().split("\n");
            for (const line of lines) {
                if (!line.trim()) continue;
                const json = JSON.parse(line);
                if (json.message?.content) {
                    fullResponse += json.message.content;
                }
            }
        });

        ollamaRes.body.on("end", () => {
            controller = null;
            res.json({ text: fullResponse });
            res.end();
        });

        ollamaRes.body.on("error", (err) => {
            controller = null;
            console.error("Ошибка:", err);
            res.end("Ошибка: " + err.message);
        });

    } catch (err) {
        if (err.name === "AbortError") {
            controller = null;
            res.end("\n⏹ Генерация остановлена\n");
        } else {
            console.error(err);
            controller = null;
            res.status(500).send("Ошибка: " + err.message);
        }
    }
});

app.post("/chat/stream", async (req, res) => {
    if (controller) {
        return res.status(400).send("⚠ Генерация уже идёт. Сначала остановите её.");
    }
    controller = new AbortController();

    try {
        const { prompt } = req.body;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const ollamaRes = await fetch("http://ollama:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "mistral",
                stream: true,
                messages: [
                    {
                        role: "system",
                        content: "Отвечай очень кратко, максимум 1-2 предложения."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                // options: {
                //     num_predict: 30
                // },
            }),
            signal: controller.signal,
        });

        ollamaRes.body.on("data", (chunk) => {
            const lines = chunk.toString().split("\n");
            for (const line of lines) {
                if (!line.trim()) continue;
                const json = JSON.parse(line);
                if (json.message?.content) {
                    res.write(`${JSON.stringify({ text: json.message.content })}\n\n`);
                }
            }
        });

        ollamaRes.body.on("end", () => {
            controller = null;
            res.write('{"text": "", "done": true}\n\n');
            res.end();
        });

        ollamaRes.body.on("error", (err) => {
            controller = null;
            console.error("Ошибка:", err);
            res.end("Ошибка: " + err.message);
        });
    } catch (err) {
        if (err.name === "AbortError") {
            controller = null;
            res.end("\n⏹ Генерация остановлена\n");
        } else {
            console.error(err);
            controller = null;
            res.status(500).send("Ошибка: " + err.message);
        }
    }
});

// остановка генерации
app.get("/chat/stop", (req, res) => {
    if (controller) {
        controller.abort(); // прерываем
        controller = null;
        return res.send("⏹ Генерация остановлена");
    } else {
        return res.send("⚠ Сейчас ничего не генерируется");
    }
});

app.listen(port, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${port}`);
    console.log(`▶ GET /generate чтобы начать`);
    console.log(`⏹ GET /stop чтобы остановить`);
});