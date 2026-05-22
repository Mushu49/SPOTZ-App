import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SPOTZ_BRAND } from '../constants/brand';
import { REPORT_REASONS, ReportReason } from '../services/reports';

const REPORT_DETAILS_MAX_LENGTH = 500;

type ReportModalProps = {
  visible: boolean;
  isDark: boolean;
  title?: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
};

export function ReportModal({
  visible,
  isDark,
  title = 'Report',
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedReason(null);
      setDetails('');
      setIsSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason, details);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, isDark && styles.sheetDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && styles.textLight]}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close report dialog"
            >
              <Ionicons name="close" size={22} color={isDark ? '#ffffff' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.reasonList}
            contentContainerStyle={styles.reasonListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {REPORT_REASONS.map((reason) => {
              const isSelected = selectedReason === reason;

              return (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonButton,
                    isDark && styles.reasonButtonDark,
                    isSelected && styles.reasonButtonSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      isDark && styles.textLight,
                      isSelected && styles.reasonTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={SPOTZ_BRAND.accent} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TextInput
              style={[styles.detailsInput, isDark && styles.detailsInputDark, isDark && styles.textLight]}
              placeholder="Tell us more"
              placeholderTextColor={isDark ? '#8e8e93' : '#8a8f98'}
              value={details}
              onChangeText={(text) => setDetails(text.slice(0, REPORT_DETAILS_MAX_LENGTH))}
              maxLength={REPORT_DETAILS_MAX_LENGTH}
              multiline
              textAlignVertical="top"
            />
            <Text style={[styles.counter, isDark && styles.textMuted]}>
              {details.length}/{REPORT_DETAILS_MAX_LENGTH}
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  sheetDark: {
    backgroundColor: '#252629',
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#111827',
    fontSize: 19,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  reasonList: {
    marginTop: 8,
  },
  reasonListContent: {
    paddingBottom: 14,
    gap: 8,
  },
  reasonButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f4f5f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  reasonButtonDark: {
    backgroundColor: '#333333',
    borderColor: '#444444',
  },
  reasonButtonSelected: {
    borderColor: SPOTZ_BRAND.accent,
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
  },
  reasonText: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  reasonTextSelected: {
    color: SPOTZ_BRAND.accent,
  },
  detailsInput: {
    minHeight: 96,
    color: '#111827',
    fontSize: 15,
    lineHeight: 20,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    backgroundColor: '#f4f5f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  detailsInputDark: {
    backgroundColor: '#333333',
    borderColor: '#444444',
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: SPOTZ_BRAND.accent,
  },
  submitButtonDisabled: {
    opacity: 0.52,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
});
