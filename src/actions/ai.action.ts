import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Ollama } from 'ollama';
import { StepExecutor } from '../engine/step-executor.interface.js';
import { resolveTemplate } from './resolve-template.util.js';

// Ejecuta un prompt de texto contra un provider de IA (Gemini u Ollama, elegido por AI_PROVIDER).
// config: { prompt, systemInstruction? }. "prompt" soporta placeholders {{campo}} contra el output
// del paso anterior (mismo mecanismo que notification.action.ts) — asi un paso de IA puede razonar
// sobre el resultado real de un http_request previo, no solo sobre texto fijo.
// No existe un paquete "ai-core" reusable de PRISM (ese backend es Python): se reimplementa el mismo
// patron (provider intercambiable, factory por env var) en TypeScript, con la misma convencion de
// nombres de env var (AI_PROVIDER/GEMINI_API_KEY/OLLAMA_HOST/OLLAMA_MODEL) para no divergir entre proyectos.
@Injectable()
export class AiAction implements StepExecutor {
  private gemini: GoogleGenAI | null = null;
  private ollama: Ollama | null = null;

  constructor(private readonly config: ConfigService) {}

  async execute(config: Record<string, unknown>, previousOutput: Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const prompt = resolveTemplate(String(config.prompt ?? ''), previousOutput);
    if (!prompt.trim()) throw new Error('ai_task: falta "prompt" en la config del paso');
    const systemInstruction = config.systemInstruction ? resolveTemplate(String(config.systemInstruction), previousOutput) : undefined;

    const provider = this.config.get<string>('ai.provider') ?? 'gemini';
    const response =
      provider === 'ollama' ? await this.runOllama(prompt, systemInstruction) : await this.runGemini(prompt, systemInstruction);

    return { provider, response };
  }

  private async runGemini(prompt: string, systemInstruction?: string): Promise<string> {
    const apiKey = this.config.get<string>('ai.geminiApiKey');
    if (!apiKey) throw new Error('ai_task: falta GEMINI_API_KEY en el entorno (AI_PROVIDER=gemini)');
    if (!this.gemini) this.gemini = new GoogleGenAI({ apiKey });

    const result = await this.gemini.models.generateContent({
      model: this.config.get<string>('ai.geminiModel') ?? 'gemini-3.6-flash',
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });
    const text = result.text;
    if (!text) throw new Error('ai_task: Gemini no devolvio texto en la respuesta');
    return text;
  }

  private async runOllama(prompt: string, systemInstruction?: string): Promise<string> {
    if (!this.ollama) this.ollama = new Ollama({ host: this.config.get<string>('ai.ollamaHost') ?? 'http://localhost:11434' });

    const messages: { role: string; content: string }[] = systemInstruction ? [{ role: 'system', content: systemInstruction }] : [];
    messages.push({ role: 'user', content: prompt });

    const result = await this.ollama.chat({
      model: this.config.get<string>('ai.ollamaModel') ?? 'qwen2.5-coder:7b',
      messages,
      stream: false,
    });
    return result.message.content;
  }
}
