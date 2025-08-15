import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, QrCode, CircleCheck as CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCheckIn } from '@/hooks/useCheckIn';
import { validateGymQRCode } from '@/lib/qrGenerator';
import { useAuth } from '@/contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function CheckinScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [scanned, setScanned] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const { checkIn, refreshStatus, checkInStatus } = useCheckIn();
  const { user } = useAuth();

  // Reset states when component mounts
  useEffect(() => {
    setAlreadyCheckedIn(false);
    setCheckedIn(false);
    setScanned(false);
  }, [checkInStatus]);

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    // Validate QR code format using the validation function
    if (validateGymQRCode(data)) {
      try {
        // Attempt to check in directly - let the API handle the "already checked in" logic
        const success = await checkIn();
        
        if (success) {
          // Set checked in state
          setCheckedIn(true);
          // Show success screen - user will click Done when ready
        } else {
          // Always refresh the status to get the latest information from the server
          await refreshStatus();
          
          // Now check if the user is actually already checked in
          if (checkInStatus.is_checked_in) {
            // Show informative message instead of error
            Alert.alert(
              'Already Checked In',
              'You are already checked in to the gym. You can check out from the main screen when you\'re ready to leave.',
              [
                { text: 'View Status', onPress: () => setAlreadyCheckedIn(true) },
                { text: 'Scan Again', onPress: () => setScanned(false) }
              ]
            );
          } else {
            Alert.alert(
              'Check-in Failed',
              'Unable to check in. Please try again.',
              [{ text: 'Try Again', onPress: () => setScanned(false) }]
            );
          }
        }
      } catch (error) {
        Alert.alert(
          'Error',
          'An error occurred during check-in. Please try again.',
          [{ text: 'Try Again', onPress: () => setScanned(false) }]
        );
      }
    } else {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not valid for gym check-in. Please scan the gym\'s QR code.',
        [{ text: 'Try Again', onPress: () => setScanned(false) }]
      );
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#E17055', '#FDCB6E']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gym Check-in</Text>
        </LinearGradient>
        
        <View style={styles.permissionContainer}>
          <QrCode size={64} color="#E17055" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan the gym's QR code for check-in
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (checkedIn) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#00B894', '#00CEC9']}
          style={styles.successContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <CheckCircle size={80} color="#FFFFFF" />
          <Text style={styles.successTitle}>Checked In!</Text>
          <Text style={styles.successText}>
            Welcome to FitForge Gym! Enjoy your workout session.
          </Text>
          <Text style={styles.successSubtext}>
            Tap "Done" when you're ready to continue
          </Text>
          <TouchableOpacity 
            style={styles.doneButton}
            onPress={() => {
              router.back();
            }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.doneButton, { marginTop: 15, backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
            onPress={async () => {
              await refreshStatus();
              router.back();
            }}
          >
            <Text style={[styles.doneButtonText, { color: '#FFFFFF' }]}>Refresh Status</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  if (alreadyCheckedIn) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#74B9FF', '#0984E3']}
          style={styles.successContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <CheckCircle size={80} color="#FFFFFF" />
          <Text style={styles.successTitle}>Already Checked In!</Text>
          <Text style={styles.successText}>
            You are currently checked in to FitForge Gym.
          </Text>
          {checkInStatus.check_in_time && (
            <Text style={styles.successSubtext}>
              Check-in time: {new Date(checkInStatus.check_in_time).toLocaleTimeString()}
            </Text>
          )}
          <Text style={styles.successSubtext}>
            Duration: {checkInStatus.duration_minutes || 0} minutes
          </Text>
          <TouchableOpacity 
            style={styles.doneButton}
            onPress={() => {
              setAlreadyCheckedIn(false);
              router.back();
            }}
          >
            <Text style={styles.doneButtonText}>Back to Main</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.doneButton, { marginTop: 15, backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
            onPress={() => {
              setAlreadyCheckedIn(false);
              setScanned(false);
            }}
          >
            <Text style={[styles.doneButtonText, { color: '#FFFFFF' }]}>Scan Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.doneButton, { marginTop: 15, backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
            onPress={async () => {
              await refreshStatus();
              setAlreadyCheckedIn(false);
              setScanned(false);
            }}
          >
            <Text style={[styles.doneButtonText, { color: '#FFFFFF' }]}>Refresh Status</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#E17055', '#FDCB6E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gym Check-in</Text>
        <Text style={styles.headerSubtitle}>Scan the gym's QR code</Text>
      </LinearGradient>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={styles.scanFrame} />
          </View>
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Position the QR code within the frame
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.resetButtonText}>Scan Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#E17055',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bottomContainer: {
    padding: 20,
  },
  resetButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E17055',
  },
  resetButtonText: {
    color: '#E17055',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  successSubtext: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 40,
  },
  doneButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  doneButtonText: {
    color: '#00B894',
    fontSize: 18,
    fontWeight: 'bold',
  },
});