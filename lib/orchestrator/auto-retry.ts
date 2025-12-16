/**
 * Auto Retry Module
 * Functions for calculating retry delays and scheduling automatic retries
 */

import { AUTO_RETRY_CONSTANTS } from './constants';

/**
 * Calculate next retry time based on retry count
 * Formula: delay = min(INITIAL_DELAY * (EXPONENTIAL_BASE ^ retryCount), MAX_DELAY)
 * 
 * Examples:
 * - Попытка 1: 5 минут
 * - Попытка 2: 10 минут
 * - Попытка 3: 20 минут
 * - Попытка 4+: 60 минут (максимум)
 */
export function calculateNextRetryTime(retryCount: number): Date {
  const delayMinutes = Math.min(
    AUTO_RETRY_CONSTANTS.INITIAL_DELAY_MINUTES *
      Math.pow(AUTO_RETRY_CONSTANTS.EXPONENTIAL_BASE, retryCount),
    AUTO_RETRY_CONSTANTS.MAX_DELAY_MINUTES
  );

  return new Date(Date.now() + delayMinutes * 60 * 1000);
}








