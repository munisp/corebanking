import { AxiosError } from 'axios';

/**
 * Extracts error message from various error response formats
 * Checks for: message, detail, error, msg, errorMessage
 * @param error - The error object (AxiosError, Error, or unknown)
 * @param defaultMessage - Default message if no error message found
 * @returns The extracted error message
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage: string = 'An error occurred'
): string {
  // Handle AxiosError with response data
  if (error instanceof AxiosError && error.response) {
    const responseData = error.response.data;
    
    if (responseData && typeof responseData === 'object') {
      // Check for common error message fields
      const errorMessage = 
        (responseData as { message?: string }).message ||
        (responseData as { detail?: string }).detail ||
        (responseData as { error?: string }).error ||
        (responseData as { msg?: string }).msg ||
        (responseData as { errorMessage?: string }).errorMessage ||
        (responseData as { error_message?: string }).error_message;
      
      if (errorMessage && typeof errorMessage === 'string') {
        return errorMessage;
      }
      
      // Check if responseData itself is a string
      if (typeof responseData === 'string') {
        return responseData;
      }
      
      // Check for nested error objects
      const nestedError = (responseData as { error?: unknown }).error;
      if (nestedError && typeof nestedError === 'object') {
        const nestedMessage = 
          (nestedError as { message?: string }).message ||
          (nestedError as { detail?: string }).detail;
        if (nestedMessage && typeof nestedMessage === 'string') {
          return nestedMessage;
        }
      }
    } else if (typeof responseData === 'string') {
      return responseData;
    }
    
    // Fallback to status text if available
    if (error.response.statusText) {
      return `${error.response.statusText}${error.response.status ? ` (${error.response.status})` : ''}`;
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  // Default fallback
  return defaultMessage;
}

/**
 * Extracts error message from API response data
 * @param responseData - The response data object
 * @param defaultMessage - Default message if no error message found
 * @returns The extracted error message
 */
export function getErrorFromResponse(
  responseData: unknown,
  defaultMessage: string = 'An error occurred'
): string {
  if (!responseData) {
    return defaultMessage;
  }
  
  if (typeof responseData === 'string') {
    return responseData;
  }
  
  if (typeof responseData === 'object') {
    const errorMessage = 
      (responseData as { message?: string }).message ||
      (responseData as { detail?: string }).detail ||
      (responseData as { error?: string }).error ||
      (responseData as { msg?: string }).msg ||
      (responseData as { errorMessage?: string }).errorMessage ||
      (responseData as { error_message?: string }).error_message;
    
    if (errorMessage && typeof errorMessage === 'string') {
      return errorMessage;
    }
  }
  
  return defaultMessage;
}






