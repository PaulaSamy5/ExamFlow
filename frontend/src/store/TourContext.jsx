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
  },
  // Tracks the in-progress step so a page refresh mid-tour resumes in place
  // instead of restarting from Welcome.
  getStep: (userId) => {
    const raw = localStorage.getItem(`examflow_onboarding_step_${userId}`);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  },
  setStep: (userId, index) => {
    localStorage.setItem(`examflow_onboarding_step_${userId}`, String(index));
  },
  clearStep: (userId) => {
    localStorage.removeItem(`examflow_onboarding_step_${userId}`);
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
    description: "Please choose whether your exam is Online (taken in student portal) or Printable (PDF download).",
    route: "/exams/new",
    selector: ".tour-exam-types",
    canAdvance: () => !!document.querySelector('[data-tour-exam-type-selected]'),
    blockedHelperText: "Please choose an exam delivery mode to continue."
  },
  {
    stepIndex: 4,
    title: "Exam Title 📝",
    description: "Give your exam a clear title — students will see this when joining. Type it in the field below to continue.",
    route: "/exams/new",
    selector: ".tour-exam-title",
    canAdvance: () => !!document.querySelector('[data-tour-title-filled]'),
    blockedHelperText: "Please type an exam title to continue."
  },
  {
    stepIndex: 5,
    title: "Description (Optional) 💬",
    description: "You can specify allowed materials, general guidelines, or extra rules. You can type them here, or click 'Skip' to proceed without one.",
    route: "/exams/new",
    selector: ".tour-exam-description",
    isOptional: true,
    checkOptionalFilled: () => !!document.querySelector('.tour-exam-description textarea')?.value?.trim()
  },
  {
    stepIndex: 6,
    title: "Grading & Results 🏆",
    description: "Configure when grades are released. Select 'Immediate', 'After Deadline', or 'Manual Review' to continue.",
    route: "/exams/new",
    selector: ".tour-grading-results",
    canAdvance: () => !!document.querySelector('[data-tour-result-visibility-selected]'),
    blockedHelperText: "Please select a result release mode to continue."
  },
  {
    stepIndex: 7,
    title: "Start Date & Time 📅",
    description: "Your exam already has a default start time. You can keep it as is, or click the date/time selector to modify it.",
    route: "/exams/new",
    selector: ".tour-start-timing"
  },
  {
    stepIndex: 8,
    title: "End Date & Time ⏰",
    description: "Choose when the exam will end. An end date and time are required to proceed.",
    route: "/exams/new",
    selector: ".tour-end-timing",
    canAdvance: () => !!document.querySelector('[data-tour-end-time-ready]'),
    blockedHelperText: "Please select an end date and time to continue."
  },
  {
    stepIndex: 9,
    title: "Exam Duration ⏳",
    description: "Specify the length of the exam in minutes. This ensures that students are automatically submitted when their individual timer expires.",
    route: "/exams/new",
    selector: ".tour-duration",
    canAdvance: () => {
      const val = parseFloat(document.querySelector('.tour-duration input')?.value);
      return !isNaN(val) && val > 0;
    },
    blockedHelperText: "Please enter a valid exam duration (in minutes) to continue."
  },
  {
    stepIndex: 10,
    title: "Go to Construction 🏗️",
    description: "Great — your exam settings are ready! Now click 'Go to Construction' to start adding questions.",
    route: "/exams/new",
    selector: ".tour-publish-btn",
    requiresAction: true,
    actionType: "click"
  },
  {
    stepIndex: 11,
    title: "Question Builder 🎨",
    description: "Build diverse questions (MCQs, Fill-in-the-blanks, Coding sandboxes, or UML diagrams) and allocate points per section. Please add at least one question to proceed!",
    route: "/exams/new",
    selector: ".tour-question-builder",
    allowScroll: true,
    canAdvance: () => !!document.querySelector('[id^="question-card-"]'),
    blockedHelperText: "Please create at least one question so we can publish your quiz!"
  },
  {
    stepIndex: 12,
    title: "Smart Publishing Validation 🚀",
    description: "When ready, click Broadcast Live. Our validation engine checks all questions and alerts you if any sections require attention.",
    route: "/exams/new",
    selector: ".tour-publish-btn",
    requiresAction: true,
    actionType: "click"
  },
  {
    stepIndex: 13,
    title: "Submissions & Grades 📋",
    description: "Monitor real-time student activity. Access detailed grades, AI semantic feedback, and export analysis.",
    route: "/instructor/dashboard",
    selector: ".tour-dashboard-stats"
  },
  {
    stepIndex: 14,
    title: "Student Join Experience 📲",
    description: "Students can join your live exams instantly by scanning the unique QR Code or entering the Access Code.",
    route: "/instructor/dashboard",
    selector: ".tour-student-join-section"
  },
  {
    stepIndex: 15,
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
        const savedStep = OnboardingStorage.getStep(user.id);
        if (savedStep !== null && savedStep > 0 && savedStep < TOUR_STEPS.length) {
          // Resume exactly where the tour left off (e.g. after a page refresh)
          // instead of restarting from Welcome — no forced navigation, since
          // a refresh reloads at the same URL the user was already on.
          setCurrentStepIndex(savedStep);
          setIsActive(true);
        } else {
          // Start tour automatically for first-time instructors
          setTimeout(() => {
            startTour();
          }, 1200); // Small delay to let initial dashboard load render
        }
      }
    } else {
      setIsActive(false);
    }
  }, [user]);

  // Persist the in-progress step so a page refresh can resume in place.
  useEffect(() => {
    if (isActive && user) {
      OnboardingStorage.setStep(user.id, currentStepIndex);
    }
  }, [isActive, currentStepIndex, user]);

  // Synchronize route whenever the step OR the current pathname changes.
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step?.route) return;
    if (step.requiresAction) return;          // let the button's own <Link> navigate
    
    console.log(`[TourRouteSync] Checking route. Path: ${location.pathname}, Expected: ${step.route}, StepIndex: ${currentStepIndex}`);
    if (location.pathname !== step.route) {
      console.log(`[TourRouteSync] Redirecting to ${step.route} from ${location.pathname} for step ${currentStepIndex + 1}`);
      navigate(step.route, { replace: true });
    }
  }, [currentStepIndex, isActive, location.pathname]);

  // If the user navigates away (e.g. browser back/forward or page links),
  // synchronize the tour step index to the new route.
  useEffect(() => {
    if (!isActive) return;
    const currentStep = TOUR_STEPS[currentStepIndex];
    if (!currentStep) return;

    console.log(`[TourNavSync] Checking manual navigation. Path: ${location.pathname}, CurrentStepRoute: ${currentStep.route}`);
    if (location.pathname !== currentStep.route) {
      const matchingIndex = TOUR_STEPS.findIndex(s => s.route === location.pathname);
      console.log(`[TourNavSync] Path changed to ${location.pathname}. Matching step index: ${matchingIndex}`);
      if (matchingIndex !== -1) {
        setCurrentStepIndex(matchingIndex);
      }
    }
  }, [isActive, location.pathname]);

  const startTour = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
    if (user) OnboardingStorage.clearStep(user.id); // fresh start, not a resume
    if (location.pathname !== "/instructor/dashboard") {
      navigate("/instructor/dashboard");
    }
  };

  const nextStep = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      // Fire any beforeEnter hook on the incoming step before updating the index
      const nextStepDef = TOUR_STEPS[nextIndex];
      if (typeof nextStepDef?.beforeEnter === 'function') {
        nextStepDef.beforeEnter();
      }
      setCurrentStepIndex(nextIndex);
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
      OnboardingStorage.clearStep(user.id);
    }
  };

  const completeTour = () => {
    setIsActive(false);
    if (user) {
      OnboardingStorage.setCompleted(user.id, true);
      OnboardingStorage.clearStep(user.id);
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
