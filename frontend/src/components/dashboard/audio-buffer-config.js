// Centralized frontend audio buffering constants (UI playback path)

export const AUDIO_WORKER_MAX_QUEUE_SIZE = 3;
export const AUDIO_WORKER_MAX_QUEUE_FOR_CATCHUP = 4;
export const AUDIO_WORKER_CATCHUP_RETAIN_CHUNKS = 1;

export const AUDIO_AUTO_FLUSH_MAX_BUFFER_SECONDS = 0.35;
export const AUDIO_AUTO_FLUSH_CHECK_INTERVAL_MS = 200;
