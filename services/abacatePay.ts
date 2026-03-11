/**
 * AbacatePay Service
 * Integrates with AbacatePay API for PIX and Card payments.
 */

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const API_BASE_URL = 'https://api.abacatepay.com/v1';

export interface AbacateCustomer {
    name: string;
    email: string;
    cellphone: string;
    taxId: string; // CPF or CNPJ
}

export interface AbacateProduct {
    externalId: string;
    name: string;
    quantity: number;
    price: number; // In cents
}

export interface AbacateBillingRequest {
    frequency: 'ONE_TIME';
    methods: ('PIX' | 'CREDIT_CARD')[];
    products: AbacateProduct[];
    returnUrl: string;
    completionUrl: string;
    customerId?: string;
    customer?: AbacateCustomer;
}

/**
 * Helper to generate a PIX billing for signup deposit via Cloud Functions.
 * This avoids CORS issues and keeps the API key secure on the server.
 */
export const generateSignupPix = async (userData: { name: string, email: string, phone: string, cpf: string, amount: number }) => {
    try {
        console.log("ABACATE: Chamando Cloud Function para gerar PIX...", userData);

        const createBilling = httpsCallable(functions, 'createAbacateBilling');
        const response = await createBilling({
            ...userData,
            origin: window.location.origin
        });

        // Return the billing data from the function response
        return response.data;
    } catch (error: any) {
        console.error("ABACATE: Signup PIX generation failed:", error);

        // Improve error message for the UI
        const message = error.message || "Erro de conexão com o servidor de pagamentos.";
        throw new Error(message);
    }
};
