import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Initialize Admin SDK once
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const DEFAULT_WHATSAPP_URL = "https://appback.conativadesk.com.br/api/messages/whatsmeow/sendTextPRO";
const DEFAULT_WHATSAPP_TOKEN = "cFpUHoKRhfWU8ZcsdVVqwOXTa76F9jSfixCbBLtqRSjG6rKTd0bIfk5";

/**
 * Cloud Function to send WhatsApp messages via Conativa Desk.
 * Using 2nd Gen API for better performance and reliability.
 */
export const whatsappSender = onCall({
    region: "us-central1",
    maxInstances: 10,
}, async (request) => {
    // request.data contém o payload enviado pelo cliente
    const { number, body, config } = request.data;

    if (!number || !body) {
        throw new HttpsError("invalid-argument", "Número e corpo da mensagem são obrigatórios.");
    }

    // 1. Buscar configurações (do payload de teste ou do Firestore)
    let url = config?.apiUrl || DEFAULT_WHATSAPP_URL;
    let token = config?.apiKey || DEFAULT_WHATSAPP_TOKEN;
    let queueId = config?.queueId || "45";

    if (!config) {
        try {
            const settingsSnap = await admin.firestore().doc("settings/integrations").get();
            if (settingsSnap.exists) {
                const settings = settingsSnap.data();
                if (settings?.whatsapp?.apiUrl) url = settings.whatsapp.apiUrl.trim();
                if (settings?.whatsapp?.apiKey) token = settings.whatsapp.apiKey.trim();
                if (settings?.whatsapp?.queueId) queueId = settings.whatsapp.queueId.trim();
            }
        } catch (error) {
            console.error("Erro ao buscar configurações no Firestore:", error);
        }
    }

    // 2. Formatar número e disparar requisição
    const formattedNumber = number.replace(/\D/g, "").trim();
    const payload = {
        number: formattedNumber,
        openTicket: 0,
        queueId: queueId,
        body: body,
    };

    try {
        console.log(`Enviando WhatsApp para ${formattedNumber} via ${url}...`);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Erro na API do WhatsApp (Server-side):", {
                status: response.status,
                data: errorData,
            });
            return { success: false, status: response.status, error: errorData };
        }

        const result = await response.json();
        return { success: true, data: result };
    } catch (error: any) {
        console.error("Exceção no serviço de WhatsApp (Server-side):", error);
        return { success: false, error: error.message };
    }
});
