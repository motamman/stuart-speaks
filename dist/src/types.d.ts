export interface FishAudioMessage {
    text: string;
    reference_id: string;
    format: 'mp3' | 'wav' | 'opus';
    mp3_bitrate?: number;
}
export interface FishAudioWSMessage {
    text: string;
    reference_id: string;
    format: 'mp3' | 'wav' | 'opus';
    temperature?: number;
    top_p?: number;
}
export interface AudioChunk {
    index: number;
    data: ArrayBuffer;
    isComplete: boolean;
    chunk: string;
}
export interface TTSRequest {
    text: string;
    bypassCache?: boolean;
    isChunk?: boolean;
    originalText?: string;
    addToHistoryOnly?: boolean;
}
export interface TTSResponse {
    success?: boolean;
    message?: string;
    error?: string;
}
export interface AuthRequest {
    email: string;
    code?: string;
}
export interface AuthResponse {
    success: boolean;
    message: string;
    email?: string;
    error?: string;
}
export interface PhraseRequest {
    phrase?: string;
    resetToDefaults?: boolean;
    removeAll?: boolean;
}
export interface PhraseResponse {
    success: boolean;
    phrases: string[];
    error?: string;
}
export interface CacheMetadata {
    text: string;
    timestamp: number;
    email?: string;
    type?: string;
}
export interface UserSession {
    authenticated: boolean;
    email: string;
    sessionId: string;
}
export interface CombinedAudioRequest {
    text: string;
}
export interface CombinedAudioResponse {
    exists: boolean;
    hash?: string;
}
declare module 'express-session' {
    interface SessionData {
        authenticated?: boolean;
        email?: string;
        sessionId?: string;
    }
}
//# sourceMappingURL=types.d.ts.map