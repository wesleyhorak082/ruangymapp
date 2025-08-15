// Simple QR code generator for testing purposes
// In a real app, you would use a proper QR code library

export const generateGymQRCode = (gymId: string = 'ruangym'): string => {
  // This is a simple implementation for testing
  // In production, you would use a proper QR code library like 'qrcode'
  const timestamp = Date.now();
  const data = `${gymId}:${timestamp}:checkin`;
  return data;
};

export const generateTestQRCode = (): string => {
  return 'ruangym:test:checkin:gym';
};

// Generate a simple test QR code for debugging
export const generateSimpleTestQRCode = (): string => {
  return 'test:gym:checkin';
};

// Function to validate QR code format
export const validateGymQRCode = (qrData: string): boolean => {
  // Check if the QR code contains gym-related identifiers
  const validIdentifiers = ['gym', 'fitforge', 'ruangym', 'checkin', 'test'];
  
  const isValid = validIdentifiers.some(identifier => qrData.toLowerCase().includes(identifier));
  
  return isValid;
};
