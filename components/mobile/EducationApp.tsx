import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { ArrowLeft, GraduationCap, BookOpen, Clock, DollarSign, CheckCircle, Briefcase, Pause, Play, Users, Star, AlertTriangle, Award } from 'lucide-react-native';
import { useGame, Education, EducationClass } from '@/contexts/GameContext';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// Lazy-load education system to avoid breaking when module isn't available
let educationSystem: typeof import('@/lib/education/educationSystem') | null = null;
try {
  educationSystem = require('@/lib/education/educationSystem');
} catch {
  // Module may not exist in test environments
}

interface EducationAppProps {
  onBack: () => void;
}

const availableEducations: Education[] = [
  {
    id: 'high_school',
    name: 'High School Diploma',
    description: 'Complete your basic education - required for most jobs',
    duration: 104,
    cost: 0,
    completed: false,
  },
  {
    id: 'police_academy',
    name: 'Police Academy',
    description: 'Law enforcement training - required for Police career',
    duration: 30,
    cost: 12000,
    completed: false,
  },
  {
    id: 'legal_studies',
    name: 'Legal Studies',
    description: 'Basic legal education - required for Legal Assistant career',
    duration: 46,
    cost: 18000,
    completed: false,
  },
  {
    id: 'entrepreneurship',
    name: 'Entrepreneurship Course',
    description: 'Learn to start and run businesses - required for starting companies',
    duration: 72,
    cost: 30000,
    completed: false,
  },
  {
    id: 'business_degree',
    name: 'Business Degree',
    description: 'Comprehensive business education - required for Teacher and Nurse careers',
    duration: 90,
    cost: 48000,
    completed: false,
  },
  {
    id: 'computer_science',
    name: 'Computer Science',
    description: 'Programming and software development - required for Software Engineer career',
    duration: 104,
    cost: 72000,
    completed: false,
  },
  {
    id: 'masters_degree',
    name: "Master's Degree",
    description: 'Advanced specialized education - required for Software Engineer career',
    duration: 120,
    cost: 90000,
    completed: false,
  },
  {
    id: 'mba',
    name: 'MBA',
    description: 'Master of Business Administration - required for Corporate career',
    duration: 150,
    cost: 120000,
    completed: false,
  },
  {
    id: 'medical_school',
    name: 'Medical School',
    description: 'Medical education - required for Doctor career',
    duration: 180,
    cost: 150000,
    completed: false,
  },
  {
    id: 'law_school',
    name: 'Law School',
    description: 'Legal education - required for Lawyer career',
    duration: 156,
    cost: 132000,
    completed: false,
  },
  {
    id: 'phd',
    name: 'PhD',
    description: 'Doctorate level research and expertise - required for Doctor career',
    duration: 208,
    cost: 180000,
    completed: false,
  },
];

function EducationApp({ onBack }: EducationAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'available' | 'enrolled' | 'completed'>('available');
  const [selectedEducation, setSelectedEducation] = useState<Education | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showClassPickerModal, setShowClassPickerModal] = useState(false);
  const [classPickerEducation, setClassPickerEducation] = useState<Education | null>(null);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [showCampusEventModal, setShowCampusEventModal] = useState(false);
  const [campusEvent, setCampusEvent] = useState<any>(null);
  const [campusEventEducationId, setCampusEventEducationId] = useState<string | null>(null);
  const [useLoanForEnroll, setUseLoanForEnroll] = useState(false);

  const enrolledEducations: Education[] = gameState.educations || [];
  const completedEducations: Education[] = enrolledEducations.filter(edu => edu.completed);
  const activeEducations: Education[] = enrolledEducations.filter(edu => !edu.completed);
  const cash = gameState.stats?.money || 0;

  // Check for pending campus events when gameState changes
  useEffect(() => {
    if (gameState.pendingCampusEventEducationId && educationSystem) {
      const event = educationSystem.getRandomCampusEvent();
      setCampusEvent(event);
      setCampusEventEducationId(gameState.pendingCampusEventEducationId);
      setShowCampusEventModal(true);
      // Clear the pending flag
      setGameState(prev => {
        const { pendingCampusEventEducationId, ...rest } = prev;
        return rest as typeof prev;
      });
    }
  }, [gameState.pendingCampusEventEducationId]);

  const handlePauseToggle = useCallback((education: Education) => {
    const updatedEducations = enrolledEducations.map(edu => {
      if (edu.id === education.id) {
        return {
          ...edu,
          paused: !edu.paused,
        };
      }
      return edu;
    });

    setGameState(prev => ({
      ...prev,
      educations: updatedEducations,
    }));
    saveGame();

    Alert.alert(
      education.paused ? 'Resumed' : 'Paused',
      `${education.name} has been ${education.paused ? 'resumed' : 'paused'}. ${education.paused ? 'Stats will now drain again.' : 'Stats will not drain while paused.'}`
    );
  }, [enrolledEducations, setGameState, saveGame]);

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

    let loanData: Education['studentLoan'] | undefined;
    let enrollCost = adjusted.cost;

    if (useLoanForEnroll && educationSystem && adjusted.cost > 0) {
      const loanOffer = educationSystem.calculateStudentLoan(adjusted.cost);
      loanData = {
        amount: loanOffer.amount,
        weeklyPayment: loanOffer.weeklyPayment,
        remaining: loanOffer.amount,
      };
      enrollCost = 0; // Loan covers everything
    } else if (cash < adjusted.cost) {
      Alert.alert('Insufficient Funds', `You need $${adjusted.cost.toLocaleString()} to enroll in ${education.name}. Consider using a student loan.`);
      return;
    }

    const newEducation: Education = {
      ...education,
      weeksRemaining: adjusted.duration,
      enrolledClasses: [],
      examsPassed: 0,
      examsFailed: 0,
      gpa: 0,
      studyGroupActive: false,
      studentLoan: loanData,
      semesterNumber: 1,
      lastExamWeek: gameState.weeksLived,
      lastCampusEventWeek: gameState.weeksLived,
    };

    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: cash - enrollCost },
      educations: [...enrolledEducations, newEducation],
    }));
    saveGame();

    const loanMsg = loanData ? `\nStudent loan: $${loanData.weeklyPayment}/week` : '';
    Alert.alert('Enrolled!', `You are now enrolled in ${education.name}.${loanMsg}\n\nChoose your classes from the Enrolled tab!`);
    setShowEnrollModal(false);
    setUseLoanForEnroll(false);
    setActiveTab('enrolled');
  }, [selectedEducation, cash, enrolledEducations, setGameState, saveGame, getAdjustedEducation, useLoanForEnroll, gameState.weeksLived]);

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
    const studyGroupBonus = education.studyGroupActive && educationSystem ? educationSystem.STUDY_GROUP_BENEFITS.extraProgress : 0;
    const weeksToReduce = 1 + (weeksReduction > 0 ? 1 : 0) + studyGroupBonus;
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
      const gpaText = education.gpa ? ` Final GPA: ${education.gpa.toFixed(2)}` : '';
      Alert.alert('Education Completed!', `Congratulations! You have completed ${education.name}!${gpaText}`);
    } else {
      const bonusText = studyGroupBonus > 0 ? ' (+1 study group bonus)' : '';
      Alert.alert('Studied!', `You made progress in ${education.name}. ${newWeeksRemaining} weeks remaining.${bonusText}`);
    }
  }, [enrolledEducations, gameState.stats.energy, gameState.stats.happiness, setGameState, saveGame, educationEffects]);

  const handleToggleStudyGroup = useCallback((education: Education) => {
    const updatedEducations = enrolledEducations.map(edu => {
      if (edu.id === education.id) {
        return {
          ...edu,
          studyGroupActive: !edu.studyGroupActive,
        };
      }
      return edu;
    });

    setGameState(prev => ({
      ...prev,
      educations: updatedEducations,
    }));
    saveGame();

    const joining = !education.studyGroupActive;
    Alert.alert(
      joining ? 'Joined Study Group!' : 'Left Study Group',
      joining
        ? 'Benefits: +15% exam bonus, +1 study progress, +2 weekly happiness.\nCost: -3 energy/week.'
        : 'You left the study group.'
    );
  }, [enrolledEducations, setGameState, saveGame]);

  const handleOpenClassPicker = useCallback((education: Education) => {
    if (!educationSystem) return;
    const alreadyTaken = (education.enrolledClasses || []).map(c => c.id);
    const classes = educationSystem.getAvailableClasses(education.id, alreadyTaken);
    if (classes.length === 0) {
      Alert.alert('No More Classes', 'You have taken all available classes for this program.');
      return;
    }
    setAvailableClasses(classes);
    setClassPickerEducation(education);
    setShowClassPickerModal(true);
  }, []);

  const handleSelectClass = useCallback((classTemplate: any) => {
    if (!classPickerEducation) return;

    const newClass: EducationClass = {
      id: classTemplate.id,
      name: classTemplate.name,
      category: classTemplate.category,
      statBonuses: classTemplate.statBonuses,
      difficulty: classTemplate.difficulty,
      completed: false,
    };

    const updatedEducations = enrolledEducations.map(edu => {
      if (edu.id === classPickerEducation.id) {
        return {
          ...edu,
          enrolledClasses: [...(edu.enrolledClasses || []), newClass],
        };
      }
      return edu;
    });

    setGameState(prev => ({
      ...prev,
      educations: updatedEducations,
    }));
    saveGame();
    setShowClassPickerModal(false);
    Alert.alert('Class Added!', `Enrolled in ${classTemplate.name}.\n${classTemplate.description}`);
  }, [classPickerEducation, enrolledEducations, setGameState, saveGame]);

  const handleCampusEventChoice = useCallback((choiceIndex: number) => {
    if (!campusEvent || campusEventEducationId == null) return;
    const choice = campusEvent.choices[choiceIndex];
    const effects = choice.effects;

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        happiness: Math.max(0, Math.min(100, prev.stats.happiness + (effects.happiness || 0))),
        health: Math.max(0, Math.min(100, prev.stats.health + (effects.health || 0))),
        energy: Math.max(0, Math.min(100, prev.stats.energy + (effects.energy || 0))),
        reputation: Math.max(0, Math.min(100, prev.stats.reputation + (effects.reputation || 0))),
        money: prev.stats.money + (effects.money || 0),
      },
    }));
    saveGame();

    setShowCampusEventModal(false);
    Alert.alert(campusEvent.title, choice.resultText);
  }, [campusEvent, campusEventEducationId, setGameState, saveGame]);

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
    const careerRequirements: Record<string, string> = {
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
    return careerRequirements[educationId] || '';
  };

  const getGPAColor = (gpa: number) => {
    if (gpa >= 3.5) return '#10B981';
    if (gpa >= 3.0) return '#3B82F6';
    if (gpa >= 2.0) return '#F59E0B';
    return '#EF4444';
  };

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty === 1) return 'Easy';
    if (difficulty === 2) return 'Medium';
    return 'Hard';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty === 1) return '#10B981';
    if (difficulty === 2) return '#F59E0B';
    return '#EF4444';
  };

  const loanOffer = useMemo(() => {
    if (!selectedEducation || !educationSystem) return null;
    const adjusted = getAdjustedEducation(selectedEducation);
    if (adjusted.cost <= 0) return null;
    return educationSystem.calculateStudentLoan(adjusted.cost);
  }, [selectedEducation, getAdjustedEducation]);

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
                          setUseLoanForEnroll(false);
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
                const isPaused = education.paused || false;
                const hasStudyGroup = education.studyGroupActive || false;
                const gpa = education.gpa || 0;
                const examsPassed = education.examsPassed || 0;
                const examsFailed = education.examsFailed || 0;
                const enrolledClasses = education.enrolledClasses || [];
                const hasLoan = education.studentLoan && education.studentLoan.remaining > 0;

                return (
                  <View key={education.id} style={[styles.educationCard, isPaused && styles.pausedCard]}>
                    <View style={styles.educationHeader}>
                      <View style={styles.educationInfo}>
                        <View style={styles.educationTitleRow}>
                          <Text style={styles.educationName}>{education.name}</Text>
                          {isPaused && (
                            <View style={styles.pausedBadge}>
                              <Pause size={12} color="#FFFFFF" />
                              <Text style={styles.pausedText}>Paused</Text>
                            </View>
                          )}
                        </View>
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
                          { width: `${progress}%`, backgroundColor: progressColor, opacity: isPaused ? 0.5 : 1 }
                        ]}
                      />
                    </View>

                    {/* GPA & Exam Stats Row */}
                    {(gpa > 0 || examsPassed > 0 || examsFailed > 0) && (
                      <View style={styles.statsRow}>
                        <View style={styles.statChip}>
                          <Award size={14} color={getGPAColor(gpa)} />
                          <Text style={[styles.statChipText, { color: getGPAColor(gpa) }]}>
                            GPA: {gpa.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.statChip}>
                          <CheckCircle size={14} color="#10B981" />
                          <Text style={styles.statChipText}>{examsPassed} passed</Text>
                        </View>
                        {examsFailed > 0 && (
                          <View style={styles.statChip}>
                            <AlertTriangle size={14} color="#EF4444" />
                            <Text style={[styles.statChipText, { color: '#EF4444' }]}>{examsFailed} failed</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Enrolled Classes */}
                    {enrolledClasses.length > 0 && (
                      <View style={styles.classesSection}>
                        <Text style={styles.classesSectionTitle}>Classes</Text>
                        <View style={styles.classChips}>
                          {enrolledClasses.map(cls => (
                            <View key={cls.id} style={[styles.classChip, cls.completed && styles.classChipCompleted]}>
                              <Text style={styles.classChipText}>{cls.name}</Text>
                              <View style={[styles.difficultyDot, { backgroundColor: getDifficultyColor(cls.difficulty) }]} />
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Student Loan Info */}
                    {hasLoan && (
                      <View style={styles.loanInfo}>
                        <DollarSign size={14} color="#F59E0B" />
                        <Text style={styles.loanInfoText}>
                          Loan: ${education.studentLoan!.remaining.toLocaleString()} remaining (${education.studentLoan!.weeklyPayment}/week)
                        </Text>
                      </View>
                    )}

                    {/* Study Group Status */}
                    <View style={styles.studyGroupRow}>
                      <TouchableOpacity
                        style={[styles.studyGroupButton, hasStudyGroup && styles.studyGroupButtonActive]}
                        onPress={() => handleToggleStudyGroup(education)}
                        disabled={isPaused}
                      >
                        <Users size={16} color={hasStudyGroup ? '#FFFFFF' : '#9FA4B3'} />
                        <Text style={[styles.studyGroupButtonText, hasStudyGroup && styles.studyGroupButtonTextActive]}>
                          {hasStudyGroup ? 'In Study Group' : 'Join Study Group'}
                        </Text>
                      </TouchableOpacity>
                      {educationSystem && (
                        <TouchableOpacity
                          style={[styles.addClassButton, isPaused && styles.addClassButtonDisabled]}
                          onPress={() => handleOpenClassPicker(education)}
                          disabled={isPaused}
                        >
                          <BookOpen size={16} color={isPaused ? '#4B5563' : '#3B82F6'} />
                          <Text style={[styles.addClassButtonText, isPaused && styles.addClassButtonTextDisabled]}>
                            + Class
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.educationActionsRow}>
                      <TouchableOpacity
                        style={[styles.pauseButton, isPaused && styles.resumeButton]}
                        onPress={() => handlePauseToggle(education)}
                      >
                        {isPaused ? (
                          <>
                            <Play size={16} color="#FFFFFF" />
                            <Text style={styles.pauseButtonText}>Resume</Text>
                          </>
                        ) : (
                          <>
                            <Pause size={16} color="#FFFFFF" />
                            <Text style={styles.pauseButtonText}>Pause</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.studyButton, isPaused && styles.studyButtonDisabled]}
                        onPress={() => handleStudy(education)}
                        disabled={isPaused}
                      >
                        <Text style={[styles.studyButtonText, isPaused && styles.studyButtonTextDisabled]}>
                          Study (20 Energy)
                        </Text>
                      </TouchableOpacity>
                    </View>
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
              completedEducations.map((education) => {
                const gpa = education.gpa || 0;
                const examsPassed = education.examsPassed || 0;
                const enrolledClasses = education.enrolledClasses || [];

                return (
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
                    {/* Show final GPA and classes for completed educations */}
                    {(gpa > 0 || examsPassed > 0) && (
                      <View style={styles.statsRow}>
                        <View style={styles.statChip}>
                          <Award size={14} color={getGPAColor(gpa)} />
                          <Text style={[styles.statChipText, { color: getGPAColor(gpa) }]}>
                            Final GPA: {gpa.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.statChip}>
                          <CheckCircle size={14} color="#10B981" />
                          <Text style={styles.statChipText}>{examsPassed} exams passed</Text>
                        </View>
                      </View>
                    )}
                    {enrolledClasses.length > 0 && (
                      <View style={styles.classesSection}>
                        <Text style={styles.classesSectionTitle}>Classes Taken</Text>
                        <View style={styles.classChips}>
                          {enrolledClasses.map(cls => (
                            <View key={cls.id} style={[styles.classChip, styles.classChipCompleted]}>
                              <Text style={styles.classChipText}>{cls.name}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
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

                {/* Student Loan Option */}
                {loanOffer && (
                  <View style={styles.loanSection}>
                    <Text style={styles.loanSectionTitle}>Student Loan</Text>
                    <TouchableOpacity
                      style={[styles.loanToggle, useLoanForEnroll && styles.loanToggleActive]}
                      onPress={() => setUseLoanForEnroll(!useLoanForEnroll)}
                    >
                      <View style={[styles.loanToggleCheckbox, useLoanForEnroll && styles.loanToggleCheckboxActive]}>
                        {useLoanForEnroll && <CheckCircle size={14} color="#FFFFFF" />}
                      </View>
                      <View style={styles.loanToggleInfo}>
                        <Text style={styles.loanToggleLabel}>
                          Use student loan ({(loanOffer.interestRate * 100).toFixed(1)}% APR)
                        </Text>
                        <Text style={styles.loanToggleDetail}>
                          ${loanOffer.weeklyPayment}/week for {Math.round(loanOffer.termWeeks / WEEKS_PER_YEAR)} years
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {useLoanForEnroll && (
                      <Text style={styles.loanWarning}>
                        Total repayment: ${(loanOffer.weeklyPayment * loanOffer.termWeeks).toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => { setShowEnrollModal(false); setUseLoanForEnroll(false); }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => selectedEducation && handleEnroll(selectedEducation)}
              >
                <Text style={styles.modalButtonText}>
                  {useLoanForEnroll ? 'Enroll with Loan' : 'Enroll'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Class Picker Modal */}
      <Modal visible={showClassPickerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a Class</Text>
            <Text style={styles.modalSubtitle}>
              {classPickerEducation?.name} — Semester {classPickerEducation?.semesterNumber || 1}
            </Text>

            <ScrollView style={styles.classPickerList} showsVerticalScrollIndicator={false}>
              {availableClasses.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={styles.classPickerCard}
                  onPress={() => handleSelectClass(cls)}
                >
                  <View style={styles.classPickerHeader}>
                    <Text style={styles.classPickerName}>{cls.name}</Text>
                    <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(cls.difficulty) + '30' }]}>
                      <Text style={[styles.difficultyBadgeText, { color: getDifficultyColor(cls.difficulty) }]}>
                        {getDifficultyLabel(cls.difficulty)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.classPickerDesc}>{cls.description}</Text>
                  <View style={styles.classPickerBonuses}>
                    {Object.entries(cls.statBonuses).map(([stat, value]) => (
                      <View key={stat} style={styles.bonusChip}>
                        <Text style={styles.bonusChipText}>+{value as number} {stat}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.classPickerCategory}>{cls.category.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 12 }]}
              onPress={() => setShowClassPickerModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Campus Event Modal */}
      <Modal visible={showCampusEventModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.campusEventHeader}>
              <Star size={24} color="#F59E0B" />
              <Text style={styles.modalTitle}>Campus Event</Text>
            </View>

            {campusEvent && (
              <View style={styles.modalContent}>
                <Text style={styles.campusEventTitle}>{campusEvent.title}</Text>
                <Text style={styles.campusEventDesc}>{campusEvent.description}</Text>

                <View style={styles.campusEventChoices}>
                  {campusEvent.choices.map((choice: any, index: number) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.campusEventChoiceButton}
                      onPress={() => handleCampusEventChoice(index)}
                    >
                      <Text style={styles.campusEventChoiceText}>{choice.label}</Text>
                      <View style={styles.campusEventEffects}>
                        {Object.entries(choice.effects).map(([stat, value]) => {
                          const numValue = value as number;
                          if (numValue === 0) return null;
                          return (
                            <Text
                              key={stat}
                              style={[styles.campusEventEffectText, { color: numValue > 0 ? '#10B981' : '#EF4444' }]}
                            >
                              {numValue > 0 ? '+' : ''}{numValue} {stat}
                            </Text>
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(EducationApp);

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
  educationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pausedCard: {
    opacity: 0.7,
    borderColor: '#F59E0B',
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pausedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  educationActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resumeButton: {
    backgroundColor: '#10B981',
  },
  pauseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  studyButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  studyButtonDisabled: {
    backgroundColor: '#4B5563',
    opacity: 0.5,
  },
  studyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  studyButtonTextDisabled: {
    color: '#9CA3AF',
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
  // ─── Stats Row (GPA, Exams) ─────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A1D29',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statChipText: {
    color: '#9FA4B3',
    fontSize: 12,
    fontWeight: '600',
  },
  // ─── Classes Section ────────────────────────────────
  classesSection: {
    marginBottom: 10,
  },
  classesSectionTitle: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  classChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  classChipCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#10B98115',
  },
  classChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // ─── Student Loan Info ──────────────────────────────
  loanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  loanInfoText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  // ─── Study Group Button ─────────────────────────────
  studyGroupRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  studyGroupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1A1D29',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  studyGroupButtonActive: {
    backgroundColor: '#7C3AED20',
    borderColor: '#7C3AED',
  },
  studyGroupButtonText: {
    color: '#9FA4B3',
    fontSize: 13,
    fontWeight: '600',
  },
  studyGroupButtonTextActive: {
    color: '#A78BFA',
  },
  addClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A1D29',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  addClassButtonDisabled: {
    borderColor: '#4B5563',
    opacity: 0.5,
  },
  addClassButtonText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '700',
  },
  addClassButtonTextDisabled: {
    color: '#4B5563',
  },
  // ─── Modals ─────────────────────────────────────────
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
    maxHeight: '80%',
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
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#9FA4B3',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
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
  modalButtonCancel: {
    backgroundColor: '#374151',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  // ─── Loan Section in Enroll Modal ───────────────────
  loanSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#23283B',
  },
  loanSectionTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  loanToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1D29',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  loanToggleActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B10',
  },
  loanToggleCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanToggleCheckboxActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B',
  },
  loanToggleInfo: {
    flex: 1,
  },
  loanToggleLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loanToggleDetail: {
    color: '#9FA4B3',
    fontSize: 12,
    marginTop: 2,
  },
  loanWarning: {
    color: '#F59E0B',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // ─── Class Picker Modal ─────────────────────────────
  classPickerList: {
    maxHeight: 350,
  },
  classPickerCard: {
    backgroundColor: '#1A1D29',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  classPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  classPickerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  classPickerDesc: {
    color: '#9FA4B3',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  classPickerBonuses: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  bonusChip: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bonusChipText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  classPickerCategory: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // ─── Campus Event Modal ─────────────────────────────
  campusEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  campusEventTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  campusEventDesc: {
    color: '#9FA4B3',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  campusEventChoices: {
    gap: 10,
  },
  campusEventChoiceButton: {
    backgroundColor: '#1A1D29',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  campusEventChoiceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  campusEventEffects: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  campusEventEffectText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
