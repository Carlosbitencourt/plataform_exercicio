/**
 * Utility to generate PIX Static QR Code payloads (BR Code standard)
 */

function crc16(str: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

export interface PixOptions {
    key: string;
    merchantName: string;
    merchantCity: string;
    amount?: number;
    txid?: string;
    description?: string;
}

export function generatePixPayload(options: PixOptions): string {
    let {
        key,
        merchantName,
        merchantCity,
        amount,
        txid = '***',
        description
    } = options;

    // Clean key: remove non-alphanumeric (except @ and . for email)
    // If it looks like a phone (10-11 digits) and doesn't have +55, add it
    let cleanKey = key.replace(/[^\w\s@+.]/gi, '').replace(/\s/g, '');

    // Simple phone detection: only digits, length 10 or 11
    if (/^\d{10,11}$/.test(cleanKey)) {
        cleanKey = `+55${cleanKey}`;
    }

    // Field 00: Payload Format Indicator
    let payload = formatField('00', '01');

    // Field 26: Merchant Account Information - PIX
    let merchantAccount = formatField('00', 'br.gov.bcb.pix');
    merchantAccount += formatField('01', cleanKey);
    if (description) {
        merchantAccount += formatField('02', description.substring(0, 25));
    }
    payload += formatField('26', merchantAccount);

    // Field 52: Merchant Category Code
    payload += formatField('52', '0000');

    // Field 53: Transaction Currency (986 = BRL)
    payload += formatField('53', '986');

    // Field 54: Transaction Amount
    if (amount && amount > 0) {
        payload += formatField('54', amount.toFixed(2));
    }

    // Field 58: Country Code
    payload += formatField('58', 'BR');

    // Field 59: Merchant Name (Max 25 chars)
    // Normalize string: remove accents and special chars
    const normalizedName = merchantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().substring(0, 25);
    payload += formatField('59', normalizedName || 'MERCHANT');

    // Field 60: Merchant City (Max 15 chars)
    const normalizedCity = merchantCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().substring(0, 15);
    payload += formatField('60', normalizedCity || 'CITY');

    // Field 62: Additional Data Field Template
    let additionalData = formatField('05', txid.substring(0, 25) || '***');
    payload += formatField('62', additionalData);

    // Field 63: CRC16
    payload += '6304';
    payload += crc16(payload);

    return payload;
}
