/**
 * HTTP Transport Layer
 *
 * Provides a native fetch wrapper with interceptors, error handling,
 * and JSON:API content type support.
 */
export interface RequestConfig {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    query?: Record<string, string | number | boolean | undefined> | undefined;
    body?: unknown;
    headers?: Record<string, string> | undefined;
    timeout?: number | undefined;
    fetch?: typeof fetch | undefined;
    fetchOptions?: (RequestInit & Record<string, any>) | undefined;
}
export interface TransportConfig {
    baseUrl: string;
    timeout: number;
    headers?: Record<string, string> | undefined;
    fetch?: typeof fetch | undefined;
    fetchOptions?: (RequestInit & Record<string, any>) | undefined;
}
/**
 * Returns proxy URL configured via environment variables, if any.
 */
export declare function getProxyUrl(): string | undefined;
export declare function getOrInitProxyDispatcher(): Promise<unknown>;
export interface RequestInterceptor {
    (config: RequestConfig): RequestConfig | Promise<RequestConfig>;
}
export interface ResponseInterceptor {
    (response: Response, body: unknown): unknown | Promise<unknown>;
}
export interface ErrorInterceptor {
    (error: Error): Error | Promise<Error>;
}
/**
 * Serializes query parameters into a URL search string.
 * Handles nested bracket notation for JSON:API (filter[name], page[number]).
 */
export declare function serializeQuery(params: Record<string, string | number | boolean | string[] | undefined>): string;
/**
 * Builds full URL with path and query parameters.
 */
export declare function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | undefined>): string;
export declare class HttpTransport {
    private config;
    private requestInterceptors;
    private responseInterceptors;
    private errorInterceptors;
    constructor(config: TransportConfig);
    /**
     * Adds a request interceptor.
     * Interceptors are called in order before the request is sent.
     */
    addRequestInterceptor(interceptor: RequestInterceptor): void;
    /**
     * Adds a response interceptor.
     * Interceptors are called in order after a successful response.
     */
    addResponseInterceptor(interceptor: ResponseInterceptor): void;
    /**
     * Adds an error interceptor.
     * Interceptors are called in order when an error occurs.
     */
    addErrorInterceptor(interceptor: ErrorInterceptor): void;
    /**
     * Executes a request with all interceptors applied.
     */
    request<T = unknown>(config: RequestConfig): Promise<T>;
    /**
     * Executes the actual HTTP request.
     */
    private executeRequest;
    /**
     * Handles the response, parsing JSON and handling errors.
     */
    private handleResponse;
    /**
     * Convenience method for GET requests.
     */
    get<T = unknown>(path: string, query?: Record<string, string | number | boolean | undefined>, options?: Partial<RequestConfig>): Promise<T>;
    /**
     * Convenience method for POST requests.
     */
    post<T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>): Promise<T>;
    /**
     * Convenience method for PATCH requests.
     */
    patch<T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>): Promise<T>;
    /**
     * Convenience method for PUT requests.
     */
    put<T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>): Promise<T>;
    /**
     * Convenience method for DELETE requests.
     */
    delete<T = unknown>(path: string, options?: Partial<RequestConfig>): Promise<T>;
}
//# sourceMappingURL=HttpTransport.d.ts.map