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
exports.whatsappSender = void 0;
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
//# sourceMappingURL=index.js.map