/**
 * Manual PIX Key Payment Service
 * Handles deposit requests when using a static PIX key instead of AbacatePay.
 * Deposits are held as "pendente" until approved by admin.
 */

import { db } from './firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    getDoc
} from 'firebase/firestore';
import { DepositRequest } from '../types';

const COLLECTION = 'depositRequests';

/**
 * Generate a Pix payload (EMV format) for QR Code rendering.
 * Follows the Brazilian Pix standard exactly as defined by BACEN.
 *
 * References:
 * - Manual de Padrões para Iniciação do Pix (BACEN)
 * - EMV QR Code Specification for Payment Systems
 */
export const generatePixPayload = (pixKey: string, merchantName: string, amount: number): string => {
    // Helper: build an EMV TLV field
    const tlv = (id: string, value: string): string => {
        const len = value.length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    };

    // Normalize merchant name: remove accents, keep only ASCII printable, max 25 chars
    const normalizeName = (name: string): string => {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')  // remove diacritics
            .replace(/[^a-zA-Z0-9 ]/g, '')    // keep only alphanumeric and space
            .toUpperCase()
            .slice(0, 25)
            .trim() || 'FAVORECIDO';
    };

    // Normalize phone key to +55XXXXXXXXXXX format
    const normalizePixKey = (key: string): string => {
        const digitsOnly = key.replace(/\D/g, '');
        // If it looks like a Brazilian phone number (10 or 11 digits), format it
        if (/^\d{10,11}$/.test(digitsOnly)) {
            return `+55${digitsOnly}`;
        }
        return key.trim();
    };

    const formattedKey = normalizePixKey(pixKey);
    const name = normalizeName(merchantName);
    const city = 'BRASIL';

    // Tag 26: Merchant Account Information
    //   Sub-tag 00: GUI = "BR.GOV.BCB.PIX"
    //   Sub-tag 01: Chave Pix
    const gui = tlv('00', 'BR.GOV.BCB.PIX');
    const key = tlv('01', formattedKey);
    const merchantAccountInfo = tlv('26', gui + key);

    // Tag 62: Additional Data Field Template
    //   Sub-tag 05: Reference Label (txid) — required, use "***" for one-off
    const additionalData = tlv('62', tlv('05', '***'));

    // Build payload without CRC
    let payload = '';
    payload += tlv('00', '01');              // Payload Format Indicator
    payload += merchantAccountInfo;          // Merchant Account Information
    payload += tlv('52', '0000');            // Merchant Category Code (generic)
    payload += tlv('53', '986');             // Transaction Currency (BRL = 986)
    payload += tlv('54', amount.toFixed(2)); // Transaction Amount
    payload += tlv('58', 'BR');              // Country Code
    payload += tlv('59', name);              // Merchant Name
    payload += tlv('60', city);              // Merchant City
    payload += additionalData;               // Additional Data (txid)
    payload += '6304';                       // CRC16 placeholder (tag 63, len 04)

    // Append CRC16-CCITT checksum
    const crc = crc16CCITT(payload);
    return payload + crc;
};

/**
 * CRC16-CCITT (polynomial 0x1021, initial value 0xFFFF).
 * Exactly as specified by BACEN for the Pix payload.
 */
const crc16CCITT = (str: string): string => {
    let crc = 0xFFFF;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str); // UTF-8 encoding, but PIX only uses ASCII so this is fine
    for (const byte of bytes) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
};



/**
 * Create a deposit request for manual approval.
 */
export const createDepositRequest = async (
    userId: string,
    userName: string,
    amount: number,
    pixKey: string,
    userPhone?: string,
    source: 'signup' | 'deposit' = 'deposit'
): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
        userId,
        userName,
        userPhone: userPhone || '',
        amount,
        pixKey,
        status: 'pendente',
        requestedAt: new Date().toISOString(),
        source
    });
    return docRef.id;
};

/**
 * Subscribe to all deposit requests (for admin panel).
 */
export const subscribeToDepositRequests = (
    callback: (requests: DepositRequest[]) => void
) => {
    const q = query(collection(db, COLLECTION), orderBy('requestedAt', 'desc'));
    return onSnapshot(q, (snap) => {
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as DepositRequest));
        callback(requests);
    });
};

/**
 * Subscribe to a specific user's deposit requests (for public pages).
 */
export const subscribeToUserDepositRequests = (
    userId: string,
    callback: (requests: DepositRequest[]) => void
) => {
    const q = query(collection(db, COLLECTION), orderBy('requestedAt', 'desc'));
    return onSnapshot(q, (snap) => {
        const requests = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as DepositRequest))
            .filter(r => r.userId === userId);
        callback(requests);
    });
};

/**
 * Approve a deposit request — credits user balance and marks as approved.
 */
export const approveDepositRequest = async (requestId: string): Promise<void> => {
    const reqRef = doc(db, COLLECTION, requestId);
    const reqSnap = await getDoc(reqRef);

    if (!reqSnap.exists()) throw new Error('Solicitação não encontrada.');

    const request = reqSnap.data() as DepositRequest;
    if (request.status !== 'pendente') throw new Error('Esta solicitação já foi processada.');

    // Credit user balance
    const userRef = doc(db, 'users', request.userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Usuário não encontrado.');

    const currentBalance = userSnap.data().balance || 0;
    await updateDoc(userRef, {
        balance: currentBalance + request.amount
    });

    // Mark request as approved
    await updateDoc(reqRef, {
        status: 'aprovado',
        processedAt: new Date().toISOString()
    });
};

/**
 * Reject a deposit request.
 */
export const rejectDepositRequest = async (requestId: string, reason?: string): Promise<void> => {
    const reqRef = doc(db, COLLECTION, requestId);
    await updateDoc(reqRef, {
        status: 'rejeitado',
        processedAt: new Date().toISOString(),
        rejectionReason: reason || 'Rejeitado pelo administrador'
    });
};
