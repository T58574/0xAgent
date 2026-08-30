import React, { useState } from 'react';
import { Terminal, CheckCheck, RotateCcw, Copy, Check, GitFork, Pencil } from 'lucide-react';
import { ChatMessage, ChatSession, LiveTelemetry, AskUserQuestionItem, StagedProposal } from '../../types';
import {
  cleanContent,
  extractThinkingFromContent,
  formatDateSeparator,
  formatTime,
} from '../../utils/helpers';
import { ToolCard } from '../ToolCard';
import { NotionMarkdown } from '../NotionMarkdown';
import { ReasoningViewer } from './ReasoningViewer';
import { InteractiveQuestionCard } from './InteractiveQuestionCard';
import { StagedProposalCard } from './StagedProposalCard';
import { sounds } from '../../services/soundEffects';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';

interface ChatMessageItemProps {
  msg: ChatMessage;
  index: number;
  isFirstOfDay: boolean;
  currentSession?: ChatSession | null;
  reasoningEnabled?: boolean;
  isLastAssistantMessage?: boolean;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  thinkingSeconds?: number;
  liveTelemetry?: LiveTelemetry | null;
  onRespondToTool: (toolId: string, approve: boolean | string) => void;
  onRollbackSession?: (targetMessageId: string, mode: 'to_user_edit' | 'to_assistant') => Promise<string>;
  onSetInputText: (text: string) => void;
  showToast: (msg: string, type: 'info' | 'success' | 'error' | 'warning') => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({
    msg,
    index,
    isFirstOfDay,
    currentSession,
    reasoningEnabled = true,
    isLastAssistantMessage = false,
    agentStatus,
    thinkingSeconds,
    liveTelemetry,
    onRespondToTool,
    onRollbackSession,
    onSetInputText,
    showToast,
  }) => {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    const isTool = msg.role === 'tool';

    const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const textToCopy = isUser ? msg.content : cleanContent(msg.content);
        navigator.clipboard.writeText(textToCopy);
        sounds.playCopy();
        setCopied(true);
        showToast(t.common.copied, 'success');
        setTimeout(() => setCopied(false), 2000);
      } catch (err: any) {
        showToast(err.message || t.common.error, 'error');
      }
    };

    const handleFork = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentSession?.id) return;
      try {
        sounds.playFork();
        await api.fork_session(currentSession.id, msg.id);
        showToast(t.chat.forkChat, 'success');
      } catch (err: any) {
        showToast(err.message || t.common.error, 'error');
      }
    };

    if (isTool) {
      return null;
    }

    if (isSystem) {
      return (
        <React.Fragment key={msg.id || index}>
          {isFirstOfDay && msg.timestamp && (
            <div className="flex justify-center my-4">
              <span className="px-3 py-1 rounded-full bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[10px] font-mono text-[var(--theme-text-muted)] select-none shadow-sm">
                {formatDateSeparator(msg.timestamp)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 max-w-3xl mx-auto w-full my-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500/90 text-xs font-mono">
            <Terminal size={14} className="shrink-0" />
            <span className="truncate">{msg.content}</span>
          </div>
        </React.Fragment>
      );
    }

    const { thinking, text } = !isUser
      ? extractThinkingFromContent(msg.content)
      : { thinking: '', text: msg.content };

    const isActivelyGenerating = isLastAssistantMessage && (agentStatus === 'thinking' || agentStatus === 'executing_tool');
    const hasThinking = Boolean(thinking && thinking.trim().length > 0);
    const hasText = Boolean(text && text.trim().length > 0);
    const hasTools = Boolean(msg.tool_calls && msg.tool_calls.length > 0);

    if (!isUser && !hasThinking && !hasText && !hasTools && !isActivelyGenerating) {
      return null;
    }

    return (
      <React.Fragment key={msg.id || index}>
        {isFirstOfDay && msg.timestamp && (
          <div className="flex justify-center my-4">
            <span className="px-3 py-1 rounded-full bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[10px] font-mono text-[var(--theme-text-muted)] select-none shadow-sm">
              {formatDateSeparator(msg.timestamp)}
            </span>
          </div>
        )}

        <div
          id={`msg-${msg.id || index}`}
          className={`flex max-w-3xl mx-auto w-full my-2.5 sm:my-3 transition-all duration-300 group ${isUser ? 'justify-end' : 'justify-start'}`}
        >
          {isUser ? (
            /* User Bubble */
            <div className="relative w-fit max-w-[88%] sm:max-w-[78%] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] border border-[var(--theme-accent)]/20 rounded-2xl rounded-tr-md px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-sm text-sm leading-relaxed select-text space-y-1.5 transition-all">
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end mb-2">
                  {msg.images.map((imgSrc, imgIdx) => (
                    <img
                      key={imgIdx}
                      src={imgSrc}
                      alt="Attached"
                      className="max-h-40 sm:max-h-48 rounded-xl border border-[var(--theme-border)] shadow-sm object-contain"
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end justify-end gap-x-3 gap-y-1">
                <span className="whitespace-pre-wrap flex-1 text-left">{text}</span>
                <span className="text-xs text-[var(--theme-text-muted)] font-sans select-none shrink-0 inline-flex items-center gap-1.5 opacity-80">
                  {formatTime(msg.timestamp)}
                  <CheckCheck size={14} className="text-[var(--theme-accent)]" />
                  
                  {/* Action Buttons for User message */}
                  <div className="inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                      title={t.chat.copyCode}
                    >
                      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>

                    {currentSession?.id && (
                      <>
                        <button
                          type="button"
                          onClick={handleFork}
                          className="p-1 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                          title={t.chat.forkSession}
                        >
                          <GitFork size={11} />
                        </button>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              sounds.playRollback();
                              if (onRollbackSession) {
                                const restored = await onRollbackSession(msg.id, 'to_user_edit');
                                onSetInputText(restored || msg.content || '');
                              } else {
                                const res = await api.rollback_session(currentSession.id, msg.id, 'to_user_edit');
                                onSetInputText(res.restoredContent || msg.content || '');
                              }
                              showToast(t.chat.editMessage, 'info');
                            } catch (err: any) {
                              showToast(err.message || t.common.error, 'error');
                            }
                          }}
                          className="px-1.5 py-0.5 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-transparent hover:border-[var(--theme-border)] transition-all inline-flex items-center gap-1 cursor-pointer text-[10px]"
                          title={t.chat.editAndResend}
                        >
                          <Pencil size={10} />
                          <span className="hidden sm:inline">{t.chat.editMessage}</span>
                        </button>
                      </>
                    )}
                  </div>
                </span>
              </div>
            </div>
          ) : (
            /* Assistant Bubble */
            <div className="relative w-fit max-w-[96%] sm:max-w-[85%] bento-card text-[var(--theme-text)] border border-[var(--theme-border)] rounded-2xl rounded-tl-md px-3.5 py-2.5 sm:px-4.5 sm:py-3 shadow-md text-[13.5px] leading-relaxed select-text space-y-2.5 transition-all">
              {!text && isActivelyGenerating && !hasTools && (
                <div className="py-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)] font-mono animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)] inline-block" />
                    <span>{t.chat.thinking}...</span>
                  </div>
                </div>
              )}

              {text && (
                <div className="space-y-1">
                  <NotionMarkdown content={cleanContent(text)} />
                </div>
              )}

              {/* Bottom Metadata & Action Strip */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--theme-border)]/40 mt-1">
                {/* LEFT: Background-less Reasoning Button */}
                <div className="flex items-center">
                  {reasoningEnabled && (hasThinking || isActivelyGenerating) && (
                    <ReasoningViewer
                      thinking={thinking}
                      isLive={isActivelyGenerating}
                      thinkingSeconds={isActivelyGenerating ? thinkingSeconds : (msg.metrics?.evalDurationMs ? msg.metrics.evalDurationMs / 1000 : 0)}
                      liveTelemetry={isActivelyGenerating ? liveTelemetry : null}
                      tokenCount={msg.metrics?.tokenCount || msg.metrics?.completionTokens}
                      defaultExpanded={false}
                    />
                  )}
                </div>

                {/* RIGHT: Timestamp & Actions */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--theme-text-muted)] opacity-80 font-sans select-none">
                    {formatTime(msg.timestamp)}
                  </span>

                  {/* Action Bar for Assistant message */}
                  <div className="inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                      title={t.chat.copyCode}
                    >
                      {copied ? <Check size={11} className="text-[var(--theme-text)]" /> : <Copy size={11} />}
                    </button>

                    {currentSession?.id && (
                      <>
                        <button
                          type="button"
                          onClick={handleFork}
                          className="p-1 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                          title={t.chat.forkSession}
                        >
                          <GitFork size={11} />
                        </button>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              sounds.playRollback();
                              if (onRollbackSession) {
                                await onRollbackSession(msg.id, 'to_assistant');
                              } else {
                                await api.rollback_session(currentSession.id, msg.id, 'to_assistant');
                              }
                              showToast(t.chat.retryMessage, 'info');
                            } catch (err: any) {
                              showToast(err.message || t.common.error, 'error');
                            }
                          }}
                          className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] px-2 py-0.5 rounded-md border border-transparent hover:border-[var(--theme-border)] transition-all inline-flex items-center gap-1 cursor-pointer text-[10px]"
                          title={t.chat.retryMessage}
                        >
                          <RotateCcw size={10} />
                          <span>{t.chat.retryMessage}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="space-y-2 pt-1 w-full">
                  {msg.tool_calls.map((tool) => {
                    if (tool.name === 'ask_user_question') {
                      let questions: AskUserQuestionItem[] = [];
                      try {
                        const parsed = typeof tool.arguments === 'string' ? JSON.parse(tool.arguments) : tool.arguments;
                        questions = Array.isArray(parsed?.questions)
                          ? parsed.questions
                          : Array.isArray(parsed)
                          ? parsed
                          : parsed?.question
                          ? [parsed]
                          : [];
                      } catch {}
                      return (
                        <InteractiveQuestionCard
                          key={tool.id}
                          toolCallId={tool.id}
                          disabled={tool.status !== 'pending'}
                          questions={
                            questions.length > 0
                              ? questions
                              : [{ id: 'q1', question: t.chat.askQuestionTitle }]
                          }
                          onSubmitAnswers={async (answers) => {
                            try {
                              await api.answer_user_question(tool.id, answers);
                              showToast(t.chat.submitAnswer, 'success');
                            } catch (err: any) {
                              showToast(err.message || t.common.error, 'error');
                            }
                          }}
                        />
                      );
                    }

                    let stagedProposal: StagedProposal | null = null;
                    const toolPayload = tool.output || tool.result;
                    if (tool.name === 'propose_pull_request' || (toolPayload && toolPayload.includes('staged_proposal'))) {
                      try {
                        const parsed = typeof toolPayload === 'string' ? JSON.parse(toolPayload) : toolPayload;
                        if (parsed?.proposal) {
                          stagedProposal = parsed.proposal;
                        } else if (parsed?.id && parsed?.files) {
                          stagedProposal = parsed as StagedProposal;
                        }
                      } catch {}
                    }

                    if (stagedProposal) {
                      return (
                        <StagedProposalCard
                          key={tool.id}
                          proposal={stagedProposal}
                          onApplied={() => {
                            showToast(`${t.chat.changesApplied} (${stagedProposal?.id})`, 'success');
                          }}
                        />
                      );
                    }

                    return (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onRespond={onRespondToTool}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  },
  (prev, next) => {
    // If it is NOT the active generating message, do not re-render on streaming ticks or live telemetry changes
    if (!prev.isLastAssistantMessage && !next.isLastAssistantMessage) {
      return (
        prev.msg.id === next.msg.id &&
        prev.msg.content === next.msg.content &&
        prev.msg.timestamp === next.msg.timestamp &&
        prev.msg.tool_calls === next.msg.tool_calls &&
        prev.isFirstOfDay === next.isFirstOfDay &&
        prev.reasoningEnabled === next.reasoningEnabled &&
        prev.currentSession?.id === next.currentSession?.id
      );
    }
    // For active message: re-render on content, telemetry, status, or timer changes
    return (
      prev.msg.id === next.msg.id &&
      prev.msg.content === next.msg.content &&
      prev.msg.timestamp === next.msg.timestamp &&
      prev.msg.tool_calls === next.msg.tool_calls &&
      prev.isLastAssistantMessage === next.isLastAssistantMessage &&
      prev.agentStatus === next.agentStatus &&
      prev.thinkingSeconds === next.thinkingSeconds &&
      prev.liveTelemetry === next.liveTelemetry &&
      prev.isFirstOfDay === next.isFirstOfDay &&
      prev.reasoningEnabled === next.reasoningEnabled &&
      prev.currentSession?.id === next.currentSession?.id
    );
  }
);
