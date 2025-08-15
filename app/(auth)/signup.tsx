import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Briefcase, DollarSign } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [trainerInfo, setTrainerInfo] = useState({
    specialty: '',
    bio: '',
    hourlyRate: '',
    experienceYears: '',
    certifications: '',
  });
  const { signUp } = useAuth();

  const handleSignup = async () => {
  if (!email || !password || !username || !fullName) {
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }

  if (isTrainer && (!trainerInfo.specialty || !trainerInfo.hourlyRate)) {
    Alert.alert('Error', 'Please fill in trainer specialty and hourly rate');
    return;
  }

  if (password !== confirmPassword) {
    Alert.alert('Error', 'Passwords do not match');
    return;
  }

  if (password.length < 6) {
    Alert.alert('Error', 'Password must be at least 6 characters');
    return;
  }

  // Validate trainer data types
  if (isTrainer) {
    const hourlyRate = parseInt(trainerInfo.hourlyRate);
    const experienceYears = parseInt(trainerInfo.experienceYears);
    
    if (isNaN(hourlyRate) || hourlyRate <= 0) {
      Alert.alert('Error', 'Please enter a valid hourly rate');
      return;
    }
    
    if (isNaN(experienceYears) || experienceYears < 0) {
      Alert.alert('Error', 'Please enter valid years of experience');
      return;
    }
  }

  setLoading(true);

  try {
    // Prepare trainer info with proper data types
    const processedTrainerInfo = isTrainer ? {
      ...trainerInfo,
      hourlyRate: parseInt(trainerInfo.hourlyRate),
      experienceYears: parseInt(trainerInfo.experienceYears) || 1,
    } : null;

    const { error } = await signUp(email, password, username, fullName, isTrainer, processedTrainerInfo);
    
    if (error) {
      console.error('Signup error details:', error);
      Alert.alert('Signup Failed', `Error: ${error.message}\n\nPlease check your information and try again.`);
    } else {
      Alert.alert(
        'Success!', 
        isTrainer 
          ? 'Trainer account created successfully! You can now sign in and will be available for booking.' 
          : 'Account created successfully! You can now sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  } catch (err) {
    console.error('Unexpected signup error:', err);
    Alert.alert('Signup Failed', 'An unexpected error occurred. Please try again.');
  } finally {
    setLoading(false);
  }
};


  return (
    <LinearGradient
      colors={['#6C5CE7', '#A29BFE', '#74B9FF']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Join FitForge</Text>
          <Text style={styles.subtitle}>Create your account and start your transformation</Text>
        </View>

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <User size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#B2BEC3"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

            <View style={styles.inputWrapper}>
              <User size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#B2BEC3"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Mail size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#B2BEC3"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#B2BEC3"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#636E72" />
                ) : (
                  <Eye size={20} color="#636E72" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#B2BEC3"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#636E72" />
                ) : (
                  <Eye size={20} color="#636E72" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* User Type Selection */}
          <View style={styles.userTypeContainer}>
            <Text style={styles.userTypeLabel}>Account Type</Text>
            <View style={styles.userTypeSwitch}>
              <Text style={[styles.userTypeText, !isTrainer && styles.activeUserType]}>App User</Text>
              <Switch
                value={isTrainer}
                onValueChange={setIsTrainer}
                trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
                thumbColor={isTrainer ? '#FFFFFF' : '#FFFFFF'}
              />
              <Text style={[styles.userTypeText, isTrainer && styles.activeUserType]}>Personal Trainer</Text>
            </View>
          </View>

          {/* Trainer Information */}
          {isTrainer && (
            <View style={styles.trainerSection}>
              <Text style={styles.trainerSectionTitle}>Trainer Information</Text>
              
              <View style={styles.inputWrapper}>
                <Briefcase size={20} color="#636E72" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Specialty (e.g., Strength Training)"
                  placeholderTextColor="#B2BEC3"
                  value={trainerInfo.specialty}
                  onChangeText={(text) => setTrainerInfo(prev => ({ ...prev, specialty: text }))}
                />
              </View>

              <View style={styles.inputWrapper}>
                <DollarSign size={20} color="#636E72" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Hourly Rate (e.g., 75)"
                  placeholderTextColor="#B2BEC3"
                  value={trainerInfo.hourlyRate}
                  onChangeText={(text) => setTrainerInfo(prev => ({ ...prev, hourlyRate: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputWrapper}>
                <User size={20} color="#636E72" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Years of Experience"
                  placeholderTextColor="#B2BEC3"
                  value={trainerInfo.experienceYears}
                  onChangeText={(text) => setTrainerInfo(prev => ({ ...prev, experienceYears: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Bio (tell clients about yourself)"
                  placeholderTextColor="#B2BEC3"
                  value={trainerInfo.bio}
                  onChangeText={(text) => setTrainerInfo(prev => ({ ...prev, bio: text }))}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Certifications (comma separated)"
                  placeholderTextColor="#B2BEC3"
                  value={trainerInfo.certifications}
                  onChangeText={(text) => setTrainerInfo(prev => ({ ...prev, certifications: text }))}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.signupButton, loading && styles.disabledButton]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.signupButtonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.termsText}>
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
  },
  eyeButton: {
    padding: 4,
  },
  signupButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginText: {
    fontSize: 16,
    color: '#636E72',
  },
  loginLink: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C5CE7',
  },
  termsText: {
    fontSize: 12,
    color: '#B2BEC3',
    textAlign: 'center',
    lineHeight: 18,
    paddingBottom: 40,
  },
  userTypeContainer: {
    marginBottom: 24,
  },
  userTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  userTypeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userTypeText: {
    fontSize: 14,
    color: '#636E72',
    marginHorizontal: 12,
  },
  activeUserType: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
  trainerSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  trainerSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  textAreaWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
});