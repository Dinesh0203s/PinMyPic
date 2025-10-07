/**
 * Utility functions for ObjectId validation
 */

/**
 * Validates if a string is a valid MongoDB ObjectId format
 * @param id - The string to validate
 * @returns true if valid ObjectId format, false otherwise
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // MongoDB ObjectId is a 24-character hexadecimal string
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Safely creates an ObjectId from a string with validation
 * @param id - The string to convert to ObjectId
 * @returns ObjectId if valid, null if invalid
 */
export function safeObjectId(id: string): any | null {
  if (!isValidObjectId(id)) {
    return null;
  }
  
  try {
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  } catch (error) {
    console.error('Error creating ObjectId:', error);
    return null;
  }
}

/**
 * Validates and logs ObjectId format issues
 * @param id - The ID to validate
 * @param context - Context for logging (e.g., 'photo', 'event')
 * @returns true if valid, false otherwise
 */
export function validateAndLogObjectId(id: string, context: string = 'item'): boolean {
  if (!isValidObjectId(id)) {
    console.error(`Invalid ${context} ID format:`, {
      id,
      length: id?.length,
      type: typeof id,
      context
    });
    return false;
  }
  return true;
}
