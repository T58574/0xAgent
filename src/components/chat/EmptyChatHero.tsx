import React from 'react';
import { AppConfig, PersonaMetadata, JarvisSparkProposal, ChatSession } from '../../types';
import { AsciiCanvasEngine } from '../common/AsciiCanvasEngine';
import { JarvisSparkCard } from './JarvisSparkCard';
import { PlanProgressStrip } from './PlanProgressStrip';
import { FloatingCommandBar } from './FloatingCommandBar';

interface EmptyChatHeroProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onCancelAgent?: () => void;
  personas: PersonaMetadata[];
  activePersonaId: string;
  onSelectPersona: (id: string) => void;
  attachedImages: string[];
  onAttachImages: (images: string[]) => void;
  onRemoveImage: (index: number) => void;
  config?: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
  onConfigChanged?: (newConfig: AppConfig) => void;
  activeSparks: JarvisSparkProposal[];
  onAcceptSpark: (spark: JarvisSparkProposal) => void;
  onDismissSpark: (sparkId: string) => void;
  onSpeakPhrase: (text: string) => void;
  currentSession?: ChatSession | null;
}

export const EmptyChatHero: React.FC<EmptyChatHeroProps> = ({
  inputText,
  setInputText,
  onSubmit,
  agentStatus,
  onCancelAgent,
  personas,
  activePersonaId,
  onSelectPersona,
  attachedImages,
  onAttachImages,
  onRemoveImage,
  config,
  onModelChanged,
  onConfigChanged,
  activeSparks,
  onAcceptSpark,
  onDismissSpark,
  onSpeakPhrase,
  currentSession,
}) => {
  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto scrollbar-none">
      <div className="w-full max-w-2xl space-y-4 sm:space-y-6 text-center">
        {/* Transparent Floating ASCII Animation */}
        <div className="flex flex-col items-center justify-center select-none pointer-events-auto">
          <AsciiCanvasEngine
            effect="hero_wave"
            fps={60}
            color="platinum"
            fontSize={11}
            interactive
          />
        </div>

        {/* Proactive Sparks in Empty State */}
        {config?.proactive_companion_enabled !== false && activeSparks.length > 0 && (
          <div className="w-full max-w-xl mx-auto space-y-2 text-left">
            {activeSparks.map((spark) => (
              <JarvisSparkCard
                key={spark.id}
                spark={spark}
                onAccept={onAcceptSpark}
                onDismiss={onDismissSpark}
                onSpeak={onSpeakPhrase}
              />
            ))}
          </div>
        )}

        {/* Dynamic Plan & Todos HUD in Empty State */}
        {currentSession?.active_todos && currentSession.active_todos.length > 0 && (
          <div className="w-full max-w-xl mx-auto text-left">
            <PlanProgressStrip todos={currentSession.active_todos} />
          </div>
        )}

        {/* Bottom Floating Command Bar for Empty State */}
        <div className="pt-2 w-full max-w-xl mx-auto">
          <FloatingCommandBar
            inputText={inputText}
            setInputText={setInputText}
            onSubmit={onSubmit}
            agentStatus={agentStatus}
            onCancelAgent={onCancelAgent}
            personas={personas}
            activePersonaId={activePersonaId}
            onSelectPersona={onSelectPersona}
            attachedImages={attachedImages}
            onAttachImages={onAttachImages}
            onRemoveImage={onRemoveImage}
            config={config}
            onModelChanged={onModelChanged}
            onConfigChanged={onConfigChanged}
          />
        </div>
      </div>
    </div>
  );
};
