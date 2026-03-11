"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAbacateBilling = exports.setUserAuth = exports.whatsappSender = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
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
exports.whatsappSender = (0, https_1.onCall)({
    region: "us-central1",
    maxInstances: 10,
}, async (request) => {
    // request.data contém o payload enviado pelo cliente
    const { number, body, config } = request.data;
    if (!number || !body) {
        throw new https_1.HttpsError("invalid-argument", "Número e corpo da mensagem são obrigatórios.");
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
                if (settings?.whatsapp?.apiUrl)
                    url = settings.whatsapp.apiUrl.trim();
                if (settings?.whatsapp?.apiKey)
                    token = settings.whatsapp.apiKey.trim();
                if (settings?.whatsapp?.queueId)
                    queueId = settings.whatsapp.queueId.trim();
            }
        }
        catch (error) {
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
    }
    catch (error) {
        console.error("Exceção no serviço de WhatsApp (Server-side):", error);
        return { success: false, error: error.message };
    }
});
/**
 * Cloud Function to create or update an Auth user.
 * Allows admins to set passwords for athletes.
 */
exports.setUserAuth = (0, https_1.onCall)({
    region: "us-central1",
}, async (request) => {
    const { email, password, displayName } = request.data;
    if (!email || !password) {
        throw new https_1.HttpsError("invalid-argument", "Email e senha são obrigatórios.");
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
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName: displayName || email.split('@')[0],
                    emailVerified: true
                });
                console.log(`Novo usuário criado: ${email}`);
            }
            else {
                throw error;
            }
        }
        return { uid: userRecord.uid };
    }
    catch (error) {
        console.error("Erro ao gerenciar usuário Auth:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Cloud Function to create a billing in AbacatePay.
 * Securely handles the API key and avoids CORS issues.
 */
exports.createAbacateBilling = (0, https_1.onCall)({
    region: "us-central1",
}, async (request) => {
    const { name, email, phone, cpf, amount } = request.data;
    if (!name || !email || !amount) {
        throw new https_1.HttpsError("invalid-argument", "Dados insuficientes para gerar faturamento.");
    }
    // 1. Fetch config from Firestore
    let apiKey = "";
    try {
        const settingsSnap = await admin.firestore().doc("settings/integrations").get();
        if (settingsSnap.exists) {
            apiKey = settingsSnap.data()?.abacate?.apiKey || "";
        }
    }
    catch (error) {
        console.error("Error fetching AbacatePay API Key:", error);
    }
    if (!apiKey || apiKey.includes('•')) {
        throw new https_1.HttpsError("failed-precondition", "AbacatePay API Key não configurada corretamente no painel Admin.");
    }
    // Sanitize API Key
    const sanitizedApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");
    // Use V1 pixQrCode/create for direct PIX data (compatible with user's V1 API Key)
    const API_BASE = "https://api.abacatepay.com/v1";
    try {
        const billingAmount = Math.round(Number(amount) * 100);
        // V1 pixQrCode/create allows sending customer data directly
        const billingPayload = {
            amount: billingAmount,
            description: "Depósito Inicial - Impulso Club",
            customer: {
                name,
                email,
                taxId: cpf.replace(/\D/g, ""),
                cellphone: phone.replace(/\D/g, "")
            }
        };
        console.log(`[Abacate] Enviando payload V1 pixQrCode: ${JSON.stringify(billingPayload)}`);
        const response = await fetch(`${API_BASE}/pixQrCode/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sanitizedApiKey}`
            },
            body: JSON.stringify(billingPayload)
        });
        const result = await response.json().catch(() => ({}));
        console.log(`[Abacate] Resposta V1 pixQrCode: ${JSON.stringify(result)}`);
        if (!response.ok) {
            console.error("[Abacate] Erro V1:", JSON.stringify(result));
            const errorMsg = result.error || result.message || response.status;
            throw new Error(`Falha ao gerar pagamento PIX: ${errorMsg}`);
        }
        // Map V1 response to the format expected by the frontend
        // V1 returned data directly in result.data or root depending on exact success structure
        const data = result.data || result;
        return {
            id: data.id,
            amount: data.amount,
            status: data.status,
            url: data.url,
            pix: {
                qrcode: data.brCodeBase64,
                payload: data.brCode
            }
        };
    }
    catch (error) {
        console.error("AbacatePay Exception:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
//# sourceMappingURL=index.js.map