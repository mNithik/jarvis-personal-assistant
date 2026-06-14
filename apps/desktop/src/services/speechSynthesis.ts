export function canSpeak() {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

export function speakText(text: string) {
  if (!canSpeak()) {
    return false;
  }

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  const preferredVoice = synth
    .getVoices()
    .find((voice) => voice.lang.toLowerCase().startsWith("en"));

  if (preferredVoice) {
    utterance.voice = preferredVoice as SpeechSynthesisVoice;
  }

  utterance.rate = 1;
  utterance.pitch = 1;
  synth.cancel();
  synth.speak(utterance);
  return true;
}
