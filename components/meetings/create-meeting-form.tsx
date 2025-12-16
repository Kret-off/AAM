'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateMeetingRequest } from '@/lib/meeting/dto';
import { ClientSelector } from './create-meeting/client-selector';
import { MeetingTypeSelector } from './create-meeting/meeting-type-selector';
import { ScenarioSelector } from './create-meeting/scenario-selector';
import { FileUploader } from './create-meeting/file-uploader';
import { apiPost } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Check } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

export function CreateMeetingForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<Partial<CreateMeetingRequest>>({
    participantIds: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { number: 1, title: 'Клиент', component: ClientSelector },
    { number: 2, title: 'Тип встречи', component: MeetingTypeSelector },
    { number: 3, title: 'Сценарий', component: ScenarioSelector },
    { number: 4, title: 'Файл', component: FileUploader },
  ];

  const updateFormData = (data: Partial<CreateMeetingRequest>) => {
    setFormData((prev) => {
      // If meetingTypeId is being changed and it's different from current,
      // reset scenarioId to ensure scenario matches the new meeting type
      if (data.meetingTypeId !== undefined && data.meetingTypeId !== prev.meetingTypeId) {
        return { ...prev, ...data, scenarioId: undefined };
      }
      return { ...prev, ...data };
    });
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    if (!formData.clientId || !formData.meetingTypeId || !formData.scenarioId) {
      setError('Заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiPost<{ meeting: { id: string } }>(
        '/api/meetings',
        {
          clientId: formData.clientId,
          meetingTypeId: formData.meetingTypeId,
          scenarioId: formData.scenarioId,
          participantIds: formData.participantIds || [],
        }
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка создания встречи');
        setIsSubmitting(false);
        return;
      }

      if (response.data?.meeting?.id) {
        // Store meeting ID for file upload
        const meetingId = response.data.meeting.id;
        updateFormData({ meetingId });
        // Move to file upload step if not already there
        if (currentStep < 4) {
          setCurrentStep(4);
        }
        // Reset submitting state after successful creation
        setIsSubmitting(false);
      } else {
        setError('Ошибка: встреча не была создана');
        setIsSubmitting(false);
      }
    } catch (err) {
      setError('Произошла ошибка при создании встречи');
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-10">
        <div className="relative">
          {/* Progress line background */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
          
          {/* Progress line fill */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-blue-600 transition-all duration-300 ease-out"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />
          
          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = currentStep > step.number;
              const isActive = currentStep === step.number;
              const isUpcoming = currentStep < step.number;
              
              return (
                <div
                  key={step.number}
                  className="flex flex-col items-center relative z-10"
                >
                  {/* Step circle */}
                  <div
                    className={`
                      flex items-center justify-center
                      w-10 h-10 rounded-full
                      transition-all duration-300 ease-out
                      ${
                        isCompleted
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : isActive
                          ? 'bg-white border-2 border-blue-600 text-blue-600 shadow-lg shadow-blue-600/20 scale-110'
                          : 'bg-white border-2 border-gray-300 text-gray-400'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      <span
                        className={`
                          text-sm font-semibold
                          ${isActive ? 'text-blue-600' : 'text-gray-400'}
                        `}
                      >
                        {step.number}
                      </span>
                    )}
                  </div>
                  
                  {/* Step label */}
                  <span
                    className={`
                      mt-3 text-sm font-medium transition-colors duration-200
                      ${
                        isCompleted || isActive
                          ? 'text-gray-900'
                          : 'text-gray-500'
                      }
                    `}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <CurrentStepComponent
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
          />

          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              Назад
            </Button>
            {currentStep < 4 ? (
              <Button onClick={handleNext} disabled={isSubmitting}>
                Далее
              </Button>
            ) : formData.meetingId ? (
              // Meeting already created, no button needed (file uploader handles it)
              <div></div>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Создание...
                  </>
                ) : (
                  'Создать встречу'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

