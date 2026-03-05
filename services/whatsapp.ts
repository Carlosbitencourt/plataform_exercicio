/**
 * WhatsApp Service for Conativa Desk Integration
 * Documentation provided by user:
 * URL: https://appback.conativadesk.com.br/api/messages/whatsmeow/sendTextPRO
 * Method: POST
 * Body: { "number": "55...", "openTicket": 0, "queueId": "45", "body": "Message" }
 * Header: { "Authorization": "Bearer cFpUHoKRhfWU8ZcsdVVqwOXTa76F9jSfixCbBLtqRSjG6rKTd0bIfk5" }
 */

import { db, functions } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

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
        const sendWhatsAppFn = httpsCallable(functions, 'whatsappSender');

        const result: any = await sendWhatsAppFn({
            number,
            body,
            config
        });

        if (result.data && result.data.success) {
            return { success: true, data: result.data.data };
        } else {
            console.error('WhatsApp Function Error:', result.data);
            return {
                success: false,
                error: result.data?.error || 'Erro desconhecido na Cloud Function'
            };
        }
    } catch (error: any) {
        console.error('WhatsApp Function Exception:', error);
        return {
            success: false,
            error: {
                message: error.message || 'Falha ao chamar a Cloud Function de WhatsApp.',
                details: error
            }
        };
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
