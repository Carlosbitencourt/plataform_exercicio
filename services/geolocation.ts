export interface LocationResult {
    latitude: number;
    longitude: number;
    accuracy: number;
}

export interface LocationError {
    code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
    message: string;
    isSystemError: boolean;
}

const GPS_TIMEOUT = 10000; // 10s for high accuracy
const FALLBACK_TIMEOUT = 20000; // 20s for low accuracy
const CACHE_TIME = 10000; // Accept 10s old cache for high accuracy

export const getUserLocation = async (): Promise<LocationResult> => {
    return new Promise(async (resolve, reject) => {
        if (!navigator.geolocation) {
            reject({
                code: 'UNKNOWN',
                message: 'Geolocalização não suportada pelo navegador.',
                isSystemError: true
            } as LocationError);
            return;
        }

        // Checking permissions if available (mostly Chrome/Android)
        // Safari does not fully support query('geolocation') in all versions/contexts
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                if (result.state === 'denied') {
                    reject({
                        code: 'PERMISSION_DENIED',
                        message: 'Permissão de localização bloqueada pelo usuário.',
                        isSystemError: false
                    } as LocationError);
                    return;
                }
            } catch (e) {
                // Ignore permission query errors (some browsers might throw)
                console.warn('Erro ao verificar permissões:', e);
            }
        }

        const handleSuccess = (pos: GeolocationPosition) => {
            resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy
            });
        };

        const handleError = async (err: GeolocationPositionError) => {
            // Permission denied is fatal, no fallback
            if (err.code === 1) { // PERMISSION_DENIED
                reject({
                    code: 'PERMISSION_DENIED',
                    message: 'Permissão de localização negada.',
                    isSystemError: false
                } as LocationError);
                return;
            }

            console.warn(`Erro GPS de alta precisão (${err.code}): ${err.message}. Tentando fallback...`);

            // Fallback: Low accuracy (Cell tower/WiFi)
            navigator.geolocation.getCurrentPosition(
                handleSuccess,
                (fallbackErr) => {
                    let code: LocationError['code'] = 'UNKNOWN';
                    let msg = fallbackErr.message;

                    if (fallbackErr.code === 1) code = 'PERMISSION_DENIED';
                    else if (fallbackErr.code === 2) code = 'POSITION_UNAVAILABLE';
                    else if (fallbackErr.code === 3) code = 'TIMEOUT';

                    reject({
                        code,
                        message: msg,
                        isSystemError: true
                    } as LocationError);
                },
                {
                    enableHighAccuracy: false,
                    timeout: FALLBACK_TIMEOUT,
                    maximumAge: 60000 // Accept 1 min old cache for fallback
                }
            );
        };

        // First attempt: High Accuracy
        navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleError,
            {
                enableHighAccuracy: true,
                timeout: GPS_TIMEOUT,
                maximumAge: CACHE_TIME
            }
        );
    });
};
