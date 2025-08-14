interface AutocompleteSuggestion {
    text: string;
    type: 'phrase' | 'recent';
    priority: number;
}
interface AudioChunk {
    index: number;
    url: string;
    chunk: string;
    blob: Blob;
}
interface TTSRequest {
    text: string;
    bypassCache?: boolean;
    isChunk?: boolean;
    originalText?: string;
    addToHistoryOnly?: boolean;
}
interface AuthRequest {
    email: string;
    code?: string;
}
interface PhraseRequest {
    phrase?: string;
    resetToDefaults?: boolean;
    removeAll?: boolean;
}
declare const authSection: HTMLElement;
declare const mainApp: HTMLElement;
declare const emailInput: HTMLInputElement;
declare const requestCodeBtn: HTMLButtonElement;
declare const codeSection: HTMLElement;
declare const codeInput: HTMLInputElement;
declare const verifyCodeBtn: HTMLButtonElement;
declare const authStatus: HTMLElement;
declare const userEmail: HTMLElement;
declare const logoutBtn: HTMLButtonElement;
declare const installBtn: HTMLButtonElement;
declare const textArea: HTMLTextAreaElement;
declare const btn: HTMLButtonElement;
declare const player: HTMLAudioElement;
declare const phrasesContainer: HTMLElement;
declare const autofillContainer: HTMLElement;
declare const charCounter: HTMLElement;
declare const newPhraseInput: HTMLInputElement;
declare const addPhraseBtn: HTMLButtonElement;
declare const removeAllPhrasesBtn: HTMLButtonElement;
declare const resetPhrasesBtn: HTMLButtonElement;
declare const autocompleteDropdown: HTMLElement;
declare let currentSuggestions: AutocompleteSuggestion[];
declare let selectedSuggestionIndex: number;
declare let userPhrasesList: string[];
declare let userRecentTexts: string[];
declare let isAuthenticated: boolean;
declare let currentUserEmail: string | null;
declare function getAutocompleteSuggestions(input: string): AutocompleteSuggestion[];
declare function showAutocompleteSuggestions(suggestions: AutocompleteSuggestion[]): void;
declare function selectSuggestion(text: string): void;
declare function hideAutocomplete(): void;
declare function handleKeyNavigation(e: KeyboardEvent): boolean;
declare function updateSelectedSuggestion(suggestions: NodeListOf<Element>): void;
declare let localAutofillList: string[];
declare let deferredPrompt: any;
declare function showSyncNotification(message: string): void;
declare function checkAuthStatus(): Promise<void>;
declare function showAuthSection(): void;
declare function showMainApp(): void;
declare function requestVerificationCode(): Promise<void>;
declare function verifyCode(): Promise<void>;
declare function logout(): Promise<void>;
declare function loadAutofill(showLoadingIndicator?: boolean): Promise<void>;
declare function loadPhrases(): Promise<void>;
declare function updateRemoveAllButtonState(phraseCount: number): void;
declare function createPhraseButton(phrase: string): void;
declare function addPhrase(): Promise<void>;
declare function removePhrase(phrase: string): Promise<void>;
declare function removeAllPhrases(): Promise<void>;
declare function resetPhrases(): Promise<void>;
declare function insertTextAtCursor(text: string): void;
declare function updateCharCounter(): void;
declare let lastKeyPresses: string[];
declare function handleTripleSpace(e: InputEvent): boolean;
declare let audioQueue: string[];
declare let isPlayingQueue: boolean;
declare let currentChunks: AudioChunk[];
declare let audioDebugId: number;
declare function logAudioState(context: string, audioUrl?: string | null): number;
declare function playAudio(audioUrl: string): Promise<void>;
declare function chunkText(text: string): string[];
declare function playAudioQueue(): Promise<void>;
declare function combineAudioChunks(chunkResults: AudioChunk[], originalText: string): Promise<void>;
declare function audioBufferToWav(audioBuffer: AudioBuffer): Blob;
declare function cacheCombinedAudio(text: string, audioBlob: Blob): Promise<void>;
declare function addToHistory(text: string): Promise<void>;
declare function doSpeak(forcedText?: string): Promise<void>;
declare const refreshAutofillBtn: HTMLButtonElement;
//# sourceMappingURL=app.d.ts.map