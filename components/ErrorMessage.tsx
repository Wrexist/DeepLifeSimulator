import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Gradient from '@/components/ui/Gradient';
import { MotiView } from '@/components/anim/MotiStub';
import { X, RefreshCw, Info, AlertCircle, AlertOctagon, XCircle, FileText } from 'lucide-react-native';
const LinearGradient = Gradient;

interface ErrorMessageProps {
 visible: boolean;
 title?: string;
 message: string;
 severity?: 'info'|'warning'|'error'|'critical';
 onDismiss?: () => void;
 onRetry?: () => void;
 /**
  * Called when the player taps "Report" on a real error (error/critical).
  * Wired from UIUXOverlay to send a comprehensive diagnostic report.
  */
 onReport?: () => void;
 autoDismiss?: boolean;
 dismissAfter?: number;
 /** Position in the visible banner stack - offsets each so they don't overlap. */
 stackIndex?: number;
}

export default function ErrorMessage({
 visible,
 title,
 message,
 severity = 'error',
 onDismiss,
 onRetry,
 onReport,
 autoDismiss = false,
 dismissAfter = 5000,
 stackIndex = 0,
}: ErrorMessageProps) {
 const insets = useSafeAreaInsets();
 React.useEffect(() => {
 if (visible && autoDismiss && onDismiss) {
 const timer = setTimeout(onDismiss, dismissAfter);
 return () => clearTimeout(timer);
 }
 return;
 }, [visible, autoDismiss, onDismiss, dismissAfter]);

 if (!visible) return null;
 // Nothing to say: an empty banner (icon + X only) reads as a broken event.
 if (!message?.trim() && !title?.trim()) return null;

 const getSeverityColors = () => {
 switch (severity) {
 case 'info':
 return ['#3B82F6', '#60A5FA'];
 case 'warning':
 return ['#F59E0B', '#FBBF24'];
 case 'critical':
 return ['#DC2626', '#EF4444'];
 default: // error
 return ['#EF4444', '#F87171'];
 }
 };

 const getIcon = () => {
 switch (severity) {
 case 'info':
 return Info;
 case 'warning':
 // Friendly rounded icon - no alarming yellow triangle for advisories.
 return AlertCircle;
 case 'critical':
 return AlertOctagon;
 default:
 return XCircle;
 }
 };

 // Real errors (error/critical) are the only place we surface a "Report"
 // action - gameplay advisories (info/warning) stay quiet and dismissible.
 const isRealError = severity === 'error' || severity === 'critical';

 const colors = getSeverityColors();
 const IconComponent = getIcon();

 return (
 <MotiView
 from={{ opacity: 0, translateY: -20 }}
 animate={{ opacity: 1, translateY: 0 }}
 exit={{ opacity: 0, translateY: -20 }}
 transition={{ type: 'timing', duration: 300 }}
 style={[
 styles.container,
 // Sit below the status bar / notch, and stagger multiple banners so they
 // don't render superimposed (each ~96pt tall incl. margin).
 { marginTop: insets.top + 8 + stackIndex * 96 },
 ]}
 >
 <LinearGradient
 colors={colors as [string, string]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 style={styles.gradient}
 >
 <View style={styles.content}>
 <View style={styles.header}>
 <IconComponent size={24} color="#FFFFFF" strokeWidth={2.4} />
 <View style={styles.textContainer}>
 {title && <Text style={styles.title}>{title}</Text>}
 <Text style={styles.message}>{message}</Text>
 </View>
 {onDismiss && (
 <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
 <X size={20} color="#fff"/>
 </TouchableOpacity>
 )}
 </View>
 
 {(onRetry || (isRealError && onReport)) && (
 <View style={styles.actions}>
 {onRetry && (
 <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
 <RefreshCw size={16} color="#fff"/>
 <Text style={styles.retryText}>Retry</Text>
 </TouchableOpacity>
 )}
 {isRealError && onReport && (
 <TouchableOpacity onPress={onReport} style={styles.supportButton}>
 <FileText size={16} color="#fff"/>
 <Text style={styles.supportText}>Report</Text>
 </TouchableOpacity>
 )}
 </View>
 )}
 </View>
 </LinearGradient>
 </MotiView>
 );
}

const styles = StyleSheet.create({
 container: {
 margin: 16,
 borderRadius: 12,
 boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
 shadowColor: '#000',
 shadowOpacity: 0.2,
 shadowOffset: { width: 0, height: 4 },
 shadowRadius: 8,
 elevation: 8,
 },
 gradient: {
 borderRadius: 12,
 padding: 16,
 },
 content: {
 flex: 1,
 },
 header: {
 flexDirection: 'row',
 alignItems: 'flex-start',
 },
 textContainer: {
 flex: 1,
 },
 title: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#fff',
 marginBottom: 4,
 },
 message: {
 fontSize: 14,
 color: '#fff',
 lineHeight: 20,
 },
 dismissButton: {
 padding: 4,
 marginLeft: 8,
 },
 actions: {
 flexDirection: 'row',
 justifyContent: 'flex-end',
 marginTop: 12,
 gap: 8,
 },
 retryButton: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: 'rgba(255,255,255,0.2)',
 paddingHorizontal: 12,
 paddingVertical: 6,
 borderRadius: 6,
 },
 retryText: {
 color: '#fff',
 fontSize: 12,
 fontWeight: '600',
 marginLeft: 4,
 },
 supportButton: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: 'rgba(255,255,255,0.2)',
 paddingHorizontal: 12,
 paddingVertical: 6,
 borderRadius: 6,
 },
 supportText: {
 color: '#fff',
 fontSize: 12,
 fontWeight: '600',
 marginLeft: 4,
 },});

