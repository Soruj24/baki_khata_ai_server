// models/utils/ValidationHelpers.ts
import validator from "validator";
import { isStrongPassword } from "./UserUtils.js";

export const ValidationHelpers = {
  isStrongPassword: (password: string): boolean => {
    return isStrongPassword(password);
  },

  sanitizeUserInput: (input: string): string => {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  },

  validateProfileData: (profileData: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (profileData.bio && profileData.bio.length > 500) {
      errors.push(`Bio cannot exceed 500 characters`);
    }

    if (profileData.website && !validator.isURL(profileData.website)) {
      errors.push('Website must be a valid URL');
    }

    if (profileData.phone && !validator.isMobilePhone(profileData.phone, 'any', { strictMode: false })) {
      errors.push('Phone number is not valid');
    }

    if (profileData.dateOfBirth) {
      const dob = new Date(profileData.dateOfBirth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 13 || age > 120) {
        errors.push('You must be at least 13 years old and not older than 120 years');
      }
    }

    return { isValid: errors.length === 0, errors };
  },

  validateEmail: (email: string): boolean => {
    return validator.isEmail(email);
  },

  validatePhone: (phone: string): boolean => {
    return validator.isMobilePhone(phone, 'any', { strictMode: false });
  },

  validateTimezone: (timezone: string): boolean => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },

  validateSocialLinks: (socialLinks: Record<string, string>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const validPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'github', 'youtube', 'website'];

    if (socialLinks) {
      Object.entries(socialLinks).forEach(([platform, url]) => {
        if (!validPlatforms.includes(platform.toLowerCase())) {
          errors.push(`Invalid social platform: ${platform}`);
        }
        if (!validator.isURL(url)) {
          errors.push(`Invalid URL for ${platform}: ${url}`);
        }
      });
    }

    return { isValid: errors.length === 0, errors };
  }
};