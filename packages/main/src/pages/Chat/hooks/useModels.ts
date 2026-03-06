import { useCallback, useEffect, useState } from 'react';
import type { ModelInfo, ModelsResponse } from '../types';
import type { ChatApi } from './useChatApi';

export interface ModelsState {
  availableModels: ModelsResponse;
  selectedModel: string;
  selectedService: 'ollama' | 'ghmodels';
  isModelModalOpen: boolean;
  modelsLoaded: boolean;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  setSelectedService: React.Dispatch<React.SetStateAction<'ollama' | 'ghmodels'>>;
  setIsModelModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleModelSelect: (model: ModelInfo, service: 'ollama' | 'ghmodels') => void;
  getSelectedModelInfo: () => ModelInfo | undefined;
  selectedModelSupportsVision: () => boolean;
  selectedModelSupportsTools: () => boolean;
  getCapabilityColor: (capability: string) => string;
}

export function useModels(api: ChatApi, activeView: string): ModelsState {
  const [availableModels, setAvailableModels] = useState<ModelsResponse>({
    ollama: [],
    ghmodels: [],
  });
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedService, setSelectedService] = useState<'ollama' | 'ghmodels'>('ghmodels');
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Lazy-load models when entering chat view
  useEffect(() => {
    if (activeView === 'chat' && !modelsLoaded) {
      const fetchModels = async () => {
        try {
          const response = await fetch(api.endpoints.models);
          if (response.ok) {
            const data = (await response.json()) as ModelsResponse;
            setAvailableModels(data);

            if (!selectedModel) {
              if (data.ghmodels.length > 0) {
                setSelectedModel(data.ghmodels[0].id);
                setSelectedService('ghmodels');
              } else if (data.ollama.length > 0) {
                setSelectedModel(data.ollama[0].id);
                setSelectedService('ollama');
              }
            }
            setModelsLoaded(true);
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
        }
      };
      fetchModels();
    }
  }, [activeView, modelsLoaded, api.endpoints.models, selectedModel]);

  const handleModelSelect = (model: ModelInfo, service: 'ollama' | 'ghmodels') => {
    setSelectedModel(model.id);
    setSelectedService(service);
    setIsModelModalOpen(false);
  };

  const getSelectedModelInfo = useCallback(() => {
    return (
      availableModels.ollama.find((m) => m.id === selectedModel) ||
      availableModels.ghmodels.find((m) => m.id === selectedModel)
    );
  }, [availableModels, selectedModel]);

  const selectedModelSupportsVision = useCallback(() => {
    const model = getSelectedModelInfo();
    return model?.capabilities?.includes('vision') ?? false;
  }, [getSelectedModelInfo]);

  const selectedModelSupportsTools = useCallback(() => {
    const model = getSelectedModelInfo();
    return model?.capabilities?.includes('tools') ?? false;
  }, [getSelectedModelInfo]);

  const getCapabilityColor = (capability: string) => {
    const colorMap: Record<string, string> = {
      vision: 'grape',
      multimodal: 'orange',
      tools: 'blue',
      thinking: 'pink',
      code: 'cyan',
      text: 'gray',
      embedding: 'teal',
    };
    return colorMap[capability.toLowerCase()] || 'gray';
  };

  return {
    availableModels,
    selectedModel,
    selectedService,
    isModelModalOpen,
    modelsLoaded,
    setSelectedModel,
    setSelectedService,
    setIsModelModalOpen,
    handleModelSelect,
    getSelectedModelInfo,
    selectedModelSupportsVision,
    selectedModelSupportsTools,
    getCapabilityColor,
  };
}
