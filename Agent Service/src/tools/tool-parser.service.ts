import { Injectable, Logger } from '@nestjs/common';

/**
 * Represents a parsed tool call from LLM output
 */
export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
  rawJson: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Result of parsing tool calls from text
 */
export interface ToolParseResult {
  toolCalls: ParsedToolCall[];
  textBeforeTools: string;
  textAfterTools: string;
}

/**
 * Service responsible for extracting tool calls from LLM text output.
 * 
 * This follows the TrackingAgent pattern where the model outputs JSON blocks
 * that represent tool invocations, rather than using structured tool calling APIs.
 * 
 * Supported formats:
 * 1. Markdown JSON code blocks: ```json {"tool": "...", "arguments": {...}} ```
 * 2. Raw JSON objects in text: {"tool": "...", "arguments": {...}}
 */
@Injectable()
export class ToolParserService {
  private readonly logger = new Logger(ToolParserService.name);

  /**
   * Parse all tool calls from LLM output text
   */
  parseToolCalls(content: string): ToolParseResult {
    const toolCalls: ParsedToolCall[] = [];
    let textBeforeTools = content;
    let textAfterTools = '';

    // Strategy 1: Look for JSON in markdown code blocks (highest confidence)
    const markdownCalls = this.parseMarkdownBlocks(content);
    toolCalls.push(...markdownCalls);

    // Strategy 2: If no markdown blocks found, try raw JSON (lower confidence)
    if (toolCalls.length === 0) {
      const rawCalls = this.parseRawJson(content);
      toolCalls.push(...rawCalls);
    }

    // Extract text before/after tool calls for context
    if (toolCalls.length > 0) {
      const firstToolJson = toolCalls[0].rawJson;
      const lastToolJson = toolCalls[toolCalls.length - 1].rawJson;
      
      const firstIndex = content.indexOf(firstToolJson);
      const lastIndex = content.lastIndexOf(lastToolJson);
      
      if (firstIndex > 0) {
        textBeforeTools = content.substring(0, firstIndex).trim();
      }
      if (lastIndex >= 0 && lastIndex + lastToolJson.length < content.length) {
        textAfterTools = content.substring(lastIndex + lastToolJson.length).trim();
      }
    }

    this.logger.debug(`Parsed ${toolCalls.length} tool calls from ${content.length} chars of text`);
    
    return { toolCalls, textBeforeTools, textAfterTools };
  }

  /**
   * Parse tool calls from markdown code blocks
   * Format: ```json {"tool": "name", "arguments": {...}} ```
   */
  private parseMarkdownBlocks(content: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = [];
    
    // Match both closed and unclosed code blocks
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)(?:```|$)/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const jsonStr = match[1].trim();
      
      // Skip if it doesn't look like a tool call
      if (!jsonStr.includes('"tool"')) {
        continue;
      }

      const parsed = this.tryParseToolJson(jsonStr);
      if (parsed) {
        toolCalls.push({
          ...parsed,
          confidence: 'high',
          rawJson: match[0],
        });
      }
    }

    return toolCalls;
  }

  /**
   * Parse raw JSON tool calls from text (fallback for models that forget markdown)
   */
  private parseRawJson(content: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = [];
    
    // Look for JSON objects containing "tool" key
    const rawJsonRegex = /\{[\s\S]*?"tool"\s*:[\s\S]*?\}/g;
    let match;

    while ((match = rawJsonRegex.exec(content)) !== null) {
      const potentialJson = match[0];
      
      const parsed = this.tryParseToolJson(potentialJson);
      if (parsed) {
        toolCalls.push({
          ...parsed,
          confidence: 'low',
          rawJson: potentialJson,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Try to parse a JSON string as a tool call
   */
  private tryParseToolJson(jsonStr: string): { name: string; arguments: Record<string, unknown> } | null {
    try {
      // Try direct parse
      let parsed = JSON.parse(jsonStr);
      
      // Handle case where model wraps in extra object
      if (parsed.tool && typeof parsed.tool === 'object') {
        parsed = parsed.tool;
      }
      
      if (parsed.tool && typeof parsed.tool === 'string') {
        return {
          name: parsed.tool,
          arguments: parsed.arguments || parsed.args || {},
        };
      }
      
      // Handle alternate format: {"name": "...", "arguments": {...}}
      if (parsed.name && typeof parsed.name === 'string') {
        return {
          name: parsed.name,
          arguments: parsed.arguments || parsed.args || {},
        };
      }

      return null;
    } catch {
      // Try to repair common JSON issues
      const repaired = this.tryRepairJson(jsonStr);
      if (repaired && repaired !== jsonStr) {
        return this.tryParseToolJson(repaired);
      }
      return null;
    }
  }

  /**
   * Attempt to repair malformed JSON
   */
  private tryRepairJson(jsonStr: string): string | null {
    let repaired = jsonStr;

    // Add missing closing brace
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }

    // Remove trailing commas before close brace
    repaired = repaired.replace(/,\s*}/g, '}');
    repaired = repaired.replace(/,\s*]/g, ']');

    return repaired !== jsonStr ? repaired : null;
  }

  /**
   * Check if content contains any potential tool calls
   * (Quick check before full parsing)
   */
  containsToolCalls(content: string): boolean {
    return content.includes('"tool"') || content.includes("'tool'");
  }

  /**
   * Extract tool calls for a specific tool name
   */
  getToolCallsByName(content: string, toolName: string): ParsedToolCall[] {
    const result = this.parseToolCalls(content);
    return result.toolCalls.filter(tc => tc.name === toolName);
  }
}
