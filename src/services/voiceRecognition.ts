import { SpeechRecognitionState, VoiceTranscriptResult } from "../types/voice";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type VoiceCallbacks = {
  onStateChange: (state: SpeechRecognitionState) => void;
  onTranscript: (result: VoiceTranscriptResult) => void;
  onError: (message: string) => void;
};

type VoiceRecognitionOptions = {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function createVoiceRecognition(
  callbacks: VoiceCallbacks,
  options: VoiceRecognitionOptions = {},
) {
  const Recognition =
    window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

  if (!Recognition) {
    callbacks.onStateChange("unsupported");
    return null;
  }

  const recognition = new Recognition();
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.lang = options.lang ?? "en-US";

  recognition.onresult = (event) => {
    let transcript = "";
    let finalState = false;

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
      finalState = event.results[index].isFinal;
    }

    callbacks.onTranscript({
      transcript: transcript.trim(),
      isFinal: finalState,
    });
  };

  recognition.onerror = (event) => {
    callbacks.onStateChange("error");
    callbacks.onError(`Voice recognition failed: ${event.error}`);
  };

  recognition.onend = () => {
    callbacks.onStateChange("idle");
  };

  return recognition;
}
