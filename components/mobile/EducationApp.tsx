import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, GraduationCap, BookOpen, Clock, DollarSign, CheckCircle, Briefcase } from 'lucide-react-native';
import { useGame, Education } from '@/contexts/GameContext';

interface EducationAppProps {
  onBack: () => void;
}

const availableEducations: Education[] = [
  {
    id: 'high_school',
    name: 'High School Diploma',
    description: 'Complete your basic education - required for most jobs',
    duration: 104, // Doubled from 52 to 104 weeks (2 years)
    cost: 0,
    completed: false,
  },
  {
    id: 'police_academy',
    name: 'Police Academy',
    description: 'Law enforcement training - required for Police career',
    duration: 30, // Doubled from 15 to 30 weeks
    cost: 12000, // Doubled from 6000 to 12000
    completed: false,
  },
  {
    id: 'legal_studies',
    name: 'Legal Studies',
    description: 'Basic legal education - required for Legal Assistant career',
    duration: 46, // Doubled from 23 to 46 weeks
    cost: 18000, // Doubled from 9000 to 18000
    completed: false,
  },
  {
    id: 'entrepreneurship',
    name: 'Entrepreneurship Course',
    description: 'Learn to start and run businesses - required for starting companies',
    duration: 72, // Doubled from 36 to 72 weeks
    cost: 30000, // Doubled from 15000 to 30000
    completed: false,
  },
  {
    id: 'business_degree',
    name: 'Business Degree',
    description: 'Comprehensive business education - required for Teacher and Nurse careers',
    duration: 90, // Doubled from 45 to 90 weeks
    cost: 48000, // Doubled from 24000 to 48000
    completed: false,
  },
  {
    id: 'computer_science',
    name: 'Computer Science',
    description: 'Programming and software development - required for Software Engineer career',
    duration: 104, // Doubled from 52 to 104 weeks
    cost: 72000, // Doubled from 36000 to 72000
    completed: false,
  },
  {
    id: 'masters_degree',
    name: "Master's Degree",
    description: 'Advanced specialized education - required for Software Engineer career',
    duration: 120, // Doubled from 60 to 120 weeks
    cost: 90000, // Doubled from 45000 to 90000
    completed: false,
  },
  {
    id: 'mba',
    name: 'MBA',
    description: 'Master of Business Administration - required for Corporate career',
    duration: 150, // Doubled from 75 to 150 weeks
    cost: 120000, // Doubled from 60000 to 120000
    completed: false,
  },
  {
    id: 'medical_school',
    name: 'Medical School',
    description: 'Medical education - required for Doctor career',
    duration: 180, // Doubled from 90 to 180 weeks
    cost: 150000, // Doubled from 75000 to 150000
    completed: false,
  },
  {
    id: 'law_school',
    name: 'Law School',
    description: 'Legal education - required for Lawyer career',
    duration: 156, // Doubled from 78 to 156 weeks
    cost: 132000, // Doubled from 66000 to 132000
    completed: false,
  },
  {
    id: 'phd',
    name: 'PhD',
    description: 'Doctorate level research and expertise - required for Doctor career',
    duration: 208, // Doubled from 104 to 208 weeks
    cost: 180000, // Doubled from 90000 to 180000
    completed: false,
  },
];

export default function EducationApp({ onBack }: EducationAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'available' | 'enrolled' | 'completed'>('available');
  const [selectedEducation, setSelectedEducation] = useState<Education | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const enrolledEducations: Education[] = gameState.educations || [];
  const completedEducations: Education[] = enrolledEducations.filter(edu => edu.completed);
  const activeEducations: Education[] = enrolledEducations.filter(edu => !edu.completed);
  const cash = gameState.stats?.money || 0;

  // Get education policy effects
  const educationEffects = gameState.politics?.activePolicyEffects?.education;
  
  // Helper function to calculate adjusted cost and duration
  const getAdjustedEducation = useCallback((education: Education) => {
    const costReduction = educationEffects?.costReduction || 0;
    const weeksReduction = educationEffects?.weeksReduction || 0;
    const scholarshipAmount = educationEffects?.scholarshipAmount || 0;
    
    const adjustedCost = Math.max(0, Math.floor(education.cost * (1 - costReduction / 100)) - scholarshipAmount);
    const adjustedDuration = Math.max(1, education.duration - weeksReduction);
    
    return {
      ...education,
      cost: adjustedCost,
      duration: adjustedDuration,
    };
  }, [educationEffects]);

  const handleEnroll = useCallback((education: Education) => {
    const adjusted = getAdjustedEducation(education);
    
    if (cash < adjusted.cost) {
      Alert.alert('Insufficient Funds', `You need $${adjusted.cost.toLocaleString()} to enroll in ${education.name}.`);
      return;
    }

    const newEducation: Education = {
      ...education,
      weeksRemaining: adjusted.duration,
    };

    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: cash - adjusted.cost },
      educations: [...enrolledEducations, newEducation],
    }));
    saveGame();

    Alert.alert('Enrolled!', `You are now enrolled in ${education.name}.`);
    setShowEnrollModal(false);
  }, [selectedEducation, cash, enrolledEducations, setGameState, saveGame, getAdjustedEducation]);

  const handleStudy = useCallback((education: Education) => {
    if (gameState.stats.energy < 20) {
      Alert.alert('Too Tired', 'You need at least 20 energy to study.');
      return;
    }

    if (!education.weeksRemaining || education.weeksRemaining <= 0) {
      Alert.alert('Already Completed', 'This education is already completed.');
      return;
    }

    // Apply weeks reduction from education policies (if studying)
    const weeksReduction = educationEffects?.weeksReduction || 0;
    const weeksToReduce = 1 + (weeksReduction > 0 ? 1 : 0); // Reduce 1 extra week if policy active
    const newWeeksRemaining = Math.max(0, education.weeksRemaining - weeksToReduce);
    const isCompleted = newWeeksRemaining === 0;

    const updatedEducations = enrolledEducations.map(edu => {
      if (edu.id === education.id) {
        return {
          ...edu,
          weeksRemaining: newWeeksRemaining,
          completed: isCompleted,
        };
      }
      return edu;
    });

    setGameState(prev => ({
      ...prev,
      stats: { 
        ...prev.stats, 
        energy: Math.max(0, prev.stats.energy - 20),
        happiness: Math.max(0, prev.stats.happiness - 5),
      },
      educations: updatedEducations,
    }));
    saveGame();

    if (isCompleted) {
      Alert.alert('Education Completed!', `Congratulations! You have completed ${education.name}!`);
    } else {
      Alert.alert('Studied!', `You made progress in ${education.name}. ${newWeeksRemaining} weeks remaining.`);
    }
  }, [enrolledEducations, gameState.stats.energy, gameState.stats.happiness, setGameState, saveGame]);

  const getProgressPercentage = (education: Education) => {
    if (!education.weeksRemaining) return 100;
    return ((education.duration - education.weeksRemaining) / education.duration) * 100;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#10B981';
    if (percentage >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getCareerRequirements = (educationId: string) => {
    const careerRequirements = {
      'police_academy': 'Police Officer',
      'legal_studies': 'Legal Assistant',
      'business_degree': 'Teacher, Nurse',
      'computer_science': 'Software Engineer',
      'masters_degree': 'Software Engineer',
      'mba': 'Corporate Manager',
      'medical_school': 'Doctor',
      'law_school': 'Lawyer',
      'phd': 'Doctor',
    };
    return careerRequirements[educationId as keyof typeof careerRequirements] || '';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Education</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
        >
          <BookOpen size={20} color={activeTab === 'available' ? '#FFFFFF' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'available' ? styles.tabTextActive : (settings.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
            Available
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'enrolled' && styles.activeTab]}
          onPress={() => setActiveTab('enrolled')}
        >
          <GraduationCap size={20} color={activeTab === 'enrolled' ? '#FFFFFF' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'enrolled' ? styles.tabTextActive : (settings.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
            Enrolled
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <CheckCircle size={20} color={activeTab === 'completed' ? '#FFFFFF' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'completed' ? styles.tabTextActive : (settings.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {activeTab === 'available' && (
          <View style={styles.educationsContainer}>
            {availableEducations.map((education) => {
              const isEnrolled = enrolledEducations.some(edu => edu.id === education.id);
              const isCompleted = enrolledEducations.some(edu => edu.id === education.id && edu.completed);
              const adjusted = getAdjustedEducation(education);
              
              return (
                <View key={education.id} style={styles.educationCard}>
                  <View style={styles.educationHeader}>
                    <View style={styles.educationInfo}>
                      <Text style={styles.educationName}>{education.name}</Text>
                      <Text style={styles.educationDescription}>{education.description}</Text>
                      {getCareerRequirements(education.id) && (
                        <View style={styles.careerRequirement}>
                          <Briefcase size={14} color="#3B82F6" />
                          <Text style={styles.careerRequirementText}>
                            Required for: {getCareerRequirements(education.id)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.educationCost}>
                      <Text style={styles.costText}>
                        {adjusted.cost === 0 ? 'Free' : `$${adjusted.cost.toLocaleString()}`}
                        {adjusted.cost < education.cost && (
                          <Text style={styles.discountText}> (was ${education.cost.toLocaleString()})</Text>
                        )}
                      </Text>
                      <Text style={styles.durationText}>
                        {adjusted.duration} weeks
                        {adjusted.duration < education.duration && (
                          <Text style={styles.discountText}> (was {education.duration})</Text>
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.educationActions}>
                    {isCompleted ? (
                      <View style={styles.completedBadge}>
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.completedText}>Completed</Text>
                      </View>
                    ) : isEnrolled ? (
                      <View style={styles.enrolledBadge}>
                        <GraduationCap size={16} color="#3B82F6" />
                        <Text style={styles.enrolledText}>Enrolled</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.enrollButton}
                        onPress={() => {
                          setSelectedEducation(education);
                          setShowEnrollModal(true);
                        }}
                      >
                        <Text style={styles.enrollButtonText}>Enroll</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'enrolled' && (
          <View style={styles.educationsContainer}>
            {activeEducations.length === 0 ? (
              <View style={styles.emptyState}>
                <GraduationCap size={64} color={settings.darkMode ? "#FFFFFF" : "#9CA3AF"} />
                <Text style={styles.emptyTitle}>No Active Education</Text>
                <Text style={styles.emptyMessage}>
                  Enroll in an education program from the Available tab to start learning!
                </Text>
              </View>
            ) : (
              activeEducations.map((education) => {
                const progress = getProgressPercentage(education);
                const progressColor = getProgressColor(progress);
                
                return (
                  <View key={education.id} style={styles.educationCard}>
                    <View style={styles.educationHeader}>
                      <View style={styles.educationInfo}>
                        <Text style={styles.educationName}>{education.name}</Text>
                        <Text style={styles.educationDescription}>{education.description}</Text>
                      </View>
                      <View style={styles.educationProgress}>
                        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                        <Text style={styles.weeksText}>{education.weeksRemaining} weeks left</Text>
                      </View>
                    </View>

                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${progress}%`, backgroundColor: progressColor }
                        ]} 
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.studyButton}
                      onPress={() => handleStudy(education)}
                    >
                      <Text style={styles.studyButtonText}>Study (20 Energy)</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'completed' && (
          <View style={styles.educationsContainer}>
            {completedEducations.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle size={64} color={settings.darkMode ? "#FFFFFF" : "#9CA3AF"} />
                <Text style={styles.emptyTitle}>No Completed Education</Text>
                <Text style={styles.emptyMessage}>
                  Complete your enrolled education programs to see them here!
                </Text>
              </View>
            ) : (
              completedEducations.map((education) => (
                <View key={education.id} style={styles.educationCard}>
                  <View style={styles.educationHeader}>
                    <View style={styles.educationInfo}>
                      <Text style={styles.educationName}>{education.name}</Text>
                      <Text style={styles.educationDescription}>{education.description}</Text>
                    </View>
                    <View style={styles.completedBadge}>
                      <CheckCircle size={20} color="#10B981" />
                      <Text style={styles.completedText}>Completed</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Enroll Modal */}
      <Modal visible={showEnrollModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enroll in Education</Text>
            
            {selectedEducation && (
              <View style={styles.modalContent}>
                <Text style={styles.modalEducationName}>{selectedEducation.name}</Text>
                <Text style={styles.modalEducationDesc}>{selectedEducation.description}</Text>
                
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetail}>
                    <DollarSign size={16} color="#9FA4B3" />
                    <Text style={styles.modalDetailText}>
                      Cost: {(() => {
                        const adjusted = getAdjustedEducation(selectedEducation);
                        return adjusted.cost === 0 ? 'Free' : `$${adjusted.cost.toLocaleString()}`;
                      })()}
                      {(() => {
                        const adjusted = getAdjustedEducation(selectedEducation);
                        return adjusted.cost < selectedEducation.cost ? ` (was $${selectedEducation.cost.toLocaleString()})` : '';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.modalDetail}>
                    <Clock size={16} color="#9FA4B3" />
                    <Text style={styles.modalDetailText}>
                      Duration: {(() => {
                        const adjusted = getAdjustedEducation(selectedEducation);
                        return adjusted.duration;
                      })()} weeks
                      {(() => {
                        const adjusted = getAdjustedEducation(selectedEducation);
                        return adjusted.duration < selectedEducation.duration ? ` (was ${selectedEducation.duration})` : '';
                      })()}
                    </Text>
                  </View>
                  {getCareerRequirements(selectedEducation.id) && (
                    <View style={styles.modalDetail}>
                      <Briefcase size={16} color="#3B82F6" />
                      <Text style={styles.modalDetailText}>
                        Required for: {getCareerRequirements(selectedEducation.id)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowEnrollModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => selectedEducation && handleEnroll(selectedEducation)}
              >
                <Text style={styles.modalButtonText}>Enroll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#11131A',
    borderBottomColor: '#1F2230',
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  tabContainer: {
    marginHorizontal: 16,
    backgroundColor: '#0F1220',
    borderRadius: 12,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    marginBottom: 16,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#101426',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabTextInactiveDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  educationsContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  educationCard: {
    backgroundColor: '#0F1220',
    borderRadius: 14,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  educationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  educationInfo: {
    flex: 1,
  },
  educationName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  educationDescription: {
    color: '#9FA4B3',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  careerRequirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  careerRequirementText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  educationCost: {
    alignItems: 'flex-end',
  },
  costText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  durationText: {
    color: '#9FA4B3',
    fontSize: 12,
  },
  discountText: {
    color: '#10B981',
    fontSize: 10,
    fontStyle: 'italic',
  },
  educationProgress: {
    alignItems: 'flex-end',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  weeksText: {
    color: '#9FA4B3',
    fontSize: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1A1D29',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  educationActions: {
    alignItems: 'flex-end',
  },
  enrollButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enrollButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  studyButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  studyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  completedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  enrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  enrolledText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#9FA4B3',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#121527',
    borderRadius: 16,
    padding: 20,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalContent: {
    marginBottom: 20,
  },
  modalEducationName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalEducationDesc: {
    color: '#9FA4B3',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalDetails: {
    gap: 8,
  },
  modalDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalDetailText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});