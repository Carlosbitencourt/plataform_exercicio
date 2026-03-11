import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
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

/**
 * Cloud Function to create or update an Auth user.
 * Allows admins to set passwords for athletes.
 */
export const setUserAuth = onCall({
    region: "us-central1",
}, async (request) => {
    const { email, password, displayName } = request.data;

    if (!email || !password) {
        throw new HttpsError("invalid-argument", "Email e senha são obrigatórios.");
    }

    try {
        let userRecord;
        try {
            // Check if user exists
            userRecord = await admin.auth().getUserByEmail(email);

            // Update password
            await admin.auth().updateUser(userRecord.uid, {
                password: password,
                displayName: displayName || userRecord.displayName
            });

            console.log(`Senha atualizada para o usuário: ${email}`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName: displayName || email.split('@')[0],
                    emailVerified: true
                });
                console.log(`Novo usuário criado: ${email}`);
            } else {
                throw error;
            }
        }

        return { uid: userRecord.uid };
    } catch (error: any) {
        console.error("Erro ao gerenciar usuário Auth:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Cloud Function to create a billing in AbacatePay.
 * Securely handles the API key and avoids CORS issues.
 */
export const createAbacateBilling = onCall({
    region: "us-central1",
}, async (request) => {
    const { name, email, phone, cpf, amount } = request.data;

    if (!name || !email || !amount) {
        console.error("[Abacate] Dados recebidos:", { name, email, phone, cpf, amount });
        throw new HttpsError("invalid-argument", `Dados insuficientes para gerar faturamento. Recebido: name=${name}, email=${email}, amount=${amount}`);
    }

    // 1. Fetch config from Firestore
    let apiKey = "";
    try {
        const settingsSnap = await admin.firestore().doc("settings/integrations").get();
        if (settingsSnap.exists) {
            apiKey = settingsSnap.data()?.abacate?.apiKey || "";
        }
    } catch (error) {
        console.error("Error fetching AbacatePay API Key:", error);
    }

    if (!apiKey || apiKey.includes('•')) {
        throw new HttpsError("failed-precondition", "AbacatePay API Key não configurada corretamente no painel Admin.");
    }

    // Sanitize API Key
    const sanitizedApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");

    const V1_API = "https://api.abacatepay.com/v1/pixQrCode/create";
    const V2_API = "https://api.abacatepay.com/v1/billing/create";

    const billingAmount = Math.round(Number(amount) * 100);

    // Try V1 first because our app relies on the inline PIX QR Code payload which V1 provides directly.
    try {
        console.log(`[Abacate] Tentando V1 pixQrCode/create para ${email}...`);

        const v1Payload = {
            amount: billingAmount,
            description: "Depósito - Impulso Club",
            customer: {
                name,
                email,
                taxId: cpf.replace(/\D/g, ""),
                cellphone: phone.replace(/\D/g, "")
            }
        };

        const v1Response = await fetch(V1_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sanitizedApiKey}`
            },
            body: JSON.stringify(v1Payload)
        });

        const v1Result: any = await v1Response.json().catch(() => ({}));

        const isVersionMismatch = v1Result?.error?.includes("version mismatch") ||
            v1Result?.message?.includes("version mismatch") ||
            v1Result?.error === "API key version mismatch";

        if (v1Response.ok && v1Result.data) {
            console.log(`[Abacate] Sucesso na V1!`);
            const data = v1Result.data;
            return {
                id: data.id,
                amount: data.amount,
                status: data.status,
                url: data.url || "",
                pix: {
                    qrcode: data.brCodeBase64 || "",
                    payload: data.brCode || ""
                }
            };
        }

        if (!isVersionMismatch && !v1Response.ok) {
            console.error("[Abacate] Erro V1 Real:", JSON.stringify(v1Result));
            const errorMsg = v1Result.message || v1Result.error || "Erro na API V1";
            throw new Error(errorMsg);
        }

        console.log(`[Abacate] Fallback para V2 devido ao erro de versão da key...`);
    } catch (v1Error: any) {
        if (!v1Error.message?.includes("version mismatch")) {
            throw v1Error;
        }
    }

    // Fallback to V2 (Hosted checkout or future transparent V2 mapping)
    try {
        console.log(`[Abacate] Tentando V2 billing/create para ${email}...`);

        const v2Payload = {
            frequency: "ONE_TIME",
            methods: ["PIX"],
            products: [{
                externalId: "deposit",
                name: "Depósito - Impulso Club",
                quantity: 1,
                price: billingAmount
            }],
            returnUrl: "https://impulso.club",
            completionUrl: "https://impulso.club",
            customer: {
                name,
                email,
                taxId: cpf.replace(/\D/g, ""),
                cellphone: phone.replace(/\D/g, "")
            }
        };

        const v2Response = await fetch(V2_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sanitizedApiKey}`
            },
            body: JSON.stringify(v2Payload)
        });

        const v2Result: any = await v2Response.json().catch(() => ({}));

        if (v2Response.ok && v2Result.data) {
            console.log(`[Abacate] Sucesso na V2!`);
            const data = v2Result.data;
            return {
                id: data.id,
                amount: data.amount,
                status: data.status,
                url: data.url,
                pix: {
                    qrcode: data.pix?.qrcode || "",
                    payload: data.pix?.payload || ""
                }
            };
        }

        console.error("[Abacate] Erro V2 Final:", JSON.stringify(v2Result));
        const errorMsg = v2Result.message || v2Result.error || "Erro na API V2";
        throw new Error(errorMsg);
    } catch (finalError) {
        console.error("[Abacate] Erro inesperado ao gerar pagamento:", finalError);
        throw new HttpsError("internal", "Falha interna ao comunicar com portal AbacatePay.");
    }
});
