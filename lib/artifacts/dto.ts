/**
 * Artifacts Module DTOs
 * Request and Response Data Transfer Objects
 */

import { ArtifactsPayload, ArtifactsConfig } from './types';

export interface ArtifactsResponse {
  artifacts: ArtifactsPayload;
  artifactsConfig: ArtifactsConfig;
}







