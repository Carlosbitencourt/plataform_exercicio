/**
 * WhatsApp Service for Conativa Desk Integration
 * Documentation provided by user:
 * URL: https://appback.conativadesk.com.br/api/messages/whatsmeow/sendTextPRO
 * Method: POST
 * Body: { "number": "55...", "openTicket": 0, "queueId": "45", "body": "Message" }
 * Header: { "Authorization": "Bearer cFpUHoKRhfWU8ZcsdVVqwOXTa76F9jSfixCbBLtqRSjG6rKTd0bIfk5" }
 */

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const DEFAULT_WHATSAPP_URL = 'https://appback.conativadesk.com.br/api/messages/whatsmeow/sendTextPRO';
const DEFAULT_WHATSAPP_TOKEN = 'cFpUHoKRhfWU8ZcsdVVqwOXTa76F9jSfixCbBLtqRSjG6rKTd0bIfk5';
const DEFAULT_TRANSMISSION_NUMBER = '5571993231592';

/**
 * Sends a text message via WhatsApp using the Conativa Desk API.
 * @param number The phone number in international format (e.g., 55719...)
 * @param body The message body
 * @param config Optional configuration overrides (useful for testing)
 */
export const sendWhatsAppMessage = async (number: string, body: string, config?: { apiUrl?: string, apiKey?: string, queueId?: string }) => {
    try {
        // Buscar configurações dinâmicas do Firestore para permitir alteração no painel Admin
        let url = config?.apiUrl || DEFAULT_WHATSAPP_URL;
        let token = config?.apiKey || DEFAULT_WHATSAPP_TOKEN;
        let queueId = config?.queueId || "45";

        // Se não foi passada config manual, tenta buscar do Firestore
        if (!config) {
            try {
                const settingsSnap = await getDoc(doc(db, 'settings', 'integrations'));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.whatsapp?.apiUrl) url = data.whatsapp.apiUrl.trim();
                    if (data.whatsapp?.apiKey) token = data.whatsapp.apiKey.trim();
                    if (data.whatsapp?.queueId) queueId = data.whatsapp.queueId.trim();
                }
            } catch (e) {
                console.warn("Usando credenciais padrão do WhatsApp (falha ao buscar settings):", e);
            }
        }

        const formattedNumber = number.replace(/\D/g, '').trim();
        const payload = {
            number: formattedNumber,
            openTicket: 0,
            queueId: queueId,
            body: body
        };

        console.log(`Enviando WhatsApp para ${formattedNumber} via ${url}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('WhatsApp API Error:', {
                status: response.status,
                data: errorData
            });
            return { success: false, status: response.status, error: errorData };
        }

        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        console.error('WhatsApp Service Exception:', error);
        return { success: false, error };
    }
};

/**
 * Template for absence notification
 */
export const sendAbsenceNotification = async (phoneNumber: string, name: string, date: string, config?: any) => {
    try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'integrations'));
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.whatsapp?.notifyAbsence === false) return { success: true, message: 'Notificações de ausência desativadas.' };
        }
    } catch (e) {
        console.warn("Erro ao buscar configurações de notificação (ausência):", e);
    }

    const message = `Olá ${name}! 🏋️‍♂️ Notamos que você não realizou seu check-in hoje (${date}). Conforme as regras do Impulso Club, uma penalidade de R$ 10,00 foi aplicada ao seu saldo. Não desanime, amanhã é um novo dia para treinar! 💪`;
    return sendWhatsAppMessage(phoneNumber, message, config);
};

/**
 * Template for signup welcome message
 */
export const sendWelcomeMessage = async (phoneNumber: string, name: string, athleteId: string, config?: any) => {
    const message = `Seja bem-vindo(a) ao Impulso Club, ${name}! 🎉 Seu cadastro foi realizado com sucesso. \n\nSeu ID Único de Atleta: *${athleteId}* \n\nUtilize este código para realizar seus check-ins diários. Vamos pra cima! 🔥`;
    return sendWhatsAppMessage(phoneNumber, message, config);
};

/**
 * Template for check-in confirmation
 */
export const sendCheckInConfirmation = async (phoneNumber: string, name: string, time: string, config?: any) => {
    try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'integrations'));
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.whatsapp?.notifyCheckIn === false) return { success: true, message: 'Confirmações de check-in desativadas.' };
        }
    } catch (e) {
        console.warn("Erro ao buscar configurações de notificação (check-in):", e);
    }

    const message = `Check-in realizado com sucesso! ✅\n\nAtleta: ${name}\nHorário: ${time}\n\nBom treino! Continue focado nos seus objetivos. 🚀`;
    return sendWhatsAppMessage(phoneNumber, message, config);
};
