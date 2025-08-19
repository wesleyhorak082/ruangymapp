import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Snowflake, Info, X } from 'lucide-react-native';

interface FreezeStreakModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentStreak: number;
  canFreeze: boolean;
  loading: boolean;
}

export const FreezeStreakModal: React.FC<FreezeStreakModalProps> = ({
  visible,
  onClose,
  onConfirm,
  currentStreak,
  canFreeze,
  loading,
}) => {
  const handleConfirm = () => {
    if (!canFreeze) {
      Alert.alert(
        'Freeze Unavailable',
        'You can only freeze your streak once per week. Save it for when you really need it!',
        [{ text: 'OK' }]
      );
      return;
    }

    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <Snowflake size={32} color="#FFFFFF" />
              <Text style={styles.modalTitle}>Freeze Your Streak</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.modalBody}>
            <View style={styles.streakInfo}>
              <Text style={styles.streakNumber}>{currentStreak}</Text>
              <Text style={styles.streakLabel}>Day Streak</Text>
            </View>

            <View style={styles.infoSection}>
              <Info size={20} color="#667eea" />
              <Text style={styles.infoTitle}>How Streak Freeze Works</Text>
            </View>

            <View style={styles.benefitsList}>
              <Text style={styles.benefitItem}>• Freezes your streak for 24 hours</Text>
              <Text style={styles.benefitItem}>• Prevents streak from expiring</Text>
              <Text style={styles.benefitItem}>• Available once per week (Monday-Sunday)</Text>
              <Text style={styles.benefitItem}>• Perfect for busy days or emergencies</Text>
            </View>

            {!canFreeze && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ You&apos;ve already used your weekly freeze. It resets every Monday.
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmButton,
                  !canFreeze && styles.disabledButton
                ]}
                onPress={handleConfirm}
                disabled={loading || !canFreeze}
              >
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Freezing...' : canFreeze ? 'Freeze Streak' : 'Used This Week'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 15,
  },
  modalHeader: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalBody: {
    padding: 24,
  },
  streakInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 8,
  },
  streakLabel: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  benefitsList: {
    marginBottom: 24,
  },
  benefitItem: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 8,
    lineHeight: 22,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmButton: {
    backgroundColor: '#667eea',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
});
