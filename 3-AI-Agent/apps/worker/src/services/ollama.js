export async function askOllama(ollamaUrl, prompt) {
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.1',
        prompt,
        stream: false,
        options: {
          temperature: 0,
          top_p: 0.1
        }
      })
    });

    if (!response.ok) {
      return `Ollama unavailable or model missing (${response.status}). Continue with static triage.`;
    }

    const data = await response.json();
    return data.response || 'No model output. Continue with static triage.';
  } catch (error) {
    return `Ollama request error (${error.message}). Continue with static triage.`;
  }
}
