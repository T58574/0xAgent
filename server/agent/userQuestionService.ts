import { AskUserQuestionRequest, AskUserQuestionAnswer } from '../../src/types';

interface PendingQuestionEntry {
  request: AskUserQuestionRequest;
  resolve: (answer: AskUserQuestionAnswer) => void;
  reject: (err: Error) => void;
}

class UserQuestionManager {
  private pendingRequests = new Map<string, PendingQuestionEntry>();

  public askQuestions(
    request: AskUserQuestionRequest,
    broadcast?: (event: string, payload: any) => void
  ): Promise<AskUserQuestionAnswer> {
    if (!request.questions || request.questions.length === 0) {
      return Promise.reject(new Error('UserQuestionRequest requires at least one question.'));
    }

    return new Promise<AskUserQuestionAnswer>((resolve, reject) => {
      const key = request.toolCallId;
      this.pendingRequests.set(key, { request, resolve, reject });

      if (broadcast) {
        broadcast('user-question-asked', request);
      }
    });
  }

  public resolveQuestion(toolCallId: string, answer: AskUserQuestionAnswer): boolean {
    const entry = this.pendingRequests.get(toolCallId);
    if (!entry) {
      return false;
    }

    this.pendingRequests.delete(toolCallId);
    entry.resolve(answer);
    return true;
  }

  public cancelQuestion(toolCallId: string, reason = 'Question cancelled'): boolean {
    const entry = this.pendingRequests.get(toolCallId);
    if (!entry) {
      return false;
    }

    this.pendingRequests.delete(toolCallId);
    entry.reject(new Error(reason));
    return true;
  }

  public getPendingRequest(toolCallId: string): AskUserQuestionRequest | undefined {
    return this.pendingRequests.get(toolCallId)?.request;
  }

  public listPending(): AskUserQuestionRequest[] {
    return Array.from(this.pendingRequests.values()).map((e) => e.request);
  }
}

export const userQuestionService = new UserQuestionManager();
