const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

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
        headers: {
            Accept: 'application/json',
            ...options?.headers,
        },
    })

    if (!response.ok) {
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
