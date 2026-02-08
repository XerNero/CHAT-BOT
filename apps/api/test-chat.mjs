import { request } from "undici";

function hasCitations(text) {
    return /\[#\d+\]/.test(String(text || ""));
}

async function callChat(question, history = []) {
    const { body, statusCode } = await request("http://localhost:3001/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history }),
    });

    const json = await body.json();
    return { statusCode, json };
}

async function run() {
    const questions = [
        "Apa saja layanan akademik yang tersedia di kampus?",                                                               
        "Apa peraturan kampus terkait sanksi pelanggaran?",
        "Bagaimana prosedur umum pengajuan layanan akademik dan batas waktunya?",
    ];

    let history = [];

    for (const q of questions) {
        console.log("\n==============================");
        console.log("Q:", q);

        const { statusCode, json } = await callChat(q, history);

        console.log("Status:", statusCode);

        if (!json.ok) {
            console.log("ERROR:", json.message);
            continue;
        }

        const ans = json.answer || {};
        console.log("\n--- answer.overview ---\n", ans.overview || "(kosong)");
        console.log("\n--- answer.detail ---\n", ans.detail || "(kosong)");
        console.log("\n--- answer.aturan ---\n", ans.aturan || "(kosong)");
        console.log("\n--- answer.penutup ---\n", ans.penutup || "(kosong)");

        const allText = `${ans.overview}\n${ans.detail}\n${ans.aturan}\n${ans.penutup}`;
        console.log("\nCitations present?:", hasCitations(allText));
        console.log("Sources count:", (json.sources || []).length);

        // Update history (multi-turn)
        history.push({ role: "user", content: q });
        history.push({
            role: "assistant",
            content: JSON.stringify(json.answer || {}),
        });
    }

    console.log("\nDONE.");
}

run().catch((e) => {
    console.error("TEST FAILED:", e);
    process.exit(1);
});
