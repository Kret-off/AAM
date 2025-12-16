'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface FileUploaderProps {
  formData: Partial<{ meetingId?: string; clientId?: string; meetingTypeId?: string; scenarioId?: string }>;
  updateFormData: (data: Partial<{ meetingId?: string }>) => void;
  onNext: () => void;
}

const MAX_FILE_SIZE = 1.2 * 1024 * 1024 * 1024; // 1.2GB
const ALLOWED_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm'];

export function FileUploader({ formData }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`Файл слишком большой. Максимальный размер: ${(MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(1)}GB`);
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError('Неподдерживаемый тип файла. Разрешены: MP4, MPEG, MOV, WebM, MP3, WAV');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите файл для загрузки');
      return;
    }

    if (!formData.meetingId) {
      setError('Встреча еще не создана. Дождитесь завершения создания встречи.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Get presigned URL
      const presignedResponse = await fetch(
        `/api/meetings/${formData.meetingId}/upload/presigned-url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        }
      );

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Ошибка получения URL для загрузки (${presignedResponse.status})`;
        console.error('Presigned URL error:', errorData);
        throw new Error(errorMessage);
      }

      const presignedData = await presignedResponse.json();
      if (presignedData.error) {
        console.error('Presigned URL error:', presignedData.error);
        throw new Error(presignedData.error.message || 'Ошибка получения URL для загрузки');
      }

      if (!presignedData.data?.uploadUrl || !presignedData.data?.storagePath) {
        console.error('Invalid presigned URL response:', presignedData);
        throw new Error('Неверный ответ сервера: отсутствуют необходимые данные');
      }

      // Store storagePath from response
      const storagePath = presignedData.data.storagePath;

      // Step 2: Upload to S3
      const uploadResponse = await fetch(presignedData.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => '');
        console.error('S3 upload error:', uploadResponse.status, errorText);
        throw new Error(`Ошибка загрузки файла в хранилище (${uploadResponse.status})`);
      }

      // Step 3: Notify completion
      const completeResponse = await fetch(
        `/api/meetings/${formData.meetingId}/upload/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            storagePath: storagePath,
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Ошибка завершения загрузки (${completeResponse.status})`;
        console.error('Complete upload error:', errorData);
        throw new Error(errorMessage);
      }

      const completeData = await completeResponse.json();
      if (completeData.error) {
        console.error('Complete upload error:', completeData.error);
        throw new Error(completeData.error.message || 'Ошибка завершения загрузки');
      }

      // Success - redirect to meeting detail
      window.location.href = `/meetings/${formData.meetingId}`;
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        {!file ? (
          <div>
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Выбрать файл
              </Button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Максимальный размер: 1.2GB
            </p>
            <p className="text-xs text-gray-400">
              Поддерживаемые форматы: MP4, MPEG, MOV, WebM, MP3, WAV
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1 text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="ml-4 text-gray-400 hover:text-gray-600"
                disabled={isUploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  <span className="text-sm text-gray-600">Загрузка...</span>
                </div>
              </div>
            )}

            {!isUploading && (
              <Button 
                onClick={handleUpload} 
                className="w-full"
                disabled={!formData.meetingId}
              >
                Загрузить файл
              </Button>
            )}
          </div>
        )}
      </div>

      {formData.meetingId && (
        <Alert variant="default">
          <AlertDescription>
            Встреча создана. Загрузите файл для начала обработки.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

