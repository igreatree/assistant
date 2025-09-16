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

        const ollamaRes = await fetch(`${OLLAMA_HOST}/api/generate`, {
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
                options: {
                    num_predict: 30
                },
                signal: controller.signal,
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

    } catch (err) {
        if (err.name === "AbortError") {
            res.end("\n⏹ Генерация остановлена\n");
        } else {
            console.error(err);
            res.status(500).send("Ошибка: " + err.message);
        }
    } finally {
        controller = null;
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

        const ollamaRes = await fetch("http://ollama:11434/api/generate", {
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
                options: {
                    num_predict: 30
                },
            }),
            signal: controller.signal,
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
                    res.write(`${JSON.stringify({ token: data.response })}\n\n`);
                }
                if (data.done) {
                    res.write('{"token": "", "done": true}\n\n');
                    res.end();
                    return;
                }
            }
        }
    } catch (err) {
        if (err.name === "AbortError") {
            res.end("\n⏹ Генерация остановлена\n");
        } else {
            console.error(err);
            res.status(500).send("Ошибка: " + err.message);
        }
    } finally {
        controller = null;
    }
});

// остановка генерации
app.get("/chat/stop", (req, res) => {
    if (controller) {
        controller.abort(); // прерываем
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