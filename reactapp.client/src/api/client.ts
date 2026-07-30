const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const requestTimeoutMs = 10_000

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

export async function apiRequest<T>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        credentials: 'include',
        signal: options?.signal ?? AbortSignal.timeout(requestTimeoutMs),
        headers: {
            Accept: 'application/json',
            'X-App-Request': 'Your-Meter',
            ...options?.headers,
        },
    })

    if (!response.ok) {
        if (response.status === 401 && path !== '/api/auth/login') {
            window.dispatchEvent(new Event('auth:unauthorized'))
        }

        let message = `Serwer zwrócił błąd ${response.status}.`

        try {
            const problem = await response.json() as {
                title?: string
                detail?: string
                errors?: Record<string, string[]>
            }
            message = problem.detail
                ?? problem.title
                ?? Object.values(problem.errors ?? {}).flat()[0]
                ?? message
        } catch {
            // Odpowiedź bez treści JSON zachowuje komunikat oparty o kod HTTP.
        }

        throw new ApiError(message, response.status)
    }

    if (response.status === 204) {
        return undefined as T
    }

    return response.json() as Promise<T>
}
