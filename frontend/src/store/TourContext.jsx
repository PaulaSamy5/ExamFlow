import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const TourContext = createContext();

// Abstracted storage helper to allow easy migration to database if required
const OnboardingStorage = {
  getCompleted: (userId) => {
    return localStorage.getItem(`examflow_onboarding_completed_${userId}`) === 'true';
  },
  setCompleted: (userId, val) => {
    localStorage.setItem(`examflow_onboarding_completed_${userId}`, val ? 'true' : 'false');
  }
};

const TOUR_STEPS = [
  {
    stepIndex: 0,
    title: "Welcome to ExamFlow 👋",
    description: "Let's take a quick 2-minute tour to help you get started with creating and managing exams.",
    route: "/instructor/dashboard",
    selector: null // Center of screen
  },
  {
    stepIndex: 1,
    title: "Dashboard Overview 📊",
    description: "This is your main command center. Here you can view your total exams, check quick stats, and manage active tests.",
    route: "/instructor/dashboard",
    selector: ".tour-dashboard-header",
    blockSelectors: [".tour-create-exam-btn"]
  },
  {
    stepIndex: 2,
    title: "Create Your First Exam 🏗️",
    description: "Click the 'Create Exam' button to launch the exam constructor.",
    route: "/instructor/dashboard",
    selector: ".tour-create-exam-btn",
    requiresAction: true,
    actionType: "click"
  },
  {
    stepIndex: 3,
    title: "Choose Exam Type 📝",
    description: "Configure whether your exam is Online (taken inside the student portal with automated grading) or Printable (PDF output for traditional paper exams).",
    route: "/exams/new",
    selector: ".tour-exam-types"
  },
  {
    stepIndex: 4,
    title: "Start Date & Time 📅",
    description: "Your exam already has a default start time. You can keep it or choose a different one.",
    route: "/exams/new",
    selector: ".tour-start-timing"
  },
  {
    stepIndex: 5,
    title: "End Date & Time ⏰",
    description: "Now choose when the exam will end. An end date and time are required before publishing.",
    route: "/exams/new",
    selector: ".tour-end-timing",
    canAdvance: () => !!document.querySelector('[data-tour-end-time-ready]'),
    blockedHelperText: "Please select an end date and time to continue."
  },
  {
    stepIndex: 6,
    title: "Question Builder 🎨",
    description: "Build diverse questions (MCQs, Fill-in-the-blanks, Coding sandboxes, or UML diagrams) and allocate points per section.",
    route: "/exams/new",
    selector: ".tour-question-builder",
    action: (setStep) => {
      // Optional callback to trigger Construction phase step in CreateExam
    }
  },
  {
    stepIndex: 7,
    title: "Smart Publishing Validation 🚀",
    description: "When ready, click Broadcast Live. Our validation engine checks all questions and alerts you if any sections require attention.",
    route: "/exams/new",
    selector: ".tour-publish-btn"
  },
  {
    stepIndex: 8,
    title: "Submissions & Grades 📋",
    description: "Monitor real-time student activity. Access detailed grades, AI semantic feedback, and export analysis.",
    route: "/instructor/dashboard",
    selector: ".tour-dashboard-stats"
  },
  {
    stepIndex: 9,
    title: "Student Join Experience 📲",
    description: "Students can join your live exams instantly by scanning the unique QR Code or entering the Access Code.",
    route: "/instructor/dashboard",
    selector: ".tour-student-join-section"
  },
  {
    stepIndex: 10,
    title: "You're All Set! 🎉",
    description: "You're ready to run seamless evaluations. Welcome to next-gen academic testing!",
    route: "/instructor/dashboard",
    selector: null // Center of screen
  }
];

export const TourProvider = ({ children }) => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if onboarding needs to be shown on login
  useEffect(() => {
    if (user && user.role === 'INSTRUCTOR') {
      const completed = OnboardingStorage.getCompleted(user.id);
      if (!completed) {
        // Start tour automatically for first-time instructors
        setTimeout(() => {
          startTour();
        }, 1200); // Small delay to let initial dashboard load render
      }
    } else {
      setIsActive(false);
    }
  }, [user]);

  // Synchronize route if step changes and requires a route switch
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (step && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [currentStepIndex, isActive]);

  const startTour = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
    if (location.pathname !== "/instructor/dashboard") {
      navigate("/instructor/dashboard");
    }
  };

  const nextStep = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const skipTour = () => {
    setIsActive(false);
    if (user) {
      OnboardingStorage.setCompleted(user.id, true);
    }
  };

  const completeTour = () => {
    setIsActive(false);
    if (user) {
      OnboardingStorage.setCompleted(user.id, true);
    }
  };

  const replayTour = () => {
    if (user) {
      OnboardingStorage.setCompleted(user.id, false);
      startTour();
    }
  };

  const currentStep = TOUR_STEPS[currentStepIndex];

  return (
    <TourContext.Provider value={{
      isActive,
      currentStep,
      currentStepIndex,
      totalSteps: TOUR_STEPS.length,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      replayTour,
      startTour,
      setCurrentStepIndex
    }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);
